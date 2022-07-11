/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { 
  Tldraw, 
  TldrawApp, 
  TldrawProps, 
  useFileSystem, 
  TDShapeType, 
  TDFile,
  Patch,
  TDShape,
  PagePartial,
  TDPage
} from '@tldraw/tldraw'

//import { useUploadAssets } from 'hooks/useUploadAssets'
import React from 'react'
import * as gtag from 'utils/gtag'
import axios from 'axios'
import { Simulation, SimulationNodeDatum } from 'd3'
import {throttle} from 'underscore'
import AsyncLock from 'async-lock'
import { 
  saveToProcessing, 
  getIconImageURLNoTime, 
  getIconImageURL,
  updateVersions, 
  updateThumbnail,
  updateCurrentVersion,
  loadFileFromProcessing,
  useUploadAssets,
  getCurrentProject
} from 'utils/quickPoseNetworking'

import { 
  EditorProps,
  dataNode,
  dataLink,
  inputShape,
  inputVersionNodeShape,
  forceLink
 } from 'utils/quickPoseTypes'

 import {
   d3Sim,
   defaultSticky,
   graphBaseData,
   linkRegex,
  nodeRegex,
  tldrawCoordstod3,
  updateGraphData,
  updateLinkShapes,
  updateNodeShapes
 } from 'utils/quickposeDrawing'
import { dateTimestampInSeconds, timestampInSeconds } from '@sentry/utils'

//declare const window: Window & { app: TldrawApp }


const D3_RADIUS = 5;
export const D3_LINK_DISTANCE = 4
export const TL_DRAW_RADIUS = 30;
export const ALPHA_TARGET_REFRESH = .1
const LOCALHOST_BASE = 'http://127.0.0.1:8080';
const DOUBLE_CLICK_TIME = 500
export const d3TlScale = 5

const Editor = ({
  id = 'home',
  isUser = false,
  isSponsor = false,
  ...rest
}: EditorProps & Partial<TldrawProps>) => {
  const rTldrawApp = React.useRef<TldrawApp>()

  //selection/dragging
  const rIsDragging = React.useRef(false)
  const selectedNode = React.useRef<string>(null)
  const lastSelection = React.useRef<string>(null)
  const currentVersion = React.useRef<string>(null)
  const timeSinceLastSelection = React.useRef<number>(0)
  const timeSinceLastFork = React.useRef<number>(0);
  const centerPoint = React.useRef<[number,number]>([600,600])
  //file loading
  const loadFile = React.useRef<TDFile>(null)
  const loadedFile = React.useRef<boolean>(false)
  const loadedData = React.useRef<boolean>(false)
  const currentProject = React.useRef<string>(null)

  //d3 sim
  const simulation = React.useRef<d3.Simulation<SimulationNodeDatum, undefined>>()

  
  //data structs
  const netData = React.useRef<any>()
  const newData = React.useRef<boolean>(false)
  const graphData = React.useRef<any>()
  graphData.current = graphBaseData
  const loadingTicks = React.useRef<number>(0); //Counter for sticky loading dots
  
  const abortCurrentVersionController = new AbortController()
  const abortFileController = new AbortController()
  const abortVersionsController = new AbortController()
  const timeout = 500
  const lock = new AsyncLock;

  function refreshSim(simulation){
    if(simulation.current !== undefined){
      //simulation.current.alpha(ALPHA_TARGET_REFRESH)
      simulation.current.restart()
    }
  }
  const sendFork = (id: string,currentVersion: { current: string; }) => throttle(sendForkThrottled(id,currentVersion),2000)

  const sendForkThrottled = async (id: string,currentVersion: { current: string; }) => {
    const start = timestampInSeconds()
    const app = rTldrawApp.current!
    if(app !== undefined){
      app.appState.isLoading = true
      console.log("send fork",id)
      lock.acquire("select", async function() {
        await axios.get(LOCALHOST_BASE + '/fork/' + id, {
          timeout: 600,
        })
        .then(response => {
          if(response.status === 200){
            newData.current = true;
            netData.current = response.data
            dataInterval(newData,netData,graphData,simulation)
            drawInterval()
            app.appState.isLoading = false;
            const maxId = Math.max(...(graphData.current.nodes as dataNode[]).map(n => parseInt(n.id)))
            console.log(maxId)
            if(app.getShapes().map(n => n.id).includes('node'+maxId)){
              app.zoomTo(app.zoom,app.getShape('node'+maxId).point)
              //app.select('node'+maxId)
            }
            
          }
        })
        .catch(error => {
          //console.warn("error fetching current version: ", error);
          return null
        })
      }).then(function(){
        app.appState.isLoading = false
      })
      .catch(error => {
        //console.warn("error fetching current version: ", error);
        return null
      })
    }
}
const sendSelect = (id: string,currentVersion: { current: string; }) => throttle(sendSelectThrottled(id,currentVersion),100)

const sendSelectThrottled = async (id: string,currentVersion: { current: string; }) => {
  const app = rTldrawApp.current!
  if(app !== undefined){
    app.appState.isLoading = true
    console.log("send select",id)
    lock.acquire("select", async function() {
      await axios.get(LOCALHOST_BASE + '/select/' + id, {
        timeout: 600,
        //signal: abortCurrentVersionController.signal
      })
      .then(function(response) {
        if(response.status === 200){
          currentVersion.current = response.data.toString()

          console.log(currentVersion.current.toString())
          const v = 'node'+currentVersion.current
          console.log(v)
          //app.pageState.selectedIds = ['node'+currentVersion]
          drawInterval()
        }
      })
      .catch(error => {
        //console.warn("error fetching current version: ", error);
        return null
      })
    }).then(function(){
      app.appState.isLoading = false
    })
  }
}

 function drawInterval(){
  console.timeStamp("startDraw")

  const sim = simulation.current!
  const app = rTldrawApp.current!
  const gData = graphData.current!
    if(sim !== undefined && gData !== undefined && 
      //simulation.current.alpha > simulation.current.alphaMin && //Doesn't work when there's only one node
      loadedFile.current === true && !(app === undefined)){
        const currentStyle = app.getAppState().currentStyle
        //console.log('drawInterval3')
        gData.nodes = [...sim.nodes()] //get simulation data out
        let tlNodes = app.getShapes().filter((shape) => nodeRegex.test(shape.id))
        
        
      //console.log('drawInterval2')
      console.timeStamp("preanimframe")
      requestAnimationFrame(() => {
        const [nextNodeShapes,createNodeShapes] =  updateNodeShapes(
          gData,
          tlNodes,
          currentVersion,
          centerPoint.current,
          app.selectedIds
        )
        const tlLinks = app.getShapes().filter((shape) => linkRegex.test(shape.id))
        tlNodes = app.getShapes().filter((shape) => nodeRegex.test(shape.id))
        const [nextLinkShapes, nextLinkBindings, createLinkShapes] = updateLinkShapes(app, tlLinks, graphData, tlNodes)
        
        //const createShapes = {...createLinkShapes,...createNodeShapes as TDShape[]} as TDShape[]
        //const selection = app.selectedIds
        if (createNodeShapes.length > 0) {
          console.log("new shapes",createNodeShapes)
          app.createShapes(...createNodeShapes)
          
        }
        const newIds: string[] = createNodeShapes.map((n) => n.id)
        if (createLinkShapes.length > 0) {
          app.updateShapes(...createLinkShapes)
        }

        //app.pageState.selectedIds = selection //breaks everything
        const nextShapes = {...nextNodeShapes,...nextLinkShapes} as Patch<TDPage['shapes']>
        const nextBindings = {...nextLinkBindings} as Patch<TDPage['bindings']>
        const nextPage: PagePartial = {
          shapes: nextShapes,
          bindings: nextBindings,
        }
        sim.nodes(gData.nodes);
        (sim.force('link') as forceLink).links(gData.links);
        sim.restart();

        // console.timeStamp("sim");
        const currentPageId = app.currentPageId
        const patch = {
          appState: {
            currentStyle:currentStyle
          },
          document: {
            pages: {
              [currentPageId]: {
                ...nextPage
              },
            },
          },
        }
        app.patchState(patch,"Quickpose Draw Update")
        //console.timeStamp("patch");
        if(newIds.includes('node0')){
            app.selectNone()
            sim.tick(2);
            setTimeout(()=>{ 
              app.zoomToFit()
              app.zoomOut()
            },500)
        }
      })
      console.timeStamp("end animframe");
    }
  }
  //check for new data, if so, update graph data
  function dataInterval(
    newData: React.MutableRefObject<boolean>,
    netData: React.MutableRefObject<JSON>,
    graphData: React.MutableRefObject< { nodes: any[]; links: any[]; }>,
    simulation: React.MutableRefObject<Simulation<SimulationNodeDatum, undefined>>)
    {
      //console.log(netData.current,graphData.current,simulation.current)
    //https://medium.com/ninjaconcept/interactive-dynamic-force-directed-graphs-with-d3-da720c6d7811
    if (netData.current && graphData.current && simulation.current) {
      //console.log("datainterval")
      if (updateGraphData(netData.current,graphData.current)) {
        currentVersion.current = netData.current["CurrentNode"].toString()
        simulation.current.nodes(graphData.current.nodes)
        const forceLink = simulation.current.force('link') as forceLink
        forceLink.links(graphData.current.links)
        refreshSim(simulation)
        drawInterval()
        //console.log("update sim data")
      }
    }
    loadingTicks.current++ 
  }

  const networkInterval = () => {
    const app = rTldrawApp.current!
    if (!(app === undefined)) {

      //load/save file
      if (loadedFile.current === false) { //still need to handle opening
        
        if(loadFile.current === null){ //haven't found a file yet, so keep looking
          app.appState.isLoading = true
          console.log('requesting file...')
          updateVersions(netData, newData, abortVersionsController)
          getCurrentProject(currentProject,rTldrawApp)
          loadFileFromProcessing(loadFile,abortFileController)
          currentVersionInterval()
          if (app.getShape('loading')) {
            const loadingDot = '.'
            app.updateShapes({
              id: 'loading',
              text: ' Quickpose is looking for a Processing Session' + loadingDot.repeat(loadingTicks.current % 6),
            })
            loadingTicks.current++
          }
        }else if(loadFile.current === undefined){ //there is no file, we need to start fresh
          loadedFile.current = true
          updateVersions(netData, newData, abortVersionsController)
          getCurrentProject(currentProject,rTldrawApp)
          console.log('no file found!')
          abortFileController.abort()
          if (app.getShape('loading')) {//remove loading sticky
            app.delete(['loading']) 
          } 
          centerPoint.current = app.centerPoint as [number,number];
          simulation.current = d3Sim(centerPoint.current,app.rendererBounds).alpha(3)
          if(netData.current !== undefined && netData.current !== null && netData.current["ProjectName"]){
            currentProject.current = netData.current["ProjectName"]
          }
          console.log(netData.current)
          currentVersionInterval()
          dataInterval(newData,netData,graphData,simulation)
          refreshSim(simulation)
          //simulation.current.alpha(ALPHA_TARGET_REFRESH)
          drawInterval()
          app.zoomToContent()
          app.appState.isLoading = false
          //make new file, do intro experience?
        }else if(loadFile.current !== null){ //we found an existing file
          abortFileController.abort()
          netData.current = null
          graphData.current = null
          app.replacePageContent({},{},{})

          currentVersionInterval()
          //https://stackoverflow.com/questions/18206231/saving-and-reloading-a-force-layout-using-d3-js
          //Load the data
          const loadedData = JSON.parse(loadFile.current.assets["simData"].toString())
          currentProject.current = loadFile.current.document.name
          app.document.name = currentProject.current
          if(loadFile.current.assets["centerPoint"] !== undefined){
            centerPoint.current = JSON.parse(loadFile.current.assets["centerPoint"].toString()) as [number,number]
          }
          console.log("centerPoint", centerPoint.current)
          app.loadDocument(loadFile.current.document)
         
          if (app.getShape('loading')) {//remove loading sticky
            app.delete(['loading']) 
          }
          //console.log('loaded data',loadedData)
          const importNodes = loadedData.nodes as dataNode[]
          //console.log(importNodes)
          importNodes.forEach(node =>{
            node.fx = node.x
            node.fy = node.y
          })
          graphData.current.nodes = importNodes
          graphData.current.links = loadedData.links
          simulation.current = d3Sim(centerPoint.current,app.rendererBounds).alpha(3)
          simulation.current.restart()
          
          simulation.current.nodes(graphData.current.nodes)

          const forceLink = simulation.current.force('link') as d3.ForceLink<
            d3.SimulationNodeDatum,
            d3.SimulationLinkDatum<d3.SimulationNodeDatum>
          >
          forceLink.links(graphData.current.links)
          simulation.current.alpha(parseInt(loadFile.current.assets["alpha"].toString()))
          simulation.current.tick(20)
          app.appState.isLoading = false
          
          // graphData.current.nodes.forEach(node =>{
          //   node.fx = null
          //   node.fy = null
          // })
          
          
          simulation.current.alpha(ALPHA_TARGET_REFRESH)
          refreshSim(simulation)
          drawInterval()
          
          loadedFile.current = true
          // const selection = app.selectedIds
          // app.select(...app.getShapes().filter((shape) => nodeRegex.test(shape.id)).map(n=>n.id))
          // app.zoomToSelection();
          // app.zoomOut();
          // app.zoomOut();
          // app.zoomOut();
          // app.zoomOut();
          // //app.select(...selection)
          //app.resetZoom()
          //app.zoomToSelection();
          //app.selectNone();
          
        }
      }else if(loadedFile.current === true){ //default update loop
        //console.log('saving/updating...')
        if (!(app.document === undefined)) {
          saveToProcessing(app.document, JSON.stringify(graphData.current), simulation.current.alpha(),centerPoint.current, null,abortCurrentVersionController)
        }
        updateVersions(netData, newData, abortVersionsController)
        dataInterval(newData,netData,graphData,simulation)
        updateCurrentVersion(currentVersion, timeout, abortCurrentVersionController)
      }else{ //This shouldnt be reached
        console.log(loadFile.current)
      }
    }
  }
  //Update Current Version — (we want to do this very fast)
  const currentVersionInterval = () => {
    updateCurrentVersion(currentVersion, timeout, abortCurrentVersionController)
  }
  const handleSave = React.useCallback((app: TldrawApp, e?:KeyboardEvent)=>{
    if(e !== undefined){
      e.preventDefault();
    }
    saveToProcessing(app.document, JSON.stringify(graphData.current), simulation.current.alpha(),centerPoint.current, null,abortCurrentVersionController)
  },[])
  const handleMount = React.useCallback((app: TldrawApp) => {
    // if(process.env["NEXT_PUBLIC_VERCEL_EN"] == '1'){
    //   console.log("im in vercel!")
    //   app = window.app
    // }else{
    //   console.log("im local!")
    //   app = rTldrawApp.current!
    // }
    

    const abortFileController = new AbortController()
    loadFileFromProcessing(loadFile,abortFileController)
    console.log("mount")
    
    rTldrawApp.current = app
    centerPoint.current = app.centerPoint as [number,number]
    app.replacePageContent({},{},{})
    app.createShapes(defaultSticky(centerPoint.current))
    app.zoomToFit()
  }, [])

  React.useEffect(() => {
    //https://sparkjava.com/documentation#examples-and-faq
    //https://stackoverflow.com/questions/18206231/saving-and-reloading-a-force-layout-using-d3-js
   
   const updateThumbnailInterval = () =>{
      //BUG = have to do this more slowly, or else firefox will get angry
      //cant change url before last image has loaded - thats why its in the slower interval
      updateThumbnail(currentVersion, rTldrawApp)
      if(currentProject.current !== undefined){
        getCurrentProject(currentProject,rTldrawApp)
      }
    }
    
    const networkLoop = setInterval(networkInterval, timeout * 2) //get data from processing
    const currentVersionLoop = setInterval(currentVersionInterval, 500)//update current version
    const thumbnailLoop = setInterval(updateThumbnailInterval,2000);
    //const dataLoop = setInterval(dataInterval, 3000)//put it into the graph
    const drawLoop = setInterval(drawInterval, 100)//draw the graph

    return () => {
      clearInterval(networkLoop)
      clearInterval(currentVersionLoop)
      clearInterval(thumbnailLoop)
      //clearInterval(dataLoop)
      clearInterval(drawLoop)
      abortVersionsController.abort()
      abortCurrentVersionController.abort()
      abortFileController.abort()

      netData.current = null
    }
  },[])

  //https://codesandbox.io/s/tldraw-context-menu-wen03q
  const handlePatch = React.useCallback((app: TldrawApp, reason?: string) => {
    console.log(reason)
    if(loadedFile.current === true){
     // drawInterval()
    }
    
    switch (reason) {
      case 'set_status:translating': {
        // started translating...
        rIsDragging.current = true
        //simulation.current.force("center",null)
        //simulation.current.force("charge",null)
        //simulation.current.force("link",null)
        lastSelection.current = null
        break
      }
      case 'set_status:creating': {
        // started translating...
        rIsDragging.current = true
        lastSelection.current = null
        break
      }
      case 'session:TranslateSession': {
        if (rIsDragging.current) {
          refreshSim(simulation)
          // Dragging...
        }
        lastSelection.current = null
        break
      }
      case 'set_status:idle': {
        if (rIsDragging.current) {
          // stopped translating...
          rIsDragging.current = false
          // if (!(app.document === undefined)) {
          //   saveToProcessing(app.document, JSON.stringify(graphData.current), simulation.current.alpha(),centerPoint.current, null,abortCurrentVersionController)
          // }
        }
        //const coords = tldrawCoordstod3(...centerPoint.current as [number,number])
        //simulation.current.force("center", d3.forceCenter(coords[0],coords[1]).strength(.1))
        //simulation.current.force('charge', d3.forceManyBody().strength(-2))
        refreshSim(simulation)
        break
      }
      //scaling
      case 'session:TransformSingleSession': {
        if (
          app.selectedIds.length == 1 &&
          app.getShape(app.selectedIds[0]).type === TDShapeType.VersionNode
        ) {
          //console.log(graphData.current.nodes)
        }
        lastSelection.current = null
        break
      }
      //double click on shape
      case 'set_status:pointingBounds': { //pointing bounds can never trigger selects
        lastSelection.current = selectedNode.current
        if (
          app.selectedIds.length == 1 &&
          app.getShape(app.selectedIds[0]).type === TDShapeType.VersionNode
        ) {

          selectedNode.current = app.selectedIds[0]
          const selectedShape = app.getShape(selectedNode.current)
          const idInteger = selectedShape.id.replace(/\D/g, '')
          
          if(app.shiftKey && new Date().getTime() - timeSinceLastFork.current > 2000){
            sendFork(idInteger,currentVersion)
            timeSinceLastFork.current = new Date().getTime()
            timeSinceLastSelection.current = new Date().getTime()
         }
         const timeSinceLastSelect = new Date().getTime() - timeSinceLastSelection.current
          if(timeSinceLastSelect > 500 && 
          lastSelection.current !== selectedNode.current){
              sendSelect(idInteger,currentVersion)
              timeSinceLastSelection.current = new Date().getTime()
          }

          if(timeSinceLastSelect > 500 && 
          lastSelection.current === selectedNode.current){
            const then = new Date().getTime()
            setTimeout(()=>{ //if we dont get a selected event in the next half second
              if(then > timeSinceLastSelection.current){
                sendSelect(idInteger,currentVersion)
                timeSinceLastSelection.current = new Date().getTime()
              }
            },500)
          }
          
        }
        break;
      }
      case 'selected': { //select events are never the second click, so they can never trigger forks
        //Select Node
        
        lastSelection.current = selectedNode.current
        if (
          app.selectedIds.length == 1 &&
          app.getShape(app.selectedIds[0]).type === TDShapeType.VersionNode
        ) {

          selectedNode.current = app.selectedIds[0]
          const selectedShape = app.getShape(selectedNode.current)
          const idInteger = selectedShape.id.replace(/\D/g, '')

          if(app.shiftKey && new Date().getTime() - timeSinceLastFork.current > 2000){
            sendFork(idInteger,currentVersion)
            timeSinceLastFork.current = new Date().getTime()
            timeSinceLastSelection.current = new Date().getTime()
         }
          if(new Date().getTime() - timeSinceLastSelection.current > 500 &&
          lastSelection.current !== selectedNode.current){
              sendSelect(idInteger,currentVersion)
              timeSinceLastSelection.current = new Date().getTime()
          }
        }
        break
      }
    }
  }, [])

  // Send events to gtag as actions.
  // const handlePersist = React.useCallback((_app: TldrawApp, reason?: string) => {
  //   gtag.event({
  //     action: reason ?? '',
  //     category: 'editor',
  //     label: reason ?? 'persist',
  //     value: 0,
  //   })
  // }, [])

  const fileSystemEvents = useFileSystem()
  const { onAssetUpload , onAssetDelete} = useUploadAssets()

  return (
    <div className="tldraw">
      <Tldraw
        {...fileSystemEvents}
        id={id}
        autofocus
        showPages={false}
        onMount={handleMount}
        onPatch={handlePatch}
        onSaveProject={handleSave}
        showSponsorLink={false}
        onSignIn={undefined}
        onSignOut={undefined}
        onAssetUpload={onAssetUpload}
        onAssetCreate={onAssetUpload}
        onAssetDelete={onAssetDelete}
        
        {...rest}
      />
      <BetaNotification />
    </div>
  )
}

export default Editor

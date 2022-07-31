/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { 
  Tldraw, 
  TldrawApp, 
  TldrawProps, 
  useFileSystem, 
  TDShapeType, 
  TDFile,
  Patch,
  PagePartial,
  TDPage,
  TldrawPatch,
  VersionNodeShape,
  TDExport,
  ColorStyle,
  TDShape,
  GroupShape,
  TLDR
} from '@tldraw/tldraw'

//import { useUploadAssets } from 'hooks/useUploadAssets'
import React from 'react'
// import * as gtag from 'utils/gtag'
import { w3cwebsocket as W3CWebSocket } from "websocket";
import axios from 'axios'
import {Simulation, SimulationNodeDatum } from 'd3'
import AsyncLock from 'async-lock'
import { 
  saveToProcessing, 
  updateVersions, 
  //updateCurrentVersion,
  loadFileFromProcessing,
  useUploadAssets,
  sendToLog,
  exportByColor,
  connectWebSocket,
  updateThumbnail
} from 'utils/quickPoseNetworking'
import * as lodash from 'lodash'

import { 
  EditorProps,
  forceLink,
  quickPoseFile
 } from 'utils/quickPoseTypes'

 import {
   d3Sim,
   defaultSticky,
   graphBaseData,
   installHelper,
   linkRegex,
  loadTldrFile,
  nodeRegex,
  updateGraphData,
  updateLinkShapes,
  updateLoadingTicks,
  updateNodeShapes
 } from 'utils/quickposeDrawing'
//import { dateTimestampInSeconds, timestampInSeconds } from '@sentry/utils'
//import { constants } from 'fs'

//declare const window: Window & { app: TldrawApp }


export const D3_LINK_DISTANCE = 4
export const TL_DRAW_RADIUS = 45;
export const ALPHA_TARGET_REFRESH = .1
const LOCALHOST_BASE = 'http://127.0.0.1:8080';
export const d3TlScale = 5

const Editor = ({
  id = 'home',
  ...rest
}: EditorProps & Partial<TldrawProps>) => {
  const rTldrawApp = React.useRef<TldrawApp>()

  //selection/dragging
  const rIsDragging = React.useRef(false)
  const selectedNode = React.useRef<string>(null)
  const lastSelection = React.useRef<string>(null)
  const currentVersion = React.useRef<number>(null)
  const timeSinceLastSelection = React.useRef<number>(0)
  const timeSinceLastFork = React.useRef<number>(0);
  const centerPoint = React.useRef<[number,number]>([600,600])

  const timeSinceLastSave = React.useRef<number>(0);
  //file loading
  const loadFile = React.useRef<quickPoseFile>(null)
  const loadedFile = React.useRef<boolean>(false)

  const thumbnailSocket = React.useRef<W3CWebSocket>(null);
  const connectInterval = React.useRef<any>(null);
  //d3 sim
  const simulation = React.useRef<d3.Simulation<SimulationNodeDatum, undefined>>()

  //data structs
  const netData = React.useRef<any>(undefined)
  const graphData = React.useRef< { nodes: any[]; links: any[]; }>(graphBaseData)
  const loadingTicks = React.useRef<number>(0); //Counter for sticky loading dots
  
  let abortFileController = new AbortController()
  const timeout = 2000
  const lock = new AsyncLock;

  function refreshSim(simulation){
    if(simulation.current !== undefined){
      //simulation.current.alpha(ALPHA_TARGET_REFRESH)
      simulation.current.restart()
    }
  }
  //const sendFork = (id: string) => throttle(sendForkThrottled(id),2000)

  const sendFork = async (id: string) => {
    //const start = timestampInSeconds()
    const app = rTldrawApp.current!
    if(app !== undefined && 
      app.isLoading === false && 
      id === currentVersion.current.toString()
      ){
      app.setIsLoading(true)
      console.log("send fork",id)
      lock.acquire("select", async function() {
        await axios.get(LOCALHOST_BASE + '/fork/' + id, {
          timeout: 600,
        })
        .then(response => {
          if(response.status === 200){
            updateThumbnail(app,'node'+currentVersion.current,currentVersion)
            netData.current = response.data
            dataInterval(netData,graphData,simulation)
            drawInterval()
            app.selectNone();
            app.setIsLoading(false)
          }
        })
        .catch(error => {
          console.warn("error forking current version: ", error);
          return null
        })
      }).then(function(){
        app.setIsLoading(false)
      })
      .catch(error => {
        console.warn("error forking current version: ", error);
        return null
      })
    }
}
//const sendSelect = (id: string,currentVersion: { current: string; }) => throttle(sendSelectThrottled(id,currentVersion),100)

const sendSelect = async (id: string) => {
  const app = rTldrawApp.current!
  if(app !== undefined && app.isLoading === false && parseInt(id) !== currentVersion.current){
    app.setIsLoading(true)
    console.log("send select",id)
    lock.acquire("select", async function() {
      await axios.get(LOCALHOST_BASE + '/select/' + id, {
        timeout: 600,
      })
      .then(function(response) {
        if(response.status === 200){
          updateThumbnail(app,'node'+currentVersion.current,currentVersion)
          currentVersion.current = parseInt(response.data)
          app.setIsLoading(false)
          app.pageState.selectedIds = ['node'+currentVersion.current]
          drawInterval()
        }
      })
      .catch(error => {
        console.warn("error selecting current version: ", error);
        return null
      })
    }).then(function(){
      app.setIsLoading(false)
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
      console.timeStamp("preanimframe")
      requestAnimationFrame(() => {
        const currentStyle = app.getAppState().currentStyle
        const content = app.getContent(app.selectedIds)
        let selectedIdsWithGroups = [];
        
        if(content !== undefined && content.shapes !== undefined ){
          selectedIdsWithGroups= content.shapes.map(shape => shape.id)
        }
        
        gData.nodes = [...sim.nodes()] //get simulation data out
        const tlNodes = app.getShapes().filter((shape) => nodeRegex.test(shape.id))
        const [nextNodeShapes,createNodeShapes] =  updateNodeShapes(
          gData,
          tlNodes,
          currentVersion,
          centerPoint,
          selectedIdsWithGroups
        )
        const tlLinks = app.getShapes().filter((shape) => linkRegex.test(shape.id))
        const [nextLinkShapes, nextLinkBindings, createLinkShapes] = updateLinkShapes(app, tlLinks, graphData, tlNodes)
        
        if (createNodeShapes.length > 0) {
          //console.log("new shapes",createNodeShapes)
          app.patchCreate(createNodeShapes as VersionNodeShape[])
          app.selectNone()
          if(createNodeShapes.length === 1){
            app.zoomTo(app.zoom,app.getShape(createNodeShapes[0].id).point)
            }
        }
        if (createLinkShapes.length > 0) {
          //console.log("createtllink",createLinkShapes)
          //console.log("tllink",tlLinks)
          const counts = lodash.countBy(createLinkShapes, 'id')
          lodash.filter(createLinkShapes, shape => counts[shape.id] > 1)
          const uniqueLinks : TDShape[] = lodash.filter(createLinkShapes, shape => counts[shape.id] == 1)
          for(id in lodash.filter(createLinkShapes, shape => counts[shape.id] > 1)){
            uniqueLinks.push(createLinkShapes.find(node => node.id === id))
          }
          app.patchCreate(createLinkShapes)
          app.selectNone()
        }

        const nextShapes = {...nextLinkShapes,...nextNodeShapes} as Patch<TDPage['shapes']>
        const nextBindings = {...nextLinkBindings} as Patch<TDPage['bindings']>
        const nextPage: PagePartial = {
          shapes: nextShapes,
          bindings: nextBindings,
        }
        sim.nodes(gData.nodes);
        (sim.force('link') as forceLink).links(gData.links);
        sim.restart();

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
      })
      console.timeStamp("end animframe");
    }
  }
  //check for new data, if so, update graph data
  function dataInterval(
    netData: React.MutableRefObject<JSON>,
    graphData: React.MutableRefObject< { nodes: any[]; links: any[]; }>,
    simulation: React.MutableRefObject<Simulation<SimulationNodeDatum, undefined>>)
    {
    //console.log(netData.current,graphData.current,simulation.current)
    //https://medium.com/ninjaconcept/interactive-dynamic-force-directed-graphs-with-d3-da720c6d7811
    if (netData.current !== undefined && graphData.current !== undefined && simulation.current !== undefined) {
      if (updateGraphData(netData.current,graphData.current)) {
        currentVersion.current = parseInt(netData.current["CurrentNode"].toString())
        simulation.current.nodes(graphData.current.nodes)
        const forceLink = simulation.current.force('link') as forceLink
        forceLink.links(graphData.current.links)
        refreshSim(simulation)
        drawInterval()
      }
    }
    loadingTicks.current++ 
  }

  const networkInterval = () => {
    const app = rTldrawApp.current!
    
    if (!(app === undefined)) {
      if(thumbnailSocket.current.readyState === thumbnailSocket.current.OPEN){
        if (loadedFile.current === false) { //still need to handle opening
          //updateVersions(netData, newData)
          if(loadFile.current === null){ //haven't found a file yet, so keep looking
            console.log('requesting file...')
            thumbnailSocket.current.send("/tldrfile");
            loadFileFromProcessing(loadFile,abortFileController)
            updateLoadingTicks(app, loadingTicks)
            app.setSetting("keepStyleMenuOpen",false)
          }else if(loadFile.current === undefined){ //there is no file, we need to start fresh
            loadedFile.current = true
            app.resetDocument()
            console.log('no file found!')
            abortFileController.abort()
            if (app.getShape('loading')) {//remove loading sticky
              app.delete(['loading','installHelper1','installHelper2','installHelper3']) 
            } 
            centerPoint.current = app.centerPoint as [number,number];
            simulation.current = d3Sim().alpha(3)
            // if(netData.current !== undefined && netData.current !== null && netData.current["ProjectName"]){
            //   app.setCurrentProject(netData.current["ProjectName"])
            // }
            //console.log(netData.current)

            dataInterval(netData,graphData,simulation)
            refreshSim(simulation)
            app.setSetting("keepStyleMenuOpen",true)
            //simulation.current.alpha(ALPHA_TARGET_REFRESH)
            drawInterval()
            app.zoomToContent()
            //app.appState.isLoading = false
            //make new file, do intro experience?
          }else if(loadFile.current !== null){ //we found an existing file
            abortFileController.abort()
            loadTldrFile(app,graphData,simulation,centerPoint,loadFile, currentVersion)
            refreshSim(simulation)
            dataInterval(netData,graphData,simulation)
            drawInterval()
            app.setSetting("keepStyleMenuOpen",true)
            loadedFile.current = true
          }
        }else if(loadedFile.current === true){ //default update loop
          app.setIsLoading(false)
          //console.log('saving/updating?')
          if (!(app.document === undefined)) {
            console.log('saving/updating...')
            saveToProcessing(
              app.document, 
              JSON.stringify(graphData.current),
              simulation.current.alpha(),
              centerPoint.current,
              app.document.name,
              false)
          }
          if(app.document.name === 'null'){
            app.document.name = app.appState.currentProject
          }
        
          updateVersions(netData)
          dataInterval(netData,graphData,simulation)
        }
        // else{ //This shouldnt be reached
        //   console.log(loadFile.current)
        // }
      }
    }
  }
  //Update Current Version — (we want to do this very fast)
  const thumbnailInterval = () => {
    const app = rTldrawApp.current!
    if (!(app === undefined)) {
      const tlNodes = app.getShapes().filter((shape:VersionNodeShape) => nodeRegex.test(shape.id) && shape.hasLoaded === false)
      tlNodes.map(node => updateThumbnail(app,node.id,currentVersion))    
    }
  }
  
  const handleSave = React.useCallback((app: TldrawApp, e?:KeyboardEvent)=>{
    if(e !== undefined){
      e.preventDefault();
    }
    saveToProcessing(
      app.document, 
      JSON.stringify(graphData.current), 
      simulation.current.alpha(),
      centerPoint.current,
      app.document.name,
      false)
  },[])

  const resetState = (app: TldrawApp) => {
    abortFileController = new AbortController()
    currentVersion.current = null
    netData.current = undefined
    graphData.current = graphBaseData
    currentVersion.current = null
    loadFile.current = null
    loadedFile.current = false
    simulation.current = d3Sim();
    if(app !== undefined){
      app.setCurrentProject("")
      app.replacePageContent({},{},{})
      app.createShapes(defaultSticky(centerPoint.current))
      app.createShapes(...installHelper(centerPoint.current))
    }
  }

  const handleMount = React.useCallback((app: TldrawApp) => {
    
    
    rTldrawApp.current = app
    centerPoint.current = app.centerPoint as [number,number]
    resetState(app)
    app.replacePageContent({},{},{})
    app.createShapes(defaultSticky(centerPoint.current))
    app.createShapes(...installHelper(centerPoint.current))
    app.selectNone()
    app.zoomToFit()
    app.setIsLoading(true)

  }, [])
  React.useEffect(() => {
    //console.log("data interval")
    dataInterval(netData,graphData,simulation)
  },[netData.current])

  React.useEffect(() => {
    if(thumbnailSocket.current !== null){
      switch(thumbnailSocket.current.readyState){
        case W3CWebSocket.CLOSED:{
          if(rTldrawApp !== undefined){
            const app  : TldrawApp = rTldrawApp.current!
            if(app !== undefined){
              app.readOnly = true
              app.setCurrentProject("")
              resetState(app)
            }
          } 
          break
        }
        case W3CWebSocket.OPEN:{
          thumbnailSocket.current.send("/tldrfile")
          if(rTldrawApp !== undefined){
            const app  : TldrawApp = rTldrawApp.current!
            if(app !== undefined){
              app.readOnly = false
              loadFileFromProcessing(loadFile,abortFileController)
              const tlNodes = app.getShapes().filter((shape) => nodeRegex.test(shape.id))
              tlNodes.map(node => updateThumbnail(app,node.id,currentVersion))
  
            }
          }
          break
        }
        case W3CWebSocket.CONNECTING:{
          break
        }
      }
    }

  },[thumbnailSocket.current])

  React.useEffect(() => {
    //https://sparkjava.com/documentation#examples-and-faq
    //https://stackoverflow.com/questions/18206231/saving-and-reloading-a-force-layout-using-d3-js
   
    connectWebSocket(thumbnailSocket,currentVersion, rTldrawApp,connectInterval,loadFile,netData,abortFileController)
    const networkLoop = setInterval(networkInterval, timeout * 2) //get data from processing
    const thumbnailLoop = setInterval(thumbnailInterval, 10000)//update current version
    const drawLoop = setInterval(drawInterval, 100)//draw the graph

    return () => {
      clearInterval(networkLoop)
      clearInterval(thumbnailLoop)
      clearInterval(drawLoop)
      abortFileController.abort()
      resetState(rTldrawApp.current!)
    }
  },[])

  //https://codesandbox.io/s/tldraw-context-menu-wen03q
  const handlePatch = React.useCallback((app: TldrawApp, patch: TldrawPatch, reason?: string) => {
    //console.log(reason)
    if(loadedFile.current === true && app.document.name !== 'null'){
      if(new Date().getTime() - timeSinceLastSave.current > 5 * 60 * 1000){ //every 5 min
        console.log("Backing up",new Date().getTime())
        saveToProcessing(
          app.document, 
          JSON.stringify(graphData.current), 
          simulation.current.alpha(),
          centerPoint.current,
          app.document.name,
          true)
        timeSinceLastSave.current = new Date().getTime()
      }
    }
    
    switch (reason) {
      case 'ui:set_current_project': {
        if(patch.appState.currentProject !== app.appState.currentProject){
          if(patch.appState.currentProject === ""){
            app.readOnly = true
          }else{
            app.readOnly = false
            resetState(app)
            app.patchState(patch)
            app.appState.currentProject = patch.appState.currentProject
          }
        }
        break
      }
      case 'set_status:translating': {
        // started translating...
        rIsDragging.current = true
        lastSelection.current = null
        sendToLog("translate")
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
        }
        refreshSim(simulation)
        break
      }
      //scaling
      case 'session:TransformSingleSession': {
        if (app.selectedIds.length == 1 &&
          app.getShape(app.selectedIds[0]).type === TDShapeType.VersionNode
        ) {
          //console.log(graphData.current.nodes)
        }
        lastSelection.current = null
        break
      }

      case 'set_status:pointingBounds': { //pointing bounds can never trigger selects
        lastSelection.current = selectedNode.current
        if (app.selectedIds.length == 1 &&
          app.getShape(app.selectedIds[0]).type === TDShapeType.VersionNode
        ) {
        console.log(patch)
        //   selectedNode.current = app.selectedIds[0]
        //   const selectedShape = app.getShape(selectedNode.current)
        //   const idInteger = selectedShape.id.replace(/\D/g, '')
          
        //   if(app.shiftKey && new Date().getTime() - timeSinceLastFork.current > 2000){
        //     sendFork(idInteger)
        //     timeSinceLastFork.current = new Date().getTime()
        //     timeSinceLastSelection.current = new Date().getTime()
        //   }else{
        //     sendSelect(idInteger)
        const timeSinceLastSelect = new Date().getTime() - timeSinceLastSelection.current
        //     // if(timeSinceLastSelect > 500 && 
        //     // lastSelection.current !== selectedNode.current){
        //     //     sendSelect(idInteger)
        //     //     timeSinceLastSelection.current = new Date().getTime()
        //     // }

            if(app.shiftKey && timeSinceLastSelect > 500 && 
            lastSelection.current === selectedNode.current){
              const then = new Date().getTime()
              setTimeout(()=>{ //if we dont get a selected event in the next half second
                if(then > timeSinceLastSelection.current){
                  sendFork(currentVersion.current.toString())
                  timeSinceLastSelection.current = new Date().getTime()
                }
              },500)
            }
        //   }
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
            sendFork(idInteger)
            timeSinceLastFork.current = new Date().getTime()
            timeSinceLastSelection.current = new Date().getTime()
          }else{
            sendSelect(idInteger)
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

  const handleExport = React.useCallback(async(app: TldrawApp, info: TDExport):Promise<void>=>{
    if(info.type === "exportByColor"){
      exportByColor(app,info.name as ColorStyle)
    }
  },[])

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
        showMultiplayerMenu={false}
        onAssetUpload={onAssetUpload}
        onAssetCreate={onAssetUpload}
        onAssetDelete={onAssetDelete}
        onExport={handleExport}
        {...rest}
      />
    </div>
  )
}

export default Editor

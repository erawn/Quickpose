/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { 
  Tldraw, 
  TldrawApp, 
  TldrawProps, 
  useFileSystem, 
  TDShapeType, 
  ColorStyle, 
  SizeStyle,
  TDShape, 
  shapeUtils, 
  ArrowBinding,
  ArrowShape,
  TDAssetType,
  TDImageAsset,
  VersionNodeShape,
  TDDocument,
  TDFile
} from '@tldraw/tldraw'
import {
  TLBoundsCorner,
  TLBoundsEdge,
  TLBoundsEventHandler,
  TLBoundsHandleEventHandler,
  TLCanvasEventHandler,
  TLPointerEventHandler,
  TLKeyboardEventHandler,
  TLShapeCloneHandler,
  Utils,
  TLBinding
} from '@tldraw/core'
import { useAccountHandlers } from 'hooks/useAccountHandlers'
//import { useUploadAssets } from 'hooks/useUploadAssets'
import React from 'react'
import * as gtag from 'utils/gtag'
import axios from 'axios'
import * as d3 from 'd3'
import { SimulationNodeDatum, SimulationLinkDatum } from 'd3'
import deepEqual from "deep-equal"
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
  inputVersionNodeShape
 } from 'utils/quickPoseTypes'

 import {
   d3Sim,
   defaultSticky,
   graphBaseData,
   linkRegex,
  nodeRegex,
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
  const centerPoint = React.useRef<number[]>([600,600])
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
  const timeout = 2000

  const refreshSim = () => {
    //simulation.current.alpha(ALPHA_TARGET_REFRESH)
    simulation.current.restart()
  }
  const sendFork = async (id: string,currentVersion: { current: string; }) => {
    const start = timestampInSeconds()
    const app = rTldrawApp.current!
    if(app !== undefined){
      app.appState.isLoading = true
      await axios.get(LOCALHOST_BASE + '/fork/' + id, {
        timeout: 600,
      })
      .then(response => {
        if(response.status === 200){
          currentVersion.current = response.data.toString()
          console.log("forked, currentVersion is  "+ currentVersion.current,timestampInSeconds()-start)
          networkInterval()
          console.log("network", timestampInSeconds()-start)
          dataInterval()
          console.log("data",timestampInSeconds()-start)
          refreshSim()
          console.log("refresh",timestampInSeconds()-start)
          drawInterval()
          console.log("draw",timestampInSeconds()-start)
          app.appState.isLoading = false
        }
      })
      .catch(error => {
        //console.warn("error fetching current version: ", error);
        return null
      })
    }
}
const sendSelect = async (id: string,currentVersion: { current: string; }) => {
  await axios.get(LOCALHOST_BASE + '/select/' + id, {
    timeout: 600,
    //signal: abortCurrentVersionController.signal
  })
  .then(function(response) {
    if(response.status === 200){
      currentVersion.current = response.data.toString()
      drawInterval()
    }
  })
  .catch(error => {
    //console.warn("error fetching current version: ", error);
    return null
  })
}

 function drawInterval(){
  //console.log('drawInterval')
  const sim = simulation.current!
  const app = rTldrawApp.current!
  const gData = graphData.current!
    if(sim !== undefined && gData !== undefined && 
      //simulation.current.alpha > simulation.current.alphaMin && //Doesn't work when there's only one node
      loadedFile.current === true && !(app === undefined)){
      //console.log('drawInterval2')
      requestAnimationFrame(() => {
        //console.log('drawInterval3')
        gData.nodes = [...sim.nodes()] //get simulation data out
        let tlNodes = app.getShapes().filter((shape) => nodeRegex.test(shape.id))
        const [addNodes, updateNodes] = updateNodeShapes(
          gData,
          tlNodes,
          currentVersion,
          app.centerPoint,
          app.selectedIds
        )
        if (addNodes.length > 0) {
          app.createShapes(...addNodes)
        }
        if (updateNodes.length > 0) {
          app.updateShapes(...updateNodes)
        }
        sim.nodes(gData.nodes)

        const tlLinks = app.getShapes().filter((shape) => linkRegex.test(shape.id))
        tlNodes = app.getShapes().filter((shape) => nodeRegex.test(shape.id))
        const [newLinks, updateLinks] = updateLinkShapes(app, tlLinks, graphData, tlNodes)
        if (updateLinks.length > 0) {
          app.updateShapes(...updateLinks)
        }
        if (newLinks.length > 0) {
          app.createShapes(...newLinks)
          //deselect created links
          const newIds: string[] = newLinks.map((link) => link.id)
          app.select(...app.selectedIds.filter((id) => !newIds.includes(id)))
        }

        (sim.force('link') as d3.ForceLink<
          d3.SimulationNodeDatum,
          d3.SimulationLinkDatum<d3.SimulationNodeDatum>
        >).links(gData.links)
        sim.restart()
      
      })
    }
  }
  //check for new data, if so, update graph data
    
  const dataInterval = () => {
      
    // if(process.env["NEXT_PUBLIC_VERCEL_EN"] == '1'){
    //   console.log("im in vercel!")
    //   app = window.app
    // }else{
    //   console.log("im local!")
    //   app = rTldrawApp.current!
    // }

    //https://medium.com/ninjaconcept/interactive-dynamic-force-directed-graphs-with-d3-da720c6d7811
    if (newData.current === true && netData.current && graphData.current) {
      //if we have new data come in
      console.log('dataInterval')
      let changed = true
      newData.current = false

      //and we have our datasources ready
      //add new links and nodes from netData into graphData
      //only --adding-- nodes and links, so we can just append new incoming data to graphData
      netData.current[0].forEach(function (netNode: dataNode) {
        if (!graphData.current.nodes.some((graphNode) => graphNode.id === netNode.id)) {
          const parentLink = netData.current[1].find((link) => link.target === netNode.id)
          if (!(parentLink === undefined)) {
            const parent: dataNode = graphData.current.nodes.find(
              (node) => node.id === parentLink.source
            )
            if (!(parent === undefined)) {
              netNode.x = parent.x + 10
              netNode.y = parent.y + 10
            }
          }
          graphData.current.nodes = [...graphData.current.nodes, { ...netNode }]
          changed = true
        }
      })
      netData.current[1].forEach(function (netLink) {
        if (
          !graphData.current.links.some(
            (graphLink) =>
              graphLink.source.id === netLink.source && graphLink.target.id === netLink.target
          )
        ) {
          graphData.current.links = [...graphData.current.links, { ...netLink }]
          changed = true
        }
      })
      if (changed) {
        
        simulation.current.nodes(graphData.current.nodes)
        const forceLink = simulation.current.force('link') as d3.ForceLink<
          d3.SimulationNodeDatum,
          d3.SimulationLinkDatum<d3.SimulationNodeDatum>
        >
        forceLink.links(graphData.current.links)
        console.log('netdata', netData.current)
        console.log('graphData', graphData.current)
        console.log("dataInterval Update")
        //simulation.current.restart()
        refreshSim()
        drawInterval()
      }
    }
    loadingTicks.current++ 
  }

  const networkInterval = () => {
    const app = rTldrawApp.current!
    if (!(app === undefined)) {

      //load/save file
      if (loadedFile.current === false) {

        if(loadFile.current === null){
          console.log('requesting file...')
          updateVersions(netData, newData, abortVersionsController)
          loadFileFromProcessing(loadFile,abortFileController)
          currentVersionInterval()
          if (app.getShape('loading')) {
            const loadingDot = '.'
            app.updateShapes({
              id: 'loading',
              text: ' Quickpose is looking for a Processing Session' + loadingDot.repeat(loadingTicks.current % 6),
            })
          }
        }else if(loadFile.current === undefined){
          loadedFile.current = true
          updateVersions(netData, newData, abortVersionsController)
          console.log('no file found!')
          abortFileController.abort()
          if (app.getShape('loading')) {//remove loading sticky
            app.delete(['loading']) 
          }
          simulation.current = d3Sim(centerPoint.current,app.rendererBounds)
          newData.current = true
          currentVersionInterval()
          dataInterval()
          refreshSim()
          //simulation.current.alpha(ALPHA_TARGET_REFRESH)
          drawInterval()
          //make new file, do intro experience?
        }else if(loadFile.current !== null){ //we have a file and data
          abortFileController.abort()
          currentVersionInterval()
          //https://stackoverflow.com/questions/18206231/saving-and-reloading-a-force-layout-using-d3-js
          //Load the data
          const loadedData = JSON.parse(loadFile.current.assets["simData"].toString())
          //console.log('loaded data',loadedData)
          const importNodes = loadedData.nodes as dataNode[]
          //console.log(importNodes)
          importNodes.forEach(node =>{
            node.fx = node.x
            node.fy = node.y
          })
          graphData.current.nodes = importNodes
          graphData.current.links = loadedData.links
          simulation.current = d3Sim(centerPoint.current,app.rendererBounds)
          simulation.current.restart()
          simulation.current.nodes(graphData.current.nodes)

          const forceLink = simulation.current.force('link') as d3.ForceLink<
            d3.SimulationNodeDatum,
            d3.SimulationLinkDatum<d3.SimulationNodeDatum>
          >
          forceLink.links(graphData.current.links)
          simulation.current.alpha(parseInt(loadFile.current.assets["alpha"].toString()))
          simulation.current.tick(20)
          
          // graphData.current.nodes.forEach(node =>{
          //   node.fx = null
          //   node.fy = null
          // })
          app.loadDocument(loadFile.current.document)

          if (app.getShape('loading')) {//remove loading sticky
            app.delete(['loading']) 
          }
          console.log("loaded file",loadFile.current.document)
          console.log('loaded graphdata',graphData.current)
          newData.current = true
          dataInterval()
          refreshSim()
          simulation.current.alpha(ALPHA_TARGET_REFRESH)
          drawInterval()
          app.zoomToFit()
          loadedFile.current = true
        }
      }else if(loadedFile.current === true){ //default update loop
        console.log('saving/updating...')
        if (!(app.document === undefined)) {
          saveToProcessing(app.document, JSON.stringify(graphData.current), simulation.current.alpha(),centerPoint.current, null)
        }
        updateVersions(netData, newData, abortVersionsController)
        dataInterval()
        updateCurrentVersion(currentVersion, timeout, abortCurrentVersionController)
        //console.log(currentVersion.current)
        //console.log(netData.current)
      }else{
        console.log(loadFile.current)
      }
    }
  }

    //Update Current Version — (we want to do this very fast)
  const currentVersionInterval = () => {
    updateCurrentVersion(currentVersion, timeout, abortCurrentVersionController)
  }

    
 

  const handleMount = React.useCallback((app: TldrawApp) => {
    // if(process.env["NEXT_PUBLIC_VERCEL_EN"] == '1'){
    //   console.log("im in vercel!")
    //   app = window.app
    // }else{
    //   console.log("im local!")
    //   app = rTldrawApp.current!
    // }

    console.log('requesting startup file...')
    const abortFileController = new AbortController()
    loadFileFromProcessing(loadFile,abortFileController)

    rTldrawApp.current = app
    centerPoint.current = app.centerPoint
    

    //app.camera.zoom =
    //app.deleteAll() //replace this with make new document or something
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
    

 

    
    //get data from processing
    const networkLoop = setInterval(networkInterval, timeout * 2)
    //look for current version
    const currentVersionLoop = setInterval(currentVersionInterval, 500)
    const thumbnailLoop = setInterval(updateThumbnailInterval,200);
    //put it into the graph
    const dataLoop = setInterval(dataInterval, 3000)
    //draw the graph
    const drawLoop = setInterval(drawInterval, 100)

    return () => {
      clearInterval(networkLoop)
      clearInterval(currentVersionLoop)
      clearInterval(thumbnailLoop)
      clearInterval(dataLoop)
      clearInterval(drawLoop)
      abortVersionsController.abort()
      abortCurrentVersionController.abort()
      abortFileController.abort()
    }
  },[])

  //https://codesandbox.io/s/tldraw-context-menu-wen03q
  const handlePatch = React.useCallback((app: TldrawApp, reason?: string) => {
    //console.log(reason)
    if(loadedFile.current === true){
      drawInterval()
    }
    
    switch (reason) {
      case 'set_status:translating': {
        // started translating...
        rIsDragging.current = true
        break
      }
      case 'session:TranslateSession': {
        if (rIsDragging.current) {
          refreshSim()
          // Dragging...
        }
        break
      }
      case 'set_status:idle': {
        if (rIsDragging.current) {
          // stopped translating...
          rIsDragging.current = false
        }
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
        break
      }
      //double click on shape
      case 'set_status:pointingBounds': {
        if (
          app.selectedIds.length == 1 &&
          app.getShape(app.selectedIds[0]).type === TDShapeType.VersionNode &&
          app.selectedIds[0] === selectedNode.current
        ) {
          const selectedShape = app.getShape(selectedNode.current)
          if (
            !(selectedShape === undefined) &&
            selectedShape.type == TDShapeType.VersionNode &&
            new Date().getTime() - timeSinceLastSelection.current < DOUBLE_CLICK_TIME
          ) {
            const idInteger = selectedShape.id.replace(/\D/g, '')
            sendFork(idInteger,currentVersion).then(response =>
              {
                networkInterval()
              })
            console.log('send double click')
          } else {
            timeSinceLastSelection.current = new Date().getTime()
          }
        } else {
          //selectedNode.current = undefined
        }
        break
      }
      case 'selected': {
        //Select Node
        lastSelection.current = selectedNode.current
        if (
          app.selectedIds.length == 1 &&
          app.getShape(app.selectedIds[0]).type === TDShapeType.VersionNode
        ) {
          selectedNode.current = app.selectedIds[0]
          const selectedShape = app.getShape(selectedNode.current)
          if (!(lastSelection.current === selectedNode.current)) {
            const idInteger = selectedShape.id.replace(/\D/g, '')
            sendSelect(idInteger,currentVersion)
            networkInterval()
            console.log('send select!', idInteger)
            timeSinceLastSelection.current = new Date().getTime()
          }
        } else {
          selectedNode.current = undefined
        }
        break
      }
    }
  }, [])

  // Send events to gtag as actions.
  const handlePersist = React.useCallback((_app: TldrawApp, reason?: string) => {
    gtag.event({
      action: reason ?? '',
      category: 'editor',
      label: reason ?? 'persist',
      value: 0,
    })
  }, [])

  const fileSystemEvents = useFileSystem()
  const { onAssetUpload , onAssetDelete} = useUploadAssets()

  return (
    <div className="tldraw">
      <Tldraw
        id={id}
        autofocus
        showPages={false}
        onMount={handleMount}
        onPatch={handlePatch}
        showSponsorLink={false}
        onSignIn={undefined}
        onSignOut={undefined}
        onAssetUpload={onAssetUpload}
        onAssetCreate={onAssetUpload}
        onAssetDelete={onAssetDelete}
        {...fileSystemEvents}
        {...rest}
      />
    </div>
  )
}

export default Editor

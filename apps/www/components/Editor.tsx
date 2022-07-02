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
  sendFork, 
  sendSelect, 
  saveToProcessing, 
  getIconImageURLNoTime, 
  getIconImageURL,
  updateVersions, 
  updateThumbnail,
  updateCurrentVersion,
  loadFileFromProcessing,
  useUploadAssets
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

//declare const window: Window & { app: TldrawApp }


const D3_RADIUS = 5;
export const D3_LINK_DISTANCE = 20
export const TL_DRAW_RADIUS = 80;
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

  //file loading
  const loadFile = React.useRef<TDFile>(null)
  const loadedFile = React.useRef<boolean>(false)
  const loadedData = React.useRef<boolean>(false)

  //d3 sim
  const simulation = React.useRef<d3.Simulation<SimulationNodeDatum, undefined>>()

  //data structs
  const netData = React.useRef<any>()
  const newData = React.useRef<boolean>(false)
  const graphData = React.useRef<any>()
  graphData.current = graphBaseData
  const refreshSim = () => {
    simulation.current.alpha(ALPHA_TARGET_REFRESH)
    simulation.current.restart()
  }

  const drawInterval = () => {
    //console.log('drawInterval')
    requestAnimationFrame(() => {
      const app = rTldrawApp.current!

      if (loadedFile.current === true && graphData.current && !(app === undefined) && simulation.current) {
        graphData.current.nodes = [...simulation.current.nodes()] //get simulation data out
        let tlNodes = app.getShapes().filter((shape) => nodeRegex.test(shape.id))
        const [addNodes, updateNodes] = updateNodeShapes(
          graphData,
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
        simulation.current.nodes(graphData.current.nodes)

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
        const forceLink = simulation.current.force('link') as d3.ForceLink<
          d3.SimulationNodeDatum,
          d3.SimulationLinkDatum<d3.SimulationNodeDatum>
        >
        forceLink.links(graphData.current.links)

        //simulation.current.alpha(ALPHA_TARGET_REFRESH)
        simulation.current.restart()
      }
    })
  }

 

  const handleMount = React.useCallback((app: TldrawApp) => {
    // if(process.env["NEXT_PUBLIC_VERCEL_EN"] == '1'){
    //   console.log("im in vercel!")
    //   app = window.app
    // }else{
    //   console.log("im local!")
    //   app = rTldrawApp.current!
    // }

    rTldrawApp.current = app
    simulation.current = d3Sim(app.centerPoint)

    //app.camera.zoom =
    app.deleteAll() //replace this with make new document or something
    app.createShapes(defaultSticky(app.centerPoint))
  }, [])

  React.useEffect(() => {
    //https://sparkjava.com/documentation#examples-and-faq
    //https://stackoverflow.com/questions/18206231/saving-and-reloading-a-force-layout-using-d3-js
    const abortCurrentVersionController = new AbortController()
    const abortFileController = new AbortController()
    const abortVersionsController = new AbortController()
    const timeout = 2000

    const networkInterval = () => {
      console.log('network Interval')
      const app = rTldrawApp.current!
      if (!(app === undefined)) {
        //load/save file
        if (loadedFile.current === false) {
          console.log('requesting file...')
          if(loadFile.current === null){
            loadFileFromProcessing(loadFile,netData,newData, abortFileController)
            if (app.getShape('loading')) {
              const loadingDot = '.'
              app.updateShapes({
                id: 'loading',
                text: ' Quickpose is looking for a Processing Session' + loadingDot.repeat(i % 6),
              })
            }
          }else if(loadFile.current === undefined){
            loadedFile.current = true
            console.log('no file found!')
            //make new file, do intro experience?
          }else if(loadFile.current && simulation.current){ //we have a file and data
            //https://stackoverflow.com/questions/18206231/saving-and-reloading-a-force-layout-using-d3-js
            //Load the data
            const loadedData = JSON.parse(loadFile.current.assets["simData"].toString())
            graphData.current = loadedData
            simulation.current.nodes(graphData.current.nodes)
            const forceLink = simulation.current.force('link') as d3.ForceLink<
              d3.SimulationNodeDatum,
              d3.SimulationLinkDatum<d3.SimulationNodeDatum>
            >
            forceLink.links(graphData.current.links)
            simulation.current.alpha(parseInt(loadFile.current.assets["alpha"].toString()))
            app.loadDocument(loadFile.current.document)

            if (app.getShape('loading')) {//remove loading sticky
              app.delete(['loading']) 
            }
            console.log("loaded file",loadFile.current.document)
            loadedFile.current = true
          }
        }else { //default update loop
          console.log('saving/updating...')
          if (!(app.document === undefined)) {
            saveToProcessing(app.document, JSON.stringify(graphData.current), simulation.current.alpha(),null)
          }
          //BUG = have to do this more slowly, or else firefox will get angry
          //cant change url before last image has loaded - thats why its in the slower interval
          updateThumbnail(selectedNode, rTldrawApp)

          updateVersions(netData, newData, abortVersionsController)
        }
      }
    }

    //Update Current Version — (we want to do this very fast)
    const currentVersionInterval = () => {
      //console.log('update current version interval')
      updateCurrentVersion(currentVersion, timeout, abortCurrentVersionController)
    }

    //check for new data, if so, update graph data
    let i = 0 //Counter for sticky loading dots
    const dataInterval = () => {
      console.log('dataInterval')
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
        }
      }
      i++
    }

    //get data from processing
    const networkLoop = setInterval(networkInterval, timeout * 2)
    //look for current version
    const currentVersionLoop = setInterval(currentVersionInterval, 100)
    //put it into the graph
    const dataLoop = setInterval(dataInterval, 3000)
    //draw the graph
    const drawLoop = setInterval(drawInterval, 16)

    return () => {
      clearInterval(networkLoop)
      clearInterval(currentVersionLoop)
      clearInterval(dataLoop)
      clearInterval(drawLoop)
      abortVersionsController.abort()
      abortCurrentVersionController.abort()
    }
  }, [])

  //https://codesandbox.io/s/tldraw-context-menu-wen03q
  const handlePatch = React.useCallback((app: TldrawApp, reason?: string) => {
    //console.log(reason)
    drawInterval()
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
            sendFork(idInteger)
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
            sendSelect(idInteger)
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

  const { onAssetUpload } = useUploadAssets()

  return (
    <div className="tldraw">
      <Tldraw
        id={id}
        autofocus
        showPages={false}
        onMount={handleMount}
        onPatch={handlePatch}
        onPersist={handlePersist}
        onAssetUpload={onAssetUpload}
        onAssetCreate={onAssetUpload}
        {...fileSystemEvents}
        {...rest}
      />
      <BetaNotification />
    </div>
  )
}

export default Editor

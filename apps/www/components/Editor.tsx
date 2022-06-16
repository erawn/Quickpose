/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { 
  Tldraw, 
  TldrawApp, 
  TldrawProps, 
  useFileSystem, 
  TDShapeType, 
  ColorStyle, 
  TDShape, 
  shapeUtils, 
  ArrowBinding
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
import { useUploadAssets } from 'hooks/useUploadAssets'
import React, { FC } from 'react'
import * as gtag from 'utils/gtag'
import axios from 'axios'
import * as d3 from 'd3'
import { SimulationNodeDatum, SimulationLinkDatum } from 'd3'
import deepEqual from "deep-equal"

//declare const window: Window & { app: TldrawApp }


const D3_RADIUS = 5;
const TL_DRAW_RADIUS = 80;

interface EditorProps {
  id?: string
  isUser?: boolean
  isSponsor?: boolean
}

interface dataNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
}
type inputShape = { id: string; name?: string; type: TDShapeType } & Partial<TDShape>


const requestCurrentId = async () => {
  const response = await fetch('http://127.0.0.1:8080/currentVersion');
	const id = await response.json();
}

function d3toTldrawCoords(x,y): number[]{
    return [ Math.round((x * 10) - TL_DRAW_RADIUS), Math.round((y * 10) - TL_DRAW_RADIUS)]
}

const Editor: FC<EditorProps & Partial<TldrawProps>> = ({
  id = 'home',
  isUser = false,
  isSponsor = false,
  ...rest
}) => {
  
  const rTldrawApp = React.useRef<TldrawApp>()
  const netData = React.useRef<any>();
  const newData = React.useRef<boolean>(false);
  const graphtestdata = {
    nodes: [],
    links: []
  };
  const graphData = React.useRef<any>();
  graphData.current = graphtestdata

  const simulation = d3
  .forceSimulation()
  .force("center", d3.forceCenter(50,50))
  .force('charge', d3.forceManyBody().strength(-100))
  .force('collision', d3.forceCollide().radius(D3_RADIUS*10))
  .force("link", d3.forceLink()
    .id(function(d: dataNode,i) {
      return d.id
    })
    .distance(20)
    .strength(1)
  );


  onRightPointShape: TLPointerEventHandler = (info) => {
    if (!this.app.isSelected(info.target)) {
      this.app.select(info.target)
    }
  }


  const handleMount = React.useCallback((app: TldrawApp) => {
    
    // if(process.env["NEXT_PUBLIC_VERCEL_EN"] == '1'){
    //   console.log("im in vercel!")
    //   app = window.app
    // }else{
    //   console.log("im local!")
    //   app = rTldrawApp.current!
    // }
    // interface AppProps {
    //   onMount?: (api: Api) => void
    // }
    
    // export default function App({ onMount }: AppProps) {
    //   const appState = useStateDesigner(machine)
    
    //   React.useEffect(() => {
    //     const api = new Api(appState)
    //     onMount?.(api)
    //     window['api'] = api
    //   }, [])

    //app.onPatch = (app, reason) => console.log(reason)
    //https://codesandbox.io/s/tldraw-context-menu-wen03q
    app.onDragShape = (info,e) => console.log("dragging",info,e)
    app.onPatch = (app, reason) => console.log("patch", reason)
    app.onDoubleClickShape = (info,e) => console.log("dblclick",info,e)
    rTldrawApp.current = app

    //app.
    //app.camera.zoom =
    app.deleteAll()
    app.createShapes( 
      {
        id: 'loading',
        type: TDShapeType.Sticky,
        name: 'loading',
        childIndex: 1,
        point: app.centerPoint,
        size: [400, 400],
        isLocked: false,
        isGenerated: true,
        text: " Quickpose is looking for a Processing Session....",
        rotation: 0,
            "style": {
              "color": "black",
              "size": "large",
              "isFilled": false,
              "dash": "draw",
              "scale": 1,
              "font": "script",
              "textAlign": "middle"
            }
      } as inputShape,
    )

    

  }, [])

  // const onDragShape: TLPointerEventHandler = (e) => {
  //   console.log(e)

  // }
  
  
  React.useEffect(() => {

    const abortController = new AbortController();
    let i = 0
    const dataInterval = setInterval(() => {
        //console.log("requesting data...")
        axios.get('http://127.0.0.1:8080/versions.json', {
          timeout: 1000,
          signal: abortController.signal
        })
        .then(response => {
          if(!deepEqual(response.data,netData.current)){
            newData.current = true;
            netData.current = response.data
            //console.log("newdata",response.data)
          }else{
            //console.log("samedata",response.data)
          }
        })
        .catch(error => {
          console.error("error fetching: ", error);
        })

        //update loading sticky
        if(graphData.current == graphtestdata){
          const app = rTldrawApp.current!
          if(app.getShape('loading')){
            if(!(app === undefined)){
              const loadingDot = "."
              app.updateShapes({
                id: 'loading',
                text: " Quickpose is looking for a Processing Session" + loadingDot.repeat(i%6),
              })
            }
          }
        }
        i++
    }, 500)

    //check for new data, if so, update graph data
    const interval = setInterval(() => {
      
      // if(process.env["NEXT_PUBLIC_VERCEL_EN"] == '1'){
      //   console.log("im in vercel!")
      //   app = window.app
      // }else{
      //   console.log("im local!")
      //   app = rTldrawApp.current!
      // }
      const app = rTldrawApp.current!
      if(!(app === undefined)){
        
        //https://medium.com/ninjaconcept/interactive-dynamic-force-directed-graphs-with-d3-da720c6d7811
        if(newData.current){ //if we have new data come in

          if(app.getShape("loading")){
            app.delete(["loading"]) //remove loading sticky
          }

          if(netData.current && graphData.current){ //and we have our datasources ready

            //add new links and nodes from netData into graphData
            //only adding nodes and links, so we can just append new incoming data to graphData
            netData.current[0].forEach(function(netNode){
              if(!graphData.current.nodes.some(graphNode => graphNode.id === netNode.id)){
                graphData.current.nodes = [...graphData.current.nodes,{...netNode}]
              }
            })
            netData.current[1].forEach(function(netLink){
              if(!graphData.current.links.some(graphLink => (graphLink.source.id === netLink.source) && (graphLink.target.id === netLink.target))){
                
                graphData.current.links = [...graphData.current.links,{...netLink}]
                //console.log("appending", netLink)
              }
            })
            
            //console.log("netdata", netData.current[1])
            simulation.nodes(graphData.current.nodes);
            const forceLink = simulation.force("link") as d3.ForceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>;
            forceLink.links(graphData.current.links)
          }
          newData.current = false
          //console.log("graphdatanodes",graphData.current.nodes,graphData.current.links)
        }
      }
    }, 500)
    //const result = await this.callbacks.onAssetCreate(this, file, id)
    //^from tldrawapp.ts
    const drawInterval = setInterval(() => {

      const app = rTldrawApp.current!
      if(graphData.current && !(app === undefined)){
        graphData.current.nodes = [...simulation.nodes()]; //get simulation data out
        const addNodes = graphData.current.nodes.map(function(node: dataNode){
          const tlDrawNode = app.getShape('node'+node.id)
          if(!tlDrawNode){
            let n = {
            id: 'node'+node.id,
            isLocked: false,
            isGenerated: true,
            type: TDShapeType.Rectangle,
            name: 'node'+node.id,
            point: d3toTldrawCoords(node.x,node.y),
            size: [TL_DRAW_RADIUS,TL_DRAW_RADIUS]
           } as inputShape

           

           return n
          }else{
            return null
          }
        }).filter(entry => entry !== null)

        if(addNodes.length > 0){
          app.createShapes(...addNodes)
        }                
        const updateNodes = graphData.current.nodes.map(function(node: dataNode){
          const tlDrawNode = app.getShape('node'+node.id)
          if(tlDrawNode){
            const coords = d3toTldrawCoords(node.x ,node.y);
            if (Math.abs(tlDrawNode.point[0] - coords[0]) > .1 || 
              Math.abs(tlDrawNode.point[1] - coords[1]) > .1){
                return {
                    ...tlDrawNode,
                    point: coords,
                    size: [TL_DRAW_RADIUS,TL_DRAW_RADIUS],
                }
            }else{
              return null
            }
          }
        }).filter(entry => entry !== null)
        if(updateNodes.length > 0){
          app.updateShapes(...updateNodes)
        }  
        
        //draw links
        const newLinks = graphData.current.links.map(function(link: SimulationLinkDatum<SimulationNodeDatum> ){
          const tlDrawLink = app.getShape('link'+link.index)
          const sourceNode = link.source as dataNode
          const targetNode = link.target as dataNode
          const startNode: TDShape = app.getShape('node'+sourceNode.id)
          const endNode: TDShape = app.getShape('node'+targetNode.id)

          if(startNode && endNode){
            const newStartBinding: ArrowBinding = {
              id: 'link'+link.index+'start',
              fromId: 'link'+link.index,
              toId: startNode.id,
              handleId: 'start',
              distance: 16,
              point: [.5,.5]
            }
            const newTargetBinding: ArrowBinding = {
              id: 'link'+link.index+'end',
              fromId: 'link'+link.index,
              toId: endNode.id,
              handleId: 'end',
              distance: 16,
              point: [.5,.5]
            }

            if(!tlDrawLink){
              const newArrow = shapeUtils.arrow.getShape({
                id: 'link'+link.index,
                name: 'link'+link.index,
                type: TDShapeType.Arrow,
                parentId: app.currentPageId,
                isLocked: false,
                isGenerated: true,
                point: [100,100],
                style: { ...app.appState.currentStyle },
                handles: {
                  start: {
                    canBind: true,
                    bindingId: 'link'+link.index+'start',
                    id: "start",
                    index: 0,
                    point: [0, 0],
                  },
                  end: {
                    canBind: true,
                    bindingId: 'link'+link.index+'end',
                    index: 1,
                    id: "end",
                    point: [1, 1],
                  },
                  bend: {
                    id: "bend",
                    "index": 2,
                    point: [.5, .5],
                  }
                }
              })
              return newArrow
            }else{
              let startBinding = app.getBinding('link'+link.index+'start')
              let endBinding = app.getBinding('link'+link.index+'end')

              if(!startBinding){
                startBinding = newStartBinding
              }
              if(!endBinding){
                endBinding = newTargetBinding
              }

              tlDrawLink.handles.start.bindingId = 'link'+link.index+'start'
              tlDrawLink.handles.end.bindingId = 'link'+link.index+'end'

              app.updateShapes(tlDrawLink)
              
              app.page.bindings[startBinding.id] = startBinding
              app.page.bindings[endBinding.id] = endBinding
            }
          }
          return null
        }).filter(entry => entry !== null)

        if(newLinks.length > 0){
          app.createShapes(...newLinks) 
        }
      }
    },100)

    return () => {
      clearInterval(interval)
      clearInterval(dataInterval)
      clearInterval(drawInterval)
      abortController.abort();
    }
  },[]);

 

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
  

  const { onSignIn, onSignOut } = useAccountHandlers()

  const { onAssetUpload } = useUploadAssets()

  return (
    <div className="tldraw">
      <Tldraw
        id={id}
        autofocus
        onMount={handleMount}
        onPersist={handlePersist}
        showSponsorLink={!isSponsor}
        onSignIn={isSponsor ? undefined : onSignIn}
        onSignOut={isUser ? onSignOut : undefined}
        onAssetUpload={onAssetUpload}
        {...fileSystemEvents}
        {...rest}
      />
    </div>
  )
}

export default Editor

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Tldraw, TldrawApp, TldrawProps, useFileSystem, TDShapeType, ColorStyle, TDShape, Arrow } from '@tldraw/tldraw'
import { useAccountHandlers } from 'hooks/useAccountHandlers'
import { useUploadAssets } from 'hooks/useUploadAssets'
import React, { FC } from 'react'
import * as gtag from 'utils/gtag'
import axios from 'axios'
import * as d3 from 'd3'
import { SimulationNodeDatum, SimulationLinkDatum } from 'd3'
import deepEqual from "deep-equal"
import { nanoid } from 'nanoid'
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
type inputShape = { id: string; type: TDShapeType } & Partial<TDShape>


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

    rTldrawApp.current = app

    app.deleteAll()
    app.createShapes( 
      {
        id: 'rect1',
        type: TDShapeType.Rectangle,
        name: 'Rectangle',
        childIndex: 1,
        point: [0, 0],
        size: [100, 100],
      } as inputShape,
      {
        id: 'rect2',
        name: 'Rectangle',
        type: TDShapeType.Rectangle,
        point: [200, 200],
        size: [100, 100],
      } as inputShape
    )

  }, [])

  
  React.useEffect(() => {

    const abortController = new AbortController();
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
    }, 5000)


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
          //console.log("we have new data")
          if(netData.current && graphData.current){ //and we have our datasources ready

            //add new links and nodes from netData into graphData
            //only adding nodes and links, so we can just append new incoming data to graphData
            netData.current[0].forEach(function(netNode){
              if(!graphData.current.nodes.some(graphNode => graphNode.id === netNode.id)){
                graphData.current.nodes = [...graphData.current.nodes,netNode]
              }
            })
            netData.current[1].forEach(function(netLink){
              if(!graphData.current.links.some(graphLink => (graphLink.source === netLink.source) && 
                                                              (graphLink.target === netLink.target))){
                graphData.current.links = [...graphData.current.links,netLink]
              }
            })
            simulation.nodes(graphData.current.nodes);
            const forceLink = simulation.force("link") as d3.ForceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>;
            forceLink.links(graphData.current.links)
          }
          newData.current = false
          console.log(graphData.current.nodes,graphData.current.links)
        }
      }
    }, 50)
    //const result = await this.callbacks.onAssetCreate(this, file, id)
    //^from tldrawapp.ts
    const drawInterval = setInterval(() => {

      const app = rTldrawApp.current!
      if(graphData.current && !(app === undefined)){
        graphData.current.nodes = [...simulation.nodes()]; //get simulation data out
        const addNodes = graphData.current.nodes.map(function(node: dataNode){
          const tlDrawNode = app.getShape('node'+node.id)
          if(!tlDrawNode){
            return{
            id: 'node'+node.id,
            type: TDShapeType.Rectangle,
            name: 'node'+node.id,
            point: d3toTldrawCoords(node.x,node.y),
            size: [TL_DRAW_RADIUS,TL_DRAW_RADIUS],
           } as inputShape
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
                  id: 'node'+node.id, 
                    type: TDShapeType.Rectangle,
                    style: {
                      ...tlDrawNode.style, 
                    },
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
          console.log('node'+link.source,'node'+link.target)
          const startNode: TDShape = app.getShape('node'+link.source)
          const endNode: TDShape = app.getShape('node'+link.target)
          console.log(startNode,endNode)
          if(!tlDrawLink && startNode && endNode){
            
            const newArrow = Arrow.create({
              id: 'link'+link.index,
              parentId: app.currentPageId,
              childIndex: 1,
              point: [100,100],
              style: { ...app.appState.currentStyle },
            })

            newArrow.handles.start.canBind = true
            newArrow.handles.start.bindingId = startNode.id
            newArrow.handles.end.canBind = true
            newArrow.handles.end.bindingId = endNode.id
            return newArrow
          }else{
            return null
          }
        }).filter(entry => entry !== null)
        if(newLinks.length > 0){
          app.createShapes(newLinks)
          console.log("newlinks",newLinks)
        }
        

        // const updateLinks = graphData.current.links.map(function(link: SimulationLinkDatum<SimulationNodeDatum> ){
        //   const tlDrawLink = app.getShape('link'+link.index)
        //   const startNode: TDShape = app.getShape('node'+link.source)
        //   const endNode: TDShape = app.getShape('node'+link.target)
        //   if(!tlDrawLink && startNode && endNode){
            
        //     const newArrow = Arrow.create({
        //       id: 'link'+link.index,
        //       parentId: app.currentPageId,
        //       childIndex: 1,
        //       point: [100,100],
        //       style: { ...app.appState.currentStyle },
        //     })

        //     newArrow.handles.start.canBind = true
        //     newArrow.handles.start.bindingId = startNode.id
        //     newArrow.handles.end.canBind = true
        //     newArrow.handles.end.bindingId = endNode.id
        //     return newArrow
        //   }else{
        //     return null
        //   }
        // }).filter(entry => entry !== null)
        // if(updateNodes.length > 0){
        //   app.updateShapes(...updateNodes)
        // } 
      }
    },10)

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

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
  TDImageAsset
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
import React from 'react'
import * as gtag from 'utils/gtag'
import axios from 'axios'
import * as d3 from 'd3'
import { SimulationNodeDatum, SimulationLinkDatum } from 'd3'
import deepEqual from "deep-equal"

//declare const window: Window & { app: TldrawApp }


const D3_RADIUS = 5;
const TL_DRAW_RADIUS = 80;
const ALPHA_TARGET_REFRESH = .1

interface EditorProps {
  id?: string
}

interface dataNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
}
type inputShape = { id: string; name?: string; type: TDShapeType;} & Partial<TDShape>


const requestCurrentId = async () => {
  const response = await fetch('http://127.0.0.1:8080/currentVersion');
	const id = await response.json();
}

function d3toTldrawCoords(x,y): number[]{
    return [ (x * 10) - TL_DRAW_RADIUS, (y * 10) - TL_DRAW_RADIUS]
}
function tldrawCoordstod3(x,y):number[] {
  return [ (x + TL_DRAW_RADIUS) / 10, (y + TL_DRAW_RADIUS) / 10]
}
function getIconImageURLNoTime(id:string){
	return 'http://127.0.0.1:8080' + "/image/" + id; //Add Time to avoid Caching so images update properly
}

function getIconImageURL(id:string){
	return 'http://127.0.0.1:8080' + "/image/" + id + "?" + ((new Date()).getTime()); //Add Time to avoid Caching so images update properly
}
const updateBinding = (app:TldrawApp, link, startNode,endNode,drawLink) => {
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
  let startBinding = app.getBinding('link'+link.index+'start')
  let endBinding = app.getBinding('link'+link.index+'end')

  if(!startBinding){startBinding = newStartBinding}
  if(!endBinding){endBinding = newTargetBinding}

  drawLink.handles.start.bindingId = 'link'+link.index+'start'
  drawLink.handles.end.bindingId = 'link'+link.index+'end'

  app.page.bindings[startBinding.id] = startBinding
  app.page.bindings[endBinding.id] = endBinding
}

const makeArrow = (parentId, style, link): ArrowShape => {
  return shapeUtils.arrow.getShape({
    hideFromSelection: true,
    id: 'link'+link.index,
    name: 'link'+link.index,
    type: TDShapeType.Arrow,
    parentId: parentId,
    isLocked: false,
    isGenerated: true,
    point: [100,100],
    style: { ...style },
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
}


const Editor = ({
  id = 'home',
  isUser = false,
  isSponsor = false,
  ...rest
}: EditorProps & Partial<TldrawProps>) => {
  
  const rTldrawApp = React.useRef<TldrawApp>()
  const netData = React.useRef<any>();
  const newData = React.useRef<boolean>(false);
  const rIsDragging = React.useRef(false);
  const selectedNode = React.useRef<string>(null);
  const lastSelection = React.useRef<string>(null)
  const graphData = React.useRef<any>();

  const nodeRegex = new RegExp(/node\d/);
  const linkRegex = new RegExp(/link\d/);

  const graphtestdata = {
    nodes: [],
    links: []
  };
  graphData.current = graphtestdata
  
  const simulation = React.useRef<d3.Simulation<SimulationNodeDatum,undefined>>();

  const drawInterval = () => {
    const app = rTldrawApp.current!
  
    if(graphData.current && !(app === undefined) && simulation.current){
      simulation.current.alpha(ALPHA_TARGET_REFRESH)
      simulation.current.restart()
      graphData.current.nodes = [...simulation.current.nodes()]; //get simulation data out
      const tlNodes = app.getShapes().filter(shape => nodeRegex.test(shape.id)) 
      const updateNodes = []
      const addNodes = graphData.current.nodes.map(function(node: dataNode){
        const tlDrawNode = tlNodes.find(n => n.id === 'node'+node.id)
       
        if(!tlDrawNode){
          const n = {
          id: 'node'+node.id,
          name: 'node'+node.id,
          type: TDShapeType.VersionNode,
          parentId: 'page',
          style:{
            isFilled:true,
            color: "black"
          },
          point: d3toTldrawCoords(node.x,node.y),
          radius: [TL_DRAW_RADIUS,TL_DRAW_RADIUS],
          imgLink: getIconImageURLNoTime(node.id.toString())
         } as inputShape
         return n
        }else if(tlDrawNode && tlDrawNode.type == TDShapeType.VersionNode){ 
          if(app.selectedIds.includes(tlDrawNode.id)){ //If we have a node selected, update the d3 sim instead
            const d3Coords = tldrawCoordstod3(tlDrawNode.point[0],tlDrawNode.point[1])
            node.x = d3Coords[0]
            node.y = d3Coords[1]
          }
          if(tlDrawNode.id === selectedNode.current){ //If our node is the current version
            tlDrawNode.style.color = ColorStyle.Green
            tlDrawNode.style.size = SizeStyle.Large
          }else{
            tlDrawNode.style.color = ColorStyle.Black
            tlDrawNode.style.size = SizeStyle.Small
          }
          tlDrawNode.point = d3toTldrawCoords(node.x ,node.y) //Update location either way
          updateNodes.push(tlDrawNode)
        }else{
          return null
        }
      }).filter(entry => entry !== null && !(entry === undefined))
      if(addNodes.length > 0){
        console.log(addNodes)
        app.createShapes(...addNodes)
      }   
      if(updateNodes.length > 0){
        app.updateShapes(...updateNodes)
      }  
  
      
      //draw links
      const updateLinks: TDShape[] = [];
      const tlLinks = app.getShapes().filter(shape => linkRegex.test(shape.id))
      const newLinks = graphData.current.links.map(function(link: SimulationLinkDatum<SimulationNodeDatum> ){
        const tlDrawLink = tlLinks.find(l => l.id === 'link'+link.index)
        const sourceNode = link.source as dataNode
        const targetNode = link.target as dataNode
        const startNode: TDShape = tlNodes.find(n => n.id === 'node'+sourceNode.id)
        const endNode: TDShape = tlNodes.find(n => n.id === 'node'+targetNode.id)
  
        if(startNode && endNode){
          if(!tlDrawLink){
            const newArrow = makeArrow(app.currentPageId,app.appState.currentStyle ,link)
            updateBinding(app, link, startNode,endNode,newArrow)
            return newArrow
          }else{
            updateBinding(app, link, startNode,endNode,tlDrawLink)
            updateLinks.push(tlDrawLink)
          }
        }
        return null
      }).filter(entry => entry !== null && !(entry === undefined)) as TDShape[]
      if(updateLinks.length > 0){
        app.updateShapes(...updateLinks)
      }
      if(newLinks.length > 0){
        app.createShapes(...newLinks) 
        //deselect created links
        const newIds: string[] = newLinks.map((link) => link.id)
        app.select(...app.selectedIds.filter((id) => !newIds.includes(id)))
      }
    }
  }
 
      //https://codesandbox.io/s/tldraw-context-menu-wen03q
  const handlePatch = React.useCallback((app: TldrawApp, reason?: string) => {

    
    //console.log(reason)
    drawInterval()
    switch (reason) {
          
          case "set_status:translating": {
            // started translating...
            rIsDragging.current = true;

            const bounds = Utils.getCommonBounds(
              app.selectedIds.map((id) => app.getShapeBounds(id))
            );

            // elm.style.setProperty("opacity", "1");
            // elm.style.setProperty("width", bounds.width + "px");
            // elm.style.setProperty(
            //   "transform",
            //   `translate(${bounds.minX}px, ${bounds.minY - 64}px)`
            // );
            break;
          }
          case "session:TranslateSession": {
            if (rIsDragging.current) {
              // Dragging...
              const bounds = Utils.getCommonBounds(
                app.selectedIds.map((id) => app.getShapeBounds(id))
                
              );
              // app.selectedIds.filter((id) => nodeRegex.test(id)).forEach((id) => {
              //   let selectedNode = app.getShape(id)

              //   if(selectedNode){
              //     let d3Node = selectedNode.node
              //     const d3Coords = tldrawCoordstod3(selectedNode.point[0],selectedNode.point[1])
              //     d3Node.x = d3Coords[0]
              //     d3Node.y = d3Coords[1]
              //     d3Node.fx = d3Coords[0]
              //     d3Node.fy = d3Coords[1]
                  
              //   }

                

              // })
              // elm.style.setProperty("opacity", "1");
              // elm.style.setProperty("width", bounds.width + "px");
              // elm.style.setProperty(
              //   "transform",
              //   `translate(${bounds.minX}px, ${bounds.minY - 64}px)`
              // );
            }
            break;
          }
          case "set_status:idle": {
            if (rIsDragging.current) {
              // stopped translating...
              //elm.style.setProperty("opacity", "0");
              rIsDragging.current = false;
            }
            break;
          }
          case "selected": {

            //Select Node
            lastSelection.current = selectedNode.current
            if(app.selectedIds.length == 1 && 
              app.getShape(app.selectedIds[0]).type === TDShapeType.VersionNode){
              console.log("selected Node")
              selectedNode.current = app.selectedIds[0]
              //const node = app.getShape(app.selectedIds[0])
              //single click
              //double click
              //clear selection

            }


            
            break
          }
        }
      }, []);


  const handleMount = React.useCallback((app: TldrawApp) => {
    
    // if(process.env["NEXT_PUBLIC_VERCEL_EN"] == '1'){
    //   console.log("im in vercel!")
    //   app = window.app
    // }else{
    //   console.log("im local!")
    //   app = rTldrawApp.current!
    // }
    rTldrawApp.current = app
    const coords = tldrawCoordstod3(...app.centerPoint as [number,number])
    simulation.current = d3
    .forceSimulation()
    .force("center", d3.forceCenter(coords[0],coords[1]))
    .force('charge', d3.forceManyBody().strength(-100))
    .force('collision', d3.forceCollide().radius(D3_RADIUS*10))
    .force("link", d3.forceLink()
      .id(function(d: dataNode,i) {
        return d.id
      })
      .distance(20)
      .strength(1)
    ).on('tick', () => {
      drawInterval()
      console.log("simref draw")
    });
    

    
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
      } as inputShape
    )
  }, [])

  React.useEffect(() => {

    const abortController = new AbortController();
    const timeout = 2000
    const networkInterval = () => {
        console.log("requesting data...")
        const app = rTldrawApp.current!
        if(!(app === undefined) && selectedNode.current){
          //BUG = have to do this more slowly, or else firefox will get angry
          //cant change url before last image has loaded - thats why its in the slower interval
          const selectedShape = app.getShape(selectedNode.current)
          if(selectedShape.type == TDShapeType.VersionNode){
            const idInteger = selectedShape.id.replace(/\D/g,"")
            selectedShape.imgLink = getIconImageURL(idInteger)//refresh the thumbnail image
          }
        }
        axios.get('http://127.0.0.1:8080/versions.json', {
          timeout: timeout,
          signal: abortController.signal
        })
        .then(response => {
          if(!deepEqual(response.data,netData.current)){
            newData.current = true;
            netData.current = response.data
            //console.log("newdata",response.data)
            dataInterval()
          }else{
            //console.log("samedata",response.data)
          }
        })
        .catch(error => {
          //console.error("error fetching: ", error);
        })
    }

    //check for new data, if so, update graph data
    let i = 0 //Counter for sticky loading dots
    const dataInterval = () => {
      
      // if(process.env["NEXT_PUBLIC_VERCEL_EN"] == '1'){
      //   console.log("im in vercel!")
      //   app = window.app
      // }else{
      //   console.log("im local!")
      //   app = rTldrawApp.current!
      // }
      const app = rTldrawApp.current!
      if(simulation.current && !(app === undefined)){
        //update loading sticky
        if(graphData.current == graphtestdata){
          const app = rTldrawApp.current!
          if(app.getShape('loading')){
              const loadingDot = "."
              app.updateShapes({
                id: 'loading',
                text: " Quickpose is looking for a Processing Session" + loadingDot.repeat(i%6),
              })
            }
          }
        
        //https://medium.com/ninjaconcept/interactive-dynamic-force-directed-graphs-with-d3-da720c6d7811
        if((newData.current === true) && netData.current && graphData.current){ //if we have new data come in

          let changed = false
          newData.current = false
          //and we have our datasources ready
          //add new links and nodes from netData into graphData
          //only --adding-- nodes and links, so we can just append new incoming data to graphData
          netData.current[0].forEach(function(netNode){
            if(!graphData.current.nodes.some(graphNode => graphNode.id === netNode.id)){
              graphData.current.nodes = [...graphData.current.nodes,{...netNode}]
              changed = true
            }
          })
          netData.current[1].forEach(function(netLink){
            if(!graphData.current.links.some(graphLink => (graphLink.source.id === netLink.source) && (graphLink.target.id === netLink.target))){
              graphData.current.links = [...graphData.current.links,{...netLink}]
              changed = true
            }
          })
          if(changed){
            simulation.current.nodes(graphData.current.nodes);
            const forceLink = simulation.current.force("link") as d3.ForceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>;
            forceLink.links(graphData.current.links)

            if(app.getShape("loading")){
              app.delete(["loading"]) //remove loading sticky
            }
            drawInterval()
          }
        }
        i++
      }
    }

    //Draw shapes
    
    const networkLoop = setInterval(networkInterval,timeout*2)
    const dataLoop = setInterval(dataInterval,3000)
    //const drawLoop = setInterval(drawInterval,100)
  //   if(simulation.current){
  //     simulation.current = simulation.current.on('tick', () => {
  //       drawInterval()
  //       console.log("draw")});
      
  // }
    
    return () => {
      clearInterval(networkLoop)
      clearInterval(dataLoop)
      //clearInterval(drawLoop)
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

  const { onAssetUpload } = useUploadAssets()

  return (
    <div className="tldraw">
      <Tldraw
        id={id}
        autofocus
        onMount={handleMount}
        onPatch={handlePatch}
        onPersist={handlePersist}
        onAssetUpload={onAssetUpload}
        {...fileSystemEvents}
        {...rest}
      />
      <BetaNotification />
    </div>
  )
}

export default Editor

import { AlignStyle, ArrowBinding, ArrowShape, ColorStyle, DashStyle, shapeUtils, SizeStyle, TDBinding, TDShape, TDShapeType, TldrawApp, VersionNodeShape } from "@tldraw/tldraw"
import { dataLink, dataNode, inputShape, inputVersionNodeShape } from "./quickPoseTypes"
import deepEqual from "deep-equal";
import { ALPHA_TARGET_REFRESH, d3TlScale, D3_LINK_DISTANCE, TL_DRAW_RADIUS } from "components/Editor";
import { getIconImageURLNoTime } from "./quickPoseNetworking"
import { forceSimulation, forceManyBody, forceLink, forceCollide} from "d3";
import forceBoundary from 'd3-force-boundary'
import type  {Patch, TLBounds} from "@tldraw/core";
import next from "next";

export const nodeRegex = new RegExp(/node\d/);
export const linkRegex = new RegExp(/link\d/);

export const d3Sim = (centerPoint,bounds:TLBounds) => {
    const coords = tldrawCoordstod3(...centerPoint as [number,number])
    const boundary = tldrawCoordstod3(bounds.maxX,bounds.maxY)
    //console.log(bounds,boundary)
    return forceSimulation()
    .force("boundary", forceBoundary(0,0,500,500))
    //.force("center", d3.forceCenter(coords[0],coords[1]).strength(.1))
    .force('charge', forceManyBody().strength(-2))
    .force("link", forceLink()
      .id(function(d:dataNode,i) {
        return d.id
      })
      .distance(function(l:dataLink){
        return D3_LINK_DISTANCE
        if(l.d !== undefined){
          //console.log(l.d)
          return l.d
          
        }else{
          return 20
        }
      }).strength(1)
    )
    .force('collision', forceCollide().radius(function(d: dataNode) {return d.r + 10} ))
    .alphaDecay(.03)
}

export const defaultSticky = (centerPoint) => {
    return {
    id: 'loading',
    type: TDShapeType.Sticky,
    name: 'loading',
    childIndex: 1,
    point: centerPoint,
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
}



export const graphBaseData = {
    nodes: [],
    links: []
  };

export function d3toTldrawCoords(x,y): number[]{
    return [ (x * d3TlScale) - TL_DRAW_RADIUS, (y * d3TlScale) - TL_DRAW_RADIUS]
}

export function tldrawCoordstod3(x,y):number[] {
    return [ (x + TL_DRAW_RADIUS) / d3TlScale, (y + TL_DRAW_RADIUS) / d3TlScale]
  }

export const makeArrow = (parentId, link): ArrowShape => {
    return shapeUtils.arrow.getShape({
      hideFromSelection: true,
      id: 'link'+link.index,
      name: 'link'+link.index,
      type: TDShapeType.Arrow,
      parentId: parentId,
      isLocked: false,
      isGenerated: true,
      point: [100,100],
      style:{
        size: SizeStyle.Small,
        dash: DashStyle.Dotted,
        isFilled:true,
        color: ColorStyle.Indigo
      },
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
export const updateBinding = (app:TldrawApp, link, startNode,endNode,drawLink,nextBindings):boolean => {
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
    let changed = false
    let startBinding = app.getBinding('link'+link.index+'start')
    let endBinding = app.getBinding('link'+link.index+'end')
  
    if(!startBinding){
      startBinding = newStartBinding
    }
    if(!endBinding){
      endBinding = newTargetBinding
    }
    if(drawLink.handles.start.bindingId !== 'link'+link.index+'start'){
      drawLink.handles.start.bindingId = 'link'+link.index+'start'
      changed = true
    }
    if(drawLink.handles.end.bindingId !== 'link'+link.index+'end'){
      drawLink.handles.end.bindingId = 'link'+link.index+'end'
      changed = true
    }
    if(!deepEqual(app.page.bindings[startBinding.id], startBinding) ){
      nextBindings[startBinding.id] = startBinding
    }
    if(!deepEqual(app.page.bindings[endBinding.id], endBinding) ){
      nextBindings[endBinding.id] = endBinding
    }
    return changed;
  }

  export const updateLinkShapes = (app: TldrawApp, tlLinks, graphData, tlNodes): [Patch<Record<string, TDShape>>,Patch<Record<string, TDBinding>>,TDShape[]] => {
    //draw links
    const nextShapes: Patch<Record<string, TDShape>> = {}
    const nextBindings: Patch<Record<string, TDBinding>> = {}
    const createShapes: TDShape[] = []
    graphData.current.links.map(function(link: dataLink){
      const tlDrawLink = tlLinks.find(l => l.id === 'link'+link.index)
      const sourceNode = link.source as dataNode
      const targetNode = link.target as dataNode
      const startNode: TDShape = tlNodes.find(n => n.id === 'node'+sourceNode.id)
      const endNode: TDShape = tlNodes.find(n => n.id === 'node'+targetNode.id)

      if(startNode && endNode){
        if(!tlDrawLink){
          const newArrow = makeArrow(app.currentPageId,link)
          //updateBinding(app, link, startNode,endNode,newArrow,nextBindings)
          //nextShapes[newArrow.id] = newArrow
          createShapes.push(newArrow)
        }else{
          if(updateBinding(app, link, startNode,endNode,tlDrawLink,nextBindings)){
            nextShapes[tlDrawLink.id] = {...tlDrawLink}
          }
        }
        link.d = D3_LINK_DISTANCE + sourceNode.r + targetNode.r
        link.strength = 10
      }
      return null
    })
    return [nextShapes,nextBindings,createShapes]
  }

  export const updateNodeShapes = (graphData, tlNodes,currentVersion,centerPoint,selectedIds):[Patch<Record<string, TDShape>>,inputVersionNodeShape[]] => {
    const nextShapes: Patch<Record<string, TDShape>> = {}
    const createShapes: inputVersionNodeShape[] = []
    graphData.nodes.map(function(node: dataNode){
      const tlDrawNode:VersionNodeShape = tlNodes.find(n => n.id === 'node'+node.id)
      //console.log(tlDrawNode)
      if(!tlDrawNode){
          const n = shapeUtils.versionNode.getShape({
              id: 'node'+node.id,
              name: 'node'+node.id,
              type: TDShapeType.VersionNode,
              isFixed: false,
              style:{
                  size: "small",
                  dash: DashStyle.Dotted,
                  isFilled:true,
                  color: "black"
              },
              point: d3toTldrawCoords(node.x,node.y),
              radius: [TL_DRAW_RADIUS,TL_DRAW_RADIUS],
              imgLink: getIconImageURLNoTime(node.id.toString())
          } as inputVersionNodeShape)
          if(n.id === "node0"){
            n.isFixed = true;
          }
          node.r = n.radius[0] / d3TlScale
          console.log("found new shape")
          //nextShapes[n.id] = n
          createShapes.push(n)
          //nextShapes[n.id] = {...n}

      }else if(tlDrawNode){ 
          const baseNode = {...tlDrawNode}
          if(selectedIds.includes(tlDrawNode.id)){ //If we have a node selected, update the d3 sim instead
              const d3Coords = tldrawCoordstod3(tlDrawNode.point[0],tlDrawNode.point[1])
              node.x = d3Coords[0]
              node.y = d3Coords[1]
              node.fx = d3Coords[0]
              node.fy = d3Coords[1]
              node.r = (tlDrawNode.radius[0] / d3TlScale)
          }else{
            node.fx = null
            node.fy = null
          }
          if(currentVersion.current && tlDrawNode.id === 'node'+currentVersion.current){ //If our node is the current version
              if(tlDrawNode.isCurrent === false){
                nextShapes[tlDrawNode.id] = {...nextShapes[tlDrawNode.id], isCurrent: true}
              }
          }else{
            if(tlDrawNode.isCurrent === true){
              nextShapes[tlDrawNode.id] = {...nextShapes[tlDrawNode.id], isCurrent: false}
            }
          }
          
          let newCoords = {...tlDrawNode.point}
          if(node.id === '0'){
              node.fx = tldrawCoordstod3(...centerPoint as [number,number])[0]
              node.fy = tldrawCoordstod3(...centerPoint as [number,number])[1]
              node.x = tldrawCoordstod3(...centerPoint as [number,number])[0]
              node.y = tldrawCoordstod3(...centerPoint as [number,number])[1]
              newCoords = centerPoint as [number,number]
              const newPoint = d3toTldrawCoords(node.x ,node.y)
              if(newPoint !== tlDrawNode.point){
                nextShapes[tlDrawNode.id] = {...nextShapes[tlDrawNode.id], point: newPoint}
              }
          }else{
              newCoords = d3toTldrawCoords(node.x ,node.y)
          }
          if (Math.abs(newCoords[0] - tlDrawNode.point[0]) > .1 || Math.abs(newCoords[1] - tlDrawNode.point[1]) > .1){
            nextShapes[tlDrawNode.id] = {...nextShapes[tlDrawNode.id], point: newCoords}
          }
      }
    })
    //console.log(nextShapes)

    return [nextShapes,createShapes]
  }

  export function updateGraphData(netData: JSON, graphData: { nodes: any[]; links: any[]; }){

    //https://medium.com/ninjaconcept/interactive-dynamic-force-directed-graphs-with-d3-da720c6d7811
      //if we have new data come in
      //console.log('dataInterval')
      let changed = false
      //console.log("updatenetdata",netData)
      //and we have our datasources ready
      //add new links and nodes from netData into graphData
      //only --adding-- nodes and links, so we can just append new incoming data to graphData
      netData["Nodes"].forEach(function (netNode: dataNode) {
        if (!graphData.nodes.some((graphNode) => graphNode.id === netNode.id)) {
          const parentLink = netData["Edges"].find((link) => link.target === netNode.id)
          if (!(parentLink === undefined)) {
            const parent: dataNode = graphData.nodes.find(
              (node) => node.id === parentLink.source
            )
            if (!(parent === undefined)) { //spawn new nodes near their parents
              netNode.x = parent.x + 10
              netNode.y = parent.y + 10
            }
          }
          graphData.nodes.push(netNode)
          //graphData.nodes = [...graphData.nodes, { ...netNode }]
          changed = true
        }
      })
      netData["Edges"].forEach(function (netLink) {
        if (
          !graphData.links.some(
            (graphLink) =>
              graphLink.source.id === netLink.source && graphLink.target.id === netLink.target
          )
        ) {
          graphData.links.push(netLink)
          //graphData.links = [...graphData.links, { ...netLink }]
          changed = true
        }
      })
      return changed
  }

  export const installHelper = (centerPoint) => {
    return [{
      "id": "installHelper1",
      "type": "text",
      "name": "Text",
      "point": [centerPoint[0]-220,centerPoint[1]+250],//[247.14, 653.4],
      "rotation": 0,
      "text": "1. Download Processing 3.5.4 from\n https://processing.org/download\n(you'll have to open it once to make your\n /Processing Folder appear in your Documents)",
      "style": {
        "color": "white",
        "size": "small",
        "isFilled": false,
        "dash": "solid",
        "scale": 0.9789379019143146,
        "font": "script",
        "textAlign": "middle"
      }
    } as inputShape,
    {
      "id": "installHelper2",
      "type": "text",
      "name": "Text",
      "point": [centerPoint[0]+200,centerPoint[1]+250],//[670.88, 652.49],
      "rotation": 0,
      "text": "2. Extract Quickpose to /Processing/tools, \nrestart Processing,\nopen a new sketch (save first), \nand click Tools-> Quickpose. ",
      "style": {
        "color": "white",
        "size": "small",
        "isFilled": false,
        "dash": "solid",
        "scale": 1,
        "font": "script",
        "textAlign": "middle"
      }
    } as inputShape,
    {
      "id": "installHelper3",
      "type": "text",
      "name": "Text",
      "point": [centerPoint[0]+130,centerPoint[1]+200],//[574.34, 607.04],
      "rotation": 0,
      "text": "To get started:",
      "style": {
        "color": "white",
        "size": "small",
        "isFilled": false,
        "dash": "solid",
        "scale": 1,
        "font": "script",
        "textAlign": "middle"
      }
    } as inputShape
  ]

}
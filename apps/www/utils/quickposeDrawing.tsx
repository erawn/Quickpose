import { ArrowBinding, ArrowShape, ColorStyle, DashStyle, shapeUtils, SizeStyle, TDShape, TDShapeType, TldrawApp, VersionNodeShape } from "@tldraw/tldraw"
import { dataLink, dataNode, inputShape, inputVersionNodeShape } from "./quickPoseTypes"
import deepEqual from "deep-equal";
import { ALPHA_TARGET_REFRESH, d3TlScale, D3_LINK_DISTANCE, TL_DRAW_RADIUS } from "components/Editor";
import { getIconImageURLNoTime } from "./quickPoseNetworking"
import * as d3 from 'd3'
import forceBoundary from 'd3-force-boundary'
import { MutableRefObject } from "react";
import { TLBounds } from "@tldraw/core";

export const nodeRegex = new RegExp(/node\d/);
export const linkRegex = new RegExp(/link\d/);

export const d3Sim = (centerPoint,bounds:TLBounds) => {
    const coords = tldrawCoordstod3(...centerPoint as [number,number])
    const boundary = tldrawCoordstod3(bounds.maxX,bounds.maxY)
    //console.log(bounds,boundary)
    return d3.forceSimulation()
    .force("boundary", forceBoundary(0,0,500,500))
    //.force("center", d3.forceCenter(coords[0],coords[1]).strength(.1))
    .force('charge', d3.forceManyBody().strength(-2))
    .force("link", d3.forceLink()
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
    .force('collision', d3.forceCollide().radius(function(d: dataNode) {return d.r + 10} ))
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
export const updateBinding = (app:TldrawApp, link, startNode,endNode,drawLink) => {
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

  export const updateLinkShapes = (app: TldrawApp, tlLinks, graphData, tlNodes) => {
    //draw links
    const updateLinks: TDShape[] = [];
    
    const newLinks = graphData.current.links.map(function(link: dataLink){
      const tlDrawLink = tlLinks.find(l => l.id === 'link'+link.index)
      const baseLink = {...tlDrawLink}
      const sourceNode = link.source as dataNode
      const targetNode = link.target as dataNode
      const startNode: TDShape = tlNodes.find(n => n.id === 'node'+sourceNode.id)
      const endNode: TDShape = tlNodes.find(n => n.id === 'node'+targetNode.id)

      if(startNode && endNode){
        if(!tlDrawLink){
          const newArrow = makeArrow(app.currentPageId,link)
          updateBinding(app, link, startNode,endNode,newArrow)
          return newArrow
        }else{
          updateBinding(app, link, startNode,endNode,tlDrawLink)
          if(!deepEqual(baseLink,tlDrawLink)){
            updateLinks.push(tlDrawLink)
          }
        }
        link.d = D3_LINK_DISTANCE + sourceNode.r + targetNode.r
        link.strength = 10
      }
      return null
    }).filter(entry => entry !== null && !(entry === undefined)) as TDShape[]
    return [newLinks,updateLinks]
  }

  export const updateNodeShapes = (graphData, tlNodes,currentVersion,centerPoint,selectedIds) => {
    const updateNodes = []
    //console.log(graphData.nodes)
    const addNodes = graphData.nodes.map(function(node: dataNode){
      const tlDrawNode:VersionNodeShape = tlNodes.find(n => n.id === 'node'+node.id)
      //console.log(tlDrawNode)
      if(!tlDrawNode){
          const n = {
              id: 'node'+node.id,
              name: 'node'+node.id,
              type: TDShapeType.VersionNode,
              style:{
                  size: "small",
                  dash: DashStyle.Solid,
                  isFilled:true,
                  color: "black"
              },
              point: d3toTldrawCoords(node.x,node.y),
              radius: [TL_DRAW_RADIUS,TL_DRAW_RADIUS],
              imgLink: getIconImageURLNoTime(node.id.toString())
          } as inputVersionNodeShape
          node.r = n.radius[0] / d3TlScale
          //console.log("input radius", node.r)
          return n

      }else if(tlDrawNode && tlDrawNode.type == TDShapeType.VersionNode){ 
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
          if(currentVersion.current && tlDrawNode.id.replace(/\D/g,"") === currentVersion.current){ //If our node is the current version
              tlDrawNode.isCurrent = true
          }else{
              tlDrawNode.isCurrent = false
          }
          
          let newCoords = tlDrawNode.point
          if(node.id === '0'){
              node.fx = tldrawCoordstod3(...centerPoint as [number,number])[0]
              node.fy = tldrawCoordstod3(...centerPoint as [number,number])[1]
              node.x = tldrawCoordstod3(...centerPoint as [number,number])[0]
              node.y = tldrawCoordstod3(...centerPoint as [number,number])[1]
              newCoords = centerPoint as [number,number]
              tlDrawNode.point = d3toTldrawCoords(node.x ,node.y)
          }else{
              newCoords = d3toTldrawCoords(node.x ,node.y)
          }
          if (Math.abs(newCoords[0] - tlDrawNode.point[0]) > .1 || Math.abs(newCoords[0] - tlDrawNode.point[0]) > .1){
              tlDrawNode.point = d3toTldrawCoords(node.x ,node.y)
          }
          //dont know why this optimization isn't updating style changes :(
          //if(!deepEqual(baseNode,tlDrawNode) || baseNode.style.color !== tlDrawNode.style.color){
          updateNodes.push(tlDrawNode)
          //}
      }else{
          return null
      }
    }).filter(entry => entry !== null && !(entry === undefined))

    return [addNodes,updateNodes]
  }
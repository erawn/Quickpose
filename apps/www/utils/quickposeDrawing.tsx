import type { Patch } from '@tldraw/core'
import {
  ArrowBinding,
  ArrowShape,
  ColorStyle,
  DashStyle,
  SizeStyle,
  TDBinding,
  TDFile,
  TDShape,
  TDShapeType,
  TLDR,
  TldrawApp,
  VersionNodeShape,
  shapeUtils,
} from '@tldraw/tldraw'
import Vec from '@tldraw/vec'
import {
  ALPHA_TARGET_REFRESH,
  D3_LINK_DISTANCE,
  TL_DRAW_RADIUS,
  d3TlScale,
} from 'components/Editor'
import {
  Simulation,
  SimulationNodeDatum,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3'
import forceBoundary from 'd3-force-boundary'
import deepEqual from 'deep-equal'
import { MutableRefObject } from 'react'
import { getIconImageURL, getIconImageURLNoTime, updateThumbnail } from './quickPoseNetworking'
import {
  dataLink,
  dataNode,
  inputShape,
  inputVersionNodeShape,
  quickPoseFile,
} from './quickPoseTypes'

export const nodeRegex = new RegExp(/node\d/)
export const linkRegex = new RegExp(/link\d/)

export const d3Sim = () => {
  //const coords = tldrawCoordstod3(...(centerPoint as [number, number]))
  // const boundary = tldrawCoordstod3(bounds.maxX,bounds.maxY)
  //console.log(bounds,boundary)
  return (
    forceSimulation()
      .force('boundary', forceBoundary(0, 0, 500, 500))
      //.force('center', d3.forceCenter(coords[0], coords[1]).strength(0.1))
      //.force('charge', forceManyBody().strength(0))
      .force(
        'link',
        forceLink()
          .id(function (d: dataNode, i) {
            return d.id
          })
          .distance(function (l: dataLink) {
            if (l.d !== undefined) {
              //console.log(l.d)
              return l.d
            } else {
              return D3_LINK_DISTANCE
            }
          })
          .strength(0)
      )
      .force(
        'collision',
        forceCollide().radius(function (d: dataNode) {
          return d.r + 10
        })
      )
      .alphaDecay(0.03)
  )
}

export const defaultSticky = (centerPoint) => {
  return {
    id: 'loading',
    type: TDShapeType.Sticky,
    parentId: 'page',
    name: 'loading',
    childIndex: 1,
    point: centerPoint,
    size: [400, 400],
    isLocked: false,
    isGenerated: true,
    text: ' Quickpose is looking for a Processing Session....',
    rotation: 0,
    style: {
      color: 'black',
      size: 'large',
      isFilled: false,
      dash: 'draw',
      scale: 1,
      font: 'script',
      textAlign: 'middle',
    },
  } as inputShape
}

export const graphBaseData = {
  nodes: [null],
  links: [null],
}

export function d3toTldrawCoords(x, y): number[] {
  return [x * d3TlScale - TL_DRAW_RADIUS, y * d3TlScale - TL_DRAW_RADIUS]
}

export function tldrawCoordstod3(x, y): number[] {
  return [(x + TL_DRAW_RADIUS) / d3TlScale, (y + TL_DRAW_RADIUS) / d3TlScale]
}

export const makeArrow = (parentId, link): ArrowShape => {
  return shapeUtils.arrow.getShape({
    hideFromSelection: true,
    id: 'link' + link.index,
    name: 'link' + link.index,
    type: TDShapeType.Arrow,
    parentId: parentId,
    isLocked: false,
    isFixed: true,
    isGenerated: true,
    point: [100, 100],
    style: {
      size: SizeStyle.Small,
      dash: DashStyle.Dotted,
      isFilled: true,
      color: ColorStyle.Indigo,
    },
    handles: {
      start: {
        canBind: true,
        bindingId: 'link' + link.index + 'start',
        id: 'start',
        index: 0,
        point: [0, 0],
      },
      end: {
        canBind: true,
        bindingId: 'link' + link.index + 'end',
        index: 1,
        id: 'end',
        point: [1, 1],
      },
      bend: {
        id: 'bend',
        index: 2,
        point: [0.5, 0.5],
      },
    },
  })
}
export const updateBinding = (
  app: TldrawApp,
  link,
  startNode,
  endNode,
  drawLink,
  nextBindings
): boolean => {
  const newStartBinding: ArrowBinding = {
    id: 'link' + link.index + 'start',
    fromId: 'link' + link.index,
    toId: startNode.id,
    handleId: 'start',
    distance: 16,
    point: [0.5, 0.5],
  }
  const newTargetBinding: ArrowBinding = {
    id: 'link' + link.index + 'end',
    fromId: 'link' + link.index,
    toId: endNode.id,
    handleId: 'end',
    distance: 16,
    point: [0.5, 0.5],
  }
  let changed = false
  let startBinding = app.getBinding('link' + link.index + 'start')
  let endBinding = app.getBinding('link' + link.index + 'end')

  if (!startBinding) {
    startBinding = newStartBinding
  }
  if (!endBinding) {
    endBinding = newTargetBinding
  }
  if (drawLink.handles.start.bindingId !== 'link' + link.index + 'start') {
    drawLink.handles.start.bindingId = 'link' + link.index + 'start'
    changed = true
  }
  if (drawLink.handles.end.bindingId !== 'link' + link.index + 'end') {
    drawLink.handles.end.bindingId = 'link' + link.index + 'end'
    changed = true
  }
  if (!deepEqual(app.page.bindings[startBinding.id], startBinding)) {
    nextBindings[startBinding.id] = startBinding
  }
  if (!deepEqual(app.page.bindings[endBinding.id], endBinding)) {
    nextBindings[endBinding.id] = endBinding
  }
  return changed
}

export const updateLinkShapes = (
  app: TldrawApp,
  tlLinks,
  graphData,
  tlNodes,
  simulation
): [Patch<Record<string, TDShape>>, Patch<Record<string, TDBinding>>, TDShape[]] => {
  //draw links
  const nextShapes: Patch<Record<string, TDShape>> = {}
  const nextBindings: Patch<Record<string, TDBinding>> = {}
  const createShapes: TDShape[] = []
  graphData.current.links.map(function (link: dataLink) {
    const sourceNode = link.source as dataNode
    const targetNode = link.target as dataNode
    let tlDrawLink = tlLinks.find((l) => l.id === 'link' + link.index)
    if (!tlDrawLink) {
      tlDrawLink = createShapes.find((l) => l.id === 'link' + link.index)
    }
    const startNode: TDShape = tlNodes.find((n) => n.id === 'node' + sourceNode.id)
    const endNode: TDShape = tlNodes.find((n) => n.id === 'node' + targetNode.id)

    if (startNode && endNode) {
      if (!tlDrawLink) {
        //console.log(link)
        const newArrow = makeArrow(app.currentPageId, link)
        //updateBinding(app, link, startNode,endNode,newArrow,nextBindings)
        //nextShapes[newArrow.id] = newArrow
        createShapes.push(newArrow)
      } else {
        if (updateBinding(app, link, startNode, endNode, tlDrawLink, nextBindings)) {
          nextShapes[tlDrawLink.id] = { ...tlDrawLink }
        }
      }
      link.d = Math.sqrt(
        Math.pow(sourceNode.x - sourceNode.x, 2) + Math.pow(sourceNode.y - sourceNode.y, 2)
      )
      link.strength = 10
    }
  })
  const forceLink = simulation.current.force('link') as d3.ForceLink<
    d3.SimulationNodeDatum,
    d3.SimulationLinkDatum<d3.SimulationNodeDatum>
  >
  //console.log(forceLink)
  forceLink.links(graphData.current.links)
  return [nextShapes, nextBindings, createShapes]
}

export const updateNodeShapes = (
  graphData: { nodes: dataNode[]; links: dataLink[] },
  tlNodes: TDShape[],
  currentVersion: MutableRefObject<number>,
  centerPoint: MutableRefObject<[number, number]>,
  selectedIds: string[],
  app: TldrawApp
): [Patch<Record<string, TDShape>>, inputVersionNodeShape[]] => {
  let nextShapes: Patch<Record<string, TDShape>> = {}
  const createShapes: inputVersionNodeShape[] = []
  graphData.nodes.map(function (node: dataNode) {
    const tlDrawNode: VersionNodeShape = tlNodes.find(
      (n) => n.id === 'node' + node.id
    ) as VersionNodeShape
    //console.log(tlDrawNode)
    if (!tlDrawNode) {
      const n = shapeUtils.versionNode.getShape({
        id: 'node' + node.id,
        name: 'node' + node.id,
        parentId: 'page',
        type: TDShapeType.VersionNode,
        isFixed: true,
        style: {
          size: 'small',
          dash: DashStyle.Solid,
          isFilled: true,
          color: 'black',
        },
        checkpoints: node.checkpoints,
        point: d3toTldrawCoords(node.x, node.y),
        radius: [TL_DRAW_RADIUS, TL_DRAW_RADIUS],
        imgLink: getIconImageURLNoTime(parseInt(node.id)),
      } as inputVersionNodeShape)
      const parentLink = graphData.links.find((link) => link.target === node.id)
      if (!(parentLink === undefined)) {
        const parent = tlNodes.find(
          (node) => node.id === 'node' + (parentLink.source as dataNode).id
        ) as VersionNodeShape
        if (!(parent === undefined)) {
          //spawn new nodes near their parents
          //(parent)
          n.radius = parent.radius
        }
      }
      node.r = n.radius[0] / d3TlScale
      //console.log("found new shape")
      //nextShapes[n.id] = n
      // if (node.id === '0') {
      //   node.fx = tldrawCoordstod3(...(centerPoint.current as [number, number]))[0]
      //   node.fy = tldrawCoordstod3(...(centerPoint.current as [number, number]))[1]
      //   node.x = tldrawCoordstod3(...(centerPoint.current as [number, number]))[0]
      //   node.y = tldrawCoordstod3(...(centerPoint.current as [number, number]))[1]
      // }
      createShapes.push(n)
      //nextShapes[n.id] = {...n}
    } else if (tlDrawNode) {
      if (selectedIds.includes(tlDrawNode.id) && tlDrawNode.parentId !== 'CurrentPageId') {
        //If we have a node selected, update the d3 sim instead
        const d3Coords = tldrawCoordstod3(tlDrawNode.point[0], tlDrawNode.point[1])
        node.x = d3Coords[0]
        node.y = d3Coords[1]
        node.fx = d3Coords[0]
        node.fy = d3Coords[1]
        node.r = tlDrawNode.radius[0] / d3TlScale
      } else {
        node.fx = null
        node.fy = null
      }
      if (currentVersion.current !== null && tlDrawNode.id === 'node' + currentVersion.current) {
        //If our node is the current version
        if (tlDrawNode.isCurrent === false) {
          nextShapes[tlDrawNode.id] = { ...nextShapes[tlDrawNode.id], isCurrent: true }
        }
      } else {
        if (tlDrawNode.isCurrent === true) {
          nextShapes[tlDrawNode.id] = { ...nextShapes[tlDrawNode.id], isCurrent: false }
        }
      }
      //console.log(node.id,node.checkpoints)
      if (node.checkpoints.toString() !== tlDrawNode.checkpoints.toString()) {
        //console.log(node.checkpoints,tlDrawNode.checkpoints)
        nextShapes[tlDrawNode.id] = { ...nextShapes[tlDrawNode.id], checkpoints: node.checkpoints }
      }

      // if (node.id === '0') {
      //   centerPoint.current = tlDrawNode.point as [number, number]
      //   node.fx = tldrawCoordstod3(...(centerPoint.current as [number, number]))[0]
      //   node.fy = tldrawCoordstod3(...(centerPoint.current as [number, number]))[1]
      //   node.x = tldrawCoordstod3(...(centerPoint.current as [number, number]))[0]
      //   node.y = tldrawCoordstod3(...(centerPoint.current as [number, number]))[1]
      // }
      const newCoords = Vec.toFixed(d3toTldrawCoords(node.x, node.y))
      if (
        Math.abs(newCoords[0] - tlDrawNode.point[0]) > 0.5 ||
        Math.abs(newCoords[1] - tlDrawNode.point[1]) > 0.5
      ) {
        const parent = app.getShape(tlDrawNode.parentId)
        if (parent !== undefined && parent.type === TDShapeType.Group) {
          const delta = [newCoords[0] - tlDrawNode.point[0], newCoords[1] - tlDrawNode.point[1]]
          const idsToMutate = parent.children.filter((id) => !app.getShape(id).isLocked)

          const change = TLDR.mutateShapes(
            app.state,
            idsToMutate,
            (shape) => ({
              point: Vec.toFixed(Vec.add(shape.point, delta)),
            }),
            app.currentPageId
          )
          const groupShapes = change.after
          nextShapes = { ...nextShapes, ...groupShapes }
          idsToMutate.map((id) => {
            const shape = app.getShape(id)
            if (shape !== undefined && shape.type === TDShapeType.VersionNode) {
              const idInteger = shape.id.replace(/\D/g, '')
              const d3Coords = tldrawCoordstod3(
                groupShapes[shape.id].point[0],
                groupShapes[shape.id].point[1]
              )
              const graphNodeInd = graphData.nodes.findIndex((node) => node.id === idInteger)
              graphData.nodes[graphNodeInd].x = d3Coords[0]
              graphData.nodes[graphNodeInd].y = d3Coords[1]
              graphData.nodes[graphNodeInd].fx = d3Coords[0]
              graphData.nodes[graphNodeInd].fy = d3Coords[1]
            }
          })
        } else if (!app.settings.simulationPause) {
          nextShapes[tlDrawNode.id] = { ...nextShapes[tlDrawNode.id], point: newCoords }
        }
      }
    }
  })
  //console.log(nextShapes)

  return [nextShapes, createShapes]
}

export function updateGraphData(netData: JSON, graphData: { nodes: any[]; links: any[] }) {
  //https://medium.com/ninjaconcept/interactive-dynamic-force-directed-graphs-with-d3-da720c6d7811
  //if we have new data come in
  //console.log('dataInterval')
  let changed = false
  //console.log("updatenetdata",netData)
  //and we have our datasources ready
  //add new links and nodes from netData into graphData
  //only --adding-- nodes and links, so we can just append new incoming data to graphData
  netData['Nodes'].forEach(function (netNode: dataNode) {
    if (!graphData.nodes.some((graphNode) => graphNode.id === netNode.id)) {
      const parentLink = netData['Edges'].find((link) => link.target === netNode.id)
      if (!(parentLink === undefined)) {
        const parent: dataNode = graphData.nodes.find((node) => node.id === parentLink.source)
        if (!(parent === undefined)) {
          //spawn new nodes near their parents
          netNode.x = parent.x + parent.r
          netNode.y = parent.y + parent.r
          netNode.r = parent.r
        }
      }

      graphData.nodes.push(netNode)
      changed = true
    } else {
      const graphNode = graphData.nodes.find((graphNode) => graphNode.id === netNode.id)
      if (graphNode !== undefined) {
        for (const key in netNode) {
          if (netNode[key] !== graphNode[key] && changed === false) {
            changed = true
            //console.log(key,netNode[key],graphNode[key])
            graphNode[key] = netNode[key]
            //console.log(netNode)
            //console.log()
          }
        }
      }
    }
  })
  netData['Edges'].forEach(function (netLink) {
    if (
      !graphData.links.some(
        (graphLink) =>
          (graphLink.source.id === netLink.source.id &&
            graphLink.target.id === netLink.target.id) ||
          (graphLink.source.id === netLink.source && graphLink.target.id === netLink.target)
      )
    ) {
      //console.log(netLink,graphData.links)
      graphData.links.push(netLink)
      //graphData.links = [...graphData.links, { ...netLink }]
      changed = true
    }
  })
  return changed
}

export function loadTldrFile(
  app: TldrawApp,
  graphData: MutableRefObject<any>,
  simulation: MutableRefObject<Simulation<SimulationNodeDatum, undefined>>,
  centerPoint: MutableRefObject<[number, number]>,
  loadFile: MutableRefObject<quickPoseFile>,
  currentVersion: MutableRefObject<number>
) {
  app.replacePageContent({}, {}, {})

  //https://stackoverflow.com/questions/18206231/saving-and-reloading-a-force-layout-using-d3-js
  //Load the data
  let loadedData = {
    nodes: [],
    links: [],
  }

  if (loadFile.current.graphData !== undefined) {
    loadedData = JSON.parse(loadFile.current.graphData.simData.toString())
    // if(netData.current !== undefined && netData.current !== null && netData.current["ProjectName"]){
    //   app.setCurrentProject(netData.current["ProjectName"])
    // }
    centerPoint.current = JSON.parse(loadFile.current.graphData.centerPoint.toString()) as [
      number,
      number
    ]
    const studyConsent = JSON.parse(loadFile.current.graphData?.studyConsent)
    if (studyConsent === 'enabled') {
      app.setSetting('sendUsageData', 'enabled')
    } else if (studyConsent === 'disabled') {
      app.setSetting('sendUsageData', 'disabled')
    }
    const importNodes = loadedData.nodes as dataNode[]
    //console.log(importNodes)
    importNodes.forEach((node) => {
      node.fx = node.x
      node.fy = node.y
    })
    graphData.current.nodes = importNodes
    graphData.current.links = loadedData.links

    graphData.current.nodes.forEach((node) => {
      node.fx = null
      node.fy = null
    })
    simulation.current.nodes(graphData.current.nodes)

    const forceLink = simulation.current.force('link') as d3.ForceLink<
      d3.SimulationNodeDatum,
      d3.SimulationLinkDatum<d3.SimulationNodeDatum>
    >
    //console.log(forceLink)
    forceLink.links(graphData.current.links)
    const alpha = JSON.parse(loadFile.current.graphData.alpha) as number
    simulation.current.alpha(alpha)
    simulation.current.restart()
    // simulation.current.alpha(ALPHA_TARGET_REFRESH)
  }
  const page = loadFile.current.document.pages[Object.keys(loadFile.current.document.pages)[0]]
  Object.values(page.shapes).forEach((shape: TDShape) => {
    const { type, id } = shape
    if (type === TDShapeType.VersionNode) {
      if (shape.imgLink.startsWith('blob')) {
        const idInteger = parseInt(id.replace(/\D/g, ''))
        shape.imgLink = getIconImageURL(idInteger)
      }
    }
  })
  app.loadDocument(loadFile.current.document)

  if (app.getShape('loading')) {
    //remove loading sticky
    app.delete(['loading', 'installHelper1', 'installHelper2', 'installHelper3'])
  }

  const tlNodes = app.getShapes().filter((shape) => nodeRegex.test(shape.id))
  tlNodes.map((node) => updateThumbnail(app, node.id, currentVersion))
}

export const updateLoadingTicks = (app: TldrawApp, loadingTicks) => {
  if (app.getShape('loading')) {
    const loadingDot = '.'
    const currentPageId = app.currentPageId
    const patch = {
      document: {
        pages: {
          [currentPageId]: {
            shapes: {
              ['loading']: {
                text:
                  ' Quickpose is looking for a Processing Session' +
                  loadingDot.repeat(loadingTicks.current % 6),
              },
            },
          },
        },
      },
    }
    app.patchState(patch, 'Quickpose Loading Update')
    loadingTicks.current++
  }
}

export const installHelper = (centerPoint: number[]) => {
  return [
    {
      id: 'installHelper1',
      type: 'text',
      name: 'Text',
      point: [centerPoint[0] - 220, centerPoint[1] + 300], //[247.14, 653.4],
      rotation: 0,
      text: '1. Download Quickpose from\n https://www.ericrawn.media/quickpose',
      style: {
        color: 'white',
        size: 'small',
        isFilled: false,
        dash: 'solid',
        scale: 0.9789379019143146,
        font: 'script',
        textAlign: 'middle',
      },
    } as inputShape,
    {
      id: 'installHelper2',
      type: 'text',
      name: 'Text',
      point: [centerPoint[0] + 200, centerPoint[1] + 300], //[670.88, 652.49],
      rotation: 0,
      text: '2. Extract /Quickpose to /Processing/tools, \nrestart Processing,\nopen your sketch (or a new one), \nand click Tools-> Quickpose. ',
      style: {
        color: 'white',
        size: 'small',
        isFilled: false,
        dash: 'solid',
        scale: 1,
        font: 'script',
        textAlign: 'middle',
      },
    } as inputShape,
    {
      id: 'installHelper3',
      type: 'text',
      name: 'Text',
      point: [centerPoint[0] + 130, centerPoint[1] + 250], //[574.34, 607.04],
      rotation: 0,
      text: 'To get started:',
      style: {
        color: 'white',
        size: 'small',
        isFilled: false,
        dash: 'solid',
        scale: 1,
        font: 'script',
        textAlign: 'middle',
      },
    } as inputShape,
  ]
}

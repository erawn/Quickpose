import { Tldraw, TldrawApp, TldrawProps, useFileSystem, TDShapeType, ColorStyle } from '@tldraw/tldraw'
import { useAccountHandlers } from 'hooks/useAccountHandlers'
import { useUploadAssets } from 'hooks/useUploadAssets'
import React, { FC } from 'react'
import * as gtag from 'utils/gtag'
import axios from 'axios'
import ForceGraph2D from 'react-force-graph-2d'
import ForceGraphInstance from 'force-graph'
import ForceGraph from 'force-graph'
import * as d3 from 'd3'
declare const window: Window & { app: TldrawApp }

interface EditorProps {
  id?: string
  isUser?: boolean
  isSponsor?: boolean
}

const requestCurrentId = async () => {
  const response = await fetch('http://127.0.0.1:8080/currentVersion');
	const id = await response.json();
}
function updateSimulation(simulation,linkGroup,nodeGroup,links,nodes) {
  //https://stackoverflow.com/questions/18206231/saving-and-reloading-a-force-layout-using-d3-js
  let radius = 5
  let canvasWidth = window.innerWidth
  let canvasHeight = window.innerHeight
  let linkElements = linkGroup.selectAll('line')
    .data(links, function (link) {
      return link.target.id + link.source.id
    })

  linkElements.exit().remove()

  var linkEnter = linkElements
    .enter().append('line')
    .attr('stroke-width', 3)
    .attr('stroke', 'rgba(50, 50, 50, 0.2)')

  linkElements = linkEnter.merge(linkElements)

  // nodes
  let nodeElements = nodeGroup.selectAll('.node')
    .data(nodes, function (node) { return node.id })

  var nodeEnter = nodeElements
    .enter()
    .append("svg:image")
    .attr("class", "node")
    .attr("height", 40)
    .attr("width", 40)
    .attr("x", function (d) { return -25; })
    .attr("y", function (d) { return -25; })

  nodeElements.exit().remove()

  nodeElements = nodeElements.merge(nodeEnter)
  simulation.nodes(nodes).on('tick', () => {
    nodeElements
      .attr('cx', function (node) { return node.x = Math.max(radius, Math.min(canvasWidth - radius, node.x)); })
      .attr('cy', function (node) { return node.y = Math.max(radius, Math.min(canvasHeight - radius, node.y)); })
      .attr("transform", function (node) {
        return "translate(" +
          Math.max(radius, Math.min(canvasWidth - radius, node.x)) + "," +
          Math.max(radius, Math.min(canvasHeight - radius, node.y)) + ")";
      })
    linkElements
      .attr('x1', function (link) { return link.source.x })
      .attr('y1', function (link) { return link.source.y })
      .attr('x2', function (link) { return link.target.x })
      .attr('y2', function (link) { return link.target.y })
  })

  simulation.force('link').links(links)
}

const Editor: FC<EditorProps & Partial<TldrawProps>> = ({
  id = 'home',
  isUser = false,
  isSponsor = false,
  ...rest
}) => {
  const [data, setData] = React.useState(null);
  const forceRef: React.RefObject<typeof ForceGraphInstance> = React.useRef();
  const forceRefInstance = React.useRef(null);
  const containerRef = React.useRef(null);
  const svg = d3
    .select(containerRef.current)
    .append("svg")
  //const elem = React.useRef()//document.getElementById("graph");
  const graphtestdata = {
    nodes: [
      { id: "A" },
      { id: "B" },
      { id: "C" },
      { id: "D" },
      { id: "E" },
      { id: "F" }
    ],
    links: [
      { source: "A", target: "B", value: 5 },
      { source: "B", target: "C", value: 5 },
      { source: "C", target: "D", value: 5 },
      { source: "D", target: "E", value: 5 },
      { source: "E", target: "F", value: 5 },
      { source: "C", target: "F", value: 5 }
    ]
  };
  var linkGroup = svg.append('g').attr('class', 'links')
  var nodeGroup = svg.append('g').attr('class', 'nodes')

  var linkForce = d3
      .forceLink()
      .id(link => link.id)
      .strength(link => link.strength)
      .distance(30)

  const simulation = d3.forceSimulation(graphtestdata.nodes)
    .force('link', linkForce)
    .force('charge', d3.forceManyBody().strength(-100))
    .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
    .force('collision', d3.forceCollide().radius(60))
    .velocityDecay(.90)
    .alphaTarget(.01);


  const handleMount = React.useCallback((app: TldrawApp) => {
    window.app = app
    app.createShapes( 
      {
        id: 'rect1',
        type: TDShapeType.Rectangle,
        name: 'Rectangle',
        childIndex: 1,
        point: [0, 0],
        size: [100, 100],
      },
      {
        id: 'rect2',
        name: 'Rectangle',
        type: TDShapeType.Rectangle,
        point: [200, 200],
        size: [100, 100],
      }
    )

  }, [])
  
  React.useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      const app = window.app
      const rect1 = app.getShape('rect1')
      //console.log("forcerefinstance",forceRefInstance.current.state)
      //console.log("forceref",forceRef.current)
      // axios('http://127.0.0.1:8080/versions.json')
      //   .then(response => {
      //     setData(response.data)
      //   })
      //   .catch(error => {
      //     console.error("error fetching: ", error);
      //   })
    
      const node0 = app.getShape('node0')
        if(!node0){
          app.createShapes({
            id: 'node0',
            type: TDShapeType.Image, 
            name: 'Image',
            childIndex: 1,
            point: [0, 0],
            size: [100, 100],
          })
        }
      
      //console.log(data)
      const color = i % 2 ? ColorStyle.Black : ColorStyle.Green

      app.updateShapes({
        id: 'rect1', 
        style: {
          ...rect1.style, 
          color,
        },
      })

      i++
    }, 1000)
    return () => clearInterval(interval)
  })

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
      <div className="forcegraph" ref={forceRefInstance}>
      <ForceGraph2D
          graphData={graphtestdata}
          width={window.innerWidth}
          height={window.innerHeight}
          backgroundColor="aliceblue"
          nodeLabel="id"
          ref={forceRef}
        />
      </div>
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
      <div className="forceGraph">
        
      </div>
      
    </div>
    
  )
}

export default Editor

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
import { SimulationNodeDatum } from 'd3'
declare const window: Window & { app: TldrawApp }

const D3_RADIUS = 5;
const TL_DRAW_RADIUS = 80;

interface EditorProps {
  id?: string
  isUser?: boolean
  isSponsor?: boolean
}


const requestCurrentId = async () => {
  const response = await fetch('http://127.0.0.1:8080/currentVersion');
	const id = await response.json();
}

function d3toTldrawCoords(x,y){
    return [ (x * 100) - TL_DRAW_RADIUS, (y * 100) - TL_DRAW_RADIUS]
}

const Editor: FC<EditorProps & Partial<TldrawProps>> = ({
  id = 'home',
  isUser = false,
  isSponsor = false,
  ...rest
}) => {
  const [incomingData, setIncomingData] = React.useState(null);
  const [nodeData, setNodeData] = React.useState(null);
  const [linkData, setLinkData] = React.useState(null);


  const [simData, setSimData] = React.useState([])



  let graphtestdata = {
    nodes: [
      { "id": "A" },
      { "id": "B" },
      { "id": "C" },
      { "id": "D" },
      { "id": "E" },
      { "id": "F" }
    ],
    links: [
      {"source": "A", "target": "B", "value": 5 },
      {"source": "B", "target": "C", "value": 5 },
      {"source": "C", "target": "D", "value": 5 },
      {"source": "D", "target": "E", "value": 5 },
      {"source": "E", "target": "F", "value": 5 },
      {"source": "C", "target": "F", "value": 5 }
    ]
  };
  
  const simulation = d3
  .forceSimulation()
  .force("center", d3.forceCenter(50,50))
  .force('charge', d3.forceManyBody().strength(-100))
  .force('collision', d3.forceCollide().radius(D3_RADIUS*10))
  .force('link', d3.forceLink()
    .id(function(d,i) {
      return d.id
    })
    .distance(20)
    .strength(1)
  );


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
      // axios('http://127.0.0.1:8080/versions.json', {timeout: 1000})
      //   .then(response => {
      //     setIncomingData(response.data)
      //   })
      //   .catch(error => {
      //     console.error("error fetching: ", error);
      //   })
    
      const rect1 = app.getShape('rect1')
      if(!rect1){
        app.createShapes({
          id: 'rect1',
          type: TDShapeType.Rectangle,
          name: 'Rectangle',
          childIndex: 1,
          point: [0, 0],
          size: [100, 100],
        })
      }else{
        const color = i % 2 ? ColorStyle.Black : ColorStyle.Green

        app.updateShapes({
          id: 'rect1', 
          style: {
            ...rect1.style, 
            color,
          },
        })
      }
      
      //console.log(data)
      

      simulation.on("tick", () => {
        setNodeData([...simulation.nodes()]);
      });
      //console.log(graphtestdata.nodes)
      //console.log(nodeData)
      simulation.nodes(graphtestdata.nodes);
      simulation.force('link').links(graphtestdata.links)
      simulation.alpha(0.1).restart();

      graphtestdata.nodes.forEach(function(node: SimulationNodeDatum){
        const tlDrawNode = app.getShape('node'+node.id)
        console.log(tlDrawNode)
        if(!tlDrawNode){
          app.createShapes({
            id: 'node'+node.id,
            type: TDShapeType.Rectangle,
            name: 'node',
            point: d3toTldrawCoords(node.x ,node.y),
            size: [TL_DRAW_RADIUS,TL_DRAW_RADIUS],
          })
        }else{
          app.updateShapes({
            id: 'node'+node.id, 
            style: {
              ...tlDrawNode.style, 
              color,
            },
            point: d3toTldrawCoords(node.x ,node.y),
            size: [TL_DRAW_RADIUS,TL_DRAW_RADIUS],
          })
        }
      })
      
     
      
      i++
    }, 1000)
    return () => clearInterval(interval)
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
      <div className="forceGraph">
        
      </div>
      
    </div>
    
  )
}

export default Editor

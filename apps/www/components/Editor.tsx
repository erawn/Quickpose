/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Tldraw, TldrawApp, TldrawProps, useFileSystem, TDShapeType, ColorStyle, TDShape } from '@tldraw/tldraw'
import { useAccountHandlers } from 'hooks/useAccountHandlers'
import { useUploadAssets } from 'hooks/useUploadAssets'
import React, { FC } from 'react'
import * as gtag from 'utils/gtag'
import axios from 'axios'
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

interface dataNode extends SimulationNodeDatum {
  id: string;
}
type inputShape = { id: string; type: TDShapeType } & Partial<TDShape>


const requestCurrentId = async () => {
  const response = await fetch('http://127.0.0.1:8080/currentVersion');
	const id = await response.json();
}

function d3toTldrawCoords(x,y): number[]{
    return [ Math.round((x * 10) - TL_DRAW_RADIUS), Math.round((y * 10) - TL_DRAW_RADIUS)]
}

function requestData(setData: (arg0: any) => void){
  axios('http://127.0.0.1:8080/versions.json', {timeout: 1000})
        .then(response => {
          setData(response.data)
        })
        .catch(error => {
          console.error("error fetching: ", error);
        })
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
  const rTldrawApp = React.useRef<TldrawApp>()

  const [simData, setSimData] = React.useState([])



  const graphtestdata = {
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
  .force("link", d3.forceLink()
    .id(function(d: dataNode,i) {
      return d.id
    })
    .distance(20)
    .strength(1)
  );


  const handleMount = React.useCallback((app: TldrawApp) => {
    
    if(process.env["NEXT_PUBLIC_VERCEL_EN"] == '1'){
      console.log("im in vercel!")
      app = window.app
    }else{
      console.log("im local!")
      app = rTldrawApp.current!
    }
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
    let i = 0

    const dataInterval = setInterval(() => {
      requestData(setIncomingData)
      console.log("requesting data...")
    }, 3000)


    const interval = setInterval(() => {
      let app
      if(process.env["NEXT_PUBLIC_VERCEL_EN"] == '1'){
        console.log("im in vercel!")
        app = window.app
      }else{
        console.log("im local!")
        app = rTldrawApp.current!
      }
      
      console.log("vercal env v:", process.env["VERCEL"])
      if(app != null){
        
        
        const color = i % 2 ? ColorStyle.Black : ColorStyle.Green
        //const app = rTldrawApp.current!
        

        const rect1 = app.getShape('rect1')

        

        if(!rect1){
          app.createShapes({
            id: 'rect1',
            type: TDShapeType.Rectangle,
            name: 'Rectangle',
            childIndex: 1,
            point: [0, 0],
            size: [100, 100],
          } as inputShape)
        }else{

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
        simulation.nodes(graphtestdata.nodes as dataNode[]);

        const forceLink = simulation.force("link") as d3.ForceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>;
        forceLink.links(graphtestdata.links)
        simulation.alpha(0.1).restart();

        graphtestdata.nodes.forEach(function(node: dataNode){
          const tlDrawNode = app.getShape('node'+node.id)
          //console.log(tlDrawNode)
          if(!tlDrawNode){
            app.createShapes({
              id: 'node'+node.id,
              type: TDShapeType.Rectangle,
              name: 'node',
              point: d3toTldrawCoords(node.x,node.y),
              size: [TL_DRAW_RADIUS,TL_DRAW_RADIUS],
            } as inputShape)
          }else{
            app.updateShapes({
              id: 'node'+node.id, 
              type: TDShapeType.Rectangle,
              style: {
                ...tlDrawNode.style, 
                color,
              },
              point: d3toTldrawCoords(node.x ,node.y),
              size: [TL_DRAW_RADIUS,TL_DRAW_RADIUS],
            } as inputShape)
          }
        })
        
        
        
        i++
      }
    }, 50)
    return () => {
      clearInterval(interval)
      clearInterval(dataInterval)
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
    
  )
}

export default Editor

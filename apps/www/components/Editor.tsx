/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Tldraw, TldrawApp, TldrawProps, useFileSystem, TDShapeType, ColorStyle, TDShape } from '@tldraw/tldraw'
import { useAccountHandlers } from 'hooks/useAccountHandlers'
import { useUploadAssets } from 'hooks/useUploadAssets'
import React, { FC } from 'react'
import * as gtag from 'utils/gtag'
import axios from 'axios'
import * as d3 from 'd3'
import { SimulationNodeDatum } from 'd3'
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
    let i = 0

    const dataInterval = setInterval(() => {
        console.log("requesting data...")
        axios.get('http://127.0.0.1:8080/versions.json', {
          timeout: 1000,
          signal: abortController.signal
        })
        .then(response => {
          if(!deepEqual(response.data,netData.current)){
            netData.current = response.data
            console.log("newdata",response.data)
          }else{
            console.log("samedata",response.data)
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
        
        
        const color = i % 2 ? ColorStyle.Black : ColorStyle.Black
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
        //https://medium.com/ninjaconcept/interactive-dynamic-force-directed-graphs-with-d3-da720c6d7811
        if(netData.current){

          //graphData.current.nodes = netData.current[0]
          //graphData.current.links = netData.current[1]
          //only adding nodes and links, so we can just append new incoming data to graphData
        }
        if(graphData.current){
          const data = graphData.current
          console.log(data)
          simulation.nodes(data.nodes);
          const forceLink = simulation.force("link") as d3.ForceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>;
          forceLink.links(data.links)

          simulation.on("tick", () => {
            graphData.current.nodes = [...simulation.nodes()];
          });

          
          
          graphData.current.nodes.forEach(function(node: dataNode){
            const tlDrawNode = app.getShape('node'+node.id)
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
        }
        i++
      }
    }, 50)
    return () => {
      clearInterval(interval)
      clearInterval(dataInterval)
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

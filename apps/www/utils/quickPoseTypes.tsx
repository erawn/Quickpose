import type { TDShapeType, TDShape, VersionNodeShape, TDFile } from "@tldraw/tldraw";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3";

export interface EditorProps {
    id?: string
    isUser?: boolean
    isSponsor?: boolean
  }
  
export interface dataNode extends SimulationNodeDatum {
    id: string;
    x: number;
    y: number;
    r: number;
  }
export type forceLink = d3.ForceLink<d3.SimulationNodeDatum,d3.SimulationLinkDatum<d3.SimulationNodeDatum>>
  
export interface dataLink extends SimulationLinkDatum<SimulationNodeDatum> {
    d: number;
    strength: number;
  }
export type inputShape = { id: string; name?: string; type: TDShapeType;} & Partial<TDShape>
export type inputVersionNodeShape = { id: string; name?: string; type: TDShapeType;} & Partial<VersionNodeShape>

export interface quickPoseFile extends TDFile {
  graphData:{
    simData: any,
    alpha: string,
    centerPoint: string,
  }
}
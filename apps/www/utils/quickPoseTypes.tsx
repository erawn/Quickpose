import { TDShapeType, TDShape, VersionNodeShape } from "@tldraw/tldraw";
import { SimulationNodeDatum, SimulationLinkDatum } from "d3";

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
  
export interface dataLink extends SimulationLinkDatum<SimulationNodeDatum> {
    d: number
  }
export type inputShape = { id: string; name?: string; type: TDShapeType;} & Partial<TDShape>
export type inputVersionNodeShape = { id: string; name?: string; type: TDShapeType;} & Partial<VersionNodeShape>


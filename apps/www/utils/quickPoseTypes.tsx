import type { TDFile, TDShape, TDShapeType, VersionNodeShape } from "@tldraw/tldraw";
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3";


export interface EditorProps {
    id?: string
    isUser?: boolean
    isSponsor?: boolean
  }

export interface studyConsentPreference {
  preference: 'Enabled' | 'Disabled' | 'Prompt'
}
export interface studyConsentResponse extends studyConsentPreference{
  promptAgain: boolean
}
  
export interface dataNode extends SimulationNodeDatum {
    id: string;
    x: number;
    y: number;
    r: number;
    checkpoints: number;
  }
export type forceLink = d3.ForceLink<d3.SimulationNodeDatum,d3.SimulationLinkDatum<d3.SimulationNodeDatum>>
  
export interface dataLink extends SimulationLinkDatum<SimulationNodeDatum> {
    d: number;
    strength: number;
  }
export type inputShape = { 
  id: string; 
  name?: string; 
  type: TDShapeType;
} & Partial<TDShape>

export type inputVersionNodeShape = { 
  id: string; 
  name?: 
  string; 
  type: TDShapeType; 
  checkpoints: number;
} & Partial<VersionNodeShape>

export interface quickPoseFile extends TDFile {
  graphData:{
    studyConsent: any;
    simData: any,
    alpha: string,
    centerPoint: string,
  }
}
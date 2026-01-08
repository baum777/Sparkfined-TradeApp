/**
 * Research Tools Types
 * Data models for indicators, drawings, and Elliott Wave tool
 */

// =====================
// INDICATOR TYPES
// =====================

export type IndicatorCategory = 
  | "trend" 
  | "momentum" 
  | "volatility" 
  | "volume" 
  | "overlays" 
  | "custom";

export interface IndicatorDefinition {
  id: string;
  label: string;
  category: IndicatorCategory;
  supported: boolean;
  params?: IndicatorParam[];
}

export interface IndicatorParam {
  key: string;
  label: string;
  type: "number" | "select";
  default: number | string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export interface EnabledIndicator {
  id: string;
  indicatorId: string;
  params: Record<string, number | string>;
  visible: boolean;
}

export interface IndicatorPreset {
  id: string;
  name: string;
  indicators: { indicatorId: string; params: Record<string, number | string> }[];
}

// =====================
// DRAWING TYPES
// =====================

export type DrawingToolId =
  | "cursor"
  | "crosshair"
  | "trendline"
  | "horizontal"
  | "vertical"
  | "rectangle"
  | "elliott_5";

export interface DrawingPoint {
  t: number; // timestamp
  p: number; // price
}

export interface BaseDrawing {
  id: string;
  type: DrawingToolId;
  createdAt: number;
}

export interface TrendlineDrawing extends BaseDrawing {
  type: "trendline";
  points: [DrawingPoint, DrawingPoint];
}

export interface HorizontalLineDrawing extends BaseDrawing {
  type: "horizontal";
  price: number;
}

export interface VerticalLineDrawing extends BaseDrawing {
  type: "vertical";
  timestamp: number;
}

export interface RectangleDrawing extends BaseDrawing {
  type: "rectangle";
  points: [DrawingPoint, DrawingPoint];
}

export interface ElliottWave5Drawing extends BaseDrawing {
  type: "elliott_5";
  points: [DrawingPoint, DrawingPoint, DrawingPoint, DrawingPoint, DrawingPoint];
  options: {
    showTrend13: boolean;
    showTrend24: boolean;
    showEpa14: boolean;
  };
}

export type Drawing =
  | TrendlineDrawing
  | HorizontalLineDrawing
  | VerticalLineDrawing
  | RectangleDrawing
  | ElliottWave5Drawing;

// =====================
// TOOLS STATE
// =====================

export interface ResearchToolsState {
  // Active drawing tool
  activeTool: DrawingToolId;
  
  // Elliott Wave placement state
  elliottPlacement: {
    active: boolean;
    step: number; // 0-4 (placing points 1-5)
    points: DrawingPoint[];
  };
  
  // Enabled indicators
  enabledIndicators: EnabledIndicator[];
  
  // Drawings on chart
  drawings: Drawing[];
  
  // Selected drawing id
  selectedDrawingId: string | null;
  
  // Undo/redo stacks
  undoStack: Drawing[][];
  redoStack: Drawing[][];
}

// =====================
// STORAGE KEYS
// =====================

export const RESEARCH_TOOLS_STORAGE_KEY = "sparkfined_research_tools_v1";
export const DRAWINGS_STORAGE_KEY = "sparkfined_drawings_v1";

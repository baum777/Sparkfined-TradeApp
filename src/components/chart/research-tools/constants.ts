/**
 * Research Tools Constants
 * Indicator library and drawing tool definitions
 */

import type { IndicatorDefinition, IndicatorPreset, DrawingToolId } from "./types";
import { 
  MousePointer2, 
  Crosshair, 
  TrendingUp, 
  Minus, 
  GripVertical, 
  Square,
  Waves
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// =====================
// INDICATOR LIBRARY
// =====================

export const INDICATOR_LIBRARY: IndicatorDefinition[] = [
  // Trend
  {
    id: "sma",
    label: "SMA",
    category: "trend",
    supported: true,
    params: [
      { key: "period", label: "Period", type: "number", default: 20, min: 1, max: 200 },
      { key: "source", label: "Source", type: "select", default: "close", options: [
        { value: "close", label: "Close" },
        { value: "open", label: "Open" },
        { value: "high", label: "High" },
        { value: "low", label: "Low" },
      ]},
    ],
  },
  {
    id: "ema",
    label: "EMA",
    category: "trend",
    supported: true,
    params: [
      { key: "period", label: "Period", type: "number", default: 50, min: 1, max: 200 },
      { key: "source", label: "Source", type: "select", default: "close", options: [
        { value: "close", label: "Close" },
        { value: "open", label: "Open" },
        { value: "high", label: "High" },
        { value: "low", label: "Low" },
      ]},
    ],
  },
  {
    id: "vwap",
    label: "VWAP",
    category: "trend",
    supported: true,
    params: [],
  },
  
  // Momentum
  {
    id: "rsi",
    label: "RSI",
    category: "momentum",
    supported: true,
    params: [
      { key: "period", label: "Period", type: "number", default: 14, min: 1, max: 100 },
    ],
  },
  {
    id: "macd",
    label: "MACD",
    category: "momentum",
    supported: true,
    params: [
      { key: "fastPeriod", label: "Fast Period", type: "number", default: 12, min: 1, max: 100 },
      { key: "slowPeriod", label: "Slow Period", type: "number", default: 26, min: 1, max: 100 },
      { key: "signalPeriod", label: "Signal Period", type: "number", default: 9, min: 1, max: 50 },
    ],
  },
  
  // Volatility
  {
    id: "bollinger",
    label: "Bollinger Bands",
    category: "volatility",
    supported: true,
    params: [
      { key: "period", label: "Period", type: "number", default: 20, min: 1, max: 100 },
      { key: "multiplier", label: "Std Dev", type: "number", default: 2, min: 0.5, max: 5 },
    ],
  },
  {
    id: "atr",
    label: "ATR",
    category: "volatility",
    supported: true,
    params: [
      { key: "period", label: "Period", type: "number", default: 14, min: 1, max: 100 },
    ],
  },
  
  // Volume
  {
    id: "volume",
    label: "Volume",
    category: "volume",
    supported: true,
    params: [],
  },
  
  // Overlays
  {
    id: "pivots",
    label: "Pivot Points",
    category: "overlays",
    supported: false,
    params: [],
  },
  
  // Custom (disabled placeholder)
  {
    id: "custom",
    label: "Custom Indicator",
    category: "custom",
    supported: false,
    params: [],
  },
];

export const INDICATOR_CATEGORIES: { id: string; label: string }[] = [
  { id: "trend", label: "Trend" },
  { id: "momentum", label: "Momentum" },
  { id: "volatility", label: "Volatility" },
  { id: "volume", label: "Volume" },
  { id: "overlays", label: "Overlays" },
  { id: "custom", label: "Custom" },
];

// =====================
// DEFAULT PRESETS
// =====================

export const DEFAULT_PRESETS: IndicatorPreset[] = [
  {
    id: "preset-scalper",
    name: "Scalper",
    indicators: [
      { indicatorId: "ema", params: { period: 9, source: "close" } },
      { indicatorId: "ema", params: { period: 21, source: "close" } },
      { indicatorId: "rsi", params: { period: 14 } },
    ],
  },
  {
    id: "preset-swing",
    name: "Swing Trader",
    indicators: [
      { indicatorId: "sma", params: { period: 50, source: "close" } },
      { indicatorId: "sma", params: { period: 200, source: "close" } },
      { indicatorId: "macd", params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
    ],
  },
  {
    id: "preset-volatility",
    name: "Volatility Focus",
    indicators: [
      { indicatorId: "bollinger", params: { period: 20, multiplier: 2 } },
      { indicatorId: "atr", params: { period: 14 } },
    ],
  },
];

// =====================
// DRAWING TOOLS
// =====================

export interface DrawingToolDefinition {
  id: DrawingToolId;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
}

export const DRAWING_TOOLS: DrawingToolDefinition[] = [
  { id: "cursor", icon: MousePointer2, label: "Cursor", shortcut: "V" },
  { id: "crosshair", icon: Crosshair, label: "Crosshair", shortcut: "C" },
  { id: "trendline", icon: TrendingUp, label: "Trendline", shortcut: "T" },
  { id: "horizontal", icon: Minus, label: "Horizontal Line", shortcut: "H" },
  { id: "vertical", icon: GripVertical, label: "Vertical Line" },
  { id: "rectangle", icon: Square, label: "Rectangle / Range", shortcut: "R" },
  { id: "elliott_5", icon: Waves, label: "Elliott Wave 1-5", shortcut: "E" },
];

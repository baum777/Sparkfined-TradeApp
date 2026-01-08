/**
 * Research Tools Store
 * State management for indicators, drawings, and Elliott Wave tool
 */

import { useState, useCallback, useEffect } from "react";
import type { 
  ResearchToolsState, 
  EnabledIndicator, 
  Drawing, 
  DrawingToolId,
  DrawingPoint,
  ElliottWave5Drawing,
} from "./types";
import { RESEARCH_TOOLS_STORAGE_KEY, DRAWINGS_STORAGE_KEY } from "./types";
import { INDICATOR_LIBRARY } from "./constants";

// =====================
// PERSISTENCE
// =====================

function loadState<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return defaultValue;
}

function saveState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors
  }
}

// =====================
// DEFAULT STATE
// =====================

const DEFAULT_ENABLED_INDICATORS: EnabledIndicator[] = [
  { id: "ind-sma-1", indicatorId: "sma", params: { period: 20, source: "close" }, visible: true },
];

// =====================
// HOOK
// =====================

export function useResearchToolsStore() {
  // Tool state
  const [activeTool, setActiveTool] = useState<DrawingToolId>("cursor");
  
  // Elliott Wave placement state
  const [elliottPlacement, setElliottPlacement] = useState<ResearchToolsState["elliottPlacement"]>({
    active: false,
    step: 0,
    points: [],
  });
  
  // Enabled indicators (persisted)
  const [enabledIndicators, setEnabledIndicators] = useState<EnabledIndicator[]>(() => 
    loadState(RESEARCH_TOOLS_STORAGE_KEY, DEFAULT_ENABLED_INDICATORS)
  );
  
  // Drawings (persisted)
  const [drawings, setDrawings] = useState<Drawing[]>(() => 
    loadState(DRAWINGS_STORAGE_KEY, [])
  );
  
  // Selected drawing
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  
  // Undo/redo stacks
  const [undoStack, setUndoStack] = useState<Drawing[][]>([]);
  const [redoStack, setRedoStack] = useState<Drawing[][]>([]);

  // Persist indicators on change
  useEffect(() => {
    saveState(RESEARCH_TOOLS_STORAGE_KEY, enabledIndicators);
  }, [enabledIndicators]);

  // Persist drawings on change
  useEffect(() => {
    saveState(DRAWINGS_STORAGE_KEY, drawings);
  }, [drawings]);

  // =====================
  // INDICATOR ACTIONS
  // =====================

  const addIndicator = useCallback((indicatorId: string, params?: Record<string, number | string>) => {
    const definition = INDICATOR_LIBRARY.find((i) => i.id === indicatorId);
    if (!definition || !definition.supported) return;

    const defaultParams: Record<string, number | string> = {};
    definition.params?.forEach((p) => {
      defaultParams[p.key] = p.default;
    });

    const newIndicator: EnabledIndicator = {
      id: `ind-${indicatorId}-${Date.now()}`,
      indicatorId,
      params: { ...defaultParams, ...params },
      visible: true,
    };

    setEnabledIndicators((prev) => [...prev, newIndicator]);
  }, []);

  const removeIndicator = useCallback((id: string) => {
    setEnabledIndicators((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toggleIndicatorVisibility = useCallback((id: string) => {
    setEnabledIndicators((prev) =>
      prev.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i))
    );
  }, []);

  const updateIndicatorParams = useCallback((id: string, params: Record<string, number | string>) => {
    setEnabledIndicators((prev) =>
      prev.map((i) => (i.id === id ? { ...i, params: { ...i.params, ...params } } : i))
    );
  }, []);

  const reorderIndicators = useCallback((fromIndex: number, toIndex: number) => {
    setEnabledIndicators((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  const loadPreset = useCallback((presetIndicators: { indicatorId: string; params: Record<string, number | string> }[]) => {
    const newIndicators: EnabledIndicator[] = presetIndicators.map((pi, index) => ({
      id: `ind-${pi.indicatorId}-${Date.now()}-${index}`,
      indicatorId: pi.indicatorId,
      params: pi.params,
      visible: true,
    }));
    setEnabledIndicators(newIndicators);
  }, []);

  // =====================
  // DRAWING ACTIONS
  // =====================

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev, drawings]);
    setRedoStack([]);
  }, [drawings]);

  const addDrawing = useCallback((drawing: Drawing) => {
    pushUndo();
    setDrawings((prev) => [...prev, drawing]);
  }, [pushUndo]);

  const removeDrawing = useCallback((id: string) => {
    pushUndo();
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    if (selectedDrawingId === id) {
      setSelectedDrawingId(null);
    }
  }, [pushUndo, selectedDrawingId]);

  const updateDrawing = useCallback((id: string, updates: Partial<Drawing>) => {
    setDrawings((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } as Drawing : d))
    );
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, drawings]);
    setUndoStack((prev) => prev.slice(0, -1));
    setDrawings(previous);
  }, [undoStack, drawings]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, drawings]);
    setRedoStack((prev) => prev.slice(0, -1));
    setDrawings(next);
  }, [redoStack, drawings]);

  const clearDrawings = useCallback(() => {
    if (drawings.length === 0) return;
    pushUndo();
    setDrawings([]);
    setSelectedDrawingId(null);
  }, [drawings, pushUndo]);

  // =====================
  // ELLIOTT WAVE ACTIONS
  // =====================

  const startElliottPlacement = useCallback(() => {
    setActiveTool("elliott_5");
    setElliottPlacement({
      active: true,
      step: 0,
      points: [],
    });
  }, []);

  const addElliottPoint = useCallback((point: DrawingPoint) => {
    setElliottPlacement((prev) => {
      const newPoints = [...prev.points, point];
      const newStep = prev.step + 1;

      // After 5 points, commit the drawing
      if (newStep >= 5) {
        const newDrawing: ElliottWave5Drawing = {
          id: `elliott-${Date.now()}`,
          type: "elliott_5",
          points: newPoints as [DrawingPoint, DrawingPoint, DrawingPoint, DrawingPoint, DrawingPoint],
          options: {
            showTrend13: false,
            showTrend24: false,
            showEpa14: false,
          },
          createdAt: Date.now(),
        };
        
        // Schedule adding the drawing (we can't call addDrawing here directly)
        setTimeout(() => {
          pushUndo();
          setDrawings((d) => [...d, newDrawing]);
        }, 0);

        return {
          active: false,
          step: 0,
          points: [],
        };
      }

      return {
        ...prev,
        step: newStep,
        points: newPoints,
      };
    });
  }, [pushUndo]);

  const cancelElliottPlacement = useCallback(() => {
    setElliottPlacement({
      active: false,
      step: 0,
      points: [],
    });
    setActiveTool("cursor");
  }, []);

  const updateElliottOptions = useCallback((id: string, options: Partial<ElliottWave5Drawing["options"]>) => {
    setDrawings((prev) =>
      prev.map((d) => {
        if (d.id === id && d.type === "elliott_5") {
          return { ...d, options: { ...d.options, ...options } };
        }
        return d;
      })
    );
  }, []);

  const resetElliottLabels = useCallback((id: string) => {
    // Labels are always 1-5, this is a no-op for data but could reset visual state
    // For now, just deselect and reselect to "reset" any UI state
    setSelectedDrawingId(null);
    setTimeout(() => setSelectedDrawingId(id), 50);
  }, []);

  // =====================
  // TOOL SELECTION
  // =====================

  const selectTool = useCallback((tool: DrawingToolId) => {
    // If switching away from elliott while placing, cancel
    if (activeTool === "elliott_5" && elliottPlacement.active && tool !== "elliott_5") {
      cancelElliottPlacement();
    }
    
    setActiveTool(tool);
    
    // Start elliott placement if selecting that tool
    if (tool === "elliott_5" && !elliottPlacement.active) {
      startElliottPlacement();
    }
  }, [activeTool, elliottPlacement.active, cancelElliottPlacement, startElliottPlacement]);

  return {
    // State
    activeTool,
    elliottPlacement,
    enabledIndicators,
    drawings,
    selectedDrawingId,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,

    // Tool actions
    selectTool,

    // Indicator actions
    addIndicator,
    removeIndicator,
    toggleIndicatorVisibility,
    updateIndicatorParams,
    reorderIndicators,
    loadPreset,

    // Drawing actions
    addDrawing,
    removeDrawing,
    updateDrawing,
    selectDrawing: setSelectedDrawingId,
    undo,
    redo,
    clearDrawings,

    // Elliott wave actions
    addElliottPoint,
    cancelElliottPlacement,
    updateElliottOptions,
    resetElliottLabels,
  };
}

export type ResearchToolsStore = ReturnType<typeof useResearchToolsStore>;

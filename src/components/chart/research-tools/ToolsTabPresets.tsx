/**
 * Tools Tab: Presets
 * Shows predefined indicator configurations
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { DEFAULT_PRESETS, INDICATOR_LIBRARY } from "./constants";
import type { IndicatorPreset } from "./types";

interface ToolsTabPresetsProps {
  onLoadPreset: (indicators: IndicatorPreset["indicators"]) => void;
  currentIndicatorIds: string[];
}

export function ToolsTabPresets({ onLoadPreset, currentIndicatorIds }: ToolsTabPresetsProps) {
  const isPresetActive = (preset: IndicatorPreset) => {
    if (currentIndicatorIds.length !== preset.indicators.length) return false;
    return preset.indicators.every((pi) => currentIndicatorIds.includes(pi.indicatorId));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Load a preset to quickly configure indicators
      </p>
      
      {DEFAULT_PRESETS.map((preset) => {
        const isActive = isPresetActive(preset);
        
        return (
          <Card 
            key={preset.id} 
            className={`transition-colors ${isActive ? "border-primary/50 bg-primary/5" : ""}`}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{preset.name}</span>
                {isActive && <Check className="h-4 w-4 text-primary" />}
              </div>
              
              <div className="flex flex-wrap gap-1 mb-3">
                {preset.indicators.map((pi, index) => {
                  const def = INDICATOR_LIBRARY.find((i) => i.id === pi.indicatorId);
                  const paramDisplay = Object.entries(pi.params)
                    .filter(([key]) => key === "period" || key === "multiplier")
                    .map(([, value]) => value)
                    .join("/");
                  
                  return (
                    <span
                      key={`${pi.indicatorId}-${index}`}
                      className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                    >
                      {def?.label || pi.indicatorId}
                      {paramDisplay && ` (${paramDisplay})`}
                    </span>
                  );
                })}
              </div>

              <Button
                variant={isActive ? "secondary" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => onLoadPreset(preset.indicators)}
              >
                {isActive ? "Active" : "Apply Preset"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

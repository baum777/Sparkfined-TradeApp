/**
 * Tools Tab: Enabled
 * Shows currently enabled indicators with reorder, toggle, edit, remove
 */

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GripVertical, Settings2, Trash2 } from "lucide-react";
import type { EnabledIndicator } from "./types";
import { INDICATOR_LIBRARY } from "./constants";

interface ToolsTabEnabledProps {
  enabledIndicators: EnabledIndicator[];
  onToggleVisibility: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function ToolsTabEnabled({
  enabledIndicators,
  onToggleVisibility,
  onRemove,
  onEdit,
}: ToolsTabEnabledProps) {
  if (enabledIndicators.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">No indicators enabled</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Go to Library to add indicators
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {enabledIndicators.map((indicator) => {
        const definition = INDICATOR_LIBRARY.find((i) => i.id === indicator.indicatorId);
        const displayLabel = definition?.label || indicator.indicatorId;
        
        // Format params for display
        const paramDisplay = Object.entries(indicator.params)
          .filter(([key]) => key === "period" || key === "multiplier")
          .map(([, value]) => value)
          .join(", ");

        return (
          <div
            key={indicator.id}
            className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />
            
            <div className="flex-1 min-w-0">
              <Label 
                htmlFor={`vis-${indicator.id}`} 
                className="text-sm font-medium cursor-pointer block truncate"
              >
                {displayLabel}
                {paramDisplay && (
                  <span className="text-muted-foreground font-normal ml-1">
                    ({paramDisplay})
                  </span>
                )}
              </Label>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Switch
                id={`vis-${indicator.id}`}
                checked={indicator.visible}
                onCheckedChange={() => onToggleVisibility(indicator.id)}
                className="scale-90"
              />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEdit(indicator.id)}
                    aria-label="Edit indicator"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onRemove(indicator.id)}
                    aria-label="Remove indicator"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove</TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}

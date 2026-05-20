/**
 * Tools Tab: Enabled
 * Shows currently enabled indicators with reorder, toggle, edit, remove
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  onEdit: (id: string | null) => void;
  onUpdateParams: (id: string, params: Record<string, number | string>) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  editingIndicatorId: string | null;
}

export function ToolsTabEnabled({
  enabledIndicators,
  onToggleVisibility,
  onRemove,
  onEdit,
  onUpdateParams,
  editingIndicatorId,
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
          <div key={indicator.id} className="rounded-md bg-muted/30 transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-2 p-2">
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
                      onClick={() => onEdit(editingIndicatorId === indicator.id ? null : indicator.id)}
                      aria-label="Edit indicator"
                      data-testid={`indicator-edit-${indicator.indicatorId}`}
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

            {editingIndicatorId === indicator.id && definition?.params && definition.params.length > 0 && (
              <div className="space-y-2 border-t border-border/40 p-2" data-testid={`indicator-editor-${indicator.indicatorId}`}>
                {definition.params.map((param) => (
                  <div key={param.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{param.label}</Label>
                    {param.type === "number" ? (
                      <Input
                        type="number"
                        min={param.min}
                        max={param.max}
                        step={param.key === "multiplier" ? 0.1 : 1}
                        value={indicator.params[param.key] ?? param.default}
                        onChange={(event) => {
                          const raw = event.currentTarget.value;
                          const parsed = Number.parseFloat(raw);
                          if (Number.isFinite(parsed)) {
                            onUpdateParams(indicator.id, { [param.key]: parsed });
                          }
                        }}
                        className="h-8 text-xs"
                      />
                    ) : (
                      <Select
                        value={String(indicator.params[param.key] ?? param.default)}
                        onValueChange={(value) => onUpdateParams(indicator.id, { [param.key]: value })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {param.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Elliott Wave Configuration Panel
 * Shows options for selected Elliott Wave drawing
 */

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RotateCcw, Trash2 } from "lucide-react";
import type { ElliottWave5Drawing } from "./types";

interface ElliottWaveConfigProps {
  drawing: ElliottWave5Drawing;
  onUpdateOptions: (options: Partial<ElliottWave5Drawing["options"]>) => void;
  onResetLabels: () => void;
  onDelete: () => void;
}

export function ElliottWaveConfig({
  drawing,
  onUpdateOptions,
  onResetLabels,
  onDelete,
}: ElliottWaveConfigProps) {
  return (
    <div 
      className="space-y-4 p-3 border border-border/50 rounded-lg bg-card/50"
      data-testid="elliott-wave-selected"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Elliott Wave 1-5</span>
        <span className="text-xs text-muted-foreground">
          {new Date(drawing.createdAt).toLocaleDateString()}
        </span>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Helper Lines
        </p>

        <div className="flex items-center justify-between">
          <Label 
            htmlFor="toggle-13" 
            className="text-sm cursor-pointer"
          >
            1–3 Trendline
          </Label>
          <Switch
            id="toggle-13"
            checked={drawing.options.showTrend13}
            onCheckedChange={(checked) => onUpdateOptions({ showTrend13: checked })}
            data-testid="elliott-toggle-13"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label 
            htmlFor="toggle-24" 
            className="text-sm cursor-pointer"
          >
            2–4 Trendline
          </Label>
          <Switch
            id="toggle-24"
            checked={drawing.options.showTrend24}
            onCheckedChange={(checked) => onUpdateOptions({ showTrend24: checked })}
            data-testid="elliott-toggle-24"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label 
            htmlFor="toggle-14" 
            className="text-sm cursor-pointer"
          >
            1–4 EPA Line
          </Label>
          <Switch
            id="toggle-14"
            checked={drawing.options.showEpa14}
            onCheckedChange={(checked) => onUpdateOptions({ showEpa14: checked })}
            data-testid="elliott-toggle-14"
          />
        </div>
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onResetLabels}
          data-testid="elliott-reset-labels"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset Labels
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          data-testid="elliott-delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground/70 text-center">
        Drag handles to reposition points
      </p>
    </div>
  );
}

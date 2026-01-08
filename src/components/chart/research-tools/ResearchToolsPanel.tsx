/**
 * Research Tools Panel
 * Desktop right panel with Enabled / Library / Presets tabs
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { ToolsTabEnabled } from "./ToolsTabEnabled";
import { ToolsTabLibrary } from "./ToolsTabLibrary";
import { ToolsTabPresets } from "./ToolsTabPresets";
import { ElliottWaveConfig } from "./ElliottWaveConfig";
import type { ResearchToolsStore } from "./useResearchToolsStore";
import type { ElliottWave5Drawing } from "./types";

interface ResearchToolsPanelProps {
  store: ResearchToolsStore;
  onOpenAIAnalyzer?: () => void;
}

export function ResearchToolsPanel({ store, onOpenAIAnalyzer }: ResearchToolsPanelProps) {
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);

  const currentIndicatorIds = store.enabledIndicators.map((i) => i.indicatorId);
  
  // Find selected Elliott Wave drawing
  const selectedElliott = store.selectedDrawingId
    ? (store.drawings.find(
        (d) => d.id === store.selectedDrawingId && d.type === "elliott_5"
      ) as ElliottWave5Drawing | undefined)
    : undefined;

  return (
    <div className="w-56 shrink-0 border border-border/50 rounded-lg bg-card/50 overflow-hidden">
      <div className="p-3 border-b border-border/50">
        <h2 className="text-sm font-semibold text-foreground">Tools</h2>
      </div>

      <div className="p-3">
        {/* AI Tools Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 mb-3"
          onClick={onOpenAIAnalyzer}
          aria-label="Analyze chart with AI"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          AI TA Analyze
        </Button>

        {/* Elliott Wave Config (when selected) */}
        {selectedElliott && (
          <div className="mb-3">
            <ElliottWaveConfig
              drawing={selectedElliott}
              onUpdateOptions={(options) => store.updateElliottOptions(selectedElliott.id, options)}
              onResetLabels={() => store.resetElliottLabels(selectedElliott.id)}
              onDelete={() => store.removeDrawing(selectedElliott.id)}
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="enabled" className="w-full" data-testid="research-tools-tabs">
          <TabsList className="w-full grid grid-cols-3 h-9">
            <TabsTrigger 
              value="enabled" 
              className="text-xs"
              data-testid="research-tools-tab-enabled"
            >
              Enabled
            </TabsTrigger>
            <TabsTrigger 
              value="library" 
              className="text-xs"
              data-testid="research-tools-tab-library"
            >
              Library
            </TabsTrigger>
            <TabsTrigger 
              value="presets" 
              className="text-xs"
              data-testid="research-tools-tab-presets"
            >
              Presets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enabled" className="mt-3">
            <ToolsTabEnabled
              enabledIndicators={store.enabledIndicators}
              onToggleVisibility={store.toggleIndicatorVisibility}
              onRemove={store.removeIndicator}
              onEdit={setEditingIndicatorId}
              onReorder={store.reorderIndicators}
            />
            {editingIndicatorId && (
              <p className="text-xs text-muted-foreground mt-2">
                Editing indicator: {editingIndicatorId}
              </p>
            )}
          </TabsContent>

          <TabsContent value="library" className="mt-3">
            <ToolsTabLibrary
              onAddIndicator={store.addIndicator}
              enabledIndicatorIds={currentIndicatorIds}
            />
          </TabsContent>

          <TabsContent value="presets" className="mt-3">
            <ToolsTabPresets
              onLoadPreset={store.loadPreset}
              currentIndicatorIds={currentIndicatorIds}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

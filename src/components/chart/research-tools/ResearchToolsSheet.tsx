/**
 * Research Tools Sheet
 * Mobile bottom sheet with Enabled / Library / Presets tabs
 */

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { ToolsTabEnabled } from "./ToolsTabEnabled";
import { ToolsTabLibrary } from "./ToolsTabLibrary";
import { ToolsTabPresets } from "./ToolsTabPresets";
import { ElliottWaveConfig } from "./ElliottWaveConfig";
import type { ResearchToolsStore } from "./useResearchToolsStore";
import type { ElliottWave5Drawing } from "./types";

interface ResearchToolsSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  store: ResearchToolsStore;
  onOpenAIAnalyzer?: () => void;
}

export function ResearchToolsSheet({
  isOpen,
  onOpenChange,
  store,
  onOpenAIAnalyzer,
}: ResearchToolsSheetProps) {
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);

  const currentIndicatorIds = store.enabledIndicators.map((i) => i.indicatorId);
  
  // Find selected Elliott Wave drawing
  const selectedElliott = store.selectedDrawingId
    ? (store.drawings.find(
        (d) => d.id === store.selectedDrawingId && d.type === "elliott_5"
      ) as ElliottWave5Drawing | undefined)
    : undefined;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 p-0 bg-background pb-20">
        <SheetHeader className="p-4 border-b border-border/50">
          <SheetTitle>Tools & Indicators</SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-3">
          {/* AI Tools Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => {
              onOpenChange(false);
              onOpenAIAnalyzer?.();
            }}
            aria-label="Analyze chart with AI"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            AI TA Analyze
          </Button>

          {/* Elliott Wave Config (when selected) */}
          {selectedElliott && (
            <ElliottWaveConfig
              drawing={selectedElliott}
              onUpdateOptions={(options) => store.updateElliottOptions(selectedElliott.id, options)}
              onResetLabels={() => store.resetElliottLabels(selectedElliott.id)}
              onDelete={() => store.removeDrawing(selectedElliott.id)}
            />
          )}

          {/* Tabs */}
          <Tabs defaultValue="enabled" className="w-full" data-testid="research-tools-tabs">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger 
                value="enabled"
                data-testid="research-tools-tab-enabled"
              >
                Enabled
              </TabsTrigger>
              <TabsTrigger 
                value="library"
                data-testid="research-tools-tab-library"
              >
                Library
              </TabsTrigger>
              <TabsTrigger 
                value="presets"
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
                  Editing: {editingIndicatorId}
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
      </SheetContent>
    </Sheet>
  );
}

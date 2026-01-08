import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ThumbsDown,
  Frown,
  Meh,
  Smile,
  ThumbsUp,
  Upload,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TradingWalletHint } from "@/components/common";
import type { JournalEntryV1 } from "@/types/journal";

// FUTURE USAGE: When a trading wallet is set, it can be passed as contextual
// metadata in the journal entry payload (e.g., tradingWallet field) once the
// API supports it. Currently, the wallet is shown for user awareness only.

type FeelingValue = NonNullable<JournalEntryV1["reflection"]>["feeling"];

export interface CreateEntryPayload {
  feeling: FeelingValue;
  confidence: number;
  reasoning?: string;
  tags: string[];
  expectation?: string;
  chartSnapshot?: string;
  notes?: string;
}

interface JournalCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateEntryPayload) => void;
}

const FEELINGS: { value: FeelingValue; icon: React.ElementType; label: string }[] = [
  { value: "very_negative", icon: ThumbsDown, label: "Very Bad" },
  { value: "negative", icon: Frown, label: "Bad" },
  { value: "neutral", icon: Meh, label: "Neutral" },
  { value: "positive", icon: Smile, label: "Good" },
  { value: "very_positive", icon: ThumbsUp, label: "Great" },
];

type SectionKey = "context" | "metrics" | "snapshot" | "tags" | "notes";

export function JournalCreateDialog({
  isOpen,
  onClose,
  onCreate,
}: JournalCreateDialogProps) {
  // Always visible
  const [feeling, setFeeling] = useState<FeelingValue>("neutral");
  const [confidence, setConfidence] = useState(50);
  
  // Collapsed sections (only one open at a time)
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  
  // Section data
  const [reasoning, setReasoning] = useState("");
  const [expectation, setExpectation] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [notes, setNotes] = useState("");
  const [chartSnapshot, setChartSnapshot] = useState("");

  const toggleSection = (section: SectionKey) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const handleCreate = () => {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onCreate({
      feeling,
      confidence,
      reasoning: reasoning.trim() || undefined,
      tags,
      expectation: expectation.trim() || undefined,
      chartSnapshot: chartSnapshot.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    // Reset form
    setFeeling("neutral");
    setConfidence(50);
    setReasoning("");
    setExpectation("");
    setTagsInput("");
    setNotes("");
    setChartSnapshot("");
    setOpenSection(null);
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const canGenerateAINote = feeling !== "neutral" || reasoning.length > 20;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        data-testid="journal-manual-entry-modal"
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>New Diary Entry</DialogTitle>
          <TradingWalletHint className="mt-1" />
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* ALWAYS VISIBLE: Feeling (5 cards) */}
          <div className="space-y-3" data-testid="journal-manual-feeling">
            <Label>How are you feeling?</Label>
            <div className="grid grid-cols-5 gap-2">
              {FEELINGS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFeeling(value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                    "hover:bg-muted/50",
                    feeling === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ALWAYS VISIBLE: Confidence slider */}
          <div className="space-y-3" data-testid="journal-manual-confidence">
            <div className="flex items-center justify-between">
              <Label>Confidence</Label>
              <span className="text-sm font-medium text-foreground">
                {confidence}%
              </span>
            </div>
            <Slider
              value={[confidence]}
              onValueChange={([v]) => setConfidence(v)}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* COLLAPSED SECTION: Market Context */}
          <Collapsible
            open={openSection === "context"}
            onOpenChange={() => toggleSection("context")}
            data-testid="journal-manual-section-context"
          >
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">Market Context</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openSection === "context" && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reasoning">Reasoning</Label>
                <Textarea
                  id="reasoning"
                  placeholder="Why did you take this trade / observation?"
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectation">Expectation</Label>
                <Textarea
                  id="expectation"
                  placeholder="What do you expect to happen?"
                  value={expectation}
                  onChange={(e) => setExpectation(e.target.value)}
                  rows={2}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* COLLAPSED SECTION: Additional Metrics (placeholder) */}
          <Collapsible
            open={openSection === "metrics"}
            onOpenChange={() => toggleSection("metrics")}
            data-testid="journal-manual-section-additional"
          >
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">Additional Metrics</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openSection === "metrics" && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <p className="text-sm text-muted-foreground">
                Additional metrics sliders coming soon
              </p>
            </CollapsibleContent>
          </Collapsible>

          {/* COLLAPSED SECTION: Chart Snapshot */}
          <Collapsible
            open={openSection === "snapshot"}
            onOpenChange={() => toggleSection("snapshot")}
            data-testid="journal-manual-section-snapshot"
          >
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">Chart Snapshot</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openSection === "snapshot" && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="space-y-2">
                <Label htmlFor="snapshot">Image URL or Upload</Label>
                <div className="flex gap-2">
                  <Input
                    id="snapshot"
                    placeholder="Paste image URL..."
                    value={chartSnapshot}
                    onChange={(e) => setChartSnapshot(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" disabled>
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* COLLAPSED SECTION: Tags */}
          <Collapsible
            open={openSection === "tags"}
            onOpenChange={() => toggleSection("tags")}
            data-testid="journal-manual-section-tags"
          >
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">Tags</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openSection === "tags" && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g., breakout, momentum, scalp"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* COLLAPSED SECTION: Notes + AI */}
          <Collapsible
            open={openSection === "notes"}
            onOpenChange={() => toggleSection("notes")}
            data-testid="journal-manual-notes"
          >
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">Notes</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openSection === "notes" && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional thoughts..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                data-testid="journal-manual-generate-ai-note"
                variant="outline"
                size="sm"
                disabled={!canGenerateAINote}
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Note
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="journal-manual-save" onClick={handleCreate}>
            Save Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

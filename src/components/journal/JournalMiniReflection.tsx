import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Smile,
  Meh,
  Frown,
  Zap,
  AlertTriangle,
  Check,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { JournalEntryLocal } from "@/services/journal/types";

interface JournalMiniReflectionProps {
  isOpen: boolean;
  onClose: () => void;
  entry: JournalEntryLocal | null;
  onSaveNote: (entryId: string, reflection: ReflectionData) => void;
  onConfirmSave: (entryId: string, reflection: ReflectionData) => void;
}

// NOTE: ReflectionData (feeling, confidence, reasoning) is local-only by contract.
// POST /api/journal/:id/confirm sends NO request body per CONTRACTS.md.
// These fields are collected for potential future use or local analytics only.
export interface ReflectionData {
  feeling: FeelingType;
  confidence: number;
  reasoning: string;
}

type FeelingType = "confident" | "neutral" | "uncertain" | "fomo" | "fearful";

const feelings: { type: FeelingType; icon: typeof Smile; label: string }[] = [
  { type: "confident", icon: Smile, label: "Confident" },
  { type: "neutral", icon: Meh, label: "Neutral" },
  { type: "uncertain", icon: Frown, label: "Uncertain" },
  { type: "fomo", icon: Zap, label: "FOMO" },
  { type: "fearful", icon: AlertTriangle, label: "Fearful" },
];

export function JournalMiniReflection({
  isOpen,
  onClose,
  entry,
  onSaveNote,
  onConfirmSave,
}: JournalMiniReflectionProps) {
  const isMobile = useIsMobile();
  const [feeling, setFeeling] = useState<FeelingType>("neutral");
  const [confidence, setConfidence] = useState([50]);
  const [reasoning, setReasoning] = useState("");

  const handleSaveNote = () => {
    if (!entry) return;
    onSaveNote(entry.id, {
      feeling,
      confidence: confidence[0],
      reasoning,
    });
    resetAndClose();
  };

  const handleConfirmSave = () => {
    if (!entry) return;
    onConfirmSave(entry.id, {
      feeling,
      confidence: confidence[0],
      reasoning,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setFeeling("neutral");
    setConfidence([50]);
    setReasoning("");
    onClose();
  };

  if (!entry) return null;

  const content = (
    <div
      data-testid="journal-mini-reflection"
      className="flex flex-col gap-5 pt-4"
    >
      {/* Feeling */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">How do you feel about this entry?</Label>
        <div
          data-testid="journal-mini-feeling"
          className="flex items-center gap-2"
        >
          {feelings.map((f) => {
            const Icon = f.icon;
            const isSelected = feeling === f.type;
            return (
              <button
                key={f.type}
                type="button"
                onClick={() => setFeeling(f.type)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
                  "border border-transparent",
                  isSelected
                    ? "bg-primary/10 border-primary text-primary"
                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Confidence */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Confidence level</Label>
          <span
            data-testid="journal-mini-confidence"
            className="text-sm font-mono text-muted-foreground"
          >
            {confidence[0]}%
          </span>
        </div>
        <Slider
          value={confidence}
          onValueChange={setConfidence}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* Reasoning */}
      <div className="space-y-2">
        <Label htmlFor="reasoning" className="text-sm font-medium">
          Quick note (optional)
        </Label>
        <Textarea
          data-testid="journal-mini-reasoning"
          id="reasoning"
          placeholder="What felt important here?"
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          data-testid="journal-mini-save"
          variant="secondary"
          className="flex-1"
          onClick={handleSaveNote}
        >
          <Save className="h-4 w-4 mr-1.5" />
          Save Note
        </Button>
        <Button
          data-testid="journal-mini-confirm-save"
          className="flex-1"
          onClick={handleConfirmSave}
        >
          <Check className="h-4 w-4 mr-1.5" />
          Confirm + Save
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Add Reflection</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-6">
        <SheetHeader>
          <SheetTitle>Add Reflection</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}

import { useState, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Edit3,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import type { JournalEntryLocal } from "@/services/journal/types";
import { cn } from "@/lib/utils";
import { JournalInsightCard } from "./JournalInsightCard";

interface JournalReviewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  pendingEntries: JournalEntryLocal[];
  initialIndex?: number;
  onConfirm: (id: string) => void;
  onEdit: (entry: JournalEntryLocal) => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  isComplete: boolean;
  value: string;
}

export function JournalReviewOverlay({
  isOpen,
  onClose,
  pendingEntries,
  initialIndex = 0,
  onConfirm,
  onEdit,
}: JournalReviewOverlayProps) {
  const isMobile = useIsMobile();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const currentEntry = pendingEntries[activeIndex];
  const total = pendingEntries.length;
  const hasNext = activeIndex < total - 1;
  const hasPrev = activeIndex > 0;

  // Reset index when entries change or overlay opens
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(Math.min(initialIndex, pendingEntries.length - 1));
    }
  }, [isOpen, initialIndex, pendingEntries.length]);

  // Initialize checklist for current entry
  useEffect(() => {
    if (currentEntry) {
      // Generate checklist items based on missing fields
      const items: ChecklistItem[] = [
        { id: "mood", label: "Add your mood", isComplete: false, value: "" },
        { id: "result", label: "Confirm result", isComplete: false, value: "" },
        { id: "lesson", label: "Note the lesson", isComplete: false, value: "" },
      ];
      setChecklist(items);
    }
  }, [currentEntry?.id]);

  const handlePrev = useCallback(() => {
    if (hasPrev) setActiveIndex((i) => i - 1);
  }, [hasPrev]);

  const handleNext = useCallback(() => {
    if (hasNext) setActiveIndex((i) => i + 1);
  }, [hasNext]);

  const handleConfirm = useCallback(() => {
    if (currentEntry) {
      onConfirm(currentEntry.id);
      // Auto-advance or close
      if (hasNext) {
        // Stay at same index as next entry slides in
      } else if (hasPrev) {
        setActiveIndex((i) => i - 1);
      } else {
        onClose();
      }
    }
  }, [currentEntry, hasNext, hasPrev, onConfirm, onClose]);

  const updateChecklistItem = (id: string, value: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, value, isComplete: value.trim().length > 0 }
          : item
      )
    );
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  if (!currentEntry || pendingEntries.length === 0) {
    return null;
  }

  const overlayContent = (
    <div className="flex flex-col h-full" data-testid="journal-review-overlay">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {format(new Date(currentEntry.timestamp), "MMM d, yyyy")}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              {format(new Date(currentEntry.timestamp), "HH:mm")}
            </span>
          </div>
          <Badge variant="outline" className="text-amber-500 border-amber-500/50">
            Pending
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Progress */}
          <span className="text-xs text-muted-foreground">
            Entry {activeIndex + 1} / {total}
          </span>

          {/* Navigation */}
          <Button
            data-testid="journal-review-prev"
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            disabled={!hasPrev}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            data-testid="journal-review-next"
            variant="ghost"
            size="icon"
            onClick={handleNext}
            disabled={!hasNext}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {/* Section 1: Snapshot */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Snapshot
          </h3>
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <span className="text-sm text-muted-foreground shrink-0">Entry</span>
              <p className="text-sm text-foreground text-right line-clamp-3">
                {currentEntry.summary}
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Time</span>
              <span className="text-sm text-foreground">
                {format(new Date(currentEntry.timestamp), "HH:mm")}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: AI Insight */}
        <JournalInsightCard entry={currentEntry} />

        {/* Section 3: Complete it checklist */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Complete it
          </h3>
          <div className="space-y-3">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  item.isComplete
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-border bg-background"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  {item.isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Label
                    htmlFor={item.id}
                    className={cn(
                      "text-sm",
                      item.isComplete && "text-emerald-500"
                    )}
                  >
                    {item.label}
                  </Label>
                </div>
                <Input
                  id={item.id}
                  placeholder={`Enter ${item.label.toLowerCase()}...`}
                  value={item.value}
                  onChange={(e) => updateChecklistItem(item.id, e.target.value)}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-border bg-background">
        <Button
          data-testid="journal-review-confirm"
          variant="default"
          className="flex-1"
          onClick={handleConfirm}
        >
          <Check className="h-4 w-4 mr-2" />
          Confirm
        </Button>
        <Button
          data-testid="journal-review-edit"
          variant="secondary"
          onClick={() => onEdit(currentEntry)}
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>
    </div>
  );

  // Responsive: Drawer for mobile, Sheet for desktop
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Review Entry</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 pt-2 overflow-y-auto">
            {overlayContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-6">
        <SheetHeader className="sr-only">
          <SheetTitle>Review Entry</SheetTitle>
        </SheetHeader>
        {overlayContent}
      </SheetContent>
    </Sheet>
  );
}

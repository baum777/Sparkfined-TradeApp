import { useMemo, useState, useCallback, useEffect } from "react";
import { isToday, isYesterday } from "date-fns";
import { Button } from "@/components/ui/button";
import { LayoutList, Check } from "lucide-react";
import { JournalInboxCard } from "./JournalInboxCard";
import { JournalMiniReflection, type ReflectionData } from "./JournalMiniReflection";
import type { JournalEntryLocal } from "@/services/journal/types";

interface JournalInboxViewProps {
  pendingEntries: JournalEntryLocal[];
  onConfirm: (id: string) => void;
  onSaveNote: (id: string, reflection: ReflectionData) => void;
  onConfirmWithNote: (id: string, reflection: ReflectionData) => void;
  onGoToTimeline: () => void;
  syncErrors?: Set<string>;
}

interface DayGroup {
  label: string;
  entries: JournalEntryLocal[];
}

export function JournalInboxView({
  pendingEntries,
  onConfirm,
  onSaveNote,
  onConfirmWithNote,
  onGoToTimeline,
  syncErrors = new Set(),
}: JournalInboxViewProps) {
  const [reflectionEntry, setReflectionEntry] = useState<JournalEntryLocal | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Group entries by Today / Yesterday / Older
  const dayGroups = useMemo(() => {
    const groups: DayGroup[] = [
      { label: "Today", entries: [] },
      { label: "Yesterday", entries: [] },
      { label: "Older", entries: [] },
    ];

    pendingEntries.forEach((entry) => {
      const date = new Date(entry.timestamp);
      if (isToday(date)) {
        groups[0].entries.push(entry);
      } else if (isYesterday(date)) {
        groups[1].entries.push(entry);
      } else {
        groups[2].entries.push(entry);
      }
    });

    // Sort entries within groups (newest first)
    groups.forEach((g) => {
      g.entries.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    });

    return groups.filter((g) => g.entries.length > 0);
  }, [pendingEntries]);

  const handleAddNote = useCallback((entry: JournalEntryLocal) => {
    setReflectionEntry(entry);
  }, []);

  const handleSaveNote = useCallback((id: string, reflection: ReflectionData) => {
    onSaveNote(id, reflection);
    setReflectionEntry(null);
  }, [onSaveNote]);

  const handleConfirmSave = useCallback((id: string, reflection: ReflectionData) => {
    onConfirmWithNote(id, reflection);
    setReflectionEntry(null);
  }, [onConfirmWithNote]);

  // Get flat list for keyboard nav index
  const flatEntries = useMemo(
    () => dayGroups.flatMap((g) => g.entries),
    [dayGroups]
  );

  // Keyboard shortcuts: J/K nav, C confirm, N add note
  useEffect(() => {
    if (flatEntries.length === 0 || reflectionEntry) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const focusedEntry = flatEntries[focusedIndex];
      if (!focusedEntry) return;

      switch (e.key.toLowerCase()) {
        case "j":
          // Next card
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, flatEntries.length - 1));
          break;
        case "k":
          // Previous card
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "c":
          // Confirm focused
          e.preventDefault();
          onConfirm(focusedEntry.id);
          // Move focus if needed
          if (focusedIndex >= flatEntries.length - 1 && focusedIndex > 0) {
            setFocusedIndex((prev) => prev - 1);
          }
          break;
        case "n":
          // Add note
          e.preventDefault();
          setReflectionEntry(focusedEntry);
          break;
        case "escape":
          // Close composer (handled by drawer, but reset focus)
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flatEntries, focusedIndex, reflectionEntry, onConfirm]);

  // Reset focus when entries change
  useEffect(() => {
    if (focusedIndex >= flatEntries.length) {
      setFocusedIndex(Math.max(0, flatEntries.length - 1));
    }
  }, [flatEntries.length, focusedIndex]);

  const todayCount = dayGroups.find((g) => g.label === "Today")?.entries.length ?? 0;

  if (pendingEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Check className="h-8 w-8 text-emerald-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-foreground">All caught up!</h3>
          <p className="text-sm text-muted-foreground">No pending entries to review</p>
        </div>
        <Button variant="outline" onClick={onGoToTimeline}>
          <LayoutList className="h-4 w-4 mr-2" />
          Go to Timeline
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Bulk confirm button for today */}
        {todayCount > 1 && (
          <div className="flex justify-end">
            <Button
              data-testid="journal-inbox-bulk-confirm-today"
              variant="outline"
              size="sm"
              className="h-9 px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => {
                const todayEntries = dayGroups.find((g) => g.label === "Today")?.entries ?? [];
                todayEntries.forEach((e) => onConfirm(e.id));
              }}
            >
              <Check className="h-4 w-4 mr-1.5" />
              Confirm all Today ({todayCount})
            </Button>
          </div>
        )}

        {/* Keyboard hint (desktop only) */}
        <p className="hidden md:block text-xs text-muted-foreground">
          <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground">J</kbd>/<kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground">K</kbd> navigate · <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground">C</kbd> confirm · <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground">N</kbd> note
        </p>

        {dayGroups.map((group) => (
          <div key={group.label} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {group.label}
            </h3>
            <div className="space-y-3">
              {group.entries.map((entry) => {
                const globalIdx = flatEntries.findIndex((e) => e.id === entry.id);
                return (
                  <JournalInboxCard
                    key={entry.id}
                    entry={entry}
                    onConfirm={() => onConfirm(entry.id)}
                    onAddNote={() => handleAddNote(entry)}
                    isFocused={globalIdx === focusedIndex}
                    hasSyncError={syncErrors.has(entry.id)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <JournalMiniReflection
        isOpen={!!reflectionEntry}
        onClose={() => setReflectionEntry(null)}
        entry={reflectionEntry}
        onSaveNote={handleSaveNote}
        onConfirmSave={handleConfirmSave}
      />
    </>
  );
}

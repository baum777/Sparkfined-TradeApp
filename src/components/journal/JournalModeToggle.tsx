import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutList, Inbox, GraduationCap, BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";

export type JournalMode = "timeline" | "inbox" | "learn" | "playbook";

const JOURNAL_MODE_KEY = "journalModeV3";

interface JournalModeToggleProps {
  value: JournalMode;
  onChange: (mode: JournalMode) => void;
  pendingCount?: number;
}

export function getStoredJournalMode(): JournalMode {
  const stored = localStorage.getItem(JOURNAL_MODE_KEY);
  if (stored === "timeline" || stored === "inbox" || stored === "learn" || stored === "playbook") {
    return stored;
  }
  return "timeline";
}

export function setStoredJournalMode(mode: JournalMode): void {
  localStorage.setItem(JOURNAL_MODE_KEY, mode);
}

export function JournalModeToggle({
  value,
  onChange,
  pendingCount = 0,
}: JournalModeToggleProps) {
  const handleChange = (newValue: string) => {
    if (newValue && (newValue === "timeline" || newValue === "inbox" || newValue === "learn" || newValue === "playbook")) {
      onChange(newValue as JournalMode);
      setStoredJournalMode(newValue as JournalMode);
    }
  };

  return (
    <div data-testid="journal-mode-toggle" className="inline-flex">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={handleChange}
        className="bg-secondary/50 p-0.5 rounded-lg"
      >
        <ToggleGroupItem
          data-testid="journal-mode-timeline"
          value="timeline"
          className={cn(
            "px-3 py-1.5 text-sm font-medium gap-1.5 rounded-md transition-all",
            value === "timeline"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutList className="h-4 w-4" />
          <span className="hidden sm:inline">Timeline</span>
        </ToggleGroupItem>

        <ToggleGroupItem
          data-testid="journal-mode-inbox"
          value="inbox"
          className={cn(
            "px-3 py-1.5 text-sm font-medium gap-1.5 rounded-md transition-all relative",
            value === "inbox"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Inbox className="h-4 w-4" />
          <span className="hidden sm:inline">Inbox</span>
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center text-[10px] font-bold bg-amber-500 text-amber-950 rounded-full px-1">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </ToggleGroupItem>

        <ToggleGroupItem
          data-testid="journal-mode-learn"
          value="learn"
          className={cn(
            "px-3 py-1.5 text-sm font-medium gap-1.5 rounded-md transition-all",
            value === "learn"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <GraduationCap className="h-4 w-4" />
          <span className="hidden sm:inline">Learn</span>
        </ToggleGroupItem>

        <ToggleGroupItem
          data-testid="journal-mode-playbook"
          value="playbook"
          className={cn(
            "px-3 py-1.5 text-sm font-medium gap-1.5 rounded-md transition-all",
            value === "playbook"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BookMarked className="h-4 w-4" />
          <span className="hidden sm:inline">Playbook</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

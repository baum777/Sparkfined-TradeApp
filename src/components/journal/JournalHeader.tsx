import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
import type { JournalEntryLocal } from "@/services/journal/types";
import { JournalViewToggle, type JournalViewMode } from "./JournalViewToggle";

interface JournalHeaderProps {
  entries: JournalEntryLocal[];
  onLogEntry: () => void;
  viewMode?: JournalViewMode;
  onViewModeChange?: (mode: JournalViewMode) => void;
}

export function JournalHeader({ 
  entries, 
  onLogEntry,
  viewMode,
  onViewModeChange,
}: JournalHeaderProps) {
  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const confirmedCount = entries.filter((e) => e.status === "confirmed").length;
  const archivedCount = entries.filter((e) => e.status === "archived").length;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Journal
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {pendingCount} pending
          </Badge>
          <Badge variant="outline" className="text-xs">
            {confirmedCount} confirmed
          </Badge>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {archivedCount} archived
          </Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* View toggle */}
        {viewMode && onViewModeChange && (
          <JournalViewToggle value={viewMode} onChange={onViewModeChange} />
        )}
        
        <div className="flex items-center gap-2">
          <Button onClick={onLogEntry}>
            <Plus className="h-4 w-4 mr-2" />
            Log entry
          </Button>
          <Button 
            variant="outline" 
            disabled
            aria-label="Export journal entries"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {/* BACKEND_TODO: implement export functionality */}
        </div>
      </div>
    </div>
  );
}

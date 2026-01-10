import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit3, Archive, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { JournalEntryLocal } from "@/services/journal/types";

interface JournalEntryCardProps {
  entry: JournalEntryLocal;
  onEdit?: () => void;
  onArchive?: () => void;
}

export function JournalEntryCard({ entry, onEdit, onArchive }: JournalEntryCardProps) {
  const timeFormatted = format(new Date(entry.timestamp), "HH:mm");
  const isConfirmed = entry.status === "confirmed";

  return (
    <Card
      data-testid="journal-card-entry"
      className={cn(
        "relative bg-surface border-border/50 rounded-xl",
        "hover:border-border hover:shadow-md transition-all"
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
          isConfirmed ? "bg-emerald-500" : "bg-muted-foreground/30"
        )}
      />

      <CardContent className="p-4 pl-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant={isConfirmed ? "default" : "secondary"} className="text-xs gap-1">
                {isConfirmed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {entry.status}
              </Badge>
              <span className="text-xs text-muted-foreground">{timeFormatted}</span>
            </div>
            <p className="text-sm text-foreground/90 line-clamp-3">{entry.summary}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEdit && (
            <Button
              data-testid="journal-entry-edit"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit3 className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          )}
          {onArchive && (
            <Button
              data-testid="journal-entry-archive"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


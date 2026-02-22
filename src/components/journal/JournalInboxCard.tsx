import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, MessageSquarePlus, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { JournalEntryLocal } from "@/services/journal/types";

interface JournalInboxCardProps {
  entry: JournalEntryLocal;
  onConfirm: () => void;
  onAddNote: () => void;
  isFocused?: boolean;
  hasSyncError?: boolean;
}

export function JournalInboxCard({
  entry,
  onConfirm,
  onAddNote,
  isFocused = false,
  hasSyncError = false,
}: JournalInboxCardProps) {
  const timeFormatted = format(new Date(entry.timestamp), "HH:mm");
  const dateFormatted = format(new Date(entry.timestamp), "MMM d");

  return (
    <Card
      data-testid="journal-inbox-card"
      className={cn(
        "relative transition-all duration-200",
        "bg-surface border-border/50 rounded-xl",
        "hover:border-border hover:shadow-md",
        isFocused && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        hasSyncError && "border-destructive/50"
      )}
    >
      <CardContent className="p-4">
        {/* Header Row: Timestamp + Pending badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{dateFormatted} {timeFormatted}</span>
            </div>
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">
              Pending
            </Badge>
          </div>

          {hasSyncError && (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
        </div>

        {/* Summary */}
        <p className="text-sm text-foreground/90 mb-4 line-clamp-3">
          {entry.summary}
        </p>

        {hasSyncError && (entry._syncLastError || entry._syncRetryCount !== undefined) && (
          <div className="mb-3 text-xs text-destructive/90">
            {entry._syncRetryCount !== undefined ? (
              <span className="font-medium">Retry #{entry._syncRetryCount}:</span>
            ) : null}{' '}
            {entry._syncLastError ?? 'Sync failed'}
          </div>
        )}

        {/* Actions - ALWAYS visible */}
        <div className="flex items-center gap-2">
          <Button
            data-testid="journal-inbox-confirm"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className="flex-1 h-9 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Confirm
          </Button>

          <Button
            data-testid="journal-inbox-add-note"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAddNote();
            }}
            className="h-9 px-3 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MessageSquarePlus className="h-4 w-4 mr-1.5" />
            Note
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

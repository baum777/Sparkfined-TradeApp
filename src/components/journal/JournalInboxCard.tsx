import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Archive,
  MessageSquarePlus,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { JournalEntryLocal } from "@/services/journal/types";
import type { OnchainContextV1 } from "@/types/journal";
import { formatInboxContextLine, formatUsdSize, formatEntryPrice } from "@/types/journal";

// Extended entry type with optional v1 fields
interface JournalInboxEntry extends JournalEntryLocal {
  symbol?: string;
  sizeUsd?: number;
  entryPrice?: number;
  onchainContext?: OnchainContextV1;
  source?: "auto" | "manual";
}

interface JournalInboxCardProps {
  entry: JournalInboxEntry;
  onConfirm: () => void;
  onArchive: () => void;
  onAddNote: () => void;
  isFocused?: boolean;
  hasSyncError?: boolean;
}

export function JournalInboxCard({
  entry,
  onConfirm,
  onArchive,
  onAddNote,
  isFocused = false,
  hasSyncError = false,
}: JournalInboxCardProps) {
  const timeFormatted = format(new Date(entry.timestamp), "HH:mm");
  const dateFormatted = format(new Date(entry.timestamp), "MMM d");
  const isLong = entry.side === "BUY";
  const contextLine = formatInboxContextLine(entry.onchainContext);

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
        {/* Header Row: Symbol/Pair + Side + Timestamp + Pending badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {isLong ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className="font-medium text-foreground">
              {entry.symbol || (isLong ? "LONG" : "SHORT")}
            </span>
            <span className="text-xs text-muted-foreground">
              {isLong ? "Buy" : "Sell"}
            </span>
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

        {/* Metrics Row: USD Size + Entry Price */}
        {(entry.sizeUsd || entry.entryPrice) && (
          <div className="flex items-center gap-4 mb-2 text-sm text-muted-foreground">
            {entry.sizeUsd && (
              <span>Size: {formatUsdSize(entry.sizeUsd)}</span>
            )}
            {entry.entryPrice && (
              <span>Entry: {formatEntryPrice(entry.entryPrice)}</span>
            )}
          </div>
        )}

        {/* Onchain Summary Line (FROZEN FORMAT) */}
        {contextLine && (
          <p className="text-xs text-muted-foreground mb-3">
            {contextLine}
          </p>
        )}

        {/* Context chips: source=auto */}
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span>{entry.source || "auto"}</span>
          </div>
          {entry.onchainContext?.dexId && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{entry.onchainContext.dexId}</span>
            </>
          )}
        </div>

        {/* Actions - ALWAYS visible */}
        <div className="flex items-center gap-2">
          <Button
            data-testid="journal-inbox-confirm"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Confirm
          </Button>

          <Button
            data-testid="journal-inbox-add-note"
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAddNote();
            }}
          >
            <MessageSquarePlus className="h-4 w-4 mr-1.5" />
            Note
          </Button>

          <Button
            data-testid="journal-inbox-archive"
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
        </div>
      </CardContent>
    </Card>
  );
}

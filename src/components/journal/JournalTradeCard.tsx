import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Edit3,
  Archive,
  MessageSquarePlus,
  TrendingUp,
  TrendingDown,
  Clock,
  Smile,
  Meh,
  Frown,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { JournalEntryLocal } from "@/services/journal/types";
import type { OnchainContextV1 } from "@/types/journal";
import { formatTimelineContextLine, formatUsdSize, formatEntryPrice } from "@/types/journal";

// Extended entry type with optional v1 fields
interface JournalTradeEntry extends JournalEntryLocal {
  symbol?: string;
  sizeUsd?: number;
  entryPrice?: number;
  onchainContext?: OnchainContextV1;
  reflection?: {
    feeling: "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
    confidence: number;
    reasoning?: string;
  };
}

interface JournalTradeCardProps {
  entry: JournalTradeEntry;
  onEdit?: () => void;
  onArchive?: () => void;
  onAddReflection?: () => void;
}

function getSessionLabel(timestamp: string): string {
  const hour = new Date(timestamp).getHours();
  if (hour >= 0 && hour < 9) return "Asia";
  if (hour >= 9 && hour < 14) return "London";
  return "NY";
}

type FeelingType = "very_negative" | "negative" | "neutral" | "positive" | "very_positive";

function FeelingIcon({ feeling }: { feeling: FeelingType }) {
  switch (feeling) {
    case "very_positive":
      return <ThumbsUp className="h-4 w-4 text-emerald-500" />;
    case "positive":
      return <Smile className="h-4 w-4 text-emerald-400" />;
    case "neutral":
      return <Meh className="h-4 w-4 text-muted-foreground" />;
    case "negative":
      return <Frown className="h-4 w-4 text-amber-500" />;
    case "very_negative":
      return <ThumbsDown className="h-4 w-4 text-red-500" />;
    default:
      return <Meh className="h-4 w-4 text-muted-foreground" />;
  }
}

export function JournalTradeCard({
  entry,
  onEdit,
  onArchive,
  onAddReflection,
}: JournalTradeCardProps) {
  const isLong = entry.side === "BUY";
  const timeFormatted = format(new Date(entry.timestamp), "HH:mm");
  const sessionLabel = getSessionLabel(entry.timestamp);
  
  const hasReflection = !!entry.reflection;
  const contextLine = formatTimelineContextLine(entry.onchainContext);

  return (
    <Card
      data-testid="journal-card-trade"
      className={cn(
        "relative bg-surface border-border/50 rounded-xl",
        "hover:border-border hover:shadow-md transition-all"
      )}
    >
      {/* Left accent */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
          isLong ? "bg-emerald-500" : "bg-red-500"
        )} 
      />

      <CardContent className="p-4 pl-5">
        {/* Header: Symbol/Pair + Side + Time */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
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
              <span>{timeFormatted}</span>
              <span className="text-muted-foreground/50">•</span>
              <span>{sessionLabel}</span>
            </div>
          </div>
        </div>

        {/* Metrics row: USD Size + Entry Price */}
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

        {/* Context Line (FROZEN FORMAT) */}
        {contextLine && (
          <p className="text-xs text-muted-foreground mb-3">
            {contextLine}
          </p>
        )}

        {/* Summary (fallback if no context line) */}
        {!contextLine && entry.summary && (
          <p className="text-sm text-foreground/90 line-clamp-2 mb-3">
            {entry.summary}
          </p>
        )}

        {/* Reflection snippet */}
        {hasReflection && entry.reflection && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-muted/30">
            <FeelingIcon feeling={entry.reflection.feeling} />
            <span className="text-xs text-muted-foreground">
              {entry.reflection.confidence}% confident
            </span>
            {entry.reflection.reasoning && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {entry.reflection.reasoning}
                </span>
              </>
            )}
          </div>
        )}

        {/* Actions (secondary only) */}
        <div className="flex items-center gap-2">
          {!hasReflection && onAddReflection && (
            <Button
              data-testid="journal-trade-add-reflection"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAddReflection();
              }}
            >
              <MessageSquarePlus className="h-4 w-4 mr-1.5" />
              Add Reflection
            </Button>
          )}
          {hasReflection && onEdit && (
            <Button
              data-testid="journal-trade-edit"
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
              data-testid="journal-trade-archive"
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

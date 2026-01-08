import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Paperclip, LineChart, Clock } from "lucide-react";
import { format } from "date-fns";
import type { JournalEntryLocal, JournalEntryStatus } from "@/services/journal/types";
import { cn } from "@/lib/utils";

interface JournalMomentCardProps {
  entry: JournalEntryLocal;
  onClick: () => void;
}

function getSessionLabel(timestamp: string): string {
  const hour = new Date(timestamp).getHours();
  if (hour >= 0 && hour < 9) return "Asia";
  if (hour >= 9 && hour < 14) return "London";
  return "NY";
}

function getSpineColor(status: JournalEntryStatus): string {
  switch (status) {
    case "pending":
      return "bg-muted-foreground/50 border-dashed border-muted-foreground/30";
    case "confirmed":
      return "bg-emerald-500";
    case "archived":
      return "bg-muted-foreground/30";
    default:
      return "bg-muted";
  }
}

export function JournalMomentCard({ entry, onClick }: JournalMomentCardProps) {
  const timeFormatted = format(new Date(entry.timestamp), "HH:mm");
  const sessionLabel = getSessionLabel(entry.timestamp);
  const spineColor = getSpineColor(entry.status);
  const isArchived = entry.status === "archived";

  // Simulated flags (would come from real entry data)
  const hasAttachments = entry.id.includes("2") || entry.id.includes("5");
  const hasChartLink = entry.id.includes("1") || entry.id.includes("3");

  return (
    <Card
      data-testid="journal-moment-card"
      onClick={onClick}
      className={cn(
        "relative cursor-pointer transition-all duration-200",
        "bg-surface border-border/50 rounded-2xl shadow-sm",
        "hover:shadow-md hover:border-border",
        "overflow-hidden",
        isArchived && "opacity-60"
      )}
    >
      {/* Accent spine */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl",
          spineColor,
          entry.status === "pending" && "border-l-2"
        )}
      />

      <CardContent className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Status */}
            <div className="flex items-center gap-2">
              <Badge
                data-testid="journal-status-badge"
                variant="secondary"
                className="text-xs shrink-0"
              >
                {entry.status}
              </Badge>
            </div>

            {/* Preview text */}
            <p className={cn(
              "text-sm line-clamp-2",
              isArchived ? "text-muted-foreground" : "text-foreground"
            )}>
              {entry.summary}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{timeFormatted}</span>
              </div>
              <span className="text-muted-foreground/60">•</span>
              <span>{sessionLabel}</span>
            </div>
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {hasAttachments && (
              <Paperclip className="h-4 w-4 text-muted-foreground" />
            )}
            {hasChartLink && (
              <LineChart className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

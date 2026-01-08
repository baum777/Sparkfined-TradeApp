import { useState, forwardRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, MoreHorizontal, Check, Archive, Trash2, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { JournalEntryLocal } from "@/services/journal/types";
import { cn } from "@/lib/utils";

interface JournalEntryRowProps {
  entry: JournalEntryLocal;
  isHighlighted?: boolean;
  onConfirm?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onRowClick?: (id: string) => void;
}

function getStatusText(entry: JournalEntryLocal): string {
  // UI-only derived status text
  if (entry.status === "pending") {
    const hour = new Date(entry.timestamp).getHours();
    if (hour < 12) return "ready";
    if (hour < 18) return "active";
    return "expiring";
  }
  return entry.status;
}

export const JournalEntryRow = forwardRef<HTMLDivElement, JournalEntryRowProps>(
  ({ entry, isHighlighted, onConfirm, onArchive, onDelete, onRestore, onRowClick }, ref) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const timeAgo = formatDistanceToNow(new Date(entry.timestamp), {
      addSuffix: true,
    });

    const statusText = getStatusText(entry);

    const handleRowClick = () => {
      onRowClick?.(entry.id);
    };

    return (
      <Card
        ref={ref}
        className={cn(
          "bg-card/50 border-border/50 transition-all duration-300",
          isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5"
        )}
      >
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-sm"
                onClick={handleRowClick}
                aria-label={`Select entry: ${entry.summary.slice(0, 50)}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="secondary"
                    className="text-xs"
                  >
                    {entry.status}
                  </Badge>
                  {entry.status === "pending" && (
                    <Badge variant="outline" className="text-xs">
                      {statusText}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-foreground line-clamp-2">
                  {entry.summary}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {timeAgo}
                </p>
              </button>

              <div className="flex items-center gap-1">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse details" : "Expand details"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Entry actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    {entry.status === "pending" && onConfirm && (
                      <DropdownMenuItem onClick={onConfirm}>
                        <Check className="h-4 w-4 mr-2" />
                        Confirm
                      </DropdownMenuItem>
                    )}
                    {(entry.status === "pending" || entry.status === "confirmed") && onArchive && (
                      <DropdownMenuItem onClick={onArchive}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    )}
                    {entry.status === "archived" && onRestore && (
                      <DropdownMenuItem onClick={onRestore}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        onClick={onDelete}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <CollapsibleContent>
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Entry ID: {entry.id}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Additional details and enrichment data would appear here.
                </p>
                {entry.status === "archived" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Archived reason: (local-only)
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
      </Card>
    );
  }
);

JournalEntryRow.displayName = "JournalEntryRow";

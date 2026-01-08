import { useMemo, useState, useCallback, useEffect } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { JournalMomentCard } from "./JournalMomentCard";
import { JournalTradeCard } from "./JournalTradeCard";
import { JournalInsightTimelineCard } from "./JournalInsightTimelineCard";
import type { JournalEntryLocal } from "@/services/journal/types";
import { cn } from "@/lib/utils";

interface JournalTimelineViewProps {
  entries: JournalEntryLocal[];
  onCardClick: (entry: JournalEntryLocal, index: number) => void;
  onEdit?: (entry: JournalEntryLocal) => void;
  onArchive?: (id: string) => void;
  onAddReflection?: (entry: JournalEntryLocal) => void;
}

interface DayGroup {
  date: Date;
  dateKey: string;
  entries: JournalEntryLocal[];
}

function formatDayHeader(date: Date): { dateStr: string; weekday: string } {
  if (isToday(date)) {
    return { dateStr: "Today", weekday: format(date, "EEEE").toUpperCase() };
  }
  if (isYesterday(date)) {
    return { dateStr: "Yesterday", weekday: format(date, "EEEE").toUpperCase() };
  }
  return {
    dateStr: format(date, "MMM d, yyyy"),
    weekday: format(date, "EEEE").toUpperCase(),
  };
}

export function JournalTimelineView({
  entries,
  onCardClick,
  onEdit,
  onArchive,
  onAddReflection,
}: JournalTimelineViewProps) {
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  // Group entries by day
  const dayGroups = useMemo(() => {
    const groups: Map<string, DayGroup> = new Map();

    entries.forEach((entry) => {
      const date = new Date(entry.timestamp);
      const dateKey = format(date, "yyyy-MM-dd");

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          date,
          dateKey,
          entries: [],
        });
      }
      groups.get(dateKey)!.entries.push(entry);
    });

    // Sort groups by date descending
    const sortedGroups = Array.from(groups.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );

    // Sort entries within each group by time descending
    sortedGroups.forEach((group) => {
      group.entries.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    });

    return sortedGroups;
  }, [entries]);

  // Today is expanded by default, collapse others on first render
  useEffect(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const otherDays = dayGroups
      .filter((g) => g.dateKey !== todayKey)
      .map((g) => g.dateKey);
    // Don't auto-collapse - keep all expanded for now
  }, []);

  const toggleDay = (dateKey: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  // Calculate global index
  const getGlobalIndex = (dayGroupIndex: number, entryIndexInDay: number): number => {
    let index = 0;
    for (let i = 0; i < dayGroupIndex; i++) {
      index += dayGroups[i].entries.length;
    }
    return index + entryIndexInDay;
  };

  if (dayGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Sample insight card at top */}
      <JournalInsightTimelineCard
        headline="Your entry timing improved this week"
        bullets={[
          "3 trades with better confirmation",
          "Win rate up 12% on breakout setups",
        ]}
        onShowEvidence={() => {}}
        onTrack={() => {}}
        onDismiss={() => {}}
      />

      {dayGroups.map((group, groupIndex) => {
        const { dateStr, weekday } = formatDayHeader(group.date);
        const confirmedCount = group.entries.filter(
          (e) => e.status === "confirmed"
        ).length;
        const pendingCount = group.entries.filter(
          (e) => e.status === "pending"
        ).length;
        const isCollapsed = collapsedDays.has(group.dateKey);

        return (
          <div
            key={group.dateKey}
            data-testid={`journal-day-group-${group.dateKey}`}
            className="space-y-3 animate-fade-in"
            style={{ animationDelay: `${groupIndex * 50}ms`, animationFillMode: "backwards" }}
          >
            {/* Day header */}
            <button
              data-testid="journal-day-toggle"
              onClick={() => toggleDay(group.dateKey)}
              className="w-full flex items-center justify-between py-2 border-b border-border/50 hover:border-border transition-colors"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-foreground">
                  {dateStr}
                </span>
                <span className="text-xs font-medium text-muted-foreground tracking-wide">
                  {weekday}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Mini KPIs */}
                <div className="flex items-center gap-2">
                  {confirmedCount > 0 && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Check className="h-3 w-3" />
                      {confirmedCount}
                    </Badge>
                  )}
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="text-xs gap-1 text-amber-500">
                      <Clock className="h-3 w-3" />
                      {pendingCount}
                    </Badge>
                  )}
                </div>
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Entries */}
            {!isCollapsed && (
              <div className="space-y-3">
                {group.entries.map((entry, entryIndex) => {
                  const isConfirmed = entry.status === "confirmed";
                  
                  if (isConfirmed) {
                    return (
                      <JournalTradeCard
                        key={entry.id}
                        entry={entry}
                        onEdit={onEdit ? () => onEdit(entry) : undefined}
                        onArchive={onArchive ? () => onArchive(entry.id) : undefined}
                        onAddReflection={onAddReflection ? () => onAddReflection(entry) : undefined}
                      />
                    );
                  }

                  return (
                    <JournalMomentCard
                      key={entry.id}
                      entry={entry}
                      onClick={() => onCardClick(entry, getGlobalIndex(groupIndex, entryIndex))}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

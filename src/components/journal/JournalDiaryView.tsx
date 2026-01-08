import { useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { JournalMomentCard } from "./JournalMomentCard";
import type { JournalEntryLocal } from "@/services/journal/types";
import type { JournalView } from "./JournalSegmentedControl";
import { Badge } from "@/components/ui/badge";
import { Clock, Check } from "lucide-react";

interface JournalDiaryViewProps {
  entries: JournalEntryLocal[];
  activeSegment: JournalView;
  onCardClick: (entry: JournalEntryLocal, index: number) => void;
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

export function JournalDiaryView({
  entries,
  activeSegment,
  onCardClick,
}: JournalDiaryViewProps) {
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

    // Sort groups by date descending (latest first)
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

  // Calculate global index for each entry
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
      {dayGroups.map((group, groupIndex) => {
        const { dateStr, weekday } = formatDayHeader(group.date);
        const tradesCount = group.entries.filter(
          (e) => e.status === "confirmed"
        ).length;
        const pendingCount = group.entries.filter(
          (e) => e.status === "pending"
        ).length;

        return (
          <div
            key={group.dateKey}
            data-testid="journal-day-group"
            className="space-y-3 animate-fade-in"
            style={{ animationDelay: `${groupIndex * 50}ms`, animationFillMode: "backwards" }}
          >
            {/* Day header */}
            <div
              data-testid="journal-day-header"
              className="flex items-center justify-between py-2 border-b border-border/50"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-foreground">
                  {dateStr}
                </span>
                <span className="text-xs font-medium text-muted-foreground tracking-wide">
                  {weekday}
                </span>
              </div>

              {/* Mini KPIs */}
              <div className="flex items-center gap-2">
                {tradesCount > 0 && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Check className="h-3 w-3" />
                    {tradesCount}
                  </Badge>
                )}
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="text-xs gap-1 text-amber-500">
                    <Clock className="h-3 w-3" />
                    {pendingCount}
                  </Badge>
                )}
              </div>
            </div>

            {/* Moment cards for this day */}
            <div className="space-y-2">
              {group.entries.map((entry, entryIndex) => (
                <JournalMomentCard
                  key={entry.id}
                  entry={entry}
                  onClick={() => onCardClick(entry, getGlobalIndex(groupIndex, entryIndex))}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type OracleFilter = "all" | "unread" | "read";

interface OracleFiltersProps {
  filter: OracleFilter;
  onFilterChange: (filter: OracleFilter) => void;
  counts: {
    all: number;
    unread: number;
    read: number;
  };
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function OracleFilters({
  filter,
  onFilterChange,
  counts,
  searchQuery,
  onSearchChange,
}: OracleFiltersProps) {
  const filters: { value: OracleFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "unread", label: "Unread", count: counts.unread },
    { value: "read", label: "Read", count: counts.read },
  ];

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {filters.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "secondary"}
              size="sm"
              onClick={() => onFilterChange(f.value)}
              className={cn(
                "rounded-full gap-1.5",
                filter === f.value && "shadow-sm"
              )}
              aria-pressed={filter === f.value}
            >
              {f.label}
              <span
                className={cn(
                  "text-xs",
                  filter === f.value
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                )}
              >
                ({f.count})
              </span>
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search insights..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

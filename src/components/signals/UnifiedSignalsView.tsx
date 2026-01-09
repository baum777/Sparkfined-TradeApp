import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { FeedCardItem } from "@/components/feed/FeedCardItem";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScreenState } from "@/components/layout/ScreenState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RefreshCw, AlertCircle } from "lucide-react";
import { fetchUnifiedSignals, getCachedUnifiedSignals } from "@/lib/api/feed";
import type { FeedFilter, FeedSort } from "@/types/feed";

export function UnifiedSignalsView({ assetId }: { assetId: string }) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [sort, setSort] = useState<FeedSort>("impact");

  // Get initial cached data
  const [initialData] = useState(() => getCachedUnifiedSignals(assetId, filter, sort));

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["signals", "unified", assetId, filter, sort],
    queryFn: () => fetchUnifiedSignals(assetId, filter, sort),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    initialData: initialData ?? undefined,
  });

  const handleFilterChange = useCallback((value: string) => {
    if (value) setFilter(value as FeedFilter);
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSort(value as FeedSort);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Determine which sections to show based on filter
  const showUserSection = filter === "all" || filter === "user";
  const showMarketSection = filter === "all" || filter === "market";

  const items = data?.items ?? [];
  const userSignals = useMemo(() => items.filter((c) => c.scope === "user"), [items]);
  const marketSignals = useMemo(() => items.filter((c) => c.scope === "market"), [items]);

  // Loading skeleton
  if (isLoading && !data) {
    return (
      <div data-testid="unified-signals-view" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Error without usable data → standard error state with retry (no silent empty).
  if (isError && !data) {
    return (
      <ScreenState
        status="error"
        onRetry={handleRefresh}
        errorTitle="Failed to load signals"
        errorMessage="Please try again."
      />
    );
  }

  return (
    <div data-testid="unified-signals-view" className="space-y-4">
      {/* Filter & Sort controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={handleFilterChange}
            data-testid="signals-filter"
            className="bg-muted/50 rounded-md p-0.5"
          >
            <ToggleGroupItem
              value="all"
              className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              All
            </ToggleGroupItem>
            <ToggleGroupItem
              value="user"
              className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              User
            </ToggleGroupItem>
            <ToggleGroupItem
              value="market"
              className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              Market
            </ToggleGroupItem>
          </ToggleGroup>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleRefresh}
            disabled={isFetching}
            aria-label="Refresh signals"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Select value={sort} onValueChange={handleSortChange}>
          <SelectTrigger data-testid="signals-sort" className="w-36 h-9 text-xs">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="impact" className="text-xs">Impact</SelectItem>
            <SelectItem value="freshness" className="text-xs">Freshness</SelectItem>
            <SelectItem value="confidence" className="text-xs">Confidence</SelectItem>
            <SelectItem value="newest" className="text-xs">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Refresh error banner (cached/previous data still visible) */}
      {isError && data && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Failed to refresh. Showing cached data.
          </AlertDescription>
        </Alert>
      )}

      {/* User Signals Section */}
      {showUserSection && (
        <section data-testid="signals-section-user" className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Your Signals</h3>
          {userSignals.length > 0 ? (
            <div className="space-y-3">
              {userSignals.map((card) => (
                <FeedCardItem key={card.id} card={card} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
              No user signals.
            </div>
          )}
        </section>
      )}

      {/* Market Signals Section */}
      {showMarketSection && (
        <section data-testid="signals-section-market" className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Market Signals</h3>
          {marketSignals.length > 0 ? (
            <div className="space-y-3">
              {marketSignals.map((card) => (
                <FeedCardItem key={card.id} card={card} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
              No market signals.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

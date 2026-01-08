import { useState, useMemo, useEffect, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  OracleHeader,
  OracleFilters,
  TodayTakeawayCard,
  StreakBanner,
  InsightCard,
  OracleEmptyState,
  OracleSkeleton,
  type OracleFilter,
} from "@/components/oracle";
import { UnifiedSignalsView } from "@/components/signals";
import { TradingWalletHint } from "@/components/common";
import { toast } from "@/hooks/use-toast";
import { usePageState } from "@/stubs/pageState";
import { makeOracle } from "@/stubs/fixtures";
import type { OracleInsight } from "@/services/oracle/types";
import { fetchOracleDaily, putOracleReadState, bulkOracleReadState } from "@/services/oracle/api";
import type { StorageLike } from "@/services/oracle/readStateQueue";
import {
  enqueueOracleMarkRead,
  getOverlayReadIds,
  loadOracleReadStateQueue,
  mergeOracleFeedWithOverlay,
  syncOracleReadStateQueue,
} from "@/services/oracle/readStateQueue";
import { loadOracleReadCache, updateOracleReadCache } from "@/services/oracle/readStateCache";

const TAKEAWAY_ID = "today-takeaway";

function getStorage(): StorageLike {
  return localStorage as unknown as StorageLike;
}

export default function Oracle() {
  const pageState = usePageState("ready");
  const storage = getStorage();

  // Insights with read state from localStorage
  const [insights, setInsights] = useState<OracleInsight[]>(() => {
    const baseInsights = makeOracle(10) as unknown as OracleInsight[];
    const cache = loadOracleReadCache(storage);
    const overlay = getOverlayReadIds(loadOracleReadStateQueue(storage));
    return baseInsights.map((insight) => ({
      ...insight,
      isRead: (cache[insight.id] ?? insight.isRead) || overlay.has(insight.id),
    }));
  });

  // Takeaway read state
  const [takeawayRead, setTakeawayRead] = useState(() => {
    const cache = loadOracleReadCache(storage);
    const overlay = getOverlayReadIds(loadOracleReadStateQueue(storage));
    return (cache[TAKEAWAY_ID] ?? false) || overlay.has(TAKEAWAY_ID);
  });

  // Filter + search state
  const [filter, setFilter] = useState<OracleFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Streak (stub)
  const showStreak = true;
  const streakDays = 5;

  // Derived counts (before search filter for chip counts)
  const counts = useMemo(
    () => ({
      all: insights.length,
      unread: insights.filter((i) => !i.isRead).length + (takeawayRead ? 0 : 1),
      read: insights.filter((i) => i.isRead).length + (takeawayRead ? 1 : 0),
    }),
    [insights, takeawayRead]
  );

  // Filtered + searched insights
  const filteredInsights = useMemo(() => {
    let result = insights;

    // Apply filter
    switch (filter) {
      case "unread":
        result = result.filter((i) => !i.isRead);
        break;
      case "read":
        result = result.filter((i) => i.isRead);
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          i.summary.toLowerCase().includes(query)
      );
    }

    return result;
  }, [insights, filter, searchQuery]);

  const refreshFromServer = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const feed = await fetchOracleDaily();
      // Update local cache from canonical backend state.
      updateOracleReadCache(storage, {
        [feed.pinned.id]: feed.pinned.isRead,
        ...Object.fromEntries(feed.insights.map((i) => [i.id, i.isRead])),
      });

      // Apply pending overlay for offline mutations.
      const overlay = getOverlayReadIds(loadOracleReadStateQueue(storage));
      const merged = mergeOracleFeedWithOverlay(feed, overlay);
      setInsights(merged.insights);
      setTakeawayRead(merged.pinned.isRead);
    } catch {
      // Stay on local/stub state when offline or unauthenticated.
    } finally {
      setIsRefreshing(false);
    }
  }, [storage]);

  const syncPending = useCallback(async () => {
    await syncOracleReadStateQueue({
      storage,
      isOnline: navigator.onLine,
      bulkApi: bulkOracleReadState,
    });
  }, [storage]);

  useEffect(() => {
    // On app start: sync pending mutations, then refresh.
    syncPending().finally(() => {
      if (navigator.onLine) refreshFromServer();
    });

    const onOnline = () => {
      syncPending().finally(() => refreshFromServer());
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refreshFromServer, syncPending]);

  const handleToggleRead = useCallback((id: string) => {
    setInsights((prev) => {
      const next = prev.map((insight) =>
        insight.id === id ? { ...insight, isRead: !insight.isRead } : insight
      );

      const updated = next.find((i) => i.id === id);
      if (!updated) return next;

      const desiredIsRead = updated.isRead;

      // Offline: queue only "mark read" (monotonic catch-up).
      if (!navigator.onLine) {
        if (desiredIsRead) enqueueOracleMarkRead(storage, id);
        return next;
      }

      // Online: write-through to backend.
      putOracleReadState({ id, isRead: desiredIsRead })
        .then(() => {
          // Cache confirmed backend state for offline fallback.
          updateOracleReadCache(storage, { [id]: desiredIsRead });
        })
        .catch(() => {
          // Retryable/permanent classification is handled at bulk-sync time.
          if (desiredIsRead) enqueueOracleMarkRead(storage, id);
        });

      return next;
    });
  }, [storage]);

  const handleMarkTakeawayRead = useCallback(() => {
    setTakeawayRead(true);
    if (!navigator.onLine) {
      enqueueOracleMarkRead(storage, TAKEAWAY_ID);
    } else {
      putOracleReadState({ id: TAKEAWAY_ID, isRead: true })
        .then(() => updateOracleReadCache(storage, { [TAKEAWAY_ID]: true }))
        .catch(() => enqueueOracleMarkRead(storage, TAKEAWAY_ID));
    }
    toast({
      title: "Marked as read",
      description: "Today's takeaway marked as read.",
    });
  }, [storage]);

  const handleMarkAllRead = useCallback(() => {
    setInsights((prev) => prev.map((i) => ({ ...i, isRead: true })));
    setTakeawayRead(true);

    const ids = [TAKEAWAY_ID, ...insights.map((i) => i.id)];
    if (!navigator.onLine) {
      ids.forEach((id) => enqueueOracleMarkRead(storage, id));
    } else {
      bulkOracleReadState({ ids, isRead: true })
        .then(() => {
          updateOracleReadCache(storage, Object.fromEntries(ids.map((id) => [id, true])));
        })
        .catch(() => {
          // On failure, queue reads for bulk catch-up later.
          ids.forEach((id) => enqueueOracleMarkRead(storage, id));
        });
    }

    toast({
      title: "All marked as read",
      description: "All insights have been marked as read.",
    });
  }, [insights, storage]);

  const handleRefresh = useCallback(() => {
    refreshFromServer().finally(() => {
      toast({
        title: "Refreshed",
        description: "Insights are up to date.",
      });
    });
  }, [refreshFromServer]);

  const handleShowAll = useCallback(() => {
    setFilter("all");
    setSearchQuery("");
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const handleRetry = useCallback(() => {
    pageState.setState("loading");
    setTimeout(() => pageState.setState("ready"), 1000);
  }, [pageState]);

  // Loading state
  if (pageState.isLoading) {
    return (
      <PageContainer testId="page-oracle">
        <OracleSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (pageState.isError) {
    return (
      <PageContainer testId="page-oracle">
        <div className="space-y-6">
          <OracleHeader
            unreadCount={0}
            onMarkAllRead={handleMarkAllRead}
            onRefresh={handleRefresh}
          />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load insights. Please try again.</span>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    );
  }

  // Global empty state (no insights at all)
  if (pageState.isEmpty || insights.length === 0) {
    return (
      <PageContainer testId="page-oracle">
        <div className="space-y-6">
          <OracleHeader
            unreadCount={0}
            onMarkAllRead={handleMarkAllRead}
            onRefresh={handleRefresh}
          />
          <OracleEmptyState type="no-insights" onAction={handleRefresh} />
        </div>
      </PageContainer>
    );
  }

  // Determine empty state type
  const isSearchEmpty = searchQuery.trim() && filteredInsights.length === 0;
  const isFilterEmpty = !searchQuery.trim() && filteredInsights.length === 0;

  // Should show takeaway based on filter
  const showTakeaway =
    filter === "all" ||
    (filter === "unread" && !takeawayRead) ||
    (filter === "read" && takeawayRead);

  return (
    <PageContainer testId="page-oracle">
      <div className="space-y-6">
        <OracleHeader
          unreadCount={counts.unread}
          onMarkAllRead={handleMarkAllRead}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Trading Wallet Context */}
        <TradingWalletHint className="mb-2" />

        <OracleFilters
          filter={filter}
          onFilterChange={setFilter}
          counts={counts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Unified Signals View */}
        <section aria-label="Unified signals">
          <UnifiedSignalsView />
        </section>

        {/* Pinned cards */}
        <div className="space-y-3">
          {showTakeaway && (
            <TodayTakeawayCard
              isRead={takeawayRead}
              onMarkRead={handleMarkTakeawayRead}
            />
          )}
          <StreakBanner show={showStreak} streak={streakDays} />
        </div>

        {/* Insights feed */}
        {isSearchEmpty ? (
          <OracleEmptyState
            type="search-empty"
            searchQuery={searchQuery}
            onAction={handleClearSearch}
          />
        ) : isFilterEmpty ? (
          <OracleEmptyState type="filter-empty" onAction={handleShowAll} />
        ) : (
          <div className="space-y-4">
            {filteredInsights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onToggleRead={handleToggleRead}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

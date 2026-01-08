/**
 * Insights Page
 * Consolidates: /oracle, /oracle/inbox, /oracle/status, /oracle/:insightId
 * 
 * URL state:
 * - ?filter=unread|read - Filter insights
 * - ?mode=status - Show provider status
 * - /insights/:insightId - Insight detail
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ScreenState } from "@/components/layout/ScreenState";
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

export default function Insights() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { insightId } = useParams<{ insightId?: string }>();
  const pageState = usePageState("ready");
  const storage = getStorage();

  // URL state
  const urlFilter = searchParams.get("filter") as OracleFilter | null;
  const urlMode = searchParams.get("mode");
  const isStatusMode = urlMode === "status";

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
  const [filter, setFilter] = useState<OracleFilter>(urlFilter || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Streak (stub)
  const showStreak = true;
  const streakDays = 5;

  // Sync filter to URL
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (filter !== "all") {
      newParams.set("filter", filter);
    } else {
      newParams.delete("filter");
    }
    setSearchParams(newParams, { replace: true });
  }, [filter, searchParams, setSearchParams]);

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
      updateOracleReadCache(storage, {
        [feed.pinned.id]: feed.pinned.isRead,
        ...Object.fromEntries(feed.insights.map((i) => [i.id, i.isRead])),
      });
      const overlay = getOverlayReadIds(loadOracleReadStateQueue(storage));
      const merged = mergeOracleFeedWithOverlay(feed, overlay);
      setInsights(merged.insights);
      setTakeawayRead(merged.pinned.isRead);
    } catch {
      // Keep local/stub state when offline or unauthenticated.
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

      if (!navigator.onLine) {
        if (desiredIsRead) enqueueOracleMarkRead(storage, id);
        return next;
      }

      putOracleReadState({ id, isRead: desiredIsRead })
        .then(() => updateOracleReadCache(storage, { [id]: desiredIsRead }))
        .catch(() => {
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
        .then(() => updateOracleReadCache(storage, Object.fromEntries(ids.map((id) => [id, true]))))
        .catch(() => ids.forEach((id) => enqueueOracleMarkRead(storage, id)));
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

  const handleToggleStatusMode = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    if (isStatusMode) {
      newParams.delete("mode");
    } else {
      newParams.set("mode", "status");
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams, isStatusMode]);

  // Detail view for /insights/:insightId
  if (insightId) {
    const insight = insights.find((i) => i.id === insightId);

    if (!insight) {
      return (
        <PageContainer testId="page-insights-detail">
          <div className="space-y-4">
            <Button variant="ghost" onClick={() => navigate("/insights")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Insights
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Insight Not Found
            </h1>
            <p className="text-sm text-muted-foreground">
              Insight "{insightId}" could not be found.
            </p>
          </div>
        </PageContainer>
      );
    }

    return (
      <PageContainer testId="page-insights-detail">
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => navigate("/insights")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Insights
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-sm">{insight.id}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Theme: </span>
                <span className="font-medium">{insight.theme}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Title: </span>
                <span className="font-medium">{insight.title}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Summary: </span>
                <span className="font-medium">{insight.summary}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Created: </span>
                <span className="font-medium">{insight.createdAt}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Placeholder for Explainability (Inputs, Weights, Sources, Confidence, Cache Age).
              </p>
              {/* BACKEND HOOK (unchanged): fetch full insight details */}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  // Loading state
  if (pageState.isLoading) {
    return (
      <PageContainer testId="page-insights">
        <ScreenState status="loading" loadingVariant={<OracleSkeleton />} />
      </PageContainer>
    );
  }

  // Error state
  if (pageState.isError) {
    return (
      <PageContainer testId="page-insights">
        <ScreenState
          status="error"
          onRetry={handleRetry}
          errorTitle="Failed to load Insights"
          errorMessage="Please try again."
        />
      </PageContainer>
    );
  }

  // Global empty state (no insights at all)
  if (pageState.isEmpty || insights.length === 0) {
    return (
      <PageContainer testId="page-insights">
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

  // Status mode view
  if (isStatusMode) {
    return (
      <PageContainer testId="page-insights">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={handleToggleStatusMode}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Provider Status
            </h1>
          </div>

          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Placeholder for provider status details and diagnostics.
              </p>
              {/* BACKEND HOOK (unchanged): fetch provider status */}
            </CardContent>
          </Card>
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
    <PageContainer testId="page-insights">
      <div className="space-y-6">
        <OracleHeader
          unreadCount={counts.unread}
          onMarkAllRead={handleMarkAllRead}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <div className="flex items-center gap-2">
          <OracleFilters
            filter={filter}
            onFilterChange={setFilter}
            counts={counts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          <Button variant="outline" size="sm" onClick={handleToggleStatusMode}>
            Status
          </Button>
        </div>

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

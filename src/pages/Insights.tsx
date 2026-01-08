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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
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
import { GrokPulseLastRunWidget } from "@/components/grokPulse";
import { UnifiedSignalsView } from "@/components/signals";
import { toast } from "@/hooks/use-toast";
import { usePageState } from "@/stubs/pageState";
import { makeOracle } from "@/stubs/fixtures";
import type { OracleStub } from "@/stubs/contracts";

const READ_STATE_KEY = "sparkfined_oracle_read_v1";
const TAKEAWAY_ID = "today-takeaway";

// Load read states from localStorage
function loadReadStates(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(READ_STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

// Save read states to localStorage
function saveReadStates(states: Record<string, boolean>) {
  try {
    localStorage.setItem(READ_STATE_KEY, JSON.stringify(states));
  } catch {
    // Ignore storage errors
  }
  // BACKEND HOOK (unchanged): persist read state per user
}

export default function Insights() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { insightId } = useParams<{ insightId?: string }>();
  const pageState = usePageState("ready");

  // URL state
  const urlFilter = searchParams.get("filter") as OracleFilter | null;
  const urlMode = searchParams.get("mode");
  const isStatusMode = urlMode === "status";

  // Insights with read state from localStorage
  // BACKEND HOOK (unchanged)
  const [insights, setInsights] = useState<OracleStub[]>(() => {
    const baseInsights = makeOracle(10);
    const readStates = loadReadStates();
    return baseInsights.map((insight) => ({
      ...insight,
      isRead: readStates[insight.id] ?? insight.isRead,
    }));
  });

  // Takeaway read state
  const [takeawayRead, setTakeawayRead] = useState(() => {
    const readStates = loadReadStates();
    return readStates[TAKEAWAY_ID] ?? false;
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

  // Save read states when they change
  useEffect(() => {
    const readStates: Record<string, boolean> = {
      [TAKEAWAY_ID]: takeawayRead,
    };
    insights.forEach((i) => {
      readStates[i.id] = i.isRead;
    });
    saveReadStates(readStates);
  }, [insights, takeawayRead]);

  const handleToggleRead = useCallback((id: string) => {
    setInsights((prev) =>
      prev.map((insight) =>
        insight.id === id ? { ...insight, isRead: !insight.isRead } : insight
      )
    );
  }, []);

  const handleMarkTakeawayRead = useCallback(() => {
    setTakeawayRead(true);
    toast({
      title: "Marked as read",
      description: "Today's takeaway marked as read.",
    });
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setInsights((prev) => prev.map((i) => ({ ...i, isRead: true })));
    setTakeawayRead(true);
    toast({
      title: "All marked as read",
      description: "All insights have been marked as read.",
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        title: "Refreshed",
        description: "Insights are up to date.",
      });
    }, 800);
    // BACKEND HOOK (unchanged): fetch fresh insights from API
  }, []);

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
        <OracleSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (pageState.isError) {
    return (
      <PageContainer testId="page-insights">
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GrokPulseLastRunWidget />
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

        {/* Grok Pulse Status Widget */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <GrokPulseLastRunWidget />
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

import { useMemo } from 'react';
import { PageContainer } from "@/components/layout/PageContainer";
import { ScreenState } from "@/components/layout/ScreenState";
import { useDashboardStub, useOracleStub, useAlertsStub } from "@/stubs/hooks";
import { useJournalApi } from "@/services/journal";
import {
  DashboardHeader,
  DashboardSkeleton,
  DashboardFab,
  ActionStrip,
  StatusProgress,
  WorkQueue,
  Snapshots,
} from "@/components/dashboard";
import type { WorkQueueItem, SnapshotData } from "@/components/dashboard";

export default function Dashboard() {
  // BACKEND HOOK (unchanged)
  const { pageState, hasData } = useDashboardStub();
  
  // Real journal data via API
  const { entries: journalEntries } = useJournalApi();
  
  // BACKEND HOOK (unchanged) - Insights data
  const { insights } = useOracleStub();
  
  // BACKEND HOOK (unchanged) - Alerts data
  const { alerts } = useAlertsStub();

  // Compute counts for Action Strip and Status Progress
  const counts = useMemo(() => {
    const pendingJournal = journalEntries.filter(e => e.status === 'pending').length;
    const confirmedJournal = journalEntries.filter(e => e.status === 'confirmed').length;
    const unreadInsights = insights.filter(i => !i.isRead).length;
    const activeAlerts = alerts.filter(a => a.status === 'active').length;
    const triggeredAlerts = alerts.filter(a => a.status === 'triggered').length;
    
    // Entries today: simplified - in real app would check timestamps
    const today = new Date().toISOString().split('T')[0];
    const entriesToday = journalEntries.filter(e => 
      e.timestamp.startsWith(today)
    ).length;

    return {
      pendingJournal,
      confirmedJournal,
      unreadInsights,
      activeAlerts,
      triggeredAlerts,
      entriesToday,
      totalInsights: insights.length,
    };
  }, [journalEntries, insights, alerts]);

  // Build work queue items
  const workQueueData = useMemo(() => {
    // Journal items with priority
    const journalItems: WorkQueueItem[] = journalEntries
      .filter(e => e.status !== 'archived')
      .map(e => ({
        id: e.id,
        type: 'journal' as const,
        title: e.summary,
        timestamp: e.timestamp,
        status: e.status === 'pending' ? 'pending' as const : 'confirmed' as const,
        route: `/journal/${e.id}`,
      }))
      .sort((a, b) => {
        // Pending first, then by timestamp
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

    // Insight items with priority
    const insightItems: WorkQueueItem[] = insights
      .map(i => ({
        id: i.id,
        type: 'insight' as const,
        title: i.title,
        timestamp: i.createdAt,
        status: i.isRead ? 'read' as const : 'unread' as const,
        route: `/insights/${i.id}`,
      }))
      .sort((a, b) => {
        // Unread first, then by timestamp
        if (a.status === 'unread' && b.status !== 'unread') return -1;
        if (b.status === 'unread' && a.status !== 'unread') return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

    // Alert items with priority
    const alertItems: WorkQueueItem[] = alerts
      .map(a => ({
        id: a.id,
        type: 'alert' as const,
        title: `${a.symbol} ${a.condition} $${a.targetPrice.toLocaleString()}`,
        timestamp: a.createdAt,
        status: a.status === 'triggered' ? 'triggered' as const : 'active' as const,
        route: '/alerts',
      }))
      .sort((a, b) => {
        // Triggered first, then by timestamp
        if (a.status === 'triggered' && b.status !== 'triggered') return -1;
        if (b.status === 'triggered' && a.status !== 'triggered') return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

    return { journalItems, insightItems, alertItems };
  }, [journalEntries, insights, alerts]);

  // Snapshot data
  const snapshotData: SnapshotData = useMemo(() => ({
    journal: {
      pending: counts.pendingJournal,
      confirmed: counts.confirmedJournal,
    },
    insights: {
      unread: counts.unreadInsights,
      total: counts.totalInsights,
    },
    alerts: {
      active: counts.activeAlerts,
      triggered: counts.triggeredAlerts,
    },
  }), [counts]);

  // Check if truly empty (no data from any source)
  const isEmptyState = !hasData && 
    journalEntries.length === 0 && 
    insights.length === 0 && 
    alerts.length === 0;

  // Loading state
  if (pageState.isLoading) {
    return (
      <PageContainer testId="page-dashboard">
        <ScreenState status="loading" loadingVariant={<DashboardSkeleton />} />
      </PageContainer>
    );
  }

  // Error state
  if (pageState.isError) {
    return (
      <PageContainer testId="page-dashboard">
        <div className="space-y-4 sm:space-y-6">
          <DashboardHeader 
            entriesToday={0} 
            activeAlerts={0} 
            streak="--" 
          />
          <div data-testid="dashboard-error-banner">
            <ScreenState
              status="error"
              onRetry={pageState.retry}
              errorTitle="Failed to load Dashboard"
              errorMessage="Please check your connection and try again."
            />
          </div>
          {/* Show cached data if available */}
          {(journalEntries.length > 0 || insights.length > 0 || alerts.length > 0) && (
            <>
              <ActionStrip 
                pendingCount={counts.pendingJournal}
                unreadInsightsCount={counts.unreadInsights}
              />
              <StatusProgress
                entriesToday={counts.entriesToday}
                pendingReviews={counts.pendingJournal}
                unreadInsights={counts.unreadInsights}
                activeAlerts={counts.activeAlerts}
              />
              <WorkQueue {...workQueueData} />
              <Snapshots data={snapshotData} />
            </>
          )}
        </div>
        <DashboardFab />
      </PageContainer>
    );
  }

  // Empty state
  if (pageState.isEmpty || isEmptyState) {
    return (
      <PageContainer testId="page-dashboard">
        <div data-testid="dashboard-empty" className="space-y-4 sm:space-y-6">
          <DashboardHeader 
            entriesToday={0} 
            activeAlerts={0} 
            streak="--" 
          />
          {/* Action strip visible with no badges */}
          <ActionStrip pendingCount={0} unreadInsightsCount={0} />
          {/* KPIs are 0 */}
          <StatusProgress
            entriesToday={0}
            pendingReviews={0}
            unreadInsights={0}
            activeAlerts={0}
          />
          {/* Work queue shows empty state */}
          <WorkQueue 
            journalItems={[]} 
            insightItems={[]} 
            alertItems={[]} 
          />
          {/* Snapshots visible with 0 counts */}
          <Snapshots data={{
            journal: { pending: 0, confirmed: 0 },
            insights: { unread: 0, total: 0 },
            alerts: { active: 0, triggered: 0 },
          }} />
        </div>
        <DashboardFab />
      </PageContainer>
    );
  }

  // Ready state with data
  return (
    <PageContainer testId="page-dashboard">
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header Row */}
        <DashboardHeader 
          entriesToday={counts.entriesToday} 
          activeAlerts={counts.activeAlerts} 
          streak="5W" 
        />

        {/* Action Strip (3 CTAs) */}
        <ActionStrip 
          pendingCount={counts.pendingJournal}
          unreadInsightsCount={counts.unreadInsights}
        />

        {/* Status & Progress (4 KPI tiles + optional streak) */}
        <StatusProgress
          entriesToday={counts.entriesToday}
          pendingReviews={counts.pendingJournal}
          unreadInsights={counts.unreadInsights}
          activeAlerts={counts.activeAlerts}
          streak="5W"
        />

        {/* Work Queue (max 6 items) */}
        <WorkQueue {...workQueueData} />

        {/* Snapshots (3 mini cards) */}
        <Snapshots data={snapshotData} />
      </div>

      {/* FAB - unchanged behavior */}
      <DashboardFab />
    </PageContainer>
  );
}

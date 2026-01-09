// Re-export all stub modules for convenient imports

// Types
export type {
  UserStub,
  AlertStub,
  JournalEntryStub,
  LessonStub,
  WatchItemStub,
  OracleStub,
  DashboardMetricStub,
  RecentActivityStub,
} from './contracts';

// Page state
export { usePageState, type PageState, type UsePageStateReturn } from './pageState';

// Fixtures
export {
  makeAlerts,
  makeJournalEntries,
  makeLessons,
  makeWatchlist,
  makeOracle,
  makeDashboardMetrics,
  makeRecentActivity,
} from './fixtures';

// Hooks
export {
  useUserStub,
  useDashboardStub,
  useAlertsStub,
  useJournalStub,
  useLearnStub,
  useChartStub,
  useWatchlistStub,
  useOracleStub,
  useSettingsStub,
  createDemoControls,
  type UseUserStubReturn,
  type UseDashboardStubReturn,
  type UseAlertsStubReturn,
  type UseJournalStubReturn,
  type UseLearnStubReturn,
  type UseChartStubReturn,
  type UseWatchlistStubReturn,
  type UseOracleStubReturn,
  type UseSettingsStubReturn,
  type SettingsState,
  type DemoControls,
  type ConfirmPayload,
} from './hooks';

import { useState, useEffect } from 'react';
import type {
  UserStub,
  AlertStub,
  JournalEntryStub,
  LessonStub,
  WatchItemStub,
  OracleStub,
  OverviewCardStub,
  NextActionStub,
  KpiTileStub,
  RecentActivityStub,
} from './contracts';
import { usePageState, type UsePageStateReturn } from './pageState';
import {
  makeAlerts,
  makeJournalEntries,
  makeLessons,
  makeWatchlist,
  makeOracle,
  makeOverviewCards,
  makeNextActions,
  makeKpiTiles,
  makeRecentActivity,
} from './fixtures';

// User stub hook
export interface UseUserStubReturn {
  user: UserStub;
  setWalletConnected: (connected: boolean) => void;
}

export function useUserStub(): UseUserStubReturn {
  const [user, setUser] = useState<UserStub>({ walletConnected: false });

  const setWalletConnected = (connected: boolean) => {
    setUser((prev) => ({ ...prev, walletConnected: connected }));
  };

  return { user, setWalletConnected };
}

// Dashboard stub hook
export interface UseDashboardStubReturn {
  pageState: UsePageStateReturn;
  hasData: boolean;
  setHasData: (value: boolean) => void;
  overviewCards: OverviewCardStub[];
  kpis: KpiTileStub[];
  nextActions: NextActionStub[];
  recentEntries: RecentActivityStub[];
  setOverviewCards: React.Dispatch<React.SetStateAction<OverviewCardStub[]>>;
  setKpis: React.Dispatch<React.SetStateAction<KpiTileStub[]>>;
  setNextActions: React.Dispatch<React.SetStateAction<NextActionStub[]>>;
  setRecentEntries: React.Dispatch<React.SetStateAction<RecentActivityStub[]>>;
}

export function useDashboardStub(): UseDashboardStubReturn {
  const pageState = usePageState('ready');
  const [hasData, setHasData] = useState(true);
  const [overviewCards, setOverviewCards] = useState<OverviewCardStub[]>(makeOverviewCards());
  const [kpis, setKpis] = useState<KpiTileStub[]>(makeKpiTiles());
  const [nextActions, setNextActions] = useState<NextActionStub[]>(makeNextActions());
  const [recentEntries, setRecentEntries] = useState<RecentActivityStub[]>(makeRecentActivity(5));

  return {
    pageState,
    hasData,
    setHasData,
    overviewCards,
    kpis,
    nextActions,
    recentEntries,
    setOverviewCards,
    setKpis,
    setNextActions,
    setRecentEntries,
  };
}

// Alerts stub hook
export interface UseAlertsStubReturn {
  pageState: UsePageStateReturn;
  alerts: AlertStub[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertStub[]>>;
  createAlert: (symbol: string, condition: string, targetPrice: number) => void;
  deleteAlert: (id: string) => void;
  toggleStatus: (id: string) => void;
}

export function useAlertsStub(): UseAlertsStubReturn {
  const pageState = usePageState('ready');
  const [alerts, setAlerts] = useState<AlertStub[]>(makeAlerts(5));

  const createAlert = (symbol: string, condition: string, targetPrice: number) => {
    const newAlert: AlertStub = {
      id: `alert-${Date.now()}`,
      symbol: symbol.toUpperCase().trim(),
      condition,
      targetPrice,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    setAlerts((prev) => [newAlert, ...prev]);
  };

  const deleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const toggleStatus = (id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id
          ? { ...alert, status: alert.status === 'active' ? 'paused' : 'active' as const }
          : alert
      )
    );
  };

  return { pageState, alerts, setAlerts, createAlert, deleteAlert, toggleStatus };
}

// Journal stub hook
export interface UseJournalStubReturn {
  pageState: UsePageStateReturn;
  entries: JournalEntryStub[];
  setEntries: React.Dispatch<React.SetStateAction<JournalEntryStub[]>>;
  confirmEntry: (id: string) => void;
  archiveEntry: (id: string) => void;
  deleteEntry: (id: string) => void;
  restoreEntry: (id: string) => void;
}

export function useJournalStub(): UseJournalStubReturn {
  const pageState = usePageState('ready');
  const [entries, setEntries] = useState<JournalEntryStub[]>([]);

  // Stub: initialize with sample entries
  useEffect(() => {
    async function load() {
      try {
        const stubs = makeJournalEntries(8);
        setEntries(stubs);
      } catch (err) {
        console.error('Failed to load journal from DB:', err);
      }
    }
    load();
  }, []);

  const confirmEntry = (id: string) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        const updated = { ...entry, status: 'confirmed' as const };
        return updated;
      })
    );
  };

  const archiveEntry = (id: string) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        const updated = { ...entry, status: 'archived' as const };
        return updated;
      })
    );
  };

  const deleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    // Note: This does not delete from backend in stub mode, but removes from local DB
    // Ideally we should delete from DB too, but for now we just remove from state
    // dbService.deleteJournalEntry(id); // TODO: implement in db service
  };

  const restoreEntry = (id: string) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        const updated = { ...entry, status: 'pending' as const };
        return updated;
      })
    );
  };

  return { pageState, entries, setEntries, confirmEntry, archiveEntry, deleteEntry, restoreEntry };
}

// Learn/Lessons stub hook
export interface UseLearnStubReturn {
  pageState: UsePageStateReturn;
  lessons: LessonStub[];
  setLessons: React.Dispatch<React.SetStateAction<LessonStub[]>>;
}

export function useLearnStub(): UseLearnStubReturn {
  const pageState = usePageState('ready');
  const [lessons, setLessons] = useState<LessonStub[]>(makeLessons(12));

  // BACKEND_TODO: fetch lessons from backend
  return { pageState, lessons, setLessons };
}

// Chart stub hook
export interface UseChartStubReturn {
  pageState: UsePageStateReturn;
  markets: WatchItemStub[];
  favorites: string[];
  selectedSymbol: string;
  selectedTimeframe: string;
  setMarkets: React.Dispatch<React.SetStateAction<WatchItemStub[]>>;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedTimeframe: (tf: string) => void;
  toggleFavorite: (id: string) => void;
}

export function useChartStub(): UseChartStubReturn {
  const pageState = usePageState('ready');
  const [markets, setMarkets] = useState<WatchItemStub[]>(makeWatchlist(8));
  const [favorites, setFavorites] = useState<string[]>(['watch-1', 'watch-2']);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  return {
    pageState,
    markets,
    favorites,
    selectedSymbol,
    selectedTimeframe,
    setMarkets,
    setSelectedSymbol,
    setSelectedTimeframe,
    toggleFavorite,
  };
}

// Watchlist stub hook
export interface UseWatchlistStubReturn {
  pageState: UsePageStateReturn;
  items: WatchItemStub[];
  setItems: React.Dispatch<React.SetStateAction<WatchItemStub[]>>;
  addSymbol: (symbol: string) => boolean;
  removeSymbol: (symbol: string) => void;
}

export function useWatchlistStub(): UseWatchlistStubReturn {
  const pageState = usePageState('ready');
  const [items, setItems] = useState<WatchItemStub[]>(makeWatchlist(5));

  const addSymbol = (symbol: string): boolean => {
    const normalized = symbol.toUpperCase().trim();
    const exists = items.some((item) => item.symbol === normalized);
    if (exists) return false;

    // BACKEND_TODO: persist watchlist items
    const newItem: WatchItemStub = {
      id: `watch-${Date.now()}`,
      symbol: normalized,
      name: normalized, // Stub name same as symbol
    };
    setItems((prev) => [...prev, newItem]);
    return true;
  };

  const removeSymbol = (symbol: string) => {
    // BACKEND_TODO: persist watchlist items
    setItems((prev) => prev.filter((item) => item.symbol !== symbol));
  };

  return { pageState, items, setItems, addSymbol, removeSymbol };
}

// Oracle stub hook
export interface UseOracleStubReturn {
  pageState: UsePageStateReturn;
  insights: OracleStub[];
  setInsights: React.Dispatch<React.SetStateAction<OracleStub[]>>;
  markAsRead: (id: string) => void;
}

export function useOracleStub(): UseOracleStubReturn {
  const pageState = usePageState('ready');
  const [insights, setInsights] = useState<OracleStub[]>(makeOracle(5));

  const markAsRead = (id: string) => {
    setInsights((prev) =>
      prev.map((insight) =>
        insight.id === id ? { ...insight, isRead: true } : insight
      )
    );
  };

  return { pageState, insights, setInsights, markAsRead };
}

// Settings stub hook
export interface SettingsState {
  // Appearance
  theme: 'dark';
  density: 'comfortable' | 'compact';
  // Chart
  defaultTimeframe: string;
  showVolume: boolean;
  showIndicatorsPanel: boolean;
  // Notifications
  priceAlerts: boolean;
  dailyRecap: boolean;
  quietHours: string;
  // Monitoring
  telemetry: boolean;
  // Journal
  autoCapture: boolean;
  // Risk
  maxRiskPercent: number;
  positionSize: number;
  // Setup
  walletConnected: boolean;
  hasAlerts: boolean;
  hasWatchlistItems: boolean;
  chartPreferencesSet: boolean;
  backupConfigured: boolean;
}

export interface UseSettingsStubReturn {
  pageState: UsePageStateReturn;
  settings: SettingsState;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  resetToDefaults: () => void;
  connectedWallets: { id: string; address: string; type: string }[];
}

const defaultSettings: SettingsState = {
  theme: 'dark',
  density: 'comfortable',
  defaultTimeframe: '1h',
  showVolume: true,
  showIndicatorsPanel: true,
  priceAlerts: true,
  dailyRecap: false,
  quietHours: 'none',
  telemetry: true,
  autoCapture: true,
  maxRiskPercent: 2,
  positionSize: 100,
  walletConnected: true,
  hasAlerts: true,
  hasWatchlistItems: true,
  chartPreferencesSet: false,
  backupConfigured: false,
};

export function useSettingsStub(): UseSettingsStubReturn {
  const pageState = usePageState('ready');
  const [settings, setSettings] = useState<SettingsState>({ ...defaultSettings });
  const [connectedWallets] = useState([
    { id: 'wallet-1', address: '0x1234...5678', type: 'MetaMask' },
  ]);

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    // BACKEND_TODO: real reset/destructive actions
    setSettings({ ...defaultSettings });
  };

  return { pageState, settings, setSettings, updateSetting, resetToDefaults, connectedWallets };
}

// Demo controls for testing different states
export interface DemoControls {
  setEmpty: () => void;
  setLoading: () => void;
  setError: () => void;
  setReady: () => void;
}

export function createDemoControls(pageState: UsePageStateReturn): DemoControls {
  return {
    setEmpty: () => pageState.setState('empty'),
    setLoading: () => pageState.setState('loading'),
    setError: () => pageState.setState('error'),
    setReady: () => pageState.setState('ready'),
  };
}

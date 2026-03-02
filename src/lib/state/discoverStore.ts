import { create } from 'zustand';
import type { Token, Tab, PresetId } from '@/features/discover/filter/types';
import { filterSpec } from '@/features/discover/filter/spec';
import { discoverService } from '@/lib/discover/discoverService';

export interface DiscoverFilters {
  launchpads: string[];
  timeWindow: '5m' | '15m' | '60m' | 'all';
  minLiquiditySol: number | null;
  searchQuery: string;
}

const DEFAULT_FILTERS: DiscoverFilters = {
  launchpads: [],
  timeWindow: 'all',
  minLiquiditySol: null,
  searchQuery: '',
};

export interface DiscoverStoreState {
  // Overlay state
  isOpen: boolean;
  activeTab: Tab;

  // Filters
  filters: DiscoverFilters;
  selectedPreset: Record<Tab, PresetId>;

  // Data
  tokens: Token[];
  isLoading: boolean;
  error: string | null;

  // Actions
  openOverlay: () => void;
  closeOverlay: () => void;
  setActiveTab: (tab: Tab) => void;
  setFilters: (filters: Partial<DiscoverFilters>) => void;
  setPreset: (tab: Tab, preset: PresetId) => void;
  setTokens: (tokens: Token[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  retryFetch: () => Promise<void>;
  resetFilters: () => void;
}

export const useDiscoverStore = create<DiscoverStoreState>((set, get) => ({
  isOpen: false,
  activeTab: 'not_bonded',
  filters: {
    launchpads: [],
    timeWindow: 'all',
    minLiquiditySol: null,
    searchQuery: '',
  },
  selectedPreset: {
    not_bonded: filterSpec.ui.overlay_tabs.not_bonded.default_preset,
    bonded: filterSpec.ui.overlay_tabs.bonded.default_preset,
    ranked: filterSpec.ui.overlay_tabs.ranked.default_preset,
  },
  tokens: [],
  isLoading: false,
  error: null,

  openOverlay: () => set({ isOpen: true }),
  closeOverlay: () => set({ isOpen: false }),
  setActiveTab: (tab) => {
    set({ activeTab: tab });
    // Reset to default preset when switching tabs
    const defaultPreset = filterSpec.ui.overlay_tabs[tab].default_preset;
    set((state) => ({
      selectedPreset: {
        ...state.selectedPreset,
        [tab]: defaultPreset,
      },
    }));
  },
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  setPreset: (tab, preset) =>
    set((state) => ({
      selectedPreset: {
        ...state.selectedPreset,
        [tab]: preset,
      },
    })),
  setTokens: (tokens) => set({ tokens }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  retryFetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const tokens = await discoverService.getTokens();
      set({ tokens, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load tokens',
        isLoading: false,
      });
    }
  },

  resetFilters: () =>
    set({
      filters: { ...DEFAULT_FILTERS },
      selectedPreset: {
        not_bonded: filterSpec.ui.overlay_tabs.not_bonded.default_preset,
        bonded: filterSpec.ui.overlay_tabs.bonded.default_preset,
        ranked: filterSpec.ui.overlay_tabs.ranked.default_preset,
      },
    }),
}));


import { useMemo, useState } from 'react';
import type { Token, Tab, PresetId, Decision } from '../filter/types';
import { evaluateToken } from '../filter/engine';
import { filterSpec } from '../filter/spec';

/**
 * Hook für Discover Filter
 * Verwaltet Filter-State und Preset-Auswahl pro Tab
 */
export function useDiscoverFilters() {
  const [selectedPresets, setSelectedPresets] = useState<Record<Tab, PresetId>>({
    not_bonded: filterSpec.ui.overlay_tabs.not_bonded.default_preset,
    bonded: filterSpec.ui.overlay_tabs.bonded.default_preset,
    ranked: filterSpec.ui.overlay_tabs.ranked.default_preset,
  });

  /**
   * Setze Preset für einen Tab
   */
  const setPreset = (tab: Tab, preset: PresetId) => {
    // Validiere dass Preset für diesen Tab erlaubt ist
    const allowedPresets = filterSpec.ui.overlay_tabs[tab].user_selectable_presets;
    if (!allowedPresets.includes(preset)) {
      console.warn(`Preset ${preset} nicht erlaubt für Tab ${tab}`);
      return;
    }

    setSelectedPresets((prev) => ({
      ...prev,
      [tab]: preset,
    }));
  };

  /**
   * Evaluates a token for a specific tab
   */
  const evaluate = (token: Token, tab: Tab): Decision => {
    const preset = selectedPresets[tab];
    return evaluateToken({ token, tab, preset });
  };

  /**
   * Get available presets for a tab
   */
  const getAvailablePresets = (tab: Tab): PresetId[] => {
    return filterSpec.ui.overlay_tabs[tab].user_selectable_presets;
  };

  /**
   * Get current preset for a tab
   */
  const getCurrentPreset = (tab: Tab): PresetId => {
    return selectedPresets[tab];
  };

  return {
    selectedPresets,
    setPreset,
    evaluate,
    getAvailablePresets,
    getCurrentPreset,
  };
}


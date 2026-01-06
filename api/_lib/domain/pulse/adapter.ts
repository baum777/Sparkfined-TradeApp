import type { PulseSourceAdapter, PulseSourceItem } from './types';

export class StubPulseAdapter implements PulseSourceAdapter {
  async getItems(_query: string): Promise<PulseSourceItem[]> {
    // Return empty list to signal "no data" -> engine should return UNKNOWN
    return [];
  }
}

export class ManualSeedAdapter implements PulseSourceAdapter {
  private items: PulseSourceItem[] = [];

  seed(items: PulseSourceItem[]) {
    this.items = items;
  }

  hasItems(): boolean {
    return this.items.length > 0;
  }

  async getItems(_query: string): Promise<PulseSourceItem[]> {
    return this.items;
  }
}

// Global instance for manual seeding (only effective in memory/dev)
export const manualSeedAdapter = new ManualSeedAdapter();

// Default factory
export function getSourceAdapter(): PulseSourceAdapter {
  // In future: return TwitterAdapter or NewsAdapter
  // For now: check if we have manually seeded data, else Stub
  if (manualSeedAdapter.hasItems()) {
     return manualSeedAdapter;
  }
  return new StubPulseAdapter();
}

/**
 * Canonical Feed Contracts (Backend)
 * Minimal stable shapes for /api/feed/*
 */
 
export type FeedSource = 'oracle' | 'pulse';
 
export interface OracleFeedItem {
  id: string;
  asset: string;
  source: 'oracle';
  title: string;
  summary: string;
  createdAt: string;
  url?: string;
  tags?: string[];
}
 
export interface PulseFeed {
  /**
   * Resolution metadata for the requested `asset` input.
   * This is stable and allows UI to evolve from SNAPSHOT -> HISTORY later.
   */
  assetResolved: {
    input: string;
    kind: 'ticker' | 'address';
    address: string;
    symbol?: string;
  };
  // If no pulse is available yet, snapshot can be null.
  snapshot: unknown | null;
  // Stub for future history support (Theme Group 6).
  history: unknown[];
  updatedAt: string;
}


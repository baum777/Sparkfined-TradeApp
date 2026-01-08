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
  asset: string;
  source: 'pulse';
  // If no pulse is available yet, snapshot can be null.
  snapshot: unknown | null;
  updatedAt: string;
}


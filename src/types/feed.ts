export type FeedKind = "oracle" | "pulse";
export type FeedScope = "user" | "market";
export type Impact = "low" | "medium" | "high" | "critical";
export type FreshnessStatus = "fresh" | "soft_stale" | "hard_stale";

export type FeedCard = {
  id: string;
  kind: FeedKind;
  scope: FeedScope;

  title: string;
  why: string;

  impact: Impact;
  asOf: string; // ISO datetime

  freshness: {
    status: FreshnessStatus;
    ageSec: number;
  };

  confidence: number; // 0..1

  assetId?: string;

  facts?: Array<{ label: string; value: string }>;
  actions?: Array<{ type: string; label: string }>;
};

export type UnifiedSignalsResponse = {
  items: FeedCard[];
};

export type FeedFilter = "all" | "user" | "market";
export type FeedSort = "impact" | "freshness" | "confidence" | "newest";

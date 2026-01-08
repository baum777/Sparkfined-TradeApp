/**
 * Oracle contracts (frontend)
 * Keep in sync with backend/api CONTRACTS.md.
 */

export interface OracleInsight {
  id: string;
  title: string;
  summary: string;
  theme: string;
  isRead: boolean;
  createdAt: string;
}

export interface OraclePinnedTakeaway {
  id: 'today-takeaway';
  title: string;
  summary: string;
  isRead: boolean;
  createdAt: string;
}

export interface OracleDailyFeed {
  pinned: OraclePinnedTakeaway;
  insights: OracleInsight[];
}

export interface OracleReadState {
  id: string;
  isRead: boolean;
  updatedAt: string;
}


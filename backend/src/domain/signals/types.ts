/**
 * Canonical Signals Contracts (Backend)
 * Minimal stable shapes for /api/signals/*
 */
 
export type SignalSource = 'oracle' | 'pulse' | 'ta' | 'alerts' | 'unknown';
export type SignalSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
 
export interface SignalCard {
  id: string;
  asset: string;
  source: SignalSource;
  title: string;
  summary: string;
  severity: SignalSeverity;
  ts: number; // unix ms
  url?: string;
  tags?: string[];
}
 
export interface UnifiedSignalsResponse {
  items: SignalCard[];
}


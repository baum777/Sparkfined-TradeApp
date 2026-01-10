import type { OracleDailyFeed } from '../oracle/types.js';
import type { GrokSentimentSnapshot } from '../grokPulse/types.js';
import type { SignalCard } from './types.js';
 
function nowTs(): number {
  return Date.now();
}
 
export function oracleDailyToSignalCards(asset: string, daily: OracleDailyFeed): SignalCard[] {
  const ts = Date.parse(daily.pinned.createdAt) || nowTs();
 
  const pinned: SignalCard = {
    id: `oracle:${daily.pinned.id}`,
    asset,
    source: 'oracle',
    title: daily.pinned.title,
    summary: daily.pinned.summary,
    severity: 'MEDIUM',
    ts,
    tags: ['daily', 'bias'],
  };
 
  const insights: SignalCard[] = daily.insights.map((i) => ({
    id: `oracle:${i.id}`,
    asset,
    source: 'oracle',
    title: i.title,
    summary: i.summary,
    severity: 'LOW',
    ts: Date.parse(i.createdAt) || ts,
    tags: ['oracle', i.theme],
  }));
 
  return [pinned, ...insights];
}
 
export function pulseSnapshotToSignalCard(asset: string, snapshot: GrokSentimentSnapshot): SignalCard {
  const severity = snapshot.severity ?? 'MEDIUM';
 
  return {
    id: `pulse:${asset}:${snapshot.ts}`,
    asset,
    source: 'pulse',
    title: `Pulse: ${snapshot.label} (${snapshot.cta})`,
    summary: snapshot.one_liner || snapshot.top_snippet || 'Pulse snapshot',
    severity,
    ts: snapshot.ts || nowTs(),
    tags: ['pulse', snapshot.label, snapshot.cta].filter(Boolean),
  };
}


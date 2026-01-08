// Journal v1 Domain Model (CANONICAL — FROZEN)
//
// Journal v1 is a Diary / Reflection system:
// - Purpose: notes, reflections, learning, review workflows
// - Status flow: pending -> confirmed -> archived
// - NOT a trading journal (no prices, pnl, stats, exports, onchain snapshots)
//
// This type is the **single product meaning** of “Journal” on the frontend.

export type JournalStatusV1 = "pending" | "confirmed" | "archived";

export interface JournalEntryV1 {
  id: string;
  status: JournalStatusV1;
  summary: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string; // only if confirmed
  archivedAt?: string; // only if archived
}

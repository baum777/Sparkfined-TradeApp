import { describe, it, expect } from 'vitest';
import { getDatabase } from '../../src/db/sqlite';
import { journalGetById, journalIngestCapture } from '../../src/domain/journal/repo';

function requireDb() {
  if (!(globalThis as any).__DB_READY__) return null;
  return getDatabase();
}

describe('Journal auto-archive on SELL capture', () => {
  it('archives the nearest prior pending BUY for the same asset', async () => {
    const db = requireDb();
    if (!db) return;

    const userId = 'u-autoarchive-1';
    const mint = 'So11111111111111111111111111111111111111112';

    const buy1 = journalIngestCapture(userId, {
      source: 'onchain',
      captureKey: 'tx1:leg0:buy',
      txSignature: 'tx1',
      actionType: 'buy',
      assetMint: mint,
      timestampISO: '2026-01-01T00:00:00.000Z',
    });

    const buy2 = journalIngestCapture(userId, {
      source: 'onchain',
      captureKey: 'tx2:leg0:buy',
      txSignature: 'tx2',
      actionType: 'buy',
      assetMint: mint,
      timestampISO: '2026-01-01T01:00:00.000Z',
    });

    const sell = journalIngestCapture(userId, {
      source: 'onchain',
      captureKey: 'tx3:leg0:sell',
      txSignature: 'tx3',
      actionType: 'sell',
      assetMint: mint,
      timestampISO: '2026-01-01T02:00:00.000Z',
    });

    // Sell stays pending.
    expect(sell.status).toBe('pending');

    const refreshedBuy1 = journalGetById(userId, buy1.id)!;
    const refreshedBuy2 = journalGetById(userId, buy2.id)!;

    expect(refreshedBuy1.status).toBe('pending');
    expect(refreshedBuy2.status).toBe('archived');
    expect(refreshedBuy2.autoArchiveReason).toBe('matched_sell');
    expect(refreshedBuy2.capture?.linkedEntryId).toBe(sell.id);

    // Sanity: only one of the buys is archived.
    const archivedCount = db
      .prepare(`SELECT COUNT(*) as c FROM journal_entries_v2 WHERE user_id = ? AND status = 'archived'`)
      .get(userId) as { c: number };
    expect(archivedCount.c).toBe(1);
  });

  it('sell with no prior pending buy archives none', async () => {
    const db = requireDb();
    if (!db) return;

    const userId = 'u-autoarchive-2';
    const mint = 'MintNoBuys';

    const sell = journalIngestCapture(userId, {
      source: 'onchain',
      captureKey: 'txX:leg0:sell',
      txSignature: 'txX',
      actionType: 'sell',
      assetMint: mint,
      timestampISO: '2026-01-01T02:00:00.000Z',
    });

    expect(sell.status).toBe('pending');

    const archivedCount = db
      .prepare(`SELECT COUNT(*) as c FROM journal_entries_v2 WHERE user_id = ? AND status = 'archived'`)
      .get(userId) as { c: number };
    expect(archivedCount.c).toBe(0);
  });

  it('duplicate sell ingest is idempotent and does not double-archive', async () => {
    const db = requireDb();
    if (!db) return;

    const userId = 'u-autoarchive-3';
    const mint = 'MintDupSell';

    const buy = journalIngestCapture(userId, {
      source: 'onchain',
      captureKey: 'txB:leg0:buy',
      txSignature: 'txB',
      actionType: 'buy',
      assetMint: mint,
      timestampISO: '2026-01-01T01:00:00.000Z',
    });

    const sell1 = journalIngestCapture(userId, {
      source: 'onchain',
      captureKey: 'txS:leg0:sell',
      txSignature: 'txS',
      actionType: 'sell',
      assetMint: mint,
      timestampISO: '2026-01-01T02:00:00.000Z',
    });

    const sell2 = journalIngestCapture(userId, {
      source: 'onchain',
      captureKey: 'txS:leg0:sell',
      txSignature: 'txS',
      actionType: 'sell',
      assetMint: mint,
      timestampISO: '2026-01-01T02:00:00.000Z',
    });

    expect(sell2.id).toBe(sell1.id);

    const refreshedBuy = journalGetById(userId, buy.id)!;
    expect(refreshedBuy.status).toBe('archived');
    expect(refreshedBuy.autoArchiveReason).toBe('matched_sell');

    const archivedCount = db
      .prepare(`SELECT COUNT(*) as c FROM journal_entries_v2 WHERE user_id = ? AND status = 'archived'`)
      .get(userId) as { c: number };
    expect(archivedCount.c).toBe(1);
  });

  it('tie-break is deterministic: timestamp, then created_at, then id', async () => {
    const db = requireDb();
    if (!db) return;

    const userId = 'u-autoarchive-4';
    const mint = 'MintTieBreak';
    const ts = '2026-01-01T01:00:00.000Z';

    // Insert two candidates with same timestamp but different created_at and id.
    db.prepare(
      `
        INSERT INTO journal_entries_v2 (
          id, user_id, side, status, timestamp, summary, day_key, created_at, updated_at,
          capture_source, capture_key, action_type, asset_mint
        ) VALUES (?, ?, 'BUY', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      'cap-a',
      userId,
      ts,
      'buy A',
      ts.slice(0, 10),
      '2026-01-01T01:00:00.100Z',
      '2026-01-01T01:00:00.100Z',
      'onchain',
      'tie:cap-a',
      'buy',
      mint
    );

    db.prepare(
      `
        INSERT INTO journal_entries_v2 (
          id, user_id, side, status, timestamp, summary, day_key, created_at, updated_at,
          capture_source, capture_key, action_type, asset_mint
        ) VALUES (?, ?, 'BUY', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      'cap-b',
      userId,
      ts,
      'buy B',
      ts.slice(0, 10),
      '2026-01-01T01:00:00.200Z',
      '2026-01-01T01:00:00.200Z',
      'onchain',
      'tie:cap-b',
      'buy',
      mint
    );

    const sell = journalIngestCapture(userId, {
      source: 'onchain',
      captureKey: 'txT:leg0:sell',
      txSignature: 'txT',
      actionType: 'sell',
      assetMint: mint,
      timestampISO: '2026-01-01T02:00:00.000Z',
    });

    const a = journalGetById(userId, 'cap-a')!;
    const b = journalGetById(userId, 'cap-b')!;

    // created_at 0.200Z should win => cap-b archived.
    expect(b.status).toBe('archived');
    expect(b.capture?.linkedEntryId).toBe(sell.id);
    expect(a.status).toBe('pending');
  });
});


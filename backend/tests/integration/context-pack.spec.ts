import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app';
import { signToken } from '../../src/lib/auth/jwt';
import { getDatabase } from '../../src/db/sqlite';

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

describe('ContextPack (tier gating + mapping)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = createServer((req, res) => app.handle(req, res));

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('standard: includes market basics, excludes indicators/deltas/narrative', async () => {
    const token = signToken({ userId: 'u-cp-standard', tier: 'standard' });

    const createRes = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-cp-1',
      },
      body: JSON.stringify({ summary: 'Entry' }),
    });
    const created = await readJson(createRes);
    expect(createRes.status).toBe(201);
    const id = created.data.id as string;

    const db = getDatabase();
    const mint = 'So11111111111111111111111111111111111111112';
    db.prepare(
      `
        UPDATE journal_entries_v2
        SET capture_source = ?,
            capture_key = ?,
            action_type = ?,
            asset_mint = ?
        WHERE user_id = ? AND id = ?
      `
    ).run('test', 'cap-cp-1', 'buy', mint, 'u-cp-standard', id);

    const capturedAt = new Date().toISOString();
    db.prepare(
      `
        INSERT OR REPLACE INTO journal_market_snapshots_v1
        (user_id, entry_id, market_snapshot_json, captured_at)
        VALUES (?, ?, ?, ?)
      `
    ).run(
      'u-cp-standard',
      id,
      JSON.stringify({
        capturedAt,
        priceUsd: 100,
        marketCapUsd: 1000000,
        volume24hUsd: 50000,
        holdersCount: 1234,
      }),
      capturedAt
    );

    const res = await fetch(`${baseUrl}/api/journal/${id}/insights`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind: 'review', includeGrok: false }),
    });
    const body = await readJson(res);
    expect(res.status).toBe(200);

    const pack = body.data?.context;
    expect(pack?.tier).toBe('standard');
    expect(pack?.asset?.mint).toBe(mint);
    expect(pack?.market?.priceUsd).toBe(100);
    expect(pack?.market?.indicators).toBeUndefined();
    expect(pack?.deltas).toBeUndefined();
    expect(pack?.narrative).toBeUndefined();
    expect(pack?.reliability?.dataCompleteness).toBe(1);
  });

  it('pro: includes market indicators + deltas (after-trade), excludes narrative when includeGrok=false', async () => {
    const token = signToken({ userId: 'u-cp-pro', tier: 'pro' });

    const createRes = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-cp-2',
      },
      body: JSON.stringify({ summary: 'Entry' }),
    });
    const created = await readJson(createRes);
    expect(createRes.status).toBe(201);
    const id = created.data.id as string;

    const db = getDatabase();
    const mint = 'So11111111111111111111111111111111111111112';
    db.prepare(
      `
        UPDATE journal_entries_v2
        SET capture_source = ?,
            capture_key = ?,
            action_type = ?,
            asset_mint = ?
        WHERE user_id = ? AND id = ?
      `
    ).run('test', 'cap-cp-2', 'buy', mint, 'u-cp-pro', id);

    const capturedAt = new Date().toISOString();
    db.prepare(
      `
        INSERT OR REPLACE INTO journal_market_snapshots_v1
        (user_id, entry_id, market_snapshot_json, captured_at)
        VALUES (?, ?, ?, ?)
      `
    ).run(
      'u-cp-pro',
      id,
      JSON.stringify({
        capturedAt,
        priceUsd: 100,
        marketCapUsd: 1000000,
        volume24hUsd: 50000,
        holdersCount: 1234,
        rsi14: 75,
        trendState: 'bullish',
      }),
      capturedAt
    );

    const delta1hAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    db.prepare(
      `
        INSERT OR REPLACE INTO journal_delta_snapshots_v1
        (user_id, entry_id, window, delta_snapshot_json, captured_at)
        VALUES (?, ?, ?, ?, ?)
      `
    ).run(
      'u-cp-pro',
      id,
      '+1h',
      JSON.stringify({
        window: '+1h',
        capturedAt: delta1hAt,
        priceDeltaUsd: -12,
        priceDeltaPercent: -12,
        volumeDelta24hUsd: 1000,
      }),
      delta1hAt
    );

    const res = await fetch(`${baseUrl}/api/journal/${id}/insights`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind: 'playbook', includeGrok: false }),
    });
    const body = await readJson(res);
    expect(res.status).toBe(200);

    const pack = body.data?.context;
    expect(pack?.tier).toBe('pro');
    expect(pack?.market?.indicators?.rsi14).toBe(75);
    expect(pack?.market?.indicators?.trendState).toBe('overbought');
    expect(pack?.deltas?.note).toBe('after-trade context only');
    expect(pack?.deltas?.windows?.some((w: any) => w.label === '+1h' && w.priceDeltaPct === -12)).toBe(true);
    expect(pack?.narrative).toBeUndefined();
    expect(pack?.reliability?.dataCompleteness).toBe(2);
  });
});


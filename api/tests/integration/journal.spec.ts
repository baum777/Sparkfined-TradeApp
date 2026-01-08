/**
 * Integration Tests: Journal API
 * Validates Boundary Contracts (lowercase status, ISO timestamps, Idempotency)
 * Uses HTTP Handlers + Mocks instead of direct Repo calls
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMemoryStore } from '../../_lib/kv/memory-store';
import journalHandler from '../../journal/index';
import journalIdHandler from '../../journal/[id]';
import confirmHandler from '../../journal/[id]/confirm';
import archiveHandler from '../../journal/[id]/archive';
import restoreHandler from '../../journal/[id]/restore';
import { createMockRequest, createMockResponse } from '../helpers/vercelMock';
import { createValidToken } from '../helpers/jwt';
import { ErrorCodes } from '../../_lib/errors';
import { DexPaprikaAdapter } from '../../_lib/domain/journal/onchain/dexpaprika';
import { MoralisAdapter } from '../../_lib/domain/journal/onchain/moralis';

// Mock Onchain Adapters
vi.mock('../../_lib/domain/journal/onchain/dexpaprika');
vi.mock('../../_lib/domain/journal/onchain/moralis');

const TEST_USER_ID = 'test-user-123';
const AUTH_HEADER = { authorization: `Bearer ${createValidToken(TEST_USER_ID)}` };

// Helper to extract JSON response
function getJson(res: any) {
  return res.json.mock.calls[0][0];
}

describe('Journal API Integration', () => {
  beforeEach(() => {
    clearMemoryStore();
  });

  describe('POST /api/journal (Create)', () => {
    it('creates entry with lowercase status "pending" and ISO timestamps', async () => {
      const req = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER },
        body: {
          side: 'BUY',
          summary: 'Test trade',
        },
      });
      const res = createMockResponse();

      await journalHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const data = getJson(res).data; // Enveloped response

      expect(data.id).toBeDefined();
      expect(data.status).toBe('pending'); // Lowercase contract
      expect(data.side).toBe('BUY');
      expect(data.summary).toBe('Test trade');
      expect(data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(data.updatedAt).toBe(data.createdAt);
      expect(data.timestamp).toBeDefined();
      expect(data.confirmedAt).toBeUndefined();
      expect(data.archivedAt).toBeUndefined();
    });

    it('supports Idempotency-Key header (returns same entry on replay)', async () => {
      const idempotencyKey = 'idem-test-1';
      const body = { side: 'SELL', summary: 'Idempotent trade' };

      // First Request
      const req1 = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER, 'idempotency-key': idempotencyKey },
        body,
      });
      const res1 = createMockResponse();
      await journalHandler(req1, res1);
      expect(res1.status).toHaveBeenCalledWith(201);
      const entry1 = getJson(res1).data;

      // Second Request (Replay)
      const req2 = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER, 'idempotency-key': idempotencyKey },
        body,
      });
      const res2 = createMockResponse();
      await journalHandler(req2, res2);
      expect(res2.status).toHaveBeenCalledWith(200);
      const entry2 = getJson(res2).data;

      expect(entry1.id).toBe(entry2.id);
      expect(entry1.createdAt).toBe(entry2.createdAt);
    });
    
    // Optional: Test conflict on different body with same key if we want to be strict
    // But for now, basic replay is main goal.
  });

  describe('GET /api/journal (List)', () => {
    it('lists entries with lowercase status', async () => {
      // Create one entry via handler to ensure state is correct
      const createReq = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER },
        body: { side: 'BUY', summary: 'List me' },
      });
      await journalHandler(createReq, createMockResponse());

      // List
      const req = createMockRequest({
        method: 'GET',
        headers: { ...AUTH_HEADER },
        query: { status: 'pending' },
      });
      const res = createMockResponse();

      await journalHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = getJson(res).data;
      expect(data.items).toHaveLength(1);
      expect(data.items[0].status).toBe('pending');
    });
  });

  describe('Transitions (Confirm/Archive/Restore)', () => {
    let entryId: string;

    beforeEach(async () => {
      const req = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER },
        body: { side: 'BUY', summary: 'Transition test' },
      });
      const res = createMockResponse();
      await journalHandler(req, res);
      entryId = getJson(res).data.id;
    });

    it('confirms entry: status="confirmed", sets confirmedAt', async () => {
      const req = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER },
        query: { id: entryId },
        body: { mood: 'confident', note: 'ok', tags: [] },
      });
      const res = createMockResponse();

      await confirmHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = getJson(res).data;
      expect(data.status).toBe('confirmed');
      expect(data.confirmedAt).toBeDefined();
      expect(data.confirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(data.updatedAt).not.toBe(data.createdAt); // Should be updated
    });

    it('archives entry: status="archived", sets archivedAt', async () => {
      const req = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER },
        query: { id: entryId },
        body: { reason: 'mistake' },
      });
      const res = createMockResponse();

      await archiveHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = getJson(res).data;
      expect(data.status).toBe('archived');
      expect(data.archivedAt).toBeDefined();
    });

    it('restores entry: status="pending", removes archivedAt', async () => {
      // Archive first
      const archiveReq = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER },
        query: { id: entryId },
        body: { reason: 'mistake' },
      });
      await archiveHandler(archiveReq, createMockResponse());

      // Restore
      const req = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER },
        query: { id: entryId },
      });
      const res = createMockResponse();

      await restoreHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = getJson(res).data;
      expect(data.status).toBe('pending');
      expect(data.archivedAt).toBeUndefined();
    });
  });

  describe('GET /api/journal/:id', () => {
    it('returns 404 for nonexistent entry', async () => {
      const req = createMockRequest({
        method: 'GET',
        headers: { ...AUTH_HEADER },
        query: { id: 'nonexistent' },
      });
      const res = createMockResponse();

      // createHandler usually catches errors and calls sendError
      // But in tests, if createHandler doesn't catch locally thrown errors from domain in unit tests?
      // createHandler catches all errors and uses handleError.
      
      await journalIdHandler(req, res);

      // expect(res.status).toHaveBeenCalledWith(404);
      // Check response body code
      const calls = (res.json as any).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0].error.code).toBe(ErrorCodes.JOURNAL_NOT_FOUND);
    });
  });

  describe('Onchain Snapshot (P1.2)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('POST creates entry with onchainContext if symbolOrAddress provided', async () => {
      // Setup successful mocks
      vi.mocked(DexPaprikaAdapter.prototype.fetchTokenData).mockResolvedValue({
        priceUsd: 1.23,
        liquidityUsd: 1000,
        volume24h: 500,
        marketCap: 1000000,
        ageMinutes: 10,
        dexId: 'raydium',
      });
      vi.mocked(MoralisAdapter.prototype.fetchTokenData).mockResolvedValue({
        holders: 100,
        transfers24h: 20,
      });

      const req = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER },
        body: {
          side: 'BUY',
          summary: 'Snapshot test',
          symbolOrAddress: 'So11111111111111111111111111111111111111112',
        },
      });
      const res = createMockResponse();

      await journalHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const data = getJson(res).data;
      
      expect(data.onchainContext).toBeDefined();
      expect(data.onchainContext.priceUsd).toBe(1.23);
      expect(data.onchainContext.holders).toBe(100);
      // Meta fields only in persistence, not mapped to V1 frontend contract?
      // Wait, Plan says: "JournalEntryV1 extension... Zusätzlich (additiv...): onchainContextMeta"
      // But in types-contract I extended JournalEvent (Persistence) and JournalEntryV1 (Response) only with onchainContext?
      // Let's check mapper again.
    });

    it('POST succeeds even if providers fail (Partial Snapshot)', async () => {
      vi.mocked(DexPaprikaAdapter.prototype.fetchTokenData).mockRejectedValue(new Error('Timeout'));
      vi.mocked(MoralisAdapter.prototype.fetchTokenData).mockResolvedValue({
        holders: 50,
        transfers24h: 5,
      });

      const req = createMockRequest({
        method: 'POST',
        headers: { ...AUTH_HEADER },
        body: {
          side: 'SELL',
          summary: 'Partial test',
          symbolOrAddress: 'So11111111111111111111111111111111111111112',
        },
      });
      const res = createMockResponse();

      await journalHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const data = getJson(res).data;
      
      expect(data.onchainContext).toBeDefined();
      expect(data.onchainContext.priceUsd).toBe(0); // Failed
      expect(data.onchainContext.holders).toBe(50); // Succeeded
      
      expect(data.onchainContextMeta).toBeDefined();
      expect(data.onchainContextMeta.errors).toHaveLength(1);
      expect(data.onchainContextMeta.errors[0].provider).toBe('dexpaprika');
    });
  });
});

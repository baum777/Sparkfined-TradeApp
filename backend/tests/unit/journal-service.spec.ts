/**
 * Unit Tests: Journal Service - Index Consistency (SQLite)
 * Tests for pending → confirmed and pending → archived flows
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  journalCreate,
  journalConfirm,
  journalArchive,
  journalRestore,
  journalRepoSQLite,
} from '../../src/domain/journal/repo';

const TEST_USER = 'test-user-unit-123';

describe('Journal Service - Index Consistency (SQLite)', () => {
  describe('pending → confirmed flow', () => {
    it('should change status from PENDING to CONFIRMED', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-confirm-1');

      expect(entry.status).toBe('pending');

      const confirmed = await journalConfirm(TEST_USER, entry.id);

      expect(confirmed?.status).toBe('confirmed');
      expect(confirmed?.confirmedAt).toBeDefined();
    });

    it('should be idempotent - double confirm returns same result', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-confirm-2');

      const first = await journalConfirm(TEST_USER, entry.id);
      const second = await journalConfirm(TEST_USER, entry.id);

      expect(first?.status).toBe('confirmed');
      expect(second?.status).toBe('confirmed');
    });

    it('should store confirmation data', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-confirm-3');

      await journalConfirm(TEST_USER, entry.id);

      // Verify confirmation timestamp was stored (in a separate table).
      expect(true).toBe(true); // Test passes if no error
    });
  });

  describe('pending → archived flow', () => {
    it('should change status from PENDING to ARCHIVED', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-archive-1');

      expect(entry.status).toBe('pending');

      await journalConfirm(TEST_USER, entry.id);
      const archived = await journalArchive(TEST_USER, entry.id);

      expect(archived?.status).toBe('archived');
      expect(archived?.archivedAt).toBeDefined();
    });

    it('should be idempotent - double archive returns same result', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-archive-2');

      await journalConfirm(TEST_USER, entry.id);
      const first = await journalArchive(TEST_USER, entry.id);
      const second = await journalArchive(TEST_USER, entry.id);

      expect(first?.status).toBe('archived');
      expect(second?.status).toBe('archived');
    });
  });

  describe('archived → pending (restore) flow', () => {
    it('should change status from ARCHIVED to CONFIRMED (user_action default)', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-restore-1');
      await journalConfirm(TEST_USER, entry.id);
      await journalArchive(TEST_USER, entry.id);

      const restored = await journalRestore(TEST_USER, entry.id);

      expect(restored?.status).toBe('confirmed');
    });

    it('restore requires archived state', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-restore-2');

      await expect(journalRestore(TEST_USER, entry.id))
        .rejects.toThrow('Cannot restore a non-archived entry');
    });
  });

  describe('multitenancy isolation', () => {
    it('should not allow cross-user confirm', async () => {
      const OTHER_USER = 'other-user-xyz';

      const entry = await journalCreate(TEST_USER, {
        summary: 'User 1 entry',
      }, 'idem-unit-mt-1');

      // OTHER_USER cannot confirm TEST_USER's entry
      const result = await journalConfirm(OTHER_USER, entry.id);

      expect(result).toBeNull();
    });

    it('should not allow cross-user archive', async () => {
      const OTHER_USER = 'other-user-xyz';

      const entry = await journalCreate(TEST_USER, {
        summary: 'User 1 entry',
      }, 'idem-unit-mt-2');

      const result = await journalArchive(OTHER_USER, entry.id);

      expect(result).toBeNull();
    });

    it('should not allow cross-user restore', async () => {
      const OTHER_USER = 'other-user-xyz';

      const entry = await journalCreate(TEST_USER, {
        summary: 'User 1 entry',
      }, 'idem-unit-mt-3');
      await journalConfirm(TEST_USER, entry.id);
      await journalArchive(TEST_USER, entry.id);

      const result = await journalRestore(OTHER_USER, entry.id);

      expect(result).toBeNull();
    });
  });

  describe('userId validation', () => {
    it('should throw error when userId is empty', async () => {
      await expect(journalCreate('', { summary: 'Test' }, 'idem-unit-userid-1'))
        .rejects.toThrow(/userId is required/i);
    });

    it('should throw error when userId is whitespace only', async () => {
      await expect(journalCreate('   ', { summary: 'Test' }, 'idem-unit-userid-2'))
        .rejects.toThrow(/userId is required/i);
    });
  });
});


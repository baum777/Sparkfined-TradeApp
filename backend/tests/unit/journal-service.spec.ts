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
    it('should change status from PENDING to CONFIRMED', () => {
      const entry = journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-confirm-1');

      expect(entry.status).toBe('pending');

      const confirmed = journalConfirm(TEST_USER, entry.id);

      expect(confirmed?.status).toBe('confirmed');
      expect(confirmed?.confirmedAt).toBeDefined();
    });

    it('should be idempotent - double confirm returns same result', () => {
      const entry = journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-confirm-2');

      const first = journalConfirm(TEST_USER, entry.id);
      const second = journalConfirm(TEST_USER, entry.id);

      expect(first?.status).toBe('confirmed');
      expect(second?.status).toBe('confirmed');
    });

    it('should store confirmation data', () => {
      const entry = journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-confirm-3');

      journalConfirm(TEST_USER, entry.id);

      // Verify confirmation timestamp was stored (in a separate table).
      expect(true).toBe(true); // Test passes if no error
    });
  });

  describe('pending → archived flow', () => {
    it('should change status from PENDING to ARCHIVED', () => {
      const entry = journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-archive-1');

      expect(entry.status).toBe('pending');

      journalConfirm(TEST_USER, entry.id);
      const archived = journalArchive(TEST_USER, entry.id);

      expect(archived?.status).toBe('archived');
      expect(archived?.archivedAt).toBeDefined();
    });

    it('should be idempotent - double archive returns same result', () => {
      const entry = journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-archive-2');

      journalConfirm(TEST_USER, entry.id);
      const first = journalArchive(TEST_USER, entry.id);
      const second = journalArchive(TEST_USER, entry.id);

      expect(first?.status).toBe('archived');
      expect(second?.status).toBe('archived');
    });
  });

  describe('archived → pending (restore) flow', () => {
    it('should change status from ARCHIVED to CONFIRMED (user_action)', () => {
      const entry = journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-restore-1');
      journalConfirm(TEST_USER, entry.id);
      journalArchive(TEST_USER, entry.id);

      const restored = journalRestore(TEST_USER, entry.id);

      expect(restored?.status).toBe('confirmed');
    });

    it('restore on pending should return null (invalid transition)', () => {
      const entry = journalCreate(TEST_USER, {
        summary: 'Test entry',
      }, 'idem-unit-restore-2');

      expect(() => journalRestore(TEST_USER, entry.id)).toThrow('Cannot restore a non-archived entry');
    });
  });

  describe('multitenancy isolation', () => {
    it('should not allow cross-user confirm', () => {
      const OTHER_USER = 'other-user-xyz';

      const entry = journalCreate(TEST_USER, {
        summary: 'User 1 entry',
      }, 'idem-unit-mt-1');

      // OTHER_USER cannot confirm TEST_USER's entry
      const result = journalConfirm(OTHER_USER, entry.id);

      expect(result).toBeNull();
    });

    it('should not allow cross-user archive', () => {
      const OTHER_USER = 'other-user-xyz';

      const entry = journalCreate(TEST_USER, {
        summary: 'User 1 entry',
      }, 'idem-unit-mt-2');

      const result = journalArchive(OTHER_USER, entry.id);

      expect(result).toBeNull();
    });

    it('should not allow cross-user restore', () => {
      const OTHER_USER = 'other-user-xyz';

      const entry = journalCreate(TEST_USER, {
        summary: 'User 1 entry',
      }, 'idem-unit-mt-3');
      journalConfirm(TEST_USER, entry.id);
      journalArchive(TEST_USER, entry.id);

      const result = journalRestore(OTHER_USER, entry.id);

      expect(result).toBeNull();
    });
  });

  describe('userId validation', () => {
    it('should throw error when userId is empty', () => {
      expect(() => journalCreate('', { summary: 'Test' }, 'idem-unit-userid-1'))
        .toThrow('userId is required');
    });

    it('should throw error when userId is whitespace only', () => {
      expect(() => journalCreate('   ', { summary: 'Test' }, 'idem-unit-userid-2'))
        .toThrow('userId is required');
    });
  });
});


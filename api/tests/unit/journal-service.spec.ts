/**
 * Unit Tests: Journal Service - Index Consistency
 * Tests for pending → confirmed → archived flows
 * Verifies index updates (day + status lists)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearMemoryStore } from '../../_lib/kv/memory-store';
import {
  journalCreate,
  journalConfirm,
  journalArchive,
  journalRestore,
  journalRepoKV,
} from '../../_lib/domain/journal/repo';

const TEST_USER = 'test-user-unit-123';

describe('Journal Service - Index Consistency', () => {
  beforeEach(() => {
    clearMemoryStore();
  });

  describe('pending → confirmed flow', () => {
    it('should remove id from PENDING list on confirm', async () => {
      // Create entry
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      });

      // Verify in pending
      const pendingBefore = await journalRepoKV.listStatusIds(TEST_USER, 'PENDING');
      expect(pendingBefore).toContain(entry.id);

      // Confirm
      await journalConfirm(TEST_USER, entry.id);

      // Verify removed from pending
      const pendingAfter = await journalRepoKV.listStatusIds(TEST_USER, 'PENDING');
      expect(pendingAfter).not.toContain(entry.id);
    });

    it('should add id to CONFIRMED list on confirm', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      });

      // Not in confirmed initially
      const confirmedBefore = await journalRepoKV.listStatusIds(TEST_USER, 'CONFIRMED');
      expect(confirmedBefore).not.toContain(entry.id);

      await journalConfirm(TEST_USER, entry.id);

      const confirmedAfter = await journalRepoKV.listStatusIds(TEST_USER, 'CONFIRMED');
      expect(confirmedAfter).toContain(entry.id);
    });

    it('should add id to day list on confirm', async () => {
      const timestamp = '2026-01-15T10:00:00.000Z';
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
        timestamp,
      });

      await journalConfirm(TEST_USER, entry.id);

      const dayIds = await journalRepoKV.listDayIds(TEST_USER, '2026-01-15');
      expect(dayIds).toContain(entry.id);
    });

    it('should update updatedAt index on confirm', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      });

      const before = await journalRepoKV.getUpdatedAt(TEST_USER);

      // Wait a tiny bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      await journalConfirm(TEST_USER, entry.id);

      const after = await journalRepoKV.getUpdatedAt(TEST_USER);
      expect(after).not.toBeNull();
      expect(after).not.toBe(before);
    });

    it('should be idempotent - double confirm does not duplicate indices', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      });

      await journalConfirm(TEST_USER, entry.id);
      await journalConfirm(TEST_USER, entry.id);

      const confirmedIds = await journalRepoKV.listStatusIds(TEST_USER, 'CONFIRMED');
      const occurrences = confirmedIds.filter(id => id === entry.id).length;
      expect(occurrences).toBe(1);
    });
  });

  describe('confirmed → archived flow', () => {
    it('should move id from CONFIRMED to ARCHIVED on archive', async () => {
      const entry = await journalCreate(TEST_USER, { summary: 'Test entry' });
      await journalConfirm(TEST_USER, entry.id);

      const confirmedBefore = await journalRepoKV.listStatusIds(TEST_USER, 'CONFIRMED');
      expect(confirmedBefore).toContain(entry.id);

      await journalArchive(TEST_USER, entry.id);

      const confirmedAfter = await journalRepoKV.listStatusIds(TEST_USER, 'CONFIRMED');
      expect(confirmedAfter).not.toContain(entry.id);

      const archivedAfter = await journalRepoKV.listStatusIds(TEST_USER, 'ARCHIVED');
      expect(archivedAfter).toContain(entry.id);
    });

    it('should update updatedAt index on archive', async () => {
      const entry = await journalCreate(TEST_USER, { summary: 'Test entry' });
      await journalConfirm(TEST_USER, entry.id);

      await new Promise(resolve => setTimeout(resolve, 10));

      await journalArchive(TEST_USER, entry.id);

      const after = await journalRepoKV.getUpdatedAt(TEST_USER);
      expect(after).not.toBeNull();
    });

    it('should be idempotent - double archive does not duplicate indices', async () => {
      const entry = await journalCreate(TEST_USER, { summary: 'Test entry' });
      await journalConfirm(TEST_USER, entry.id);

      await journalArchive(TEST_USER, entry.id);
      await journalArchive(TEST_USER, entry.id);

      const archivedIds = await journalRepoKV.listStatusIds(TEST_USER, 'ARCHIVED');
      const occurrences = archivedIds.filter(id => id === entry.id).length;
      expect(occurrences).toBe(1);
    });
  });

  describe('archived → pending (restore) flow', () => {
    it('should remove id from ARCHIVED list on restore', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      });
      await journalConfirm(TEST_USER, entry.id);
      await journalArchive(TEST_USER, entry.id);

      const archivedBefore = await journalRepoKV.listStatusIds(TEST_USER, 'ARCHIVED');
      expect(archivedBefore).toContain(entry.id);

      await journalRestore(TEST_USER, entry.id);

      const archivedAfter = await journalRepoKV.listStatusIds(TEST_USER, 'ARCHIVED');
      expect(archivedAfter).not.toContain(entry.id);
    });

    it('should add id back to PENDING list on restore', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      });
      await journalConfirm(TEST_USER, entry.id);
      await journalArchive(TEST_USER, entry.id);

      await journalRestore(TEST_USER, entry.id);

      const pendingAfter = await journalRepoKV.listStatusIds(TEST_USER, 'PENDING');
      expect(pendingAfter).toContain(entry.id);
    });

    it('should update updatedAt index on restore', async () => {
      const entry = await journalCreate(TEST_USER, {
        summary: 'Test entry',
      });
      await journalConfirm(TEST_USER, entry.id);
      await journalArchive(TEST_USER, entry.id);

      await new Promise(resolve => setTimeout(resolve, 10));

      await journalRestore(TEST_USER, entry.id);

      const after = await journalRepoKV.getUpdatedAt(TEST_USER);
      expect(after).not.toBeNull();
    });
  });

  describe('multitenancy isolation', () => {
    it('should not affect other user indices', async () => {
      const OTHER_USER = 'other-user-xyz';

      // Create entry for TEST_USER
      const entry1 = await journalCreate(TEST_USER, { summary: 'User 1' });
      const entry2 = await journalCreate(OTHER_USER, { summary: 'User 2' });

      // Confirm TEST_USER entry
      await journalConfirm(TEST_USER, entry1.id);

      // OTHER_USER pending list should still have their entry
      const otherPending = await journalRepoKV.listStatusIds(OTHER_USER, 'PENDING');
      expect(otherPending).toContain(entry2.id);

      // OTHER_USER confirmed list should be empty
      const otherConfirmed = await journalRepoKV.listStatusIds(OTHER_USER, 'CONFIRMED');
      expect(otherConfirmed).not.toContain(entry1.id);
    });
  });
});


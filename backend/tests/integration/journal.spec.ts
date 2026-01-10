/**
 * Integration Tests: Journal API
 * MULTITENANCY: All operations require userId
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  journalCreate,
  journalGetById,
  journalList,
  journalConfirm,
  journalArchive,
  journalRestore,
  journalDelete,
  journalSystemArchive,
} from '../../src/domain/journal/repo';
import { AppError } from '../../src/http/error';

// Test userId - all operations are scoped to this user
const TEST_USER_ID = 'test-user-123';
const OTHER_USER_ID = 'other-user-456';

describe('Journal Integration', () => {
  describe('Create', () => {
    it('should create entry with PENDING status', () => {
      const entry = journalCreate(TEST_USER_ID, {
        summary: 'Test entry',
      }, 'idem-create-1');
      
      expect(entry.id).toBeDefined();
      expect(entry.status).toBe('pending');
      expect(entry.summary).toBe('Test entry');
      expect(entry.timestamp).toBeDefined();
      expect(entry.createdAt).toBeDefined();
      expect(entry.updatedAt).toBeDefined();
    });
    
    it('should use provided timestamp', () => {
      const timestamp = '2025-12-31T12:00:00.000Z';
      
      const entry = journalCreate(TEST_USER_ID, {
        summary: 'Test',
        timestamp,
      }, 'idem-create-2');
      
      expect(entry.timestamp).toBe(timestamp);
    });

    it('should throw error when userId is empty', () => {
      expect(() => journalCreate('', { summary: 'Test' }, 'idem-create-3'))
        .toThrow('userId is required');
    });
  });
  
  describe('Get by ID', () => {
    it('should return entry by id (userId-scoped)', () => {
      const created = journalCreate(TEST_USER_ID, {
        summary: 'Find me',
      }, 'idem-get-1');
      
      const found = journalGetById(TEST_USER_ID, created.id);
      
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.summary).toBe('Find me');
    });
    
    it('should return null for non-existent id', () => {
      const found = journalGetById(TEST_USER_ID, 'non-existent-id');
      
      expect(found).toBeNull();
    });

    it('should isolate entries by userId (multitenancy)', () => {
      const created = journalCreate(TEST_USER_ID, {
        summary: 'User A only',
      }, 'idem-isolation-1');
      
      // OTHER_USER cannot see it
      const foundByOther = journalGetById(OTHER_USER_ID, created.id);
      expect(foundByOther).toBeNull();
      
      // TEST_USER can see it
      const foundByOwner = journalGetById(TEST_USER_ID, created.id);
      expect(foundByOwner).not.toBeNull();
    });
  });
  
  describe('List', () => {
    beforeEach(() => {
      // Create entries with different statuses for TEST_USER
      journalCreate(TEST_USER_ID, { summary: 'Pending 1' }, 'idem-list-p1');
      journalCreate(TEST_USER_ID, { summary: 'Pending 2' }, 'idem-list-p2');
      
      const toConfirm = journalCreate(TEST_USER_ID, { summary: 'To confirm' }, 'idem-list-c1');
      journalConfirm(TEST_USER_ID, toConfirm.id);
      
      const toArchive = journalCreate(TEST_USER_ID, { summary: 'To archive' }, 'idem-list-a1');
      journalConfirm(TEST_USER_ID, toArchive.id);
      journalArchive(TEST_USER_ID, toArchive.id);
    });
    
    it('should list all entries without filter (userId-scoped)', () => {
      const result = journalList(TEST_USER_ID);
      
      expect(result.items.length).toBe(4);
    });
    
    it('should filter by pending status', () => {
      const result = journalList(TEST_USER_ID, 'pending');
      
      expect(result.items.length).toBe(2);
      expect(result.items.every(e => e.status === 'pending')).toBe(true);
    });
    
    it('should filter by confirmed status', () => {
      const result = journalList(TEST_USER_ID, 'confirmed');
      
      expect(result.items.length).toBe(1);
      expect(result.items[0].status).toBe('confirmed');
    });
    
    it('should filter by archived status', () => {
      const result = journalList(TEST_USER_ID, 'archived');
      
      expect(result.items.length).toBe(1);
      expect(result.items[0].status).toBe('archived');
    });
    
    it('should respect limit', () => {
      const result = journalList(TEST_USER_ID, undefined, 2);
      
      expect(result.items.length).toBe(2);
    });

    it('should not list entries from other users', () => {
      // Create entry for OTHER_USER
      journalCreate(OTHER_USER_ID, { summary: 'Other user entry' }, 'idem-other-1');
      
      // TEST_USER list should not include it
      const testUserList = journalList(TEST_USER_ID);
      const otherUserList = journalList(OTHER_USER_ID);
      
      expect(testUserList.items.length).toBe(4); // Only TEST_USER entries
      expect(otherUserList.items.length).toBe(1); // Only OTHER_USER entry
    });
  });
  
  describe('Confirm', () => {
    it('should change status to CONFIRMED', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-confirm-1');
      
      const confirmed = journalConfirm(TEST_USER_ID, entry.id);
      
      expect(confirmed?.status).toBe('confirmed');
      expect(confirmed?.confirmedAt).toBeDefined();
    });
    
    it('should be idempotent', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-confirm-2');
      
      journalConfirm(TEST_USER_ID, entry.id);
      const second = journalConfirm(TEST_USER_ID, entry.id);
      
      expect(second?.status).toBe('confirmed');
    });

    it('should not confirm other users entries', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-confirm-3');
      
      const result = journalConfirm(OTHER_USER_ID, entry.id);
      
      expect(result).toBeNull();
    });
  });
  
  describe('Archive', () => {
    it('should change status to ARCHIVED', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-archive-1');
      journalConfirm(TEST_USER_ID, entry.id);
      
      const archived = journalArchive(TEST_USER_ID, entry.id);
      
      expect(archived?.status).toBe('archived');
      expect(archived?.archivedAt).toBeDefined();
    });
    
    it('should be idempotent', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-archive-2');
      journalConfirm(TEST_USER_ID, entry.id);
      
      journalArchive(TEST_USER_ID, entry.id);
      const second = journalArchive(TEST_USER_ID, entry.id);
      
      expect(second?.status).toBe('archived');
    });

    it('should not archive other users entries', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-archive-3');
      journalConfirm(TEST_USER_ID, entry.id);
      
      const result = journalArchive(OTHER_USER_ID, entry.id);
      
      expect(result).toBeNull();
    });

    it('blocks user archive of pending entry', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-archive-pending-1');
      
      expect(() => journalArchive(TEST_USER_ID, entry.id)).toThrow(AppError);
      expect(() => journalArchive(TEST_USER_ID, entry.id)).toThrow('Cannot archive a pending entry');
    });

    it('allows system auto-archive for matched_sell', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-archive-matched-1');
      
      const archived = journalSystemArchive({
        userId: TEST_USER_ID,
        id: entry.id,
        reason: 'matched_sell',
      });
      
      expect(archived?.status).toBe('archived');
      expect(archived?.autoArchiveReason).toBe('matched_sell');
    });
  });
  
  describe('Restore', () => {
    it('restore matched_sell -> pending; user_action -> confirmed', () => {
      // Test restore from matched_sell archive -> pending
      const entry1 = journalCreate(TEST_USER_ID, { summary: 'Test 1' }, 'idem-restore-matched-1');
      journalSystemArchive({
        userId: TEST_USER_ID,
        id: entry1.id,
        reason: 'matched_sell',
      });
      
      const restored1 = journalRestore(TEST_USER_ID, entry1.id);
      expect(restored1?.status).toBe('pending');

      // Test restore from user_action archive -> confirmed
      const entry2 = journalCreate(TEST_USER_ID, { summary: 'Test 2' }, 'idem-restore-user-1');
      journalConfirm(TEST_USER_ID, entry2.id);
      journalArchive(TEST_USER_ID, entry2.id);
      
      const restored2 = journalRestore(TEST_USER_ID, entry2.id);
      expect(restored2?.status).toBe('confirmed');
    });

    it('should throw error when restoring non-archived entry', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-restore-error-1');
      journalConfirm(TEST_USER_ID, entry.id);
      
      expect(() => journalRestore(TEST_USER_ID, entry.id)).toThrow(AppError);
      expect(() => journalRestore(TEST_USER_ID, entry.id)).toThrow('Cannot restore a non-archived entry');
    });

    it('should not restore other users entries', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-restore-3');
      journalConfirm(TEST_USER_ID, entry.id);
      journalArchive(TEST_USER_ID, entry.id);
      
      const result = journalRestore(OTHER_USER_ID, entry.id);
      
      expect(result).toBeNull();
    });
  });
  
  describe('Delete', () => {
    it('should remove entry', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-delete-1');
      
      const deleted = journalDelete(TEST_USER_ID, entry.id);
      
      expect(deleted).toBe(true);
      expect(journalGetById(TEST_USER_ID, entry.id)).toBeNull();
    });
    
    it('should return false for non-existent', () => {
      const deleted = journalDelete(TEST_USER_ID, 'non-existent');
      
      expect(deleted).toBe(false);
    });

    it('should not delete other users entries', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-delete-2');
      
      const deleted = journalDelete(OTHER_USER_ID, entry.id);
      
      expect(deleted).toBe(false);
      // Entry still exists for owner
      expect(journalGetById(TEST_USER_ID, entry.id)).not.toBeNull();
    });
  });
});

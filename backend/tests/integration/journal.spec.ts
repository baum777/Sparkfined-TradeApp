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
} from '../../src/domain/journal/repo';

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
      
      const archived = journalArchive(TEST_USER_ID, entry.id);
      
      expect(archived?.status).toBe('archived');
      expect(archived?.archivedAt).toBeDefined();
    });
    
    it('should be idempotent', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-archive-2');
      
      journalArchive(TEST_USER_ID, entry.id);
      const second = journalArchive(TEST_USER_ID, entry.id);
      
      expect(second?.status).toBe('archived');
    });

    it('should not archive other users entries', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-archive-3');
      
      const result = journalArchive(OTHER_USER_ID, entry.id);
      
      expect(result).toBeNull();
    });
  });
  
  describe('Restore', () => {
    it('should change status back to PENDING', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-restore-1');
      journalArchive(TEST_USER_ID, entry.id);
      
      const restored = journalRestore(TEST_USER_ID, entry.id);
      
      expect(restored?.status).toBe('pending');
    });
    
    it('should be idempotent on pending', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-restore-2');
      
      const restored = journalRestore(TEST_USER_ID, entry.id);
      
      expect(restored?.status).toBe('pending');
    });

    it('should not restore other users entries', () => {
      const entry = journalCreate(TEST_USER_ID, { summary: 'Test' }, 'idem-restore-3');
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

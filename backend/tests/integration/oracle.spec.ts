import { describe, it, expect } from 'vitest';
import {
  oracleGetDaily,
  oracleSetReadState,
  oracleBulkSetReadState,
} from '../../src/domain/oracle/repo';

describe('Oracle Integration', () => {
  const userId = 'test-user';
  
  describe('Daily Feed', () => {
    it('should return feed with pinned takeaway', async () => {
      const feed = await oracleGetDaily(new Date(), userId);
      
      expect(feed.pinned).toBeDefined();
      expect(feed.pinned.id).toBe('today-takeaway');
      expect(feed.pinned.title).toBeDefined();
      expect(feed.pinned.summary).toBeDefined();
    });
    
    it('should return insights list', async () => {
      const feed = await oracleGetDaily(new Date(), userId);
      
      expect(feed.insights).toBeDefined();
      expect(feed.insights.length).toBeGreaterThanOrEqual(3);
      
      feed.insights.forEach(insight => {
        expect(insight.id).toBeDefined();
        expect(insight.title).toBeDefined();
        expect(insight.summary).toBeDefined();
        expect(insight.theme).toBeDefined();
        expect(typeof insight.isRead).toBe('boolean');
      });
    });
    
    it('should generate deterministic feed for same date', async () => {
      const date = new Date('2025-12-31');
      
      const feed1 = await oracleGetDaily(date, userId);
      const feed2 = await oracleGetDaily(date, userId);
      
      expect(feed1.pinned.title).toBe(feed2.pinned.title);
      expect(feed1.insights.length).toBe(feed2.insights.length);
    });
    
    it('should generate different feed for different dates', async () => {
      const date1 = new Date('2025-12-31');
      const date2 = new Date('2026-01-01');
      
      const feed1 = await oracleGetDaily(date1, userId);
      const feed2 = await oracleGetDaily(date2, userId);
      
      // Titles might differ based on hash
      expect(feed1.insights[0].id).not.toBe(feed2.insights[0].id);
    });
  });
  
  describe('Read State', () => {
    it('should set and persist read state', async () => {
      const date = new Date();
      
      // Initially unread
      let feed = await oracleGetDaily(date, userId);
      expect(feed.pinned.isRead).toBe(false);
      
      // Mark as read
      const result = await oracleSetReadState(userId, 'today-takeaway', true);
      expect(result.isRead).toBe(true);
      expect(result.updatedAt).toBeDefined();
      
      // Should be reflected in feed
      feed = await oracleGetDaily(date, userId);
      expect(feed.pinned.isRead).toBe(true);
    });
    
    it('should set read state for insights', async () => {
      const date = new Date('2025-12-31');
      let feed = await oracleGetDaily(date, userId);
      
      const insightId = feed.insights[0].id;
      
      await oracleSetReadState(userId, insightId, true);
      
      feed = await oracleGetDaily(date, userId);
      const insight = feed.insights.find(i => i.id === insightId);
      
      expect(insight?.isRead).toBe(true);
    });
  });
  
  describe('Bulk Read State', () => {
    it('should set multiple read states', async () => {
      const date = new Date('2025-12-31');
      let feed = await oracleGetDaily(date, userId);
      
      const ids = ['today-takeaway', ...feed.insights.map(i => i.id)];
      
      const results = await oracleBulkSetReadState(userId, ids, true);
      
      expect(results.length).toBe(ids.length);
      results.forEach(r => {
        expect(r.isRead).toBe(true);
      });
      
      // Verify all are now read
      feed = await oracleGetDaily(date, userId);
      expect(feed.pinned.isRead).toBe(true);
      feed.insights.forEach(i => {
        expect(i.isRead).toBe(true);
      });
    });
  });
  
  describe('User Isolation', () => {
    it('should isolate read states between users', async () => {
      const date = new Date('2025-12-31');
      const user1 = 'user-1';
      const user2 = 'user-2';
      
      // User 1 marks as read
      await oracleSetReadState(user1, 'today-takeaway', true);
      
      // User 2 should still see as unread
      const feed1 = await oracleGetDaily(date, user1);
      const feed2 = await oracleGetDaily(date, user2);
      
      expect(feed1.pinned.isRead).toBe(true);
      expect(feed2.pinned.isRead).toBe(false);
    });
  });
});

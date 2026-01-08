/// <reference lib="webworker" />

/**
 * Service Worker Oracle Handler
 * Polls for daily feed and shows notifications
 * Per SW_SPEC.md
 */

import {
  type OracleDailyFeed,
  type SwNotificationData,
  DEDUPE_TTL,
} from './sw-contracts';
import { isDeduplicated, addDedupe } from './sw-storage';
import { shouldPoll, recordPollSuccess, recordPollFailure, handleRateLimit } from './sw-scheduler';

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const ENABLE_AUTH = import.meta.env.VITE_ENABLE_AUTH === 'true';

/**
 * Get today's date string (YYYY-MM-DD)
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get 6-hour bucket for new insights deduplication
 */
function get6HourBucket(): string {
  const now = new Date();
  const bucket = Math.floor(now.getHours() / 6);
  return `${getTodayDateString()}-${bucket}`;
}

/**
 * Poll for oracle daily feed
 */
export async function pollOracleDaily(accessToken: string | null): Promise<void> {
  if (!shouldPoll('oracle')) {
    return;
  }
  
  try {
    const url = `${API_BASE}/oracle/daily`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (ENABLE_AUTH && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await fetch(url, { headers, credentials: 'omit' });
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      handleRateLimit('oracle', retryAfter ? parseInt(retryAfter, 10) : undefined);
      return;
    }
    
    if (response.status === 401 || response.status === 403) {
      if (ENABLE_AUTH && accessToken) {
        throw new Error('AUTH_REQUIRED');
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json() as { data: OracleDailyFeed };
    const feed = data.data;
    
    // Check for unread takeaway
    if (!feed.pinned.isRead) {
      await showTakeawayNotification(feed);
    }
    
    // Check for new unread insights
    const unreadInsights = feed.insights.filter(i => !i.isRead);
    if (unreadInsights.length > 0) {
      await showNewInsightsNotification(unreadInsights.length);
    }
    
    recordPollSuccess('oracle');
    
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
      throw error;
    }
    console.error('[SW] Oracle poll failed:', error);
    recordPollFailure('oracle');
  }
}

/**
 * Show notification for daily takeaway
 */
async function showTakeawayNotification(feed: OracleDailyFeed): Promise<void> {
  const dedupeKey = `oracle:takeaway:${getTodayDateString()}`;
  
  const alreadyShown = await isDeduplicated(dedupeKey);
  if (alreadyShown) {
    return;
  }
  
  const data: SwNotificationData = {
    type: 'ORACLE',
    url: '/oracle',
    eventId: `takeaway-${getTodayDateString()}`,
    oracleId: 'today-takeaway',
  };
  
  if (typeof self !== 'undefined' && 'registration' in self) {
    await self.registration.showNotification("Today's Takeaway", {
      body: feed.pinned.title,
      icon: '/favicon.ico',
      tag: 'oracle-takeaway',
      data,
    });
  }
  
  await addDedupe(dedupeKey, data.eventId, DEDUPE_TTL.oracle);
}

/**
 * Show notification for new insights
 */
async function showNewInsightsNotification(count: number): Promise<void> {
  const dedupeKey = `oracle:new:${get6HourBucket()}`;
  
  const alreadyShown = await isDeduplicated(dedupeKey);
  if (alreadyShown) {
    return;
  }
  
  const data: SwNotificationData = {
    type: 'ORACLE',
    url: '/oracle',
    eventId: `new-insights-${get6HourBucket()}`,
  };
  
  if (typeof self !== 'undefined' && 'registration' in self) {
    await self.registration.showNotification('New Oracle Insights', {
      body: `${count} new insight${count > 1 ? 's' : ''} available`,
      icon: '/favicon.ico',
      tag: 'oracle-new',
      data,
    });
  }
  
  await addDedupe(dedupeKey, data.eventId, DEDUPE_TTL.oracle);
}

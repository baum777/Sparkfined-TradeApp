/// <reference lib="webworker" />

/**
 * Service Worker Alerts Handler
 * Polls for alert events and shows notifications
 * Per SW_SPEC.md
 */

import {
  type AlertEmitted,
  type SwNotificationData,
  DEDUPE_TTL,
} from './sw-contracts';
import { kvGet, kvSet, isDeduplicated, addDedupe } from './sw-storage';
import { shouldPoll, recordPollSuccess, recordPollFailure, handleRateLimit } from './sw-scheduler';

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const ALERTS_LAST_SINCE_KEY = 'alerts:lastSince';
const API_BASE = '/api';
const ENABLE_AUTH = import.meta.env.VITE_ENABLE_AUTH === 'true';

/**
 * Get notification title for alert event
 */
function getNotificationTitle(event: AlertEmitted): string {
  const symbol = event.symbolOrAddress.toUpperCase();
  
  switch (event.type) {
    case 'SIMPLE_TRIGGERED':
      return `Price Alert: ${symbol}`;
    case 'TWO_STAGE_CONFIRMED':
      return `Confirmed Signal: ${symbol}`;
    case 'DEAD_TOKEN_STAGE':
    case 'DEAD_TOKEN_SESSION_ENDED':
      {
        const stage = event.detail?.deadTokenStage || event.type;
        return `Dead Token: ${symbol} — ${stage}`;
      }
    default:
      return `Alert: ${symbol}`;
  }
}

/**
 * Get notification body for alert event
 */
function getNotificationBody(event: AlertEmitted): string {
  const parts: string[] = [event.timeframe];
  
  if (event.detail) {
    if (event.detail.kind === 'simple') {
      parts.push(`${event.detail.condition} ${event.detail.targetPrice}`);
    } else if (event.detail.kind === 'twoStage') {
      parts.push(`${event.detail.triggeredCount}/2 confirmed`);
    } else if (event.detail.kind === 'deadToken') {
      parts.push(`Stage: ${event.detail.deadTokenStage}`);
    }
  }
  
  return parts.join(' • ');
}

/**
 * Get dedupe key for alert event
 */
function getDedupeKey(event: AlertEmitted): string {
  return `alert:${event.eventId}`;
}

/**
 * Poll for alert events
 */
export async function pollAlertEvents(accessToken: string | null): Promise<void> {
  if (!shouldPoll('alerts')) {
    return;
  }
  
  try {
    // Get last since watermark
    const lastSince = await kvGet<string>(ALERTS_LAST_SINCE_KEY);
    const since = lastSince || new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    // Fetch events
    const url = `${API_BASE}/alerts/events?since=${encodeURIComponent(since)}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (ENABLE_AUTH && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await fetch(url, { headers, credentials: 'omit' });
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      handleRateLimit('alerts', retryAfter ? parseInt(retryAfter, 10) : undefined);
      return;
    }
    
    if (response.status === 401 || response.status === 403) {
      // Auth is intentionally disabled by default. Only treat 401/403 as "auth required"
      // if auth is enabled AND we attempted an authenticated call.
      if (ENABLE_AUTH && accessToken) {
        throw new Error('AUTH_REQUIRED');
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json() as { data: { items: AlertEmitted[] } };
    const events = data.data?.items || [];
    
    // Sort by occurredAt ascending
    events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    
    // Process events
    let maxOccurredAt = since;
    
    for (const event of events) {
      const dedupeKey = getDedupeKey(event);
      
      // Check dedupe
      const alreadyProcessed = await isDeduplicated(dedupeKey);
      if (alreadyProcessed) {
        continue;
      }
      
      // Show notification
      await showAlertNotification(event);
      
      // Record dedupe
      await addDedupe(dedupeKey, event.eventId, DEDUPE_TTL.alert);
      
      // Update watermark
      if (event.occurredAt > maxOccurredAt) {
        maxOccurredAt = event.occurredAt;
      }
    }
    
    // Save watermark
    await kvSet(ALERTS_LAST_SINCE_KEY, maxOccurredAt);
    
    recordPollSuccess('alerts');
    
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
      throw error;
    }
    console.error('[SW] Alert poll failed:', error);
    recordPollFailure('alerts');
  }
}

/**
 * Show notification for alert event
 */
async function showAlertNotification(event: AlertEmitted): Promise<void> {
  // Skip progress events (optional notification)
  if (event.type === 'TWO_STAGE_PROGRESS') {
    return;
  }
  
  const title = getNotificationTitle(event);
  const body = getNotificationBody(event);
  
  const data: SwNotificationData = {
    type: 'ALERT',
    url: '/alerts',
    eventId: event.eventId,
    alertId: event.alertId,
  };
  
  // Use self.registration in service worker context
  if (typeof self !== 'undefined' && 'registration' in self) {
    await self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: `alert-${event.alertId}`,
      data,
      requireInteraction: event.type === 'TWO_STAGE_CONFIRMED',
    });
  }
}

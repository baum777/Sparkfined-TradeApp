/// <reference lib="webworker" />

/**
 * Service Worker Entry Point
 * Per SW_SPEC.md
 */

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { initSwStorage, cleanupDedupe } from './sw-storage';
import { pollAlertEvents } from './sw-alerts';
import { pollOracleDaily } from './sw-oracle';
import type { SwMessage, SwNotificationData, SwStatusMessage } from './sw-contracts';

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const ENABLE_AUTH = import.meta.env.VITE_ENABLE_AUTH === 'true';

// Current access token (received from UI)
let accessToken: string | null = null;

// Auth required flag
let authRequired = false;

/**
 * Install event
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    initSwStorage().then(() => {
      console.log('[SW] Storage initialized');
      return self.skipWaiting();
    })
  );
});

/**
 * Activate event
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      cleanupDedupe(),
    ]).then(() => {
      console.log('[SW] Activated and cleaned up');
    })
  );
});

/**
 * Message event - handle messages from UI
 */
self.addEventListener('message', (event) => {
  const message = event.data as SwMessage;
  
  switch (message.type) {
    case 'SW_AUTH_UPDATE':
      accessToken = message.accessToken;
      authRequired = false;
      console.log('[SW] Auth token updated');
      break;
      
    case 'SW_TICK':
      // Trigger polling
      handleTick();
      break;
  }
});

/**
 * Handle tick - poll for updates
 */
async function handleTick(): Promise<void> {
  if (ENABLE_AUTH && authRequired) {
    sendStatus('authRequired');
    return;
  }
  
  try {
    await Promise.all([
      pollAlertEvents(accessToken).catch((err) => {
        if (ENABLE_AUTH && err.message === 'AUTH_REQUIRED') {
          authRequired = true;
          sendStatus('authRequired');
          return;
        }
        // When auth is disabled, treat unexpected 401/403 as standard error state.
        sendStatus('error', err instanceof Error ? err.message : 'Unknown error');
      }),
      pollOracleDaily(accessToken).catch((err) => {
        if (ENABLE_AUTH && err.message === 'AUTH_REQUIRED') {
          authRequired = true;
          sendStatus('authRequired');
          return;
        }
        sendStatus('error', err instanceof Error ? err.message : 'Unknown error');
      }),
    ]);
    
    // Cleanup old dedupe entries periodically
    await cleanupDedupe();
    
  } catch (error) {
    console.error('[SW] Tick failed:', error);
    sendStatus('error', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Send status message to all clients
 */
async function sendStatus(
  status: 'ready' | 'authRequired' | 'error',
  error?: string
): Promise<void> {
  const clients = await self.clients.matchAll();
  const message: SwStatusMessage = {
    type: 'SW_STATUS',
    status,
    error,
  };
  
  for (const client of clients) {
    client.postMessage(message);
  }
}

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  const data = event.notification.data as SwNotificationData | undefined;
  const url = data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE', url });
            return;
          }
        }
        // Open new window
        return self.clients.openWindow(url);
      })
  );
});

/**
 * Push event (for future push notifications)
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  // BACKEND_TODO: Handle push notifications when push service is implemented
  const data = event.data?.json();
  
  if (data) {
    event.waitUntil(
      self.registration.showNotification(data.title || 'Notification', {
        body: data.body || '',
        icon: '/favicon.ico',
        data: data.data,
      })
    );
  }
});

// Export for type checking (not used at runtime)
export {};

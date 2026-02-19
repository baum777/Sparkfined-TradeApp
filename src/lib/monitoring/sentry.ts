/**
 * Sentry Error Tracking
 * 
 * Initializes Sentry and provides error capture utilities.
 * Gracefully handles missing DSN (no-op in dev/test).
 */

import * as Sentry from '@sentry/react';

let isInitialized = false;

/**
 * Initialize Sentry with DSN from environment variable.
 * If DSN is not set, Sentry is not initialized (no-op).
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] DSN not configured, error tracking disabled');
    }
    return;
  }

  if (isInitialized) {
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      replaysOnErrorSampleRate: 1.0,
      beforeSend(event, hint) {
        // Filter out known non-critical errors
        const error = hint.originalException;
        if (error instanceof Error) {
          // Ignore network errors that are expected (e.g., user offline)
          if (error.message.includes('fetch failed') && !navigator.onLine) {
            return null;
          }
        }
        return event;
      },
    });

    // Set initial tags
    Sentry.setTag('feature.research_embed_terminal', import.meta.env.VITE_RESEARCH_EMBED_TERMINAL === 'true');

    isInitialized = true;

    if (import.meta.env.DEV) {
      console.info('[Sentry] Initialized successfully');
    }
  } catch (error) {
    console.error('[Sentry] Initialization failed:', error);
  }
}

/**
 * Capture an exception to Sentry.
 * If Sentry is not initialized, this is a no-op.
 */
export function captureException(
  error: Error,
  context?: {
    contexts?: Record<string, unknown>;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) {
  if (!isInitialized) {
    return;
  }

  try {
    Sentry.captureException(error, {
      ...(context?.contexts && { contexts: context.contexts as any }),
      ...(context?.tags && { tags: context.tags }),
      ...(context?.extra && { extra: context.extra as any }),
    });
  } catch (err) {
    // Silently fail if Sentry capture fails
    console.error('[Sentry] Failed to capture exception:', err);
  }
}

/**
 * Set user context (wallet address, etc.)
 * Safe to call even if Sentry is not initialized.
 */
export function setUserContext(user: { walletAddress?: string; walletName?: string }) {
  if (!isInitialized) {
    return;
  }

  try {
    Sentry.setUser({
      id: user.walletAddress,
      username: user.walletName,
    });
  } catch (error) {
    console.error('[Sentry] Failed to set user context:', error);
  }
}

/**
 * Set additional context (route, feature flags, etc.)
 */
export function setContext(key: string, context: Record<string, unknown>) {
  if (!isInitialized) {
    return;
  }

  try {
    Sentry.setContext(key, context);
  } catch (error) {
    console.error('[Sentry] Failed to set context:', error);
  }
}

/**
 * Update route tag when navigation occurs
 */
export function setRoute(route: string) {
  if (!isInitialized) {
    return;
  }

  try {
    Sentry.setTag('route', route);
  } catch (error) {
    console.error('[Sentry] Failed to set route:', error);
  }
}


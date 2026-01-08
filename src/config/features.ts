/**
 * Feature flags / build-time toggles.
 *
 * Auth is intentionally disabled for the current milestone.
 * Flip with: VITE_ENABLE_AUTH="true"
 */
export const ENABLE_AUTH: boolean = import.meta.env.VITE_ENABLE_AUTH === 'true';


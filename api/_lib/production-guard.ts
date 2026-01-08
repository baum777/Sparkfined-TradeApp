import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Blocks core product endpoints in production when hit via Vercel Functions.
 * Canonical implementations live in the Node backend; this guard prevents drift.
 */
const CORE_BLOCKLIST = [
  /^\/api\/alerts(\/|$)/,
  /^\/api\/journal(\/|$)/,
  /^\/api\/oracle(\/|$)/,
  /^\/api\/grok-pulse(\/|$)/,
  /^\/api\/reasoning(\/|$)/,
  /^\/api\/chart(\/|$)/,
  /^\/api\/usage(\/|$)/,
  /^\/api\/profile(\/|$)/,
  /^\/api\/meta(\/|$)/,
  /^\/api\/health(\/|$)/,
];

const AUX_ALLOWLIST = [
  /^\/api\/wallet\/webhook(\/|$)/,
  /^\/api\/alerts\/push(\/|$)/,
  /^\/api\/alerts\/stream\/?$/,
  /^\/api\/cron(\/|$)/, // transitional: cron endpoints will be migrated to backend
];

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isAllowedPath(pathname: string): boolean {
  return AUX_ALLOWLIST.some((pattern) => pattern.test(pathname));
}

function isBlockedPath(pathname: string): boolean {
  return CORE_BLOCKLIST.some((pattern) => pattern.test(pathname));
}

export function maybeBlockInProduction(req: VercelRequest, res: VercelResponse): boolean {
  if (!isProd()) return false;

  const pathname = (req.url || '').split('?')[0] || '/';

  if (isAllowedPath(pathname)) {
    return false;
  }

  if (!isBlockedPath(pathname)) {
    return false;
  }

  res.status(410).json({
    ok: false,
    error: {
      code: 'NON_CANONICAL_ENDPOINT',
      message: 'This /api route is disabled in production. Use the canonical Node backend.',
      path: pathname,
    },
  });

  return true;
}


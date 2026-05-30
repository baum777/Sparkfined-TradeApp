import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app.js';
import { resetEnvCache } from '../../src/config/env.js';
import { getConfig, resetConfigCache } from '../../src/config/config.js';
import { applyServerSecurity } from '../../src/http/serverSecurity.js';

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function parseCookieMap(setCookie: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of setCookie) {
    const first = entry.split(';')[0] || '';
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    out[first.slice(0, eq)] = decodeURIComponent(first.slice(eq + 1));
  }
  return out;
}

function toCookieHeader(cookieMap: Record<string, string>): string {
  return Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
}

describe('Auth + Security (Phase 1)', () => {
  let server: Server;
  let baseUrl: string;
  let listenBlocked = false;

  beforeAll(async () => {
    process.env.SERVICE_MODE = 'full';
    process.env.BACKEND_CORS_ORIGINS = 'https://allowed.example';
    process.env.JWT_SECRET = 'test-secret-which-is-long-enough-for-phase1';
    resetEnvCache();
    resetConfigCache();

    const app = createApp();
    const config = getConfig();
    server = createServer((req, res) => {
      if (applyServerSecurity(req, res, config)) return;
      app.handle(req, res);
    });

    try {
      await new Promise<void>((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => resolve());
        server.once('error', reject);
      });
    } catch (error: any) {
      if (error?.code === 'EPERM') {
        listenBlocked = true;
        return;
      }
      throw error;
    }

    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    if (listenBlocked) return;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('rejects duplicate registration with 409', async () => {
    if (listenBlocked) return;
    const payload = {
      email: 'security-dup@example.com',
      password: 'CorrectHorseBatteryStaple!42',
    };

    const first = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(200);

    const second = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const secondBody = await readJson(second);

    expect(second.status).toBe(409);
    expect(secondBody).toHaveProperty('error.code');
  });

  it('rejects wrong password with 401', async () => {
    if (listenBlocked) return;
    const email = 'security-login@example.com';
    const password = 'CorrectHorseBatteryStaple!43';

    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(register.status).toBe(200);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'definitely-wrong' }),
    });
    const loginBody = await readJson(login);

    expect(login.status).toBe(401);
    expect(loginBody).toHaveProperty('error.code', 'UNAUTHENTICATED');
  });

  it('supports register, cookie session read, refresh, and logout', async () => {
    if (listenBlocked) return;
    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'security-full-flow@example.com',
        username: 'security-full-flow',
        password: 'CorrectHorseBatteryStaple!46',
      }),
    });
    const registerBody = await readJson(register);
    const registerCookies = (
      register.headers as unknown as { getSetCookie?: () => string[] }
    ).getSetCookie?.() || [];
    const registerCookieMap = parseCookieMap(registerCookies);

    expect(register.status).toBe(200);
    expect(registerBody).toHaveProperty('data.user.email', 'security-full-flow@example.com');
    expect(registerBody).toHaveProperty('data.tokens.accessToken');
    expect(registerCookieMap).toHaveProperty('access_token');
    expect(registerCookieMap).toHaveProperty('refresh_token');
    expect(registerCookieMap).toHaveProperty('csrf_token');

    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: toCookieHeader(registerCookieMap) },
    });
    const meBody = await readJson(me);

    expect(me.status).toBe(200);
    expect(meBody).toHaveProperty('data.email', 'security-full-flow@example.com');

    const refresh = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: toCookieHeader(registerCookieMap),
        'x-csrf-token': registerCookieMap.csrf_token || '',
      },
      body: JSON.stringify({}),
    });
    const refreshBody = await readJson(refresh);
    const refreshCookies = (
      refresh.headers as unknown as { getSetCookie?: () => string[] }
    ).getSetCookie?.() || [];
    const refreshCookieMap = parseCookieMap(refreshCookies);

    expect(refresh.status).toBe(200);
    expect(refreshBody).toHaveProperty('data.tokens.accessToken');
    expect(refreshCookieMap).toHaveProperty('access_token');
    expect(refreshCookieMap).toHaveProperty('refresh_token');
    expect(refreshCookieMap).toHaveProperty('csrf_token');

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: toCookieHeader(refreshCookieMap),
        'x-csrf-token': refreshCookieMap.csrf_token || '',
      },
    });
    const logoutBody = await readJson(logout);
    const clearCookies = (
      logout.headers as unknown as { getSetCookie?: () => string[] }
    ).getSetCookie?.() || [];

    expect(logout.status).toBe(200);
    expect(logoutBody).toHaveProperty('data.ok', true);
    expect(clearCookies.some((cookie) => cookie.startsWith('access_token=') && cookie.includes('Max-Age=0'))).toBe(true);
    expect(clearCookies.some((cookie) => cookie.startsWith('refresh_token=') && cookie.includes('Max-Age=0'))).toBe(true);
    expect(clearCookies.some((cookie) => cookie.startsWith('csrf_token=') && cookie.includes('Max-Age=0'))).toBe(true);
  });

  it('enforces CSRF for cookie-authenticated state-changing requests', async () => {
    if (listenBlocked) return;
    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'security-csrf@example.com',
        password: 'CorrectHorseBatteryStaple!44',
      }),
    });
    const setCookie = (
      register.headers as unknown as { getSetCookie?: () => string[] }
    ).getSetCookie?.() || [];
    expect(setCookie.length).toBeGreaterThan(0);

    const cookieMap = parseCookieMap(setCookie);
    const cookieHeader = toCookieHeader(cookieMap);

    const missingCsrf = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieHeader },
    });
    expect(missingCsrf.status).toBe(403);

    const ok = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        'x-csrf-token': cookieMap.csrf_token || '',
      },
    });
    expect(ok.status).toBe(200);
  });

  it('does not require CSRF for bearer-authenticated requests', async () => {
    if (listenBlocked) return;
    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'security-bearer@example.com',
        password: 'CorrectHorseBatteryStaple!45',
      }),
    });
    const registerBody = await readJson(register);
    const accessToken = registerBody?.data?.tokens?.accessToken;
    expect(typeof accessToken).toBe('string');

    const create = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'auth-security-bearer-no-csrf',
      },
      body: JSON.stringify({ summary: 'bearer auth no csrf' }),
    });

    expect(create.status).toBe(201);
  });

  it('applies CORS allowlist for preflight requests', async () => {
    if (listenBlocked) return;
    const allowed = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://allowed.example',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://allowed.example');

    const denied = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://blocked.example',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(denied.status).toBe(403);
  });
});

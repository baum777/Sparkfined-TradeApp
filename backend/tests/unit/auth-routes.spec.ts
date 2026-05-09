import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ParsedRequest } from '../../src/http/router.js';
import { getDatabase } from '../../src/db/index.js';
import { logger } from '../../src/observability/logger.js';
import {
  handleAuthLogin,
  handleAuthRefresh,
  handleAuthRegister,
} from '../../src/routes/auth.js';

type MockResponse = {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string;
  setHeader: (name: string, value: string | string[]) => void;
  writeHead: (status: number, headers?: Record<string, string>) => void;
  end: (chunk?: string) => void;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(status, headers) {
      this.statusCode = status;
      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          this.headers[key] = value;
        }
      }
    },
    end(chunk) {
      this.body = chunk || '';
    },
  };
}

function baseReq(overrides: Partial<ParsedRequest>): ParsedRequest {
  return {
    method: 'POST',
    path: '/api/auth/register',
    params: {},
    query: {},
    body: {},
    headers: {},
    userId: 'anon',
    authSource: 'none',
    ...overrides,
  };
}

function parseSetCookie(headers: Record<string, string | string[]>): string[] {
  const value = headers['Set-Cookie'];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Auth routes (security)', () => {
  it('register hashes password and persists user', async () => {
    const req = baseReq({
      body: {
        email: 'routes-auth-1@example.com',
        password: 'CorrectHorseBatteryStaple!99',
      },
    });
    const res = createMockResponse();

    await handleAuthRegister(req, res as any);

    expect(res.statusCode).toBe(200);
    const cookies = parseSetCookie(res.headers);
    expect(cookies.some(c => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some(c => c.startsWith('refresh_token='))).toBe(true);
    expect(cookies.some(c => c.startsWith('csrf_token='))).toBe(true);

    const db = getDatabase();
    const row = await db
      .prepare(`SELECT password_hash FROM auth_users_v1 WHERE email = ?`)
      .get<{ password_hash: string }>('routes-auth-1@example.com');

    expect(row).toBeTruthy();
    expect(row?.password_hash).not.toBe('CorrectHorseBatteryStaple!99');
    expect(row?.password_hash.startsWith('$2')).toBe(true);
  });

  it('register rejects duplicate email with 409', async () => {
    const req = baseReq({
      body: {
        email: 'routes-auth-dup@example.com',
        password: 'CorrectHorseBatteryStaple!100',
      },
    });
    const res1 = createMockResponse();
    const res2 = createMockResponse();

    await handleAuthRegister(req, res1 as any);
    await expect(handleAuthRegister(req, res2 as any)).rejects.toMatchObject({ status: 409 });
  });

  it('login rejects wrong password', async () => {
    const registerReq = baseReq({
      body: {
        email: 'routes-auth-login@example.com',
        password: 'CorrectHorseBatteryStaple!101',
      },
    });
    await handleAuthRegister(registerReq, createMockResponse() as any);

    const loginReq = baseReq({
      path: '/api/auth/login',
      body: {
        email: 'routes-auth-login@example.com',
        password: 'definitely-wrong',
      },
    });

    await expect(handleAuthLogin(loginReq, createMockResponse() as any)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('emits failed_login security signal for wrong password attempts', async () => {
    const email = 'routes-auth-signal@example.com';
    const registerReq = baseReq({
      body: {
        email,
        password: 'CorrectHorseBatteryStaple!103',
      },
    });
    await handleAuthRegister(registerReq, createMockResponse() as any);

    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const loginReq = baseReq({
      path: '/api/auth/login',
      headers: {
        'x-forwarded-for': '198.51.100.77',
        'user-agent': 'vitest-auth-signal',
      },
      body: {
        email,
        password: 'definitely-wrong',
      },
    });

    await expect(handleAuthLogin(loginReq, createMockResponse() as any)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });

    expect(warnSpy).toHaveBeenCalled();
    const signalCall = warnSpy.mock.calls.find((call) => call[0] === 'security.signal');
    expect(signalCall).toBeTruthy();
    const payload = (signalCall?.[1] ?? {}) as Record<string, unknown>;
    expect(payload.signalType).toBe('failed_login');
    expect(payload.reason).toBe('wrong_password');
    expect(payload.emailHash).toBeDefined();
    expect(String(payload.emailHash)).not.toContain(email);
  });

  it('refresh rejects missing CSRF when refresh cookie is used', async () => {
    const registerReq = baseReq({
      body: {
        email: 'routes-auth-refresh@example.com',
        password: 'CorrectHorseBatteryStaple!102',
      },
    });
    const registerRes = createMockResponse();
    await handleAuthRegister(registerReq, registerRes as any);

    const cookieHeader = parseSetCookie(registerRes.headers)
      .map(cookie => cookie.split(';')[0])
      .join('; ');

    const refreshReq = baseReq({
      path: '/api/auth/refresh',
      headers: {
        cookie: cookieHeader,
      },
    });

    await expect(handleAuthRefresh(refreshReq, createMockResponse() as any)).rejects.toMatchObject({
      status: 403,
      code: 'CSRF_INVALID',
    });
  });
});

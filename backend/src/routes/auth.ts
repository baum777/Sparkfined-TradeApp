import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson } from '../http/response.js';
import { badRequest, unauthorized, ErrorCodes } from '../http/error.js';
import { getEnv } from '../config/env.js';
import { signToken, verifyToken } from '../lib/auth/jwt.js';

type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: 'user';
  preferences: {
    theme: 'dark';
    language: 'en' | 'de';
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      alerts: boolean;
    };
    trading: {
      defaultStrategy: string;
      defaultPositionSize: number;
      riskPerTrade: number;
    };
  };
  createdAt: string;
  lastLoginAt: string;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type AuthResponse = {
  user: AuthUser;
  tokens: AuthTokens;
};

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

function defaultPreferences() {
  return {
    theme: 'dark' as const,
    language: 'en' as const,
    timezone: 'UTC',
    notifications: {
      email: true,
      push: true,
      alerts: true,
    },
    trading: {
      defaultStrategy: 'default',
      defaultPositionSize: 1,
      riskPerTrade: 1,
    },
  };
}

function buildUser(params: { id: string; email: string; username: string }): AuthUser {
  const now = new Date().toISOString();
  return {
    id: params.id,
    email: params.email,
    username: params.username,
    role: 'user',
    preferences: defaultPreferences(),
    createdAt: now,
    lastLoginAt: now,
  };
}

function buildCookie(
  name: string,
  value: string,
  options: { maxAgeSeconds: number; httpOnly: boolean; secure: boolean }
): string {
  const base = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Strict; Max-Age=${options.maxAgeSeconds}`;
  const httpOnly = options.httpOnly ? '; HttpOnly' : '';
  const secure = options.secure ? '; Secure' : '';
  return `${base}${httpOnly}${secure}`;
}

function clearCookie(name: string, secure: boolean): string {
  return `${name}=; Path=/; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}; HttpOnly`;
}

function setAuthCookies(res: ServerResponse, tokens: AuthTokens, secure: boolean): void {
  res.setHeader('Set-Cookie', [
    buildCookie('access_token', tokens.accessToken, {
      maxAgeSeconds: tokens.expiresIn,
      httpOnly: true,
      secure,
    }),
    buildCookie('refresh_token', tokens.refreshToken, {
      maxAgeSeconds: REFRESH_TTL_SECONDS,
      httpOnly: true,
      secure,
    }),
  ]);
}

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  const entries = header.split(';').map(part => part.trim());
  const out: Record<string, string> = {};
  for (const entry of entries) {
    const [key, ...rest] = entry.split('=');
    if (!key) continue;
    out[key] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function buildTokens(payload: { userId: string; tier?: string }): AuthTokens {
  const accessToken = signToken(payload, `${ACCESS_TTL_SECONDS}s`);
  const refreshToken = signToken(payload, `${REFRESH_TTL_SECONDS}s`);
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

export async function handleAuthRegister(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as { email?: string; username?: string; password?: string };
  if (!body?.email || !body?.password) {
    throw badRequest('Email and password are required');
  }
  const username = body.username || body.email.split('@')[0] || 'user';
  const user = buildUser({ id: `user-${username}`, email: body.email, username });
  const tokens = buildTokens({ userId: user.id, tier: 'free' });

  const secure = getEnv().NODE_ENV === 'production';
  setAuthCookies(res, tokens, secure);
  sendJson(res, { user, tokens } satisfies AuthResponse);
}

export async function handleAuthLogin(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as { email?: string; password?: string };
  if (!body?.email || !body?.password) {
    throw badRequest('Email and password are required');
  }
  const username = body.email.split('@')[0] || 'user';
  const user = buildUser({ id: `user-${username}`, email: body.email, username });
  const tokens = buildTokens({ userId: user.id, tier: 'free' });

  const secure = getEnv().NODE_ENV === 'production';
  setAuthCookies(res, tokens, secure);
  sendJson(res, { user, tokens } satisfies AuthResponse);
}

export async function handleAuthRefresh(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const body = (req.body as { refreshToken?: string }) || {};
  const refreshToken = cookies.refresh_token || body.refreshToken;

  if (!refreshToken) {
    throw unauthorized('Missing refresh token', ErrorCodes.UNAUTHENTICATED);
  }

  const verified = verifyToken(refreshToken);
  if (!verified) {
    throw unauthorized('Invalid refresh token', ErrorCodes.UNAUTHENTICATED);
  }

  const tokens = buildTokens({ userId: verified.userId, tier: verified.tier });
  const secure = getEnv().NODE_ENV === 'production';
  setAuthCookies(res, tokens, secure);
  sendJson(res, { tokens } as AuthResponse);
}

export async function handleAuthLogout(_req: ParsedRequest, res: ServerResponse): Promise<void> {
  const secure = getEnv().NODE_ENV === 'production';
  res.setHeader('Set-Cookie', [
    clearCookie('access_token', secure),
    clearCookie('refresh_token', secure),
  ]);
  sendJson(res, { ok: true });
}

export async function handleAuthMe(req: ParsedRequest, res: ServerResponse): Promise<void> {
  if (req.userId === 'anon') {
    throw unauthorized('Unauthenticated', ErrorCodes.UNAUTHENTICATED);
  }
  const user = buildUser({
    id: req.userId,
    email: `${req.userId}@example.local`,
    username: req.userId,
  });
  sendJson(res, user);
}


import { randomBytes } from 'crypto';
import type { ServerResponse } from 'http';
import bcrypt from 'bcryptjs';
import type { ParsedRequest } from '../http/router.js';
import { sendJson } from '../http/response.js';
import { AppError, badRequest, ErrorCodes, unauthorized } from '../http/error.js';
import { getEnv } from '../config/env.js';
import { signToken, verifyToken } from '../lib/auth/jwt.js';
import {
  createAuthUser,
  findAuthUserByEmail,
  findAuthUserById,
  touchAuthUserLastLogin,
} from '../domain/auth/repo.js';

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
const BCRYPT_SALT_ROUNDS = 12;

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

function buildUser(params: {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  lastLoginAt: string;
}): AuthUser {
  return {
    id: params.id,
    email: params.email,
    username: params.username,
    role: 'user',
    preferences: defaultPreferences(),
    createdAt: params.createdAt,
    lastLoginAt: params.lastLoginAt,
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

function clearCookie(name: string, secure: boolean, httpOnly: boolean): string {
  const securePart = secure ? '; Secure' : '';
  const httpOnlyPart = httpOnly ? '; HttpOnly' : '';
  return `${name}=; Path=/; SameSite=Strict; Max-Age=0${securePart}${httpOnlyPart}`;
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

function deriveUsername(email: string, explicit?: string): string {
  const fallback = email.split('@')[0] || 'user';
  const source = (explicit || fallback).trim();
  const normalized = source.replace(/[^a-zA-Z0-9_.-]/g, '');
  return normalized || 'user';
}

function buildTokens(payload: { userId: string; tier?: string }): AuthTokens {
  const accessToken = signToken(payload, `${ACCESS_TTL_SECONDS}s`);
  const refreshToken = signToken(payload, `${REFRESH_TTL_SECONDS}s`);
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

function setAuthCookies(res: ServerResponse, tokens: AuthTokens, secure: boolean, csrfToken: string): void {
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
    buildCookie('csrf_token', csrfToken, {
      maxAgeSeconds: REFRESH_TTL_SECONDS,
      httpOnly: false,
      secure,
    }),
  ]);
}

function validateCsrfFromCookies(req: ParsedRequest): void {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies.csrf_token;
  const headerTokenRaw = req.headers['x-csrf-token'];
  const headerToken = Array.isArray(headerTokenRaw) ? headerTokenRaw[0] : headerTokenRaw;
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new AppError('Invalid CSRF token', 403, ErrorCodes.CSRF_INVALID);
  }
}

function isUniqueEmailViolation(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes('idx_auth_users_v1_email') ||
    message.includes('auth_users_v1.email') ||
    message.includes('duplicate key value violates unique constraint')
  );
}

export async function handleAuthRegister(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as { email?: string; username?: string; password?: string };
  if (!body?.email || !body?.password) {
    throw badRequest('Email and password are required');
  }

  const normalizedEmail = body.email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw badRequest('Email is invalid');
  }
  if (body.password.length < 12) {
    throw badRequest('Password must be at least 12 characters');
  }

  const username = deriveUsername(normalizedEmail, body.username);
  const passwordHash = await bcrypt.hash(body.password, BCRYPT_SALT_ROUNDS);

  let created;
  try {
    created = await createAuthUser({
      email: normalizedEmail,
      username,
      passwordHash,
    });
  } catch (error) {
    if (isUniqueEmailViolation(error)) {
      throw new AppError('Email already registered', 409, ErrorCodes.VALIDATION_FAILED);
    }
    throw error;
  }

  const user = buildUser({
    id: created.id,
    email: created.email,
    username: created.username,
    createdAt: created.created_at,
    lastLoginAt: created.last_login_at,
  });
  const tokens = buildTokens({ userId: user.id, tier: 'free' });

  const secure = getEnv().NODE_ENV === 'production';
  setAuthCookies(res, tokens, secure, generateCsrfToken());
  sendJson(res, { user, tokens } satisfies AuthResponse);
}

export async function handleAuthLogin(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = req.body as { email?: string; password?: string };
  if (!body?.email || !body?.password) {
    throw badRequest('Email and password are required');
  }

  const userRecord = await findAuthUserByEmail(body.email);
  if (!userRecord) {
    throw unauthorized('Invalid credentials', ErrorCodes.UNAUTHENTICATED);
  }

  const matches = await bcrypt.compare(body.password, userRecord.password_hash);
  if (!matches) {
    throw unauthorized('Invalid credentials', ErrorCodes.UNAUTHENTICATED);
  }

  await touchAuthUserLastLogin(userRecord.id);
  const latestUser = (await findAuthUserById(userRecord.id)) || userRecord;
  const user = buildUser({
    id: latestUser.id,
    email: latestUser.email,
    username: latestUser.username,
    createdAt: latestUser.created_at,
    lastLoginAt: latestUser.last_login_at,
  });
  const tokens = buildTokens({ userId: user.id, tier: 'free' });

  const secure = getEnv().NODE_ENV === 'production';
  setAuthCookies(res, tokens, secure, generateCsrfToken());
  sendJson(res, { user, tokens } satisfies AuthResponse);
}

export async function handleAuthRefresh(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const body = (req.body as { refreshToken?: string }) || {};
  const refreshToken = cookies.refresh_token || body.refreshToken;

  if (!refreshToken) {
    throw unauthorized('Missing refresh token', ErrorCodes.UNAUTHENTICATED);
  }

  if (cookies.refresh_token) {
    validateCsrfFromCookies(req);
  }

  const verified = verifyToken(refreshToken);
  if (!verified) {
    throw unauthorized('Invalid refresh token', ErrorCodes.UNAUTHENTICATED);
  }

  const tokens = buildTokens({ userId: verified.userId, tier: verified.tier });
  const secure = getEnv().NODE_ENV === 'production';
  setAuthCookies(res, tokens, secure, generateCsrfToken());
  sendJson(res, { tokens } as AuthResponse);
}

export async function handleAuthLogout(_req: ParsedRequest, res: ServerResponse): Promise<void> {
  const secure = getEnv().NODE_ENV === 'production';
  res.setHeader('Set-Cookie', [
    clearCookie('access_token', secure, true),
    clearCookie('refresh_token', secure, true),
    clearCookie('csrf_token', secure, false),
  ]);
  sendJson(res, { ok: true });
}

export async function handleAuthMe(req: ParsedRequest, res: ServerResponse): Promise<void> {
  if (req.userId === 'anon') {
    throw unauthorized('Unauthenticated', ErrorCodes.UNAUTHENTICATED);
  }
  const userRecord = await findAuthUserById(req.userId);
  if (!userRecord) {
    throw unauthorized('Unauthenticated', ErrorCodes.UNAUTHENTICATED);
  }

  sendJson(
    res,
    buildUser({
      id: userRecord.id,
      email: userRecord.email,
      username: userRecord.username,
      createdAt: userRecord.created_at,
      lastLoginAt: userRecord.last_login_at,
    })
  );
}

import { createHash } from 'crypto';
import { logger } from './logger.js';

type FailedLoginReason = 'unknown_email' | 'wrong_password';

type FailedLoginSignal = {
  signalType: 'failed_login';
  reason: FailedLoginReason;
  emailHash?: string;
  ipHash?: string;
  userAgent?: string;
};

type RateLimitHitSignal = {
  signalType: 'rate_limit_hit';
  scope: string;
  path?: string;
  actorHash?: string;
  count: number;
  limit: number;
  retryAfterSeconds?: number;
};

type SecuritySignal = FailedLoginSignal | RateLimitHitSignal;

const USER_AGENT_MAX = 256;

export function hashForSecurityTelemetry(value?: string | null): string | undefined {
  const source = typeof value === 'string' ? value.trim() : '';
  if (!source) return undefined;
  return createHash('sha256').update(source).digest('hex').slice(0, 16);
}

function cleanUserAgent(userAgent?: string): string | undefined {
  if (!userAgent) return undefined;
  const trimmed = userAgent.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= USER_AGENT_MAX) return trimmed;
  return trimmed.slice(0, USER_AGENT_MAX);
}

function emitSecuritySignal(signal: SecuritySignal): void {
  logger.warn('security.signal', signal as unknown as Record<string, unknown>);
}

export function emitFailedLoginSignal(input: {
  reason: FailedLoginReason;
  email?: string;
  ip?: string;
  userAgent?: string;
}): void {
  emitSecuritySignal({
    signalType: 'failed_login',
    reason: input.reason,
    emailHash: hashForSecurityTelemetry(input.email),
    ipHash: hashForSecurityTelemetry(input.ip),
    userAgent: cleanUserAgent(input.userAgent),
  });
}

export function emitRateLimitHitSignal(input: {
  scope: string;
  path?: string;
  actorId?: string;
  count: number;
  limit: number;
  retryAfterSeconds?: number;
}): void {
  emitSecuritySignal({
    signalType: 'rate_limit_hit',
    scope: input.scope,
    path: input.path,
    actorHash: hashForSecurityTelemetry(input.actorId),
    count: input.count,
    limit: input.limit,
    retryAfterSeconds: input.retryAfterSeconds,
  });
}

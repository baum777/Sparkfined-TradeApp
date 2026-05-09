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

type SuspiciousActivitySignal = {
  signalType: 'suspicious_activity';
  detector: 'failed_login_burst';
  basis: 'email' | 'ip';
  actorHash: string;
  observedCount: number;
  threshold: number;
  windowMs: number;
};

type SecuritySignal = FailedLoginSignal | RateLimitHitSignal | SuspiciousActivitySignal;

const USER_AGENT_MAX = 256;
const FAILED_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const FAILED_LOGIN_BURST_THRESHOLD = 5;
const MAX_BURST_ENTRIES = 10_000;

type FailedLoginBurstEntry = {
  count: number;
  windowStartedAt: number;
  alerted: boolean;
};

const failedLoginBursts = new Map<string, FailedLoginBurstEntry>();

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

function nextBurstEntry(now: number, existing?: FailedLoginBurstEntry): FailedLoginBurstEntry {
  if (!existing) {
    return { count: 1, windowStartedAt: now, alerted: false };
  }
  if (now - existing.windowStartedAt > FAILED_LOGIN_WINDOW_MS) {
    return { count: 1, windowStartedAt: now, alerted: false };
  }
  return { ...existing, count: existing.count + 1 };
}

function pruneFailedLoginBursts(now: number): void {
  if (failedLoginBursts.size <= MAX_BURST_ENTRIES) return;
  for (const [key, entry] of failedLoginBursts.entries()) {
    if (now - entry.windowStartedAt > FAILED_LOGIN_WINDOW_MS) {
      failedLoginBursts.delete(key);
    }
  }
}

function trackFailedLoginBurst(input: { emailHash?: string; ipHash?: string }): void {
  const now = Date.now();
  pruneFailedLoginBursts(now);

  const keys: Array<{ basis: 'email' | 'ip'; actorHash: string }> = [];
  if (input.emailHash) keys.push({ basis: 'email', actorHash: input.emailHash });
  if (input.ipHash) keys.push({ basis: 'ip', actorHash: input.ipHash });

  for (const item of keys) {
    const key = `${item.basis}:${item.actorHash}`;
    const entry = nextBurstEntry(now, failedLoginBursts.get(key));
    failedLoginBursts.set(key, entry);

    if (!entry.alerted && entry.count >= FAILED_LOGIN_BURST_THRESHOLD) {
      entry.alerted = true;
      emitSecuritySignal({
        signalType: 'suspicious_activity',
        detector: 'failed_login_burst',
        basis: item.basis,
        actorHash: item.actorHash,
        observedCount: entry.count,
        threshold: FAILED_LOGIN_BURST_THRESHOLD,
        windowMs: FAILED_LOGIN_WINDOW_MS,
      });
    }
  }
}

export function emitFailedLoginSignal(input: {
  reason: FailedLoginReason;
  email?: string;
  ip?: string;
  userAgent?: string;
}): void {
  const emailHash = hashForSecurityTelemetry(input.email);
  const ipHash = hashForSecurityTelemetry(input.ip);
  emitSecuritySignal({
    signalType: 'failed_login',
    reason: input.reason,
    emailHash,
    ipHash,
    userAgent: cleanUserAgent(input.userAgent),
  });
  trackFailedLoginBurst({ emailHash, ipHash });
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

export function resetSecuritySignalsStateForTesting(): void {
  failedLoginBursts.clear();
}

import { getRequestId } from '../http/requestId.js';
import { getConfig } from '../config/config.js';

/**
 * Structured Logger
 * Includes request context when available
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogEntry {
  level: LogLevel;
  message: string;
  requestId?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

const SENSITIVE_FIELD_RE = /(authorization|token|secret|password|cookie|api[-_]?key|jwt|session|csrf)/i;
const MAX_LOG_DEPTH = 6;
const MAX_LOG_ENTRIES = 80;
const MAX_LOG_STRING = 4096;

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars) + `…[+${value.length - maxChars} chars]`;
}

function redactSensitiveInline(value: string): string {
  return value
    .replace(/(authorization\s*:\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(cookie\s*:\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/\b(sk|xai|ds)-[a-z0-9_-]{12,}\b/gi, '[REDACTED]');
}

function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > MAX_LOG_DEPTH) return '[TRUNCATED_DEPTH]';

  if (typeof value === 'string') {
    return truncate(redactSensitiveInline(value), MAX_LOG_STRING);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveInline(value.message),
      stack: value.stack ? truncate(redactSensitiveInline(value.stack), MAX_LOG_STRING) : undefined,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_LOG_ENTRIES).map((item) => sanitizeLogValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_LOG_ENTRIES);
    for (const [k, v] of entries) {
      if (SENSITIVE_FIELD_RE.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeLogValue(v, depth + 1);
      }
    }
    return out;
  }

  return String(value);
}

function shouldLog(level: LogLevel): boolean {
  try {
    const config = getConfig();
    return LOG_LEVELS[level] >= LOG_LEVELS[config.logging.level];
  } catch {
    // Config not loaded yet, default to info
    return LOG_LEVELS[level] >= LOG_LEVELS.info;
  }
}

function formatLog(entry: LogEntry): string {
  const payload: Record<string, unknown> = {
    timestamp: entry.timestamp,
    level: entry.level,
    message: redactSensitiveInline(entry.message),
  };

  if (entry.requestId && entry.requestId !== 'no-request-context') {
    payload.requestId = entry.requestId;
  }
  if (entry.data && Object.keys(entry.data).length > 0) {
    payload.data = sanitizeLogValue(entry.data);
  }

  return JSON.stringify(payload);
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) {
    return;
  }
  
  const entry: LogEntry = {
    level,
    message,
    requestId: getRequestId(),
    timestamp: new Date().toISOString(),
    data,
  };
  
  const formatted = formatLog(entry);
  
  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) => log('error', message, data),
};

import type { LlmMessage } from './types.js';

const MAX_DEFAULT_CHARS = 20_000;
const UNTRUSTED_BEGIN = '<BEGIN_UNTRUSTED_USER_INPUT>';
const UNTRUSTED_END = '<END_UNTRUSTED_USER_INPUT>';

const sensitiveKeyHint = /\b(authorization|bearer|token|secret|password|cookie|api[-_]?key|jwt|session)\b/i;

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars) + `…[+${value.length - maxChars} chars]`;
}

function stripControlChars(value: string): string {
  // Keep LF/TAB but strip other ASCII control chars to avoid hidden instructions.
  let out = '';
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    const keep =
      code === 9 || // TAB
      code === 10 || // LF
      (code >= 32 && code <= 126) ||
      code > 127;
    if (keep) out += ch;
  }
  return out;
}

export function redactSensitiveText(input: string): string {
  return input
    .replace(/(authorization\s*:\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(cookie\s*:\s*)(.+)/gi, '$1[REDACTED]')
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/\b(sk|xai|ds)-[a-z0-9_-]{12,}\b/gi, '[REDACTED]')
    .replace(/(\b(?:api[-_]?key|token|secret|password)\b)\s*[:=]\s*["']?([^\s"',;]+)/gi, '$1=[REDACTED]');
}

export function neutralizePromptInjectionText(input: string): string {
  return input
    .replace(/<\|[^>]{0,100}\|>/g, '[CONTROL_TOKEN]')
    .replace(/^\s*(system|assistant|developer|tool)\s*:/gim, '[ROLE_OVERRIDE_BLOCKED]:');
}

export function sanitizePromptText(input: string, opts?: { maxChars?: number }): string {
  const maxChars = Math.max(64, opts?.maxChars ?? MAX_DEFAULT_CHARS);
  const value = typeof input === 'string' ? input : String(input);
  const stripped = stripControlChars(value);
  const redacted = redactSensitiveText(stripped);
  const neutralized = neutralizePromptInjectionText(redacted);
  return truncate(neutralized, maxChars);
}

export function sanitizePromptMessages(
  messages: Array<{ role: LlmMessage['role']; content: string }>,
  input?: { maxMessages?: number; maxCharsPerMessage?: number }
): Array<{ role: LlmMessage['role']; content: string }> {
  const maxMessages = Math.max(1, input?.maxMessages ?? 6);
  const maxCharsPerMessage = Math.max(64, input?.maxCharsPerMessage ?? 2_000);

  return messages.slice(-maxMessages).map((m) => ({
    role: m.role,
    content: sanitizePromptText(m.content, { maxChars: maxCharsPerMessage }),
  }));
}

export function asUntrustedUserInputBlock(input: string, opts?: { maxChars?: number }): string {
  const sanitized = sanitizePromptText(input, { maxChars: opts?.maxChars ?? MAX_DEFAULT_CHARS });
  return [UNTRUSTED_BEGIN, sanitized, UNTRUSTED_END].join('\n');
}

export function looksSensitiveKey(key: string): boolean {
  return sensitiveKeyHint.test(key);
}

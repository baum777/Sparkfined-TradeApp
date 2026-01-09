import { createHash } from 'crypto';

type JsonValue = null | boolean | number | string | JsonObject | JsonValue[];
type JsonObject = { [k: string]: JsonValue };

function stable(value: JsonValue): JsonValue {
  // Defensive: callers may accidentally pass runtime-undefined values.
  // We coerce them to null to keep hashing deterministic and avoid crashes.
  if ((value as any) === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(v => stable(v));
  const obj = value as JsonObject;
  const out: JsonObject = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) out[k] = stable(obj[k] as JsonValue);
  return out;
}

export function stableStringify(value: JsonObject): string {
  return JSON.stringify(stable(value));
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function stableSha256Hex(value: JsonObject): string {
  return sha256Hex(stableStringify(value));
}


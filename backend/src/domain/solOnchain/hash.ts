import { createHash } from 'crypto';

type JsonValue = null | boolean | number | string | JsonObject | JsonValue[];
type JsonObject = { [k: string]: JsonValue };

function stable(value: any): JsonValue {
  if (value === null) return null;
  // Determinism: treat `undefined` as "missing" (omit via parent) or null when standalone.
  if (value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(v => stable(v));
  const obj = value as JsonObject;
  const out: JsonObject = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) {
    const v = (obj as any)[k];
    // Omit undefined keys to avoid unstable hashes from optional fields.
    if (v === undefined) continue;
    out[k] = stable(v);
  }
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


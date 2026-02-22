function toHex(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let out = '';
  for (const b of arr) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * SHA-256 (browser)
 * - Uses WebCrypto when available
 * - Falls back to a small deterministic non-crypto hash when not
 */
export async function hashSha256Hex(input: string): Promise<string> {
  const subtle =
    typeof globalThis !== 'undefined' &&
    'crypto' in globalThis &&
    (globalThis as any).crypto?.subtle;

  if (subtle?.digest) {
    const data = new TextEncoder().encode(input);
    const digest = await subtle.digest('SHA-256', data);
    return toHex(digest);
  }

  // Fallback: FNV-1a 32-bit -> hex (deterministic, not cryptographic)
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}



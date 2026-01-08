import { getEnv } from '../../config/env.js';

export type PulseAssetKind = 'ticker' | 'address';

export type PulseAssetResolved =
  | { input: string; kind: 'address'; address: string }
  | { input: string; kind: 'ticker'; symbol: string; address: string };

// Frontend-compatible rules (see `src/routes/routes.ts`).
const TICKER_REGEX = /^[A-Z0-9._-]{1,15}$/i;
const SOLANA_LIKE_LENGTH_REGEX = /^\S{32,44}$/;

function parseTickerMap(raw?: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw) return map;

  // Format: "SOL=So111...,USDC=EPjF..."
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim().toUpperCase();
    const value = trimmed.slice(idx + 1).trim();
    if (!key || !value) continue;
    map.set(key, value);
  }

  return map;
}

function getWellKnownMint(symbolUpper: string): string | null {
  // Minimal built-ins to make ticker resolution usable even without env configuration.
  // Note: This is best-effort and intentionally small.
  switch (symbolUpper) {
    case 'SOL':
      return 'So11111111111111111111111111111111111111112';
    case 'USDC':
      return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    case 'USDT':
      return 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
    case 'BONK':
      return 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    default:
      return null;
  }
}

export function classifyPulseAsset(input: string): { kind: PulseAssetKind; normalized: string } | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  if (TICKER_REGEX.test(raw)) {
    return { kind: 'ticker', normalized: raw.toUpperCase() };
  }

  if (SOLANA_LIKE_LENGTH_REGEX.test(raw)) {
    // Length gate only; preserve original case.
    return { kind: 'address', normalized: raw };
  }

  return null;
}

/**
 * Best-effort resolver:
 * - ticker-like: resolve to a Solana mint address via env map or a small built-in set
 * - address-like: accept as-is
 */
export function resolvePulseAsset(input: string): PulseAssetResolved | null {
  const raw = (input ?? '').trim();
  const classified = classifyPulseAsset(raw);
  if (!classified) return null;

  if (classified.kind === 'address') {
    return { input: raw, kind: 'address', address: classified.normalized };
  }

  const symbol = classified.normalized;
  const env = getEnv();
  const envMap = parseTickerMap(env.PULSE_TICKER_MAP);
  const mapped = envMap.get(symbol) ?? getWellKnownMint(symbol);
  if (!mapped) return null;

  return { input: raw, kind: 'ticker', symbol, address: mapped };
}


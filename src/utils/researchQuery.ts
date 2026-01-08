export type ResearchQueryKind = "ticker" | "address" | "invalid";

export type ParsedResearchQuery =
  | { kind: "ticker"; normalized: string; raw: string }
  | { kind: "address"; normalized: string; raw: string }
  | { kind: "invalid"; raw: string };

// Ticker-like input: ^[A-Z0-9._-]{1,15}$ (case-insensitive)
const TICKER_REGEX = /^[A-Z0-9._-]{1,15}$/i;

/**
 * Strict parser/normalizer for the Research chart query (`q`).
 *
 * Rules:
 * - `raw` is always trimmed.
 * - ticker-like => normalized to UPPERCASE.
 * - solana-like => length gate only (32–44), no deeper parsing; preserve case.
 */
export function parseResearchChartQuery(input: string): ParsedResearchQuery {
  const raw = (input ?? "").trim();

  if (!raw) return { kind: "invalid", raw };

  if (TICKER_REGEX.test(raw)) {
    return { kind: "ticker", normalized: raw.toUpperCase(), raw };
  }

  // Solana-like: length gate only (32–44). Avoid over-parsing.
  if (/^\S{32,44}$/.test(raw)) {
    return { kind: "address", normalized: raw, raw };
  }

  return { kind: "invalid", raw };
}



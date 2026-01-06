/**
 * Onchain Context Types (Backend)
 * Matches src/types/journal.ts contract + Persistence Meta
 */

// Re-export frozen contract from src/types if possible, or redefine to avoid alias issues.
// Given the project structure, it is safer to redefine strict contract here to decouple backend build from src.

export interface OnchainContextV1 {
  capturedAt: string; // ISO
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  marketCap: number;
  ageMinutes: number;
  holders: number;
  transfers24h: number;
  dexId?: string;
}

export type OnchainContextProvider = 'dexpaprika' | 'moralis' | 'internal';

export type OnchainContextErrorCode = 
  | 'MISSING_MARKET_KEY'
  | 'MISSING_API_KEY'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'PARSE_ERROR'
  | 'MISSING_FIELD'
  | 'APPROXIMATE_COUNT'
  | 'UNKNOWN_ERROR';

export interface OnchainContextErrorV1 {
  provider: OnchainContextProvider;
  code: OnchainContextErrorCode;
  message: string;
  at: string; // ISO
  requestId: string;
  httpStatus?: number;
}

export interface OnchainContextMetaV1 {
  capturedAt: string; // ISO (redundant for ease of access)
  errors: OnchainContextErrorV1[];
  
  // Phase C: Intelligence Metadata (optional, additive)
  capture?: {
    source: string; // e.g. "helius"
    type: 'swap' | 'transfer' | 'unknown';
    signature: string;
    wallet?: string; // optional, subject to logging policy
    parsedAt: string; // ISO
  };
  
  classification?: {
    sideConfidence: number; // 0..1
    assetConfidence: number; // 0..1
    reasonCodes: string[];
  };
  
  display?: {
    baseMint?: string;
    quoteMint?: string;
    baseSymbol?: string; // from external resolution (optional)
    quoteSymbol?: string; // from external resolution (optional)
  };
}

// Internal result structure for builders
export interface OnchainSnapshotResult {
  context: OnchainContextV1;
  meta: OnchainContextMetaV1;
}


import type { InputCandle, SolTimeframe } from './types.js';

/**
 * Candle source abstraction (no onchain/LLM dependencies).
 *
 * Implementations can pull from exchange APIs, indexed DBs, or fixtures.
 * Determinism requirement: return candles sorted by ts ascending.
 */
export interface CandleSource {
  getCandles(input: {
    mint: string;
    timeframe: SolTimeframe;
    limit: number;
    endTs?: number;
  }): Promise<InputCandle[]>;
}


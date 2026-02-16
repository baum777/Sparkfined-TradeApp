// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { DiscoverTokenCard } from '@/components/discover/DiscoverTokenCard';
import { DiscoverTokenList } from '@/components/discover/DiscoverTokenList';
import { DiscoverReasonChips } from '@/components/discover/DiscoverReasonChips';
import { useDiscoverStore } from '@/lib/state/discoverStore';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { quoteService } from '@/lib/trading/quote/quoteService';
import type { Decision, Reason, Token } from '@/features/discover/filter/types';
import type { TerminalQuoteData } from '../../shared/trading/types';
import { FEE_TIERS } from '../../shared/trading/fee/feeTiers';

vi.mock('@/lib/trading/quote/quoteService', () => ({
  quoteService: {
    getQuote: vi.fn(),
  },
}));

function createToken(overrides: Partial<Token> = {}): Token {
  return {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'TEST',
    name: 'Test Token',
    launchpad: 'pumpfun',
    market: {
      age_minutes: 120,
      is_bonded: true,
      bonding_progress_pct: null,
    },
    authorities: {
      mint_authority_revoked: true,
      freeze_authority_revoked: true,
    },
    liquidity: {
      liq_usd: 50000,
      liq_sol: 220,
      lp_locked_pct: 90,
      lp_lock_days: 60,
      lp_burned: false,
    },
    holders: {
      holder_count: 900,
      top1_pct: 4,
      top10_pct: 18,
      deployer_pct: 2,
    },
    trading: {
      tx_per_min_5m: 12,
      buys_5m: 42,
      sells_5m: 27,
      volume_usd_5m: 8500,
      volume_usd_15m: 24000,
      volume_usd_60m: 92000,
      price_change_5m: 3.2,
      price_change_60m: 11.4,
    },
    manipulation: {
      bundle_score: 15,
      identical_buy_cluster_score: 12,
      same_funder_cluster_score: 18,
      wash_trade_score: 9,
    },
    safety: {
      jupiter_shield_level: 'low',
    },
    social: {
      x_mentions_15m: 140,
      x_velocity_15m: 35,
      x_account_quality_score: 65,
    },
    oracle: {
      sentiment: 0.42,
      confidence: 0.71,
      trend_score: 72,
    },
    ...overrides,
  };
}

function createDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    action: 'allow',
    reasons: [],
    ...overrides,
  };
}

const quoteFixture: TerminalQuoteData = {
  expectedOut: {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'TEST',
    decimals: 9,
    amountBaseUnits: '1000000',
    amountUi: '0.001',
  },
  minOut: {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'TEST',
    decimals: 9,
    amountBaseUnits: '980000',
    amountUi: '0.00098',
  },
  feeBps: 40,
  feeAmountEstimate: {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    decimals: 6,
    amountBaseUnits: '2500',
    amountUi: '0.0025',
  },
  provider: {
    name: 'jupiter',
    quoteResponse: { routePlan: [] },
    feeMechanism: 'jupiter-platform-fee',
  },
};

describe('Discover/Terminal Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    useTerminalStore.setState({
      pair: {
        baseMint: 'Es9vMFrzaCERQSmvN1x8JfC2ScM6A97X3CJidb8sRP9H',
        quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      },
      side: 'sell',
      amount: { mode: 'base', value: '1.5' },
      slippageBps: 125,
      priorityFee: { enabled: true, microLamports: 11_000 },
      feeTier: FEE_TIERS.hardI,
      quote: { status: 'idle' },
      tx: { status: 'idle' },
    });

    useDiscoverStore.setState({
      isOpen: true,
      activeTab: 'not_bonded',
      filters: {
        launchpads: [],
        timeWindow: 'all',
        minLiquiditySol: null,
        searchQuery: '',
      },
      selectedPreset: {
        not_bonded: 'bundler_exclusion_gate',
        bonded: 'strict_safety_gate',
        ranked: 'signal_fusion',
      },
      tokens: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('click token sets pair and keeps fee/swap params stable', () => {
    const token = createToken({
      mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      symbol: 'JUP',
      name: 'Jupiter',
    });
    const before = useTerminalStore.getState();

    render(<DiscoverTokenCard token={token} decision={createDecision()} tab="not_bonded" />);
    fireEvent.click(screen.getByText('JUP'));

    const after = useTerminalStore.getState();
    expect(after.pair).toEqual({
      baseMint: token.mint,
      quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      baseSymbol: token.symbol,
      quoteSymbol: 'USDC',
    });
    expect(after.feeTier).toEqual(before.feeTier);
    expect(after.slippageBps).toBe(before.slippageBps);
    expect(after.priorityFee).toEqual(before.priorityFee);
    expect(after.side).toBe(before.side);
    expect(after.amount).toEqual(before.amount);
    expect(useDiscoverStore.getState().isOpen).toBe(false);
  });

  it('tab switch does not fetch quote, pair click does', async () => {
    vi.mocked(quoteService.getQuote).mockResolvedValue(quoteFixture);

    useTerminalStore.setState({
      pair: {
        baseMint: 'Es9vMFrzaCERQSmvN1x8JfC2ScM6A97X3CJidb8sRP9H',
        quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      },
      side: 'buy',
      amount: { mode: 'quote', value: '15' },
      slippageBps: 60,
      priorityFee: { enabled: false, microLamports: 5_000 },
      feeTier: FEE_TIERS.soft,
      quote: { status: 'idle' },
      tx: { status: 'idle' },
    });

    useDiscoverStore.getState().setActiveTab('bonded');
    vi.advanceTimersByTime(500);
    expect(quoteService.getQuote).not.toHaveBeenCalled();

    render(
      <DiscoverTokenCard
        token={createToken({
          mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6f4J45jWfNhM6hQd',
          symbol: 'BONK',
          name: 'Bonk',
        })}
        decision={createDecision()}
        tab="bonded"
      />
    );
    fireEvent.click(screen.getByText('BONK'));
    await vi.advanceTimersByTimeAsync(500);
    expect(quoteService.getQuote).toHaveBeenCalledTimes(1);
  });

  it('preset merge logic is reflected at UI list level', async () => {
    const rejectedByPreset = createToken({
      mint: '7dHbWXadNqiH4uM2nA8fLnb6N6byN1Nsx3Rp3bV5w7kF',
      symbol: 'SLOW',
      trading: {
        tx_per_min_5m: 2,
        buys_5m: 5,
        sells_5m: 4,
        volume_usd_5m: 1000,
        volume_usd_15m: 3000,
        volume_usd_60m: 9000,
        price_change_5m: 1,
        price_change_60m: 2,
      },
    });
    const validToken = createToken({
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'FAST',
      trading: {
        tx_per_min_5m: 9,
        buys_5m: 18,
        sells_5m: 12,
        volume_usd_5m: 6200,
        volume_usd_15m: 16000,
        volume_usd_60m: 57000,
        price_change_5m: 4,
        price_change_60m: 9,
      },
    });

    useDiscoverStore.setState((state) => ({
      ...state,
      tokens: [rejectedByPreset, validToken],
      selectedPreset: {
        ...state.selectedPreset,
        bonded: 'organic_momentum',
      },
    }));

    render(<DiscoverTokenList tab="bonded" />);

    await waitFor(() => {
      expect(screen.getByText('FAST')).toBeInTheDocument();
      expect(screen.queryByText('SLOW')).not.toBeInTheDocument();
    });
  });

  it('rank score appears only in ranked tab and reason chips are capped to 2', () => {
    const token = createToken();
    const reasons: Reason[] = [
      { code: 'bundle_score_high', message: 'Bundler risk' },
      { code: 'liquidity_insufficient', message: 'Low liquidity' },
      { code: 'social_low_quality', message: 'Low quality social' },
      { code: 'missing_lp_data', message: 'Missing LP data' },
    ];

    const { rerender } = render(
      <DiscoverTokenCard
        token={token}
        decision={createDecision({ action: 'downrank', score: 88, reasons })}
        tab="ranked"
      />
    );
    expect(screen.getByText('88')).toBeInTheDocument();

    rerender(
      <DiscoverTokenCard
        token={token}
        decision={createDecision({ action: 'downrank', score: 88, reasons })}
        tab="bonded"
      />
    );
    expect(screen.queryByText('88')).not.toBeInTheDocument();

    const reasonChipRender = render(<DiscoverReasonChips reasons={reasons} />);
    expect(reasonChipRender.queryByText('Bundler risk')).toBeInTheDocument();
    expect(reasonChipRender.queryByText('Low liquidity')).toBeInTheDocument();
    expect(reasonChipRender.queryByText('Low quality social')).not.toBeInTheDocument();
    expect(reasonChipRender.queryByText('Missing LP data')).not.toBeInTheDocument();
  });
});

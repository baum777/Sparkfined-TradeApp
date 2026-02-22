// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderForm } from '@/components/terminal/OrderForm';
import { useTerminalStore } from '@/lib/state/terminalStore';
import type { Connection } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

vi.mock('@/lib/solana/balance', () => ({
  fetchTokenBalance: vi.fn((_conn: unknown, _owner: unknown, mint: string) => {
    if (mint === 'So11111111111111111111111111111111111111112') return Promise.resolve('1.5');
    if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') return Promise.resolve('100.25');
    return Promise.resolve(null);
  }),
}));

const MOCK_PAIR = {
  baseMint: 'So11111111111111111111111111111111111111112',
  quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  baseSymbol: 'SOL',
  quoteSymbol: 'USDC',
};

function createMockWallet(connected = true) {
  return {
    publicKey: connected ? new PublicKey('11111111111111111111111111111111') : null,
    signTransaction: async (tx: unknown) => tx,
  } as Parameters<typeof OrderForm>[0]['wallet'];
}

describe('OrderForm', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      pair: MOCK_PAIR,
      side: 'buy',
      amount: { mode: 'quote', value: '' },
      balances: { base: '1.5', quote: '100.25', loading: false },
      quote: { status: 'idle' },
      tx: { status: 'idle' },
    });
  });

  afterEach(() => {
    useTerminalStore.setState({
      pair: null,
      balances: { base: null, quote: null, loading: false },
    });
  });

  it('renders balance display when wallet connected', async () => {
    const wallet = createMockWallet(true);
    const connection = {} as Connection;

    render(<OrderForm wallet={wallet} connection={connection} />);

    expect(screen.getByTestId('balance-display')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/100.25 USDC/)).toBeInTheDocument();
    });
  }, 15_000);

  it('Max button fills amount input with wallet balance', async () => {
    const user = userEvent.setup();
    const wallet = createMockWallet(true);
    const connection = {} as Connection;

    render(<OrderForm wallet={wallet} connection={connection} />);

    await waitFor(() => {
      expect(screen.getByText(/100.25 USDC/)).toBeInTheDocument();
    });

    const maxButton = screen.getByTestId('balance-max-button');
    expect(maxButton).not.toBeDisabled();

    await user.click(maxButton);

    await waitFor(() => {
      expect(useTerminalStore.getState().amount.value).toBe('100.25');
    });
  }, 15_000);

  it('does not render balance display when wallet disconnected', () => {
    const wallet = createMockWallet(false);
    const connection = {} as Connection;

    render(<OrderForm wallet={wallet} connection={connection} />);

    expect(screen.queryByTestId('balance-display')).not.toBeInTheDocument();
  });
});

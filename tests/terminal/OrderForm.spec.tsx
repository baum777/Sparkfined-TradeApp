// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

type TerminalStoreSnapshot = ReturnType<typeof useTerminalStore.getState>;
const originalFetchBalances = useTerminalStore.getState().fetchBalances;
const originalScheduleQuoteFetch = useTerminalStore.getState().scheduleQuoteFetch;
const noOpFetchBalances: TerminalStoreSnapshot['fetchBalances'] = async (_opts) => {};
const noOpScheduleQuoteFetch: TerminalStoreSnapshot['scheduleQuoteFetch'] = () => {};

describe('OrderForm', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      pair: MOCK_PAIR,
      side: 'buy',
      amount: { mode: 'quote', value: '' },
      balances: { base: '1.5', quote: '100.25', loading: false },
      quote: { status: 'idle' },
      tx: { status: 'idle' },
      fetchBalances: noOpFetchBalances,
      scheduleQuoteFetch: noOpScheduleQuoteFetch,
    });
  });

  afterEach(() => {
    cleanup();
    useTerminalStore.setState({
      pair: null,
      balances: { base: null, quote: null, loading: false },
      fetchBalances: originalFetchBalances,
      scheduleQuoteFetch: originalScheduleQuoteFetch,
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

  it('uses quote balance as quick amount baseline on buy side', async () => {
    const user = userEvent.setup();
    const wallet = createMockWallet(true);
    const connection = {} as Connection;

    useTerminalStore.setState({
      side: 'buy',
      balances: { base: '1.5', quote: '100.25', loading: false },
    });

    render(<OrderForm wallet={wallet} connection={connection} />);

    await user.click(screen.getByRole('button', { name: 'Set amount to 50%' }));

    await waitFor(() => {
      expect(useTerminalStore.getState().amount.value).toBe('50.125');
    });
  });

  it('uses base balance as quick amount baseline on sell side', async () => {
    const user = userEvent.setup();
    const wallet = createMockWallet(true);
    const connection = {} as Connection;

    useTerminalStore.setState({
      side: 'sell',
      balances: { base: '1.5', quote: '100.25', loading: false },
    });

    render(<OrderForm wallet={wallet} connection={connection} />);

    await user.click(screen.getByRole('button', { name: 'Set amount to 50%' }));

    await waitFor(() => {
      expect(useTerminalStore.getState().amount.value).toBe('0.75');
    });
  });

  it('disables quick amount buttons while balances are loading', () => {
    const wallet = createMockWallet(true);
    const connection = {} as Connection;

    useTerminalStore.setState({
      side: 'buy',
      balances: { base: '1.5', quote: '100.25', loading: true },
    });

    render(<OrderForm wallet={wallet} connection={connection} />);

    expect(screen.getByRole('button', { name: 'Set amount to 25%' })).toBeDisabled();
    expect(screen.getByText('Balance unavailable')).toBeInTheDocument();
  });

  it('disables quick amount buttons when relevant balance is missing', () => {
    const wallet = createMockWallet(true);
    const connection = {} as Connection;

    useTerminalStore.setState({
      side: 'buy',
      balances: { base: '1.5', quote: null, loading: false },
    });

    render(<OrderForm wallet={wallet} connection={connection} />);

    expect(screen.getByRole('button', { name: 'Set amount to 25%' })).toBeDisabled();
    expect(screen.getByText('Balance unavailable')).toBeInTheDocument();
  });
});

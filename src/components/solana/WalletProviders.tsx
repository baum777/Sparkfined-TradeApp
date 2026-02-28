import { useMemo, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletReadyState, type WalletAdapter } from '@solana/wallet-adapter-base';
import { PublicKey } from '@solana/web3.js';
import { getCommitment, getRpcEndpoint, validateSolanaEnv } from '@/lib/solana/connection';
import { logSolanaEnvOnce } from '@/lib/env';

// E2E Wallet Mock: Deterministic connected wallet for Playwright tests
// Enabled only when VITE_E2E_WALLET_MOCK=1 (env) or window.__E2E_WALLET_MOCK__ (runtime)
const E2E_WALLET_MOCK =
  import.meta.env.VITE_E2E_WALLET_MOCK === '1' ||
  (typeof window !== 'undefined' && window.__E2E_WALLET_MOCK__ === true);

// Stable test public key (deterministic across browsers)
const TEST_PUBLIC_KEY = new PublicKey('So11111111111111111111111111111111111111112');

/**
 * E2E Mock Wallet Adapter
 * Implements the WalletAdapter interface for deterministic E2E testing.
 * Never signs real transactions - returns mock data for UI testing.
 */
class E2EMockWalletAdapter implements WalletAdapter {
  name = 'E2E Mock Wallet';
  url = 'https://mock.wallet';
  icon = 'data:image/svg+xml;base64,PHN2Zy8+';
  readyState = WalletReadyState.Installed;
  publicKey: PublicKey = TEST_PUBLIC_KEY;
  connecting = false;
  connected = true;
  disconnecting = false;

  // Event emitter stubs (required by interface)
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, listener: Function, _context?: unknown) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: Function) {
    this.listeners.get(event)?.delete(listener);
  }

  once(event: string, listener: Function, _context?: unknown) {
    const wrapped = (...args: unknown[]) => {
      listener(...args);
      this.off(event, wrapped);
    };
    return this.on(event, wrapped);
  }

  emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
    return true;
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0;
  }

  removeAllListeners(event?: string) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  async connect() {
    this.connected = true;
    this.emit('connect', this.publicKey);
  }

  async disconnect() {
    this.connected = false;
    this.publicKey = null as unknown as PublicKey;
    this.emit('disconnect');
  }

  async select(_walletName: string) {
    // No-op in E2E mode
  }

  async signTransaction<T>(transaction: T): Promise<T> {
    // E2E mode: Return transaction as-is (no actual signing)
    // This allows UI to proceed without real wallet interaction
    return transaction;
  }

  async signAllTransactions<T>(transactions: T[]): Promise<T[]> {
    // E2E mode: Return transactions as-is
    return transactions;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    // E2E mode: Return deterministic mock signature
    return new Uint8Array(64).fill(1);
  }

  async signIn(_input?: unknown) {
    return {
      address: TEST_PUBLIC_KEY.toBytes(),
      signature: new Uint8Array(64).fill(1),
      signedMessage: new Uint8Array(0),
    };
  }
}

// Expose E2E wallet state globally for tests
declare global {
  interface Window {
    __E2E_WALLET_MOCK__?: boolean;
    __E2E_WALLET_STATE__?: {
      connected: boolean;
      publicKey: PublicKey;
      wallet: E2EMockWalletAdapter;
    };
  }
}

export function WalletProviders({ children }: { children: ReactNode }) {
  logSolanaEnvOnce();
  validateSolanaEnv();
  const endpoint = getRpcEndpoint();

  const wallets = useMemo<WalletAdapter[]>(() => {
    if (E2E_WALLET_MOCK) {
      // In E2E mode, only provide the mock wallet
      return [new E2EMockWalletAdapter()];
    }
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ];
  }, []);

  // E2E mode: autoConnect=true to immediately show as connected
  const autoConnect = E2E_WALLET_MOCK;

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: getCommitment() }}>
      <WalletProvider wallets={wallets} autoConnect={autoConnect}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

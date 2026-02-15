import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { BackpackWalletAdapter, PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

function getCluster(): 'mainnet-beta' | 'devnet' {
  const raw = (import.meta as any).env?.VITE_SOLANA_CLUSTER as string | undefined;
  if (raw === 'devnet') return 'devnet';
  return 'mainnet-beta';
}

export function getRpcEndpoint(): string {
  const explicit = (import.meta as any).env?.VITE_SOLANA_RPC_URL as string | undefined;
  if (explicit?.trim()) return explicit.trim();
  return clusterApiUrl(getCluster());
}

export function WalletProviders({ children }: { children: React.ReactNode }) {
  const endpoint = getRpcEndpoint();

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}


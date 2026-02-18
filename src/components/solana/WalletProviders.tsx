import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { getCommitment, getRpcEndpoint, validateSolanaEnv } from '@/lib/solana/connection';
import { logSolanaEnvOnce } from '@/lib/env';

export function WalletProviders({ children }: { children: React.ReactNode }) {
  logSolanaEnvOnce();
  validateSolanaEnv();
  const endpoint = getRpcEndpoint();

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      // BackpackWalletAdapter not available in current package version
      // new BackpackWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: getCommitment() }}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}


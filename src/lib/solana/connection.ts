import { Connection, clusterApiUrl, type Commitment } from '@solana/web3.js';

let cachedConnection: Connection | null = null;
let cachedEndpoint: string | null = null;

type Cluster = 'devnet' | 'mainnet-beta';

function getEnvString(key: string): string | undefined {
  // Vite only exposes VITE_* by default. We still read NEXT_PUBLIC_* as a best-effort
  // for repo parity with Next.js configs (will be undefined unless explicitly exposed).
  const env = (import.meta as any).env as Record<string, string | boolean | undefined> | undefined;
  const v = env?.[key];
  return typeof v === 'string' ? v : undefined;
}

export function getCommitment(): Commitment {
  return 'confirmed';
}

export function getCluster(): Cluster {
  const clusterRaw =
    getEnvString('VITE_SOLANA_CLUSTER') ||
    getEnvString('NEXT_PUBLIC_SOLANA_CLUSTER');
  return clusterRaw === 'devnet' ? 'devnet' : 'mainnet-beta';
}

export function getRpcEndpoint(): string {
  const explicit =
    getEnvString('VITE_SOLANA_RPC_URL') ||
    getEnvString('NEXT_PUBLIC_SOLANA_RPC_URL');

  if (explicit?.trim()) return explicit.trim();

  return clusterApiUrl(getCluster());
}

export function getConnection(): Connection {
  const endpoint = getRpcEndpoint();
  if (cachedConnection && cachedEndpoint === endpoint) return cachedConnection;

  cachedEndpoint = endpoint;
  cachedConnection = new Connection(endpoint, { commitment: getCommitment() });
  return cachedConnection;
}

export function validateSolanaEnv(): void {
  const cluster = getCluster();
  const endpoint = getRpcEndpoint();
  const isDev = (import.meta as any).env?.DEV === true;

  if (isDev) {
    if (cluster === 'devnet' && endpoint.includes('mainnet')) {
      console.warn(
        '[Terminal] ⚠️ Config Mismatch: Cluster is "devnet" but RPC URL looks like "mainnet". This may cause transaction failures.'
      );
    }
    if (cluster === 'mainnet-beta' && endpoint.includes('devnet')) {
      console.warn(
        '[Terminal] ⚠️ Config Mismatch: Cluster is "mainnet-beta" but RPC URL looks like "devnet".'
      );
    }
  }
}


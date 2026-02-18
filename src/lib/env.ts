import type { Commitment } from '@solana/web3.js';
import { getCommitment, getRpcEndpoint } from '@/lib/solana/connection';

export type SolanaCluster = 'devnet' | 'mainnet-beta';

interface ImportMetaEnvLike {
  DEV?: boolean;
  [key: string]: string | boolean | undefined;
}

function getImportMetaEnv(): ImportMetaEnvLike {
  return (import.meta as ImportMeta & { env?: ImportMetaEnvLike }).env ?? {};
}

function getEnvString(key: string): string | undefined {
  const env = getImportMetaEnv();
  const v = env?.[key];
  return typeof v === 'string' ? v : undefined;
}

export function getSolanaCluster(): SolanaCluster {
  // Priority: VITE_* > NEXT_PUBLIC_* > fallback(mainnet-beta)
  const raw =
    getEnvString('VITE_SOLANA_CLUSTER') ||
    getEnvString('NEXT_PUBLIC_SOLANA_CLUSTER');
  return raw === 'devnet' ? 'devnet' : 'mainnet-beta';
}

export function getSolanaCommitment(): Commitment {
  return getCommitment();
}

export function getSolanaRpcEndpoint(): string {
  // Priority: VITE_* > NEXT_PUBLIC_* > cluster fallback
  return getRpcEndpoint();
}

let didLog = false;

export function isDev(): boolean {
  return (import.meta as any).env?.DEV === true;
}

export function logSolanaEnvOnce(): void {
  if (didLog) return;
  didLog = true;

  // Only in dev
  if (!isDev()) return;

  // Best-effort detection of whether endpoint is explicit or derived
  const explicit =
    getEnvString('VITE_SOLANA_RPC_URL') ||
    getEnvString('NEXT_PUBLIC_SOLANA_RPC_URL');

  // eslint-disable-next-line no-console
  console.info('[Terminal] Solana config', {
    rpcEndpoint: getSolanaRpcEndpoint(),
    cluster: getSolanaCluster(),
    commitment: getSolanaCommitment(),
    rpcSource: explicit ? 'explicit' : 'cluster-fallback',
  });
}

export function isDev(): boolean {
  return getImportMetaEnv().DEV === true;
}


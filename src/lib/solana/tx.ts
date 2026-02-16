import { VersionedTransaction as V0Transaction } from '@solana/web3.js';
import type { Commitment, Connection, Transaction, VersionedTransaction } from '@solana/web3.js';

export interface SendSignedTransactionOpts {
  connection: Connection;
  signedTx: Transaction | VersionedTransaction;
  skipPreflight?: boolean;
  maxRetries?: number;
}

export interface SendSignedTransactionResult {
  signature: string;
}

export async function simulateSignedTransaction(
  connection: Connection,
  signedTx: Transaction | VersionedTransaction,
  commitment: Commitment = 'processed'
): Promise<{ logs?: string[]; err?: unknown }> {
  const res =
    signedTx instanceof V0Transaction
      ? await connection.simulateTransaction(signedTx, { commitment })
      : await connection.simulateTransaction(signedTx);
  return { logs: res.value.logs ?? undefined, err: res.value.err ?? undefined };
}

export function extractTxError(e: unknown): string {
  if (!e) return 'Unbekannter Fehler';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message || 'Transaktion fehlgeschlagen';

  // Best-effort parsing for web3.js-ish errors
  const maybeErr = e as { message?: unknown; logs?: unknown };
  const msg = typeof maybeErr.message === 'string' ? maybeErr.message : null;
  const logs = Array.isArray(maybeErr.logs) ? maybeErr.logs : null;
  if (msg && logs?.length) return `${msg}\n${logs.slice(-10).join('\n')}`;
  return msg || 'Transaktion fehlgeschlagen';
}

export async function sendSignedTransaction(opts: SendSignedTransactionOpts): Promise<SendSignedTransactionResult> {
  const raw = opts.signedTx.serialize();

  const signature = await opts.connection.sendRawTransaction(raw, {
    skipPreflight: opts.skipPreflight ?? false,
    maxRetries: opts.maxRetries ?? 3,
  });

  return { signature };
}

export async function confirmSignature(opts: {
  connection: Connection;
  signature: string;
  commitment?: Commitment;
  /**
   * Optional extra info for more deterministic confirmation.
   * Use when available (e.g. from Jupiter swap response or tx recentBlockhash).
   */
  blockhash?: string;
  lastValidBlockHeight?: number;
}): Promise<void> {
  const commitment = opts.commitment ?? 'confirmed';

  if (opts.blockhash && typeof opts.lastValidBlockHeight === 'number') {
    const res = await opts.connection.confirmTransaction(
      { signature: opts.signature, blockhash: opts.blockhash, lastValidBlockHeight: opts.lastValidBlockHeight },
      commitment
    );
    if (res.value.err) throw new Error(`Transaction error: ${JSON.stringify(res.value.err)}`);
    return;
  }

  const res = await opts.connection.confirmTransaction(opts.signature, commitment);
  if (res.value.err) throw new Error(`Transaction error: ${JSON.stringify(res.value.err)}`);
}


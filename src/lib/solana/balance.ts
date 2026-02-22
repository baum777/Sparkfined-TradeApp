import type { Connection, PublicKey } from '@solana/web3.js';
import { PublicKey as SolanaPublicKey } from '@solana/web3.js';
import { formatBaseUnitsToUi } from '../../../shared/trading/fee/feeEngine';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SOL_DECIMALS = 9;
const RENT_EXEMPTION_LAMPORTS = 890_880;

/**
 * Fetch token balance for a wallet.
 * For SOL (native): uses getBalance, subtracts rent exemption for spendable amount.
 * For SPL tokens: uses getParsedTokenAccountsByOwner filtered by mint.
 * Returns formatted UI string or null on error.
 */
export async function fetchTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: string
): Promise<string | null> {
  try {
    if (mint === SOL_MINT) {
      const lamports = await connection.getBalance(owner);
      const spendable = Math.max(0, lamports - RENT_EXEMPTION_LAMPORTS);
      return formatBaseUnitsToUi(BigInt(spendable), SOL_DECIMALS, 6);
    }

    const mintPubkey = new SolanaPublicKey(mint);
    const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
      mint: mintPubkey,
    });

    if (!accounts.value.length) {
      return formatBaseUnitsToUi(0n, 6, 6);
    }

    const parsed = accounts.value[0]?.account?.data;
    if (!parsed || typeof parsed !== 'object' || !('parsed' in parsed)) {
      return null;
    }

    const info = (parsed as { parsed?: { info?: { tokenAmount?: { amount: string; decimals: number } } } }).parsed
      ?.info?.tokenAmount;
    if (!info) return null;

    const amount = BigInt(info.amount);
    const decimals = info.decimals ?? 6;
    return formatBaseUnitsToUi(amount, decimals, 6);
  } catch {
    return null;
  }
}

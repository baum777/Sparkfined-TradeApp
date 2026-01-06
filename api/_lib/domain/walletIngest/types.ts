export interface TradeEventV1 {
  id: string; // "sig:<signature>"
  walletAddress: string;
  signature: string;
  blockTime: string; // ISO
  type: 'swap' | 'transfer' | 'unknown';
  
  // Details for Journal
  tokenInMint?: string;
  tokenOutMint?: string;
  amountIn?: string;
  amountOut?: string;
  
  source: 'helius';
}


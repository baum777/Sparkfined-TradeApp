export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: unknown;
};

export type JsonRpcErrorObject = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcResponse<T> =
  | {
      jsonrpc: '2.0';
      id: string;
      result: T;
    }
  | {
      jsonrpc: '2.0';
      id: string;
      error: JsonRpcErrorObject;
    };

export type HeliusGetAssetResult = {
  // We only care about token_info for SPL mint mapping.
  token_info?: {
    supply?: string | number | null;
    decimals?: number | null;
    mint_authority?: string | null;
    freeze_authority?: string | null;
  } | null;
};

export type HeliusGetTokenSupplyResult = {
  value?: {
    amount?: string;
    decimals?: number;
    uiAmountString?: string;
  };
};

export type HeliusTokenLargestAccount = {
  address?: string;
  amount?: string;
  decimals?: number;
  uiAmountString?: string;
  uiAmount?: number | null;
};

export type HeliusGetTokenLargestAccountsResult = {
  value?: HeliusTokenLargestAccount[];
};

export type HeliusTransactionsForAddressRow = {
  signature?: string;
  blockTime?: number | null;
};

export type HeliusGetTransactionsForAddressResult = {
  transactions?: HeliusTransactionsForAddressRow[];
  paginationToken?: string | null;
};

export type HeliusEnhancedTokenTransfer = {
  mint: string;
  tokenAmount: number;
  fromUserAccount?: string;
  toUserAccount?: string;
};

export type HeliusEnhancedTransaction = {
  signature: string;
  timestamp: number; // unix seconds
  tokenTransfers?: HeliusEnhancedTokenTransfer[];
  source?: string;
  // Keep optional/loose: we only use a minimal subset.
};


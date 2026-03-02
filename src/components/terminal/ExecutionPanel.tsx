import type { WalletContextState } from '@solana/wallet-adapter-react';
import type { Connection } from '@solana/web3.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderForm } from './OrderForm';
import { FeePreviewCard } from './FeePreviewCard';

interface ExecutionPanelProps {
  wallet: WalletContextState;
  connection: Connection;
}

export function ExecutionPanel({ wallet, connection }: ExecutionPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      <Card>
        <CardHeader>
          <CardTitle>Order</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderForm wallet={wallet} connection={connection} />
        </CardContent>
      </Card>

      <FeePreviewCard />
    </div>
  );
}


import { useTerminalStore } from '@/lib/state/terminalStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TerminalPair } from '../../../shared/trading/types';

// Hardcoded starter pairs (Approach 1)
const STARTER_PAIRS: TerminalPair[] = [
  {
    baseMint: 'So11111111111111111111111111111111111111112', // SOL
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    baseSymbol: 'SOL',
    quoteSymbol: 'USDC',
  },
  {
    baseMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    baseSymbol: 'USDT',
    quoteSymbol: 'USDC',
  },
  {
    baseMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    baseSymbol: 'mSOL',
    quoteSymbol: 'USDC',
  },
];

function pairKey(pair: TerminalPair): string {
  return `${pair.baseMint}-${pair.quoteMint}`;
}

export function PairSelector() {
  const pair = useTerminalStore((s) => s.pair);
  const setPair = useTerminalStore((s) => s.setPair);

  const currentValue = pair ? pairKey(pair) : '';

  return (
    <Select
      value={currentValue}
      onValueChange={(value) => {
        const selected = STARTER_PAIRS.find((p) => pairKey(p) === value);
        setPair(selected || null);
      }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select pair" />
      </SelectTrigger>
      <SelectContent>
        {STARTER_PAIRS.map((p) => (
          <SelectItem key={pairKey(p)} value={pairKey(p)}>
            {p.baseSymbol || 'BASE'} / {p.quoteSymbol || 'QUOTE'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


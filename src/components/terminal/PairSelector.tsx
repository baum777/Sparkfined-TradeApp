import { useEffect, useMemo, useState } from 'react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { discoverService } from '@/lib/discover/discoverService';
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

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function pairKey(pair: TerminalPair): string {
  return `${pair.baseMint}-${pair.quoteMint}`;
}

function toPairFromDiscoverToken(token: { mint: string; symbol: string }): TerminalPair | null {
  const mint = token.mint?.trim();
  if (!mint || mint === USDC_MINT) return null;
  return {
    baseMint: mint,
    quoteMint: USDC_MINT,
    baseSymbol: token.symbol?.trim() || 'TOKEN',
    quoteSymbol: 'USDC',
  };
}

export function PairSelector() {
  const pair = useTerminalStore((s) => s.pair);
  const setPair = useTerminalStore((s) => s.setPair);
  const [discoveredPairs, setDiscoveredPairs] = useState<TerminalPair[]>([]);

  useEffect(() => {
    let active = true;

    const loadPairs = async () => {
      try {
        const tokens = await discoverService.getTokens();
        if (!active || !tokens.length) return;

        const seen = new Set<string>();
        const mapped = tokens
          .map((token) => toPairFromDiscoverToken(token))
          .filter((entry): entry is TerminalPair => Boolean(entry))
          .filter((entry) => {
            if (seen.has(entry.baseMint)) return false;
            seen.add(entry.baseMint);
            return true;
          })
          .slice(0, 50);

        if (!mapped.length) return;
        setDiscoveredPairs(mapped);
      } catch {
        // Discover service already handles and logs fallback cases.
      }
    };

    void loadPairs();
    return () => {
      active = false;
    };
  }, []);

  const availablePairs = useMemo(() => {
    const merged = [...STARTER_PAIRS];
    const known = new Set(STARTER_PAIRS.map((entry) => pairKey(entry)));
    for (const entry of discoveredPairs) {
      const key = pairKey(entry);
      if (known.has(key)) continue;
      known.add(key);
      merged.push(entry);
    }
    return merged;
  }, [discoveredPairs]);

  useEffect(() => {
    if (!pair && availablePairs.length > 0) {
      setPair(availablePairs[0]);
    }
  }, [pair, availablePairs, setPair]);

  const currentValue = pair ? pairKey(pair) : '';

  return (
    <Select
      value={currentValue}
      onValueChange={(value) => {
        const selected = STARTER_PAIRS.find((p) => pairKey(p) === value);
        const fallback = availablePairs.find((p) => pairKey(p) === value);
        setPair(selected || fallback || null);
      }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select pair" />
      </SelectTrigger>
      <SelectContent>
        {availablePairs.map((p) => (
          <SelectItem key={pairKey(p)} value={pairKey(p)}>
            {p.baseSymbol || 'BASE'} / {p.quoteSymbol || 'QUOTE'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


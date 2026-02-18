import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { useDiscoverStore } from '@/lib/state/discoverStore';
import type { Tab } from '@/features/discover/filter/types';
import {
  createDiscoverTokenSelector,
  type EvaluatedTokenRow,
} from '@/features/discover/ui/discoverSelectors';
import { DiscoverTokenCard } from './DiscoverTokenCard';
import { Skeleton } from '@/components/ui/skeleton';

interface DiscoverTokenListProps {
  tab: Tab;
}

interface VirtualRowProps {
  rows: EvaluatedTokenRow[];
  tab: Tab;
}

const ROW_HEIGHT = 172;
const LIST_OVERSCAN = 8;
const LIST_FALLBACK_HEIGHT = 480;

function VirtualTokenRow({ index, style, rows, tab }: RowComponentProps<VirtualRowProps>) {
  const row = rows[index];
  if (!row) return null;

  return (
    <div style={style} className="px-2 pb-2">
      <DiscoverTokenCard token={row.token} decision={row.decision} tab={tab} />
    </div>
  );
}

export function DiscoverTokenList({ tab }: DiscoverTokenListProps) {
  const tokens = useDiscoverStore((s) => s.tokens);
  const filters = useDiscoverStore((s) => s.filters);
  const selectedPreset = useDiscoverStore((s) => s.selectedPreset[tab]);
  const isLoading = useDiscoverStore((s) => s.isLoading);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [listHeight, setListHeight] = useState<number>(0);
  const selectDiscoverTokens = useMemo(() => createDiscoverTokenSelector(), []);

  // Evaluate tokens via memoized selector (kept outside render logic for stability/perf).
  const filteredTokens = useMemo(() => {
    return selectDiscoverTokens({
      tokens,
      filters,
      tab,
      preset: selectedPreset,
    });
  }, [selectDiscoverTokens, tokens, filters, tab, selectedPreset]);

  const rowProps = useMemo<VirtualRowProps>(
    () => ({
      rows: filteredTokens,
      tab,
    }),
    [filteredTokens, tab]
  );

  useLayoutEffect(() => {
    const element = listContainerRef.current;
    if (!element) return;

    const updateHeight = () => {
      const nextHeight = element.clientHeight;
      setListHeight(nextHeight > 0 ? nextHeight : LIST_FALLBACK_HEIGHT);
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden">
        <div className="space-y-2 p-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (filteredTokens.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No tokens found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={listContainerRef} className="h-full">
      <List
        rowComponent={VirtualTokenRow}
        rowCount={filteredTokens.length}
        rowHeight={ROW_HEIGHT}
        rowProps={rowProps}
        overscanCount={LIST_OVERSCAN}
        defaultHeight={LIST_FALLBACK_HEIGHT}
        style={{ height: listHeight || LIST_FALLBACK_HEIGHT, width: '100%' }}
      />
    </div>
  );
}


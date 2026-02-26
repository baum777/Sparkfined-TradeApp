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
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';

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
  const error = useDiscoverStore((s) => s.error);
  const retryFetch = useDiscoverStore((s) => s.retryFetch);
  const resetFilters = useDiscoverStore((s) => s.resetFilters);
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

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 text-destructive" aria-hidden />
        <div className="text-center">
          <p className="text-lg font-medium">Failed to load tokens</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
        <Button variant="outline" onClick={() => void retryFetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden">
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading tokens...</p>
        </div>
        <div className="space-y-2 p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (filteredTokens.length === 0) {
    const hasActiveFilters =
      (filters.searchQuery?.trim().length ?? 0) > 0 ||
      (filters.launchpads?.length ?? 0) > 0 ||
      filters.minLiquiditySol != null;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No tokens found</p>
          <p className="mt-1 text-sm">
            {hasActiveFilters
              ? 'All tokens excluded by current filters'
              : 'Try adjusting your filters'}
          </p>
        </div>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset filters
          </Button>
        )}
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


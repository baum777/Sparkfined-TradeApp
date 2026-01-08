/**
 * Research Workspace
 * Consolidates: /chart, /watchlist, /replay, /asset/:assetId
 * 
 * URL state:
 * - ?view=chart - Canonical view (default, normalized)
 * - ?q=<symbol> - Selected symbol
 * - ?panel=watchlist - Show watchlist panel
 * - ?replay=true - Enable replay mode
 * - /research/:assetId - Asset hub view
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Navigate, useSearchParams, useParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { useChartStub, useOracleStub } from "@/stubs/hooks";
import { useJournalApi } from "@/services/journal";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertCircle, RefreshCw, BarChart3, X, Eye, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { isValidChartQuery, normalizeChartQuery, isValidSolanaBase58 } from "@/routes/routes";
import {
  ChartTopBar,
  ChartCanvas,
  ChartSkeleton,
} from "@/components/chart";
import { MarketsBanner } from "@/components/chart/MarketsBanner";
import { BottomCardsCarousel } from "@/components/chart/BottomCardsCarousel";
import { AITAAnalyzerDialog } from "@/components/chart/AITAAnalyzerDialog";
import { ChartFeedPanel } from "@/components/feed";
import { GrokPulseCard } from "@/components/grokPulse";
import {
  WatchlistQuickAdd,
  WatchlistItemRow,
  WatchlistEmptyState,
  type WatchlistQuickAddRef,
} from "@/components/watchlist";
import {
  useResearchToolsStore,
  DrawingToolbar,
  ResearchToolsPanel,
  ResearchToolsSheet,
} from "@/components/chart/research-tools";
import { TradingWalletHint } from "@/components/common";
import type { WatchItemStub } from "@/stubs/contracts";

const WATCHLIST_STORAGE_KEY = "sparkfined_watchlist_v1";

function loadWatchlist(): WatchItemStub[] {
  try {
    const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return [
    { id: "watch-1", symbol: "BTC", name: "Bitcoin" },
    { id: "watch-2", symbol: "ETH", name: "Ethereum" },
    { id: "watch-3", symbol: "SOL", name: "Solana" },
  ];
}

function saveWatchlist(items: WatchItemStub[]) {
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
  // BACKEND HOOK (unchanged)
}

export default function Research() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { assetId } = useParams<{ assetId?: string }>();
  const isMobile = useIsMobile();

  // Canonical normalization: ensure view=chart
  const view = searchParams.get("view");
  if (view !== "chart") {
    const params = new URLSearchParams(searchParams);
    params.set("view", "chart");
    return <Navigate to={`/research?${params.toString()}`} replace />;
  }
  
  const {
    pageState,
    markets,
    selectedSymbol,
    selectedTimeframe,
    setSelectedSymbol,
    setSelectedTimeframe,
  } = useChartStub();

  // BACKEND HOOK (unchanged)
  const { insights: oracleInsights } = useOracleStub();
  // Real journal data via API
  const { entries: journalEntries } = useJournalApi();

  // URL state
  const isWatchlistPanelOpen = searchParams.get("panel") === "watchlist";
  const isReplayMode = searchParams.get("replay") === "true";
  const querySymbol = searchParams.get("q");

  // Watchlist state
  const [watchlistItems, setWatchlistItems] = useState<WatchItemStub[]>(() => loadWatchlist());
  const [selectedWatchlistSymbol, setSelectedWatchlistSymbol] = useState<string | null>(null);
  const quickAddRef = useRef<WatchlistQuickAddRef>(null);

  // Chart UI state
  const [queryError, setQueryError] = useState<string | null>(null);
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [aiAnalyzerOpen, setAiAnalyzerOpen] = useState(false);
  
  // Research tools store (indicators, drawings, Elliott Wave)
  const toolsStore = useResearchToolsStore();

  // Sync watchlist to localStorage
  useEffect(() => {
    saveWatchlist(watchlistItems);
  }, [watchlistItems]);

  // Handle URL query param for symbol
  useEffect(() => {
    const q = querySymbol || assetId;
    if (!q) {
      setQueryError(null);
      return;
    }

    if (!isValidChartQuery(q) && !isValidSolanaBase58(q)) {
      setQueryError(
        'Invalid query: expected ticker (1–15, A-Z/0-9/._-) or Solana Base58 (32–44).'
      );
      return;
    }

    setQueryError(null);
    const normalized = isValidSolanaBase58(q) ? q : normalizeChartQuery(q);
    setSelectedSymbol(normalized);
    // BACKEND HOOK (unchanged): trigger fetch for selected market
  }, [querySymbol, assetId, setSelectedSymbol]);

  // Watchlist panel toggle
  const handleToggleWatchlistPanel = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    if (isWatchlistPanelOpen) {
      newParams.delete("panel");
    } else {
      newParams.set("panel", "watchlist");
    }
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams, isWatchlistPanelOpen]);

  // Replay mode toggle
  const handleReplayToggle = useCallback(
    (enabled: boolean) => {
      const newParams = new URLSearchParams(searchParams);
      if (enabled) {
        newParams.set("replay", "true");
      } else {
        newParams.delete("replay");
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Market selection
  const handleSelectMarket = useCallback(
    (symbol: string) => {
      setSelectedSymbol(symbol);
      const newParams = new URLSearchParams(searchParams);
      newParams.set("q", symbol);
      setSearchParams(newParams, { replace: true });
      // BACKEND HOOK (unchanged): fetch chart data for selected market
    },
    [searchParams, setSearchParams, setSelectedSymbol]
  );

  // Watchlist handlers
  const handleWatchlistSelect = useCallback(
    (symbol: string) => {
      setSelectedWatchlistSymbol(symbol);
      handleSelectMarket(symbol);
      if (isMobile) {
        handleToggleWatchlistPanel(); // Close panel on mobile after selection
      }
    },
    [handleSelectMarket, isMobile, handleToggleWatchlistPanel]
  );

  const handleAddSymbol = useCallback(
    (symbol: string): boolean => {
      const normalized = symbol.toUpperCase().trim();
      const exists = watchlistItems.some(
        (item) => item.symbol.toLowerCase() === normalized.toLowerCase()
      );
      if (exists) return false;

      const newItem: WatchItemStub = {
        id: `watch-${Date.now()}`,
        symbol: normalized,
        name: normalized,
      };
      setWatchlistItems((prev) => [...prev, newItem]);
      toast({
        title: "Added",
        description: `${normalized} added to watchlist`,
      });
      // BACKEND HOOK (unchanged): persist watchlist items
      return true;
    },
    [watchlistItems]
  );

  const handleRemoveSymbol = useCallback(
    (symbol: string) => {
      if (selectedWatchlistSymbol === symbol) {
        setSelectedWatchlistSymbol(null);
      }
      setWatchlistItems((prev) => prev.filter((item) => item.symbol !== symbol));
      toast({
        title: "Removed",
        description: `${symbol} removed from watchlist`,
      });
      // BACKEND HOOK (unchanged): persist watchlist items
    },
    [selectedWatchlistSymbol]
  );

  // Keyboard shortcut for Escape to cancel Elliott placement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toolsStore.elliottPlacement.active) {
        toolsStore.cancelElliottPlacement();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toolsStore]);

  const handleRetry = () => {
    pageState.setState("loading");
    setTimeout(() => pageState.setState("ready"), 1000);
  };

  const handleTrySOL = useCallback(() => {
    handleSelectMarket("SOL");
    pageState.setState("ready");
  }, [handleSelectMarket, pageState]);

  // Check if viewing asset hub
  const isAssetHub = !!assetId && isValidSolanaBase58(assetId);
  const hasChartData = !!selectedSymbol;

  // Loading state
  if (pageState.isLoading) {
    return (
      <PageContainer testId="page-research">
        <h1 className="sr-only">Research</h1>
        <ChartSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (pageState.isError) {
    return (
      <PageContainer testId="page-research">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Research
          </h1>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load research data. Please try again.</span>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    );
  }

  // Watchlist panel content
  const WatchlistPanelContent = () => (
    <div className="space-y-4">
      <WatchlistQuickAdd ref={quickAddRef} onAdd={handleAddSymbol} />
      
      {watchlistItems.length === 0 ? (
        <WatchlistEmptyState onAddClick={() => quickAddRef.current?.focus()} />
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-2 pr-4">
            {watchlistItems.map((item) => (
              <WatchlistItemRow
                key={item.id}
                item={item}
                isSelected={item.symbol === selectedWatchlistSymbol}
                onSelect={() => handleWatchlistSelect(item.symbol)}
                onRemove={() => handleRemoveSymbol(item.symbol)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  return (
    <PageContainer testId="page-research">
      <h1 className="sr-only">Research</h1>
      
      {/* Trading Wallet Context */}
      <TradingWalletHint className="mb-2" />

      <div className="space-y-4">
        {queryError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{queryError}</AlertDescription>
          </Alert>
        )}

        {/* Replay mode indicator */}
        {isReplayMode && (
          <Alert>
            <Play className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Replay mode active</span>
              <Button variant="outline" size="sm" onClick={() => handleReplayToggle(false)}>
                Exit Replay
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Top Bar */}
        <ChartTopBar
          symbol={selectedSymbol}
          timeframe={selectedTimeframe}
          onTimeframeChange={setSelectedTimeframe}
          isReplayMode={isReplayMode}
          onReplayToggle={handleReplayToggle}
          onMobileToolsOpen={() => setToolsSheetOpen(true)}
          isMobile={isMobile}
        />

        {/* Action bar with watchlist toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={isWatchlistPanelOpen ? "secondary" : "outline"}
            size="sm"
            onClick={handleToggleWatchlistPanel}
            data-testid="research-watchlist-toggle"
          >
            <Eye className="h-4 w-4 mr-2" />
            Watchlist
          </Button>
          
          <MarketsBanner
            selectedMarket={selectedSymbol}
            onSelectMarket={handleSelectMarket}
            watchlistItems={markets}
          />
        </div>

        {/* Main layout */}
        <div className="flex gap-4">
          {/* Watchlist panel (desktop - inline) */}
          {!isMobile && isWatchlistPanelOpen && (
            <div className="w-64 shrink-0 border rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Watchlist</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleToggleWatchlistPanel}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <WatchlistPanelContent />
            </div>
          )}

          {/* Center content */}
          <div className="flex-1 space-y-3 min-w-0">
            {!isReplayMode && (
              <DrawingToolbar
                activeTool={toolsStore.activeTool}
                onToolChange={toolsStore.selectTool}
                canUndo={toolsStore.canUndo}
                canRedo={toolsStore.canRedo}
                onUndo={toolsStore.undo}
                onRedo={toolsStore.redo}
                onClear={toolsStore.clearDrawings}
                hasDrawings={toolsStore.drawings.length > 0}
                elliottStep={toolsStore.elliottPlacement.active ? toolsStore.elliottPlacement.step : undefined}
              />
            )}

            {/* Chart Canvas or Empty state */}
            {hasChartData ? (
              <ChartCanvas symbol={selectedSymbol} timeframe={selectedTimeframe} />
            ) : (
              <div
                data-testid="chart-canvas-container"
                className="min-h-[360px] md:min-h-[480px] lg:min-h-[520px] border border-border/50 rounded-lg bg-card/30 flex flex-col items-center justify-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Select a market to view chart</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={handleTrySOL}>
                      Try SOL
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleToggleWatchlistPanel}>
                      <Eye className="h-4 w-4 mr-2" />
                      Open Watchlist
                    </Button>
                  </div>
                </div>
                {/* BACKEND HOOK (unchanged): integrate chart library */}
              </div>
            )}

            {/* Asset Hub section (when viewing /research/:assetId) */}
            {isAssetHub && (
              <section data-testid="section-grok-pulse" className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Asset Analysis</h2>
                <GrokPulseCard address={assetId} />
              </section>
            )}

            {/* Chart Feed Panel */}
            {selectedSymbol && !isReplayMode && (
              <ChartFeedPanel assetId={selectedSymbol} />
            )}

            {/* Bottom Cards Carousel */}
            <BottomCardsCarousel
              oracleInsights={oracleInsights}
              journalNotes={journalEntries}
            />
          </div>

          {/* Right panel - Tools/Indicators (desktop, lg+) */}
          {!isMobile && !isReplayMode && (
            <div className="hidden lg:block">
              <ResearchToolsPanel
                store={toolsStore}
                onOpenAIAnalyzer={() => setAiAnalyzerOpen(true)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile watchlist sheet */}
      <Sheet open={isMobile && isWatchlistPanelOpen} onOpenChange={(open) => {
        if (!open) handleToggleWatchlistPanel();
      }}>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Watchlist</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <WatchlistPanelContent />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile tools sheet */}
      <ResearchToolsSheet
        isOpen={toolsSheetOpen}
        onOpenChange={setToolsSheetOpen}
        store={toolsStore}
        onOpenAIAnalyzer={() => {
          setToolsSheetOpen(false);
          setAiAnalyzerOpen(true);
        }}
      />

      {/* AI TA Analyzer Dialog */}
      <AITAAnalyzerDialog
        isOpen={aiAnalyzerOpen}
        onOpenChange={setAiAnalyzerOpen}
        selectedMarket={selectedSymbol}
        selectedTimeframe={selectedTimeframe}
        isReplayMode={isReplayMode}
      />
    </PageContainer>
  );
}

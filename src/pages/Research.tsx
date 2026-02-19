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
import { Navigate, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { ScreenState } from "@/components/layout/ScreenState";
import { useChartStub, useOracleStub } from "@/stubs/hooks";
import { useJournalApi } from "@/services/journal";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResearchTerminalSync } from "@/components/Research/ResearchTerminalSync";
import { EmbeddedTerminal } from "@/components/terminal/EmbeddedTerminal";
import { isResearchEmbedTerminalEnabled } from "@/lib/env";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";
import { useDiscoverStore } from "@/lib/state/discoverStore";
import { AlertCircle, BarChart3, X, Eye, Play, Terminal as TerminalIcon, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { routeHelpers, isValidSolanaBase58 } from "@/routes/routes";
import { parseResearchChartQuery } from "@/utils/researchQuery";
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
import { cn } from "@/lib/utils";
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
  const [searchParams] = useSearchParams();
  const { assetId } = useParams<{ assetId?: string }>();

  // Canonical normalization: ensure view=chart
  const view = searchParams.get("view");
  if (view !== "chart") {
    const params = new URLSearchParams(searchParams);
    params.set("view", "chart");

    // If /research/:assetId is used, preserve the path segment during normalization.
    // This allows /research/:assetId to coexist with query params (canonical UI state).
    const basePath = assetId
      ? `/research/${encodeURIComponent(assetId)}`
      : "/research";

    return <Navigate to={`${basePath}?${params.toString()}`} replace />;
  }

  // Render workspace only once canonical URL state is present.
  // This avoids conditional hook execution across renders (Rules of Hooks).
  return <ResearchWorkspace />;
}

function ResearchWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { assetId } = useParams<{ assetId?: string }>();
  const isMobile = useIsMobile();
  
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
  const [tradingTerminalOpen, setTradingTerminalOpen] = useState(false);
  
  // Feature flag: Enable embedded trading terminal
  const isEmbedTerminalEnabled = isResearchEmbedTerminalEnabled();
  
  // Research tools store (indicators, drawings, Elliott Wave)
  const toolsStore = useResearchToolsStore();
  
  // Discover store for overlay management
  const closeOverlay = useDiscoverStore((s) => s.closeOverlay);

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

    const parsed = parseResearchChartQuery(q);
    if (parsed.kind === "invalid") {
      // Do not hard-block. Backend decides; frontend should handle backend errors gracefully.
      setQueryError(
        "Query looks unusual. Expected ticker (1–15, A-Z/0-9/._-) or Solana-like address (32–44)."
      );
      setSelectedSymbol(parsed.raw);
      return;
    }

    setQueryError(null);
    setSelectedSymbol(parsed.normalized);
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
      const parsed = parseResearchChartQuery(symbol);
      const q = parsed.kind === "invalid" ? parsed.raw : parsed.normalized;

      setSelectedSymbol(q);

      navigate(
        routeHelpers.research({
          q,
          panel: isWatchlistPanelOpen ? "watchlist" : undefined,
          replay: isReplayMode,
        }),
        { replace: true }
      );
      // BACKEND HOOK (unchanged): fetch chart data for selected market
    },
    [navigate, isWatchlistPanelOpen, isReplayMode, setSelectedSymbol]
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
        <ScreenState status="loading" loadingVariant={<ChartSkeleton />} />
      </PageContainer>
    );
  }

  // Error state
  if (pageState.isError) {
    return (
      <PageContainer testId="page-research">
        <ScreenState
          status="error"
          onRetry={handleRetry}
          errorTitle="Failed to load Research"
          errorMessage="Please try again."
        />
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
    <PageContainer 
      testId="page-research"
      className={cn(tradingTerminalOpen && "sf-focusMode")}
    >
      <h1 className="sr-only">Research</h1>
      
      {/* Research → Terminal Sync (one-way, feature-flagged) */}
      {isEmbedTerminalEnabled && (
        <ResearchTerminalSync selectedSymbol={selectedSymbol} />
      )}
      
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
            <div className="w-64 shrink-0 sf-panel p-4 sf-dimmable">
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
          <div className="flex-1 space-y-3 min-w-0 sf-dimmable">
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
                className="sf-chartPlaceholder"
              >
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Select a market to begin…</p>
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

            {/* Trading Terminal (feature-flagged) */}
            {isEmbedTerminalEnabled && (
              <Collapsible open={tradingTerminalOpen} onOpenChange={setTradingTerminalOpen}>
                <div className="space-y-2" data-focus-exempt>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => {
                        if (!tradingTerminalOpen) {
                          setTradingTerminalOpen(true);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <TerminalIcon className="h-4 w-4" />
                        <span>Trading Terminal</span>
                      </div>
                      {tradingTerminalOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ErrorBoundary scope="TradingTerminal" onReset={() => {
                      // Close overlays and reset terminal state
                      closeOverlay();
                      setTradingTerminalOpen(false);
                    }}>
                      <EmbeddedTerminal />
                    </ErrorBoundary>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
          </div>

          {/* Right panel - Tools/Indicators (desktop, lg+) */}
          {!isMobile && !isReplayMode && (
            <div className="hidden lg:block sf-dimmable">
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

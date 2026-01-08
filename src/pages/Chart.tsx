import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { useChartStub, useOracleStub } from "@/stubs/hooks";
import { useJournalApi } from "@/services/journal";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, BarChart3 } from "lucide-react";
import { isValidChartQuery, normalizeChartQuery } from "@/routes/routes";
import {
  ChartTopBar,
  ChartToolbar,
  ChartCanvas,
  ToolsIndicatorsPanel,
  ToolsIndicatorsSheet,
  ChartSkeleton,
} from "@/components/chart";
import { MarketsBanner } from "@/components/chart/MarketsBanner";
import { BottomCardsCarousel } from "@/components/chart/BottomCardsCarousel";
import { AITAAnalyzerDialog } from "@/components/chart/AITAAnalyzerDialog";
import { ChartFeedPanel } from "@/components/feed";

export default function Chart() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const {
    pageState,
    markets,
    selectedSymbol,
    selectedTimeframe,
    setSelectedSymbol,
    setSelectedTimeframe,
  } = useChartStub();

  // Get oracle and journal data for bottom cards
  const { insights: oracleInsights } = useOracleStub();
  const { entries: journalEntries } = useJournalApi();

  // Chart query param (frozen): /chart?q=<query>
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("q");
    if (!q) {
      setQueryError(null);
      return;
    }

    if (!isValidChartQuery(q)) {
      setQueryError(
        'Ungültiger "q" Parameter: erlaubt sind Ticker (1–15, A-Z/0-9/._-) oder Solana Base58 (32–44).'
      );
      return;
    }

    setQueryError(null);
    setSelectedSymbol(normalizeChartQuery(q));
    // BACKEND_TODO: trigger fetch for selected market
  }, [searchParams, setSelectedSymbol]);

  // UI state
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [aiAnalyzerOpen, setAiAnalyzerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState("cursor");
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);
  const [enabledIndicators, setEnabledIndicators] = useState<string[]>(["sma"]);

  const isReplayMode = searchParams.get("replay") === "true";

  const handleReplayToggle = useCallback(
    (enabled: boolean) => {
      if (!enabled) return;
      const params = new URLSearchParams(searchParams);
      params.set("view", "chart");
      params.set("replay", "true");
      if (selectedSymbol) {
        params.set("q", selectedSymbol);
      } else {
        params.delete("q");
      }
      const query = params.toString();
      navigate(`/research${query ? `?${query}` : ""}`);
    },
    [navigate, selectedSymbol, searchParams]
  );

  const handleToggleIndicator = useCallback((id: string) => {
    setEnabledIndicators((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleRetry = () => {
    pageState.setState("loading");
    setTimeout(() => pageState.setState("ready"), 1000);
  };

  const handleSelectMarket = useCallback(
    (symbol: string) => {
      setSelectedSymbol(symbol);
      // BACKEND_TODO: fetch chart data for selected market
    },
    [setSelectedSymbol]
  );

  const handleTrySOL = useCallback(() => {
    handleSelectMarket("SOL");
    pageState.setState("ready");
  }, [handleSelectMarket, pageState]);

  // Loading state
  if (pageState.isLoading) {
    return (
      <PageContainer testId="page-research">
        <h1 className="sr-only">Chart</h1>
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
            Chart
          </h1>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load chart data. Please try again.</span>
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

  // Check if we have chart data (stub: selectedSymbol exists)
  const hasChartData = !!selectedSymbol;

  // Ready state
  return (
    <PageContainer testId="page-research">
      <h1 className="sr-only">Chart</h1>

      <div className="space-y-4">
        {queryError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{queryError}</AlertDescription>
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

        {/* Markets Banner (replaces left sidebar) */}
        <MarketsBanner
          selectedMarket={selectedSymbol}
          onSelectMarket={handleSelectMarket}
          watchlistItems={markets}
        />

        {/* Main layout - maximized chart width */}
        <div className="flex gap-4">
          {/* Center content - full width on mobile, with right panel on desktop */}
          <div className="flex-1 space-y-3 min-w-0">
            <ChartToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              crosshairEnabled={crosshairEnabled}
              onCrosshairToggle={setCrosshairEnabled}
            />

            {/* Chart Canvas with empty overlay */}
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
                  </div>
                </div>
                {/* BACKEND_TODO: integrate chart library */}
              </div>
            )}

            {/* Chart Feed Panel (Oracle | Pulse toggle) */}
            {selectedSymbol && (
              <ChartFeedPanel assetId={selectedSymbol} />
            )}

            {/* Bottom Cards Carousel (Oracle / Journal Notes) */}
            <BottomCardsCarousel
              oracleInsights={oracleInsights}
              journalNotes={journalEntries}
            />
          </div>

          {/* Right panel (desktop only, lg+) */}
          {!isMobile && (
            <div className="hidden lg:block">
              <ToolsIndicatorsPanel
                enabledIndicators={enabledIndicators}
                onToggleIndicator={handleToggleIndicator}
                onOpenAIAnalyzer={() => setAiAnalyzerOpen(true)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile tools sheet */}
      <ToolsIndicatorsSheet
        isOpen={toolsSheetOpen}
        onOpenChange={setToolsSheetOpen}
        enabledIndicators={enabledIndicators}
        onToggleIndicator={handleToggleIndicator}
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
        isReplayMode={false}
      />
    </PageContainer>
  );
}

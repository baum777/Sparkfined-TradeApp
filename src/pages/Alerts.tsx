import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { ScreenState } from "@/components/layout/ScreenState";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertsHeader,
  AlertsQuickCreate,
  AlertsFilterBar,
  AlertCard,
  AlertsEmptyState,
  AlertsFilterEmpty,
  AlertsSkeleton,
  useAlertsStore,
  type PrefillData,
} from "@/components/alerts";
import { TradingWalletHint } from "@/components/common";

export default function Alerts() {
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    pageState,
    alerts,
    filteredAlerts,
    filter,
    setFilter,
    createSimpleAlert,
    createTwoStageAlert,
    createDeadTokenAlert,
    deleteAlert,
    togglePause,
    cancelWatch,
    applyPrefill,
  } = useAlertsStore();

  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<PrefillData | undefined>();
  const prefillAppliedRef = useRef(false);

  // URL prefill - apply once on mount
  useEffect(() => {
    if (prefillAppliedRef.current) return;

    const data = applyPrefill(searchParams);
    if (data) {
      prefillAppliedRef.current = true;
      setPrefillData(data);
      setIsQuickCreateOpen(true);
      toast.info("Prefilled from link");

      // Clean query params
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, applyPrefill]);

  const handleCreateClick = () => {
    setPrefillData(undefined);
    setIsQuickCreateOpen(true);
  };

  const handleExampleClick = (example: {
    symbol: string;
    condition: string;
    targetPrice: number;
  }) => {
    setPrefillData({
      symbol: example.symbol,
      condition: example.condition,
      target: example.targetPrice,
      type: "simple",
    });
    setIsQuickCreateOpen(true);
  };

  const handleSimpleSubmit = (params: Parameters<typeof createSimpleAlert>[0]) => {
    createSimpleAlert(params);
    toast.success("Alert created");
  };

  const handleTwoStageSubmit = (params: Parameters<typeof createTwoStageAlert>[0]) => {
    createTwoStageAlert(params);
    toast.success("2-Stage alert created");
  };

  const handleDeadTokenSubmit = (params: Parameters<typeof createDeadTokenAlert>[0]) => {
    createDeadTokenAlert(params);
    toast.success("Dead Token alert created");
  };

  const handleRetry = () => {
    pageState.setState("loading");
    setTimeout(() => pageState.setState("ready"), 1000);
  };

  const handleDelete = (id: string) => {
    deleteAlert(id);
    toast.success("Alert deleted");
  };

  const handleCancelWatch = (id: string) => {
    cancelWatch(id);
    toast.info("Watch cancelled");
  };

  const isListEmpty = alerts.length === 0;
  const isFilterEmpty = filteredAlerts.length === 0 && !isListEmpty;

  // Loading state
  if (pageState.isLoading) {
    return (
      <PageContainer testId="page-alerts">
        <ScreenState status="loading" loadingVariant={<AlertsSkeleton />} />
      </PageContainer>
    );
  }

  // Error state
  if (pageState.isError) {
    return (
      <PageContainer testId="page-alerts">
        <ScreenState
          status="error"
          onRetry={handleRetry}
          errorTitle="Failed to load Alerts"
          errorMessage="Please try again."
        />
      </PageContainer>
    );
  }

  // Empty state (pageState.isEmpty OR no alerts)
  if (pageState.isEmpty || isListEmpty) {
    return (
      <PageContainer testId="page-alerts">
        <div className="space-y-6">
          <AlertsHeader onCreateClick={handleCreateClick} />

          <AlertsQuickCreate
            isOpen={isQuickCreateOpen}
            onOpenChange={setIsQuickCreateOpen}
            onSubmitSimple={handleSimpleSubmit}
            onSubmitTwoStage={handleTwoStageSubmit}
            onSubmitDeadToken={handleDeadTokenSubmit}
            prefillData={prefillData}
          />

          <AlertsEmptyState
            onCreateClick={handleCreateClick}
            onExampleClick={handleExampleClick}
          />
        </div>
      </PageContainer>
    );
  }

  // Ready state with alerts
  return (
    <PageContainer testId="page-alerts">
      <div className="space-y-6">
        <AlertsHeader onCreateClick={handleCreateClick} />

        {/* Trading Wallet Context */}
        <TradingWalletHint className="mb-2" />

        <AlertsQuickCreate
          isOpen={isQuickCreateOpen}
          onOpenChange={setIsQuickCreateOpen}
          onSubmitSimple={handleSimpleSubmit}
          onSubmitTwoStage={handleTwoStageSubmit}
          onSubmitDeadToken={handleDeadTokenSubmit}
          prefillData={prefillData}
        />

        <AlertsFilterBar
          filter={filter}
          onFilterChange={setFilter}
          resultsCount={filteredAlerts.length}
          totalCount={alerts.length}
        />

        {isFilterEmpty ? (
          <AlertsFilterEmpty onClearFilter={() => setFilter("all")} />
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onTogglePause={togglePause}
                onDelete={handleDelete}
                onCancelWatch={handleCancelWatch}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

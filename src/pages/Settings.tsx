import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { ScreenState } from "@/components/layout/ScreenState";
import {
  SettingsSectionCard,
  SettingsRow,
  SettingsSkeleton,
  useSettingsStore,
  useUsageStore,
  TierBudgetsSection,
  UsageCountersSection,
  ProviderParamsSection,
  CacheOfflineSection,
  PushAlertsSection,
  PrivacyDiagnosticsSection,
  TradingWalletSection,
} from "@/components/settings";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePageState } from "@/stubs/pageState";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { 
  Wallet, 
  Check, 
  Bell, 
  Download, 
  Upload, 
  RotateCcw,
  RefreshCw
} from "lucide-react";

export default function Settings() {
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const pageState = usePageState("ready");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL section param for deep linking (consolidated from /settings/*)
  const urlSection = searchParams.get("section");
  
  // Map URL section param to accordion value
  const sectionMapping: Record<string, string> = {
    providers: "provider-params",
    data: "cache-offline",
    experiments: "privacy-diagnostics",
    privacy: "privacy-diagnostics",
  };

  // Default open sections based on URL
  const defaultOpenSections = useMemo(() => {
    if (urlSection && sectionMapping[urlSection]) {
      return [sectionMapping[urlSection]];
    }
    return [];
  }, [urlSection]);

  // Stores
  const settingsStore = useSettingsStore();
  const usageStore = useUsageStore();

  // Compute usedToday from usage store
  const usedToday: Record<string, Record<string, number>> = usageStore.usage.counters.callsToday;

  // Wallet connection (UI-only stub)
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  // Notification toggles (UI-only)
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [signalConfirmations, setSignalConfirmations] = useState(true);
  const [dailyOracleTakeaway, setDailyOracleTakeaway] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>("default");

  // Dialogs
  const [resetDefaultsDialogOpen, setResetDefaultsDialogOpen] = useState(false);
  const [resetCountersDialogOpen, setResetCountersDialogOpen] = useState(false);

  // Handlers
  const handleConnectWallet = () => {
    setIsWalletConnected(true);
    toast({ title: "Wallet connected", description: "Demo wallet connected successfully." });
    // BACKEND_TODO: real wallet connect
  };

  const handleDisconnectWallet = () => {
    setIsWalletConnected(false);
    setDisconnectDialogOpen(false);
    toast({ title: "Wallet disconnected", description: "Your wallet has been disconnected." });
    // BACKEND_TODO: real wallet disconnect
  };

  const handleRequestPermission = () => {
    setNotificationPermission("granted");
    toast({ title: "Permission granted", description: "Browser notifications enabled." });
    // BACKEND_TODO: real permission + SW push
  };

  const handleExportSettings = () => {
    settingsStore.exportSettings();
    toast({ title: "Settings exported", description: "Settings file downloaded." });
  };

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = settingsStore.importSettings(content);
        if (result.success) {
          toast({ title: "Settings imported", description: "Settings applied successfully." });
        } else {
          toast({ title: "Import failed", description: result.error || "Invalid settings file.", variant: "destructive" });
        }
      } catch {
        toast({ title: "Import failed", description: "Could not read file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleResetDefaults = () => {
    settingsStore.resetToDefaults();
    setResetDefaultsDialogOpen(false);
    toast({ title: "Reset complete", description: "Settings reset to defaults." });
  };

  const handleResetCounters = () => {
    usageStore.resetCounters();
    setResetCountersDialogOpen(false);
    toast({ title: "Counters reset", description: "Usage counters have been cleared." });
  };

  const handleApplyTierDefaults = () => {
    settingsStore.applyTierDefaults();
    toast({ title: "Tier defaults applied", description: "All budgets reset to tier defaults." });
  };

  const handleCopyDiagnostics = () => {
    const diagnostics = usageStore.exportDiagnostics();
    navigator.clipboard.writeText(diagnostics);
    toast({ title: "Copied", description: "Diagnostics copied to clipboard." });
  };

  const handleExportMetrics = () => {
    const diagnostics = usageStore.exportDiagnostics();
    const blob = new Blob([diagnostics], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sparkfined-metrics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Metrics file downloaded." });
  };

  // Path-based update for nested settings
  const handlePathUpdate = (path: string, value: boolean | number | string) => {
    const parts = path.split('.');
    const settings = settingsStore.settings as unknown as Record<string, unknown>;
    
    if (parts.length === 2) {
      const [section, key] = parts;
      const currentSection = settings[section] as Record<string, unknown> || {};
      settingsStore.updateSettings({
        [section]: {
          ...currentSection,
          [key]: value,
        },
      });
    } else if (parts.length === 3) {
      const [section, subsection, key] = parts;
      const currentSection = settings[section] as Record<string, unknown> || {};
      const currentSubsection = currentSection[subsection] as Record<string, unknown> || {};
      settingsStore.updateSettings({
        [section]: {
          ...currentSection,
          [subsection]: {
            ...currentSubsection,
            [key]: value,
          },
        },
      });
    }
  };

  const handleThrottleChange = (field: 'maxCallsPerMinute' | 'maxConcurrentCalls', value: number) => {
    settingsStore.updateSettings({
      tier: {
        ...settingsStore.settings.tier,
        [field]: value,
        customThrottles: true,
      },
    });
  };

  // Action bar
  const ActionBar = () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportSettings}
        data-testid="btn-export-settings"
      >
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        data-testid="btn-import-settings"
      >
        <Upload className="mr-2 h-4 w-4" />
        Import
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportSettings}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setResetDefaultsDialogOpen(true)}
        data-testid="btn-reset-defaults"
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Reset defaults
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setResetCountersDialogOpen(true)}
        data-testid="btn-reset-counters"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Reset counters
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleApplyTierDefaults}
        data-testid="btn-apply-tier-defaults"
      >
        Apply tier defaults
      </Button>
    </div>
  );

  // Connection Section
  const ConnectionSection = () => (
    <div className="space-y-4">
      <SettingsRow
        label="Wallet status"
        description={isWalletConnected ? "Your wallet is connected" : "Connect a wallet to unlock all features"}
      >
        <Badge variant={isWalletConnected ? "default" : "secondary"}>
          {isWalletConnected ? "Connected" : "Not connected"}
        </Badge>
      </SettingsRow>
      <div className="flex flex-wrap gap-2">
        {!isWalletConnected ? (
          <Button onClick={handleConnectWallet}>
            <Wallet className="mr-2 h-4 w-4" />
            Connect wallet
          </Button>
        ) : (
          <Button
            variant="outline"
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => setDisconnectDialogOpen(true)}
          >
            Disconnect
          </Button>
        )}
      </div>
      {/* BACKEND_TODO: real wallet connect */}
    </div>
  );

  // App Preferences Section
  const AppPreferencesSection = () => (
    <div className="space-y-4">
      <SettingsRow label="Theme" description="Dark mode only (v1)">
        <Badge variant="secondary">Dark</Badge>
      </SettingsRow>
      <SettingsRow label="Reduce motion" description="Minimize animations throughout the app">
        <Switch
          checked={settingsStore.settings.ui.reduceMotion}
          onCheckedChange={(checked) => 
            settingsStore.updateSettings({
              ui: { ...settingsStore.settings.ui, reduceMotion: checked }
            })
          }
          aria-label="Reduce motion"
        />
      </SettingsRow>
      <SettingsRow label="Compact mode" description="Use tighter spacing for more content">
        <Switch
          checked={settingsStore.settings.ui.compactMode}
          onCheckedChange={(checked) => 
            settingsStore.updateSettings({
              ui: { ...settingsStore.settings.ui, compactMode: checked }
            })
          }
          aria-label="Compact mode"
        />
      </SettingsRow>
      {/* BACKEND_TODO: sync across devices */}
    </div>
  );

  // Notifications Section
  const NotificationsSection = () => (
    <div className="space-y-4">
      <SettingsRow label="Price alerts" description="Get notified when price targets are hit">
        <Switch
          checked={priceAlerts}
          onCheckedChange={setPriceAlerts}
          aria-label="Price alerts"
        />
      </SettingsRow>
      <SettingsRow label="Signal confirmations" description="Notifications for trade signal confirmations">
        <Switch
          checked={signalConfirmations}
          onCheckedChange={setSignalConfirmations}
          aria-label="Signal confirmations"
        />
      </SettingsRow>
      <SettingsRow label="Daily Oracle takeaway" description="Receive the daily Oracle summary">
        <Switch
          checked={dailyOracleTakeaway}
          onCheckedChange={setDailyOracleTakeaway}
          aria-label="Daily Oracle takeaway"
        />
      </SettingsRow>
      <div className="rounded-md bg-muted/50 p-3 space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Bell className="h-3.5 w-3.5" />
          Browser notifications require permission
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestPermission}
            disabled={notificationPermission === "granted"}
          >
            {notificationPermission === "granted" ? "Permission granted" : "Request permission"}
          </Button>
          {notificationPermission === "granted" && (
            <Badge variant="secondary" className="text-xs">
              <Check className="mr-1 h-3 w-3" />
              Enabled
            </Badge>
          )}
        </div>
      </div>
      {/* BACKEND_TODO: real permission + SW push */}
    </div>
  );

  // Loading state
  if (pageState.state === "loading") {
    return (
      <PageContainer testId="page-settings">
        <ScreenState status="loading" loadingVariant={<SettingsSkeleton />} />
      </PageContainer>
    );
  }

  // Error state
  if (pageState.state === "error") {
    return (
      <PageContainer testId="page-settings">
        <ScreenState
          status="error"
          errorTitle="Failed to load Settings"
          errorMessage="Please try again."
          onRetry={() => {
            pageState.setState("loading");
            setTimeout(() => pageState.setState("ready"), 1000);
          }}
        />
      </PageContainer>
    );
  }

  // Ready state
  return (
    <PageContainer testId="page-settings">
      <div className="space-y-6">
        {/* Header with action bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Control Center • Tier • Budgets • Counters</p>
          </div>
          {!isMobile && <ActionBar />}
        </div>

        {/* Mobile action bar */}
        {isMobile && (
          <div className="overflow-x-auto pb-2">
            <ActionBar />
          </div>
        )}

        {/* Desktop: 2-column layout */}
        {!isMobile ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column: Primary sections */}
            <div className="space-y-4">
              {/* Tier & Budgets */}
              <TierBudgetsSection
                settings={settingsStore.settings}
                usedToday={usedToday}
                onTierChange={settingsStore.updateTier}
                onBudgetChange={settingsStore.updateBudget}
                onToggleCustom={settingsStore.toggleBudgetCustom}
                onThrottleChange={handleThrottleChange}
                isEditable={settingsStore.isEditable}
              />

              {/* Usage & Counters */}
              <UsageCountersSection
                usage={usageStore.usage}
                totalCallsToday={usageStore.totalCallsToday}
                totalErrorsToday={usageStore.totalErrorsToday}
                totalCacheHits={usageStore.totalCacheHits}
                overallAvgLatency={usageStore.overallAvgLatency}
                onResetCounters={() => setResetCountersDialogOpen(true)}
                onCopyDiagnostics={handleCopyDiagnostics}
              />

              {/* Trading Wallet */}
              <SettingsSectionCard title="Trading Wallet" description="Your Solana wallet for trade detection">
                <TradingWalletSection />
              </SettingsSectionCard>

              {/* Connection */}
              <SettingsSectionCard title="Connection" description="Wallet connection status">
                <ConnectionSection />
              </SettingsSectionCard>

              {/* App Preferences */}
              <SettingsSectionCard title="App Preferences" description="Theme and display settings">
                <AppPreferencesSection />
              </SettingsSectionCard>

              {/* Notifications */}
              <SettingsSectionCard title="Notifications" description="Alert and notification settings">
                <NotificationsSection />
              </SettingsSectionCard>
            </div>

            {/* Right column: Advanced sections */}
            <div className="space-y-4">
              {/* Provider Params */}
              <ProviderParamsSection
                settings={settingsStore.settings}
                isEditable={settingsStore.isEditable}
                onUpdate={handlePathUpdate}
              />

              {/* Cache & Offline */}
              <CacheOfflineSection
                settings={settingsStore.settings}
                onUpdate={handlePathUpdate}
              />

              {/* Push & Alerts */}
              <PushAlertsSection
                settings={settingsStore.settings}
                onUpdate={handlePathUpdate}
              />

              {/* Privacy & Diagnostics */}
              <PrivacyDiagnosticsSection
                settings={settingsStore.settings}
                onUpdate={handlePathUpdate}
                onExportSettings={handleExportSettings}
                onExportMetrics={handleExportMetrics}
              />
            </div>
          </div>
        ) : (
          // Mobile: Accordion layout
          <Accordion type="single" collapsible className="space-y-2" defaultValue={defaultOpenSections[0]}>
            {/* Tier & Budgets */}
            <AccordionItem value="tier-budgets" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="font-medium">Tier & Budgets</div>
                  <div className="text-xs text-muted-foreground">API limits and usage quotas</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <TierBudgetsSection
                  settings={settingsStore.settings}
                  usedToday={usedToday}
                  onTierChange={settingsStore.updateTier}
                  onBudgetChange={settingsStore.updateBudget}
                  onToggleCustom={settingsStore.toggleBudgetCustom}
                  onThrottleChange={handleThrottleChange}
                  isEditable={settingsStore.isEditable}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Usage & Counters */}
            <AccordionItem value="usage-counters" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="font-medium">Usage & Counters</div>
                  <div className="text-xs text-muted-foreground">API call statistics</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <UsageCountersSection
                  usage={usageStore.usage}
                  totalCallsToday={usageStore.totalCallsToday}
                  totalErrorsToday={usageStore.totalErrorsToday}
                  totalCacheHits={usageStore.totalCacheHits}
                  overallAvgLatency={usageStore.overallAvgLatency}
                  onResetCounters={() => setResetCountersDialogOpen(true)}
                  onCopyDiagnostics={handleCopyDiagnostics}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Trading Wallet */}
            <AccordionItem value="trading-wallet" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="font-medium">Trading Wallet</div>
                  <div className="text-xs text-muted-foreground">Solana wallet for trade detection</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <TradingWalletSection />
              </AccordionContent>
            </AccordionItem>

            {/* Connection */}
            <AccordionItem value="connection" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="font-medium">Connection</div>
                  <div className="text-xs text-muted-foreground">Wallet connection status</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <ConnectionSection />
              </AccordionContent>
            </AccordionItem>

            {/* App Preferences */}
            <AccordionItem value="preferences" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="font-medium">App Preferences</div>
                  <div className="text-xs text-muted-foreground">Theme and display settings</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <AppPreferencesSection />
              </AccordionContent>
            </AccordionItem>

            {/* Notifications */}
            <AccordionItem value="notifications" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="font-medium">Notifications</div>
                  <div className="text-xs text-muted-foreground">Alert and notification settings</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <NotificationsSection />
              </AccordionContent>
            </AccordionItem>

            {/* Provider Params */}
            <AccordionItem value="provider-params" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="font-medium">Provider Params</div>
                  <div className="text-xs text-muted-foreground">AI model configuration</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <ProviderParamsSection
                  settings={settingsStore.settings}
                  isEditable={settingsStore.isEditable}
                  onUpdate={handlePathUpdate}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Cache & Offline */}
            <AccordionItem value="cache-offline" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="font-medium">Cache & Offline</div>
                  <div className="text-xs text-muted-foreground">Data persistence settings</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <CacheOfflineSection
                  settings={settingsStore.settings}
                  onUpdate={handlePathUpdate}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Push & Alerts */}
            <AccordionItem value="push-alerts" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="font-medium">Push & Alerts</div>
                  <div className="text-xs text-muted-foreground">Push notification settings</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <PushAlertsSection
                  settings={settingsStore.settings}
                  onUpdate={handlePathUpdate}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Privacy & Diagnostics */}
            <AccordionItem value="privacy-diagnostics" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="text-left">
                  <div className="font-medium">Privacy & Diagnostics</div>
                  <div className="text-xs text-muted-foreground">Data handling and debug options</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <PrivacyDiagnosticsSection
                  settings={settingsStore.settings}
                  onUpdate={handlePathUpdate}
                  onExportSettings={handleExportSettings}
                  onExportMetrics={handleExportMetrics}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      {/* Disconnect wallet confirmation dialog */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect wallet?</DialogTitle>
            <DialogDescription>
              This will disconnect your wallet from the app. You can reconnect at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisconnectWallet}>
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset defaults confirmation dialog */}
      <Dialog open={resetDefaultsDialogOpen} onOpenChange={setResetDefaultsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset to defaults?</DialogTitle>
            <DialogDescription>
              This will reset all settings to their default values for your current tier. Custom budget overrides will be cleared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDefaultsDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetDefaults}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset counters confirmation dialog */}
      <Dialog open={resetCountersDialogOpen} onOpenChange={setResetCountersDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset usage counters?</DialogTitle>
            <DialogDescription>
              This will clear all usage statistics including call counts, errors, and latency data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetCountersDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetCounters}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

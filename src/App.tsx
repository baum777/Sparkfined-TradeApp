import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

// Primary pages
import Dashboard from "@/pages/Dashboard";
import Research from "@/pages/Research";
import Journal from "@/pages/Journal";
import Insights from "@/pages/Insights";
import Alerts from "@/pages/Alerts";
import SettingsPage from "@/pages/SettingsPage";

// Secondary pages
import JournalEntry from "@/pages/JournalEntry";
import NotFound from "@/pages/NotFound";

// Journal queue sync runner
import { startJournalQueueSync } from "@/services/journal/queueStore";

const queryClient = new QueryClient();

// Redirect components for legacy routes
function ChartRedirect() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q");
  return <Navigate to={q ? `/research?q=${q}` : "/research"} replace />;
}

function WatchlistRedirect() {
  return <Navigate to="/research?panel=watchlist" replace />;
}

function ReplayRedirect() {
  return <Navigate to="/research?replay=true" replace />;
}

function AssetRedirect({ assetId }: { assetId: string }) {
  return <Navigate to={`/research/${assetId}`} replace />;
}

function OracleRedirect() {
  const [searchParams] = useSearchParams();
  const params = searchParams.toString();
  return <Navigate to={params ? `/insights?${params}` : "/insights"} replace />;
}

function OracleInboxRedirect() {
  return <Navigate to="/insights?filter=unread" replace />;
}

function OracleStatusRedirect() {
  return <Navigate to="/insights?mode=status" replace />;
}

function OracleInsightRedirect({ insightId }: { insightId: string }) {
  return <Navigate to={`/insights/${insightId}`} replace />;
}

function LearnRedirect() {
  return <Navigate to="/journal?mode=learn" replace />;
}

function HandbookRedirect() {
  return <Navigate to="/journal?mode=playbook" replace />;
}

function JournalReviewRedirect() {
  return <Navigate to="/journal?mode=inbox" replace />;
}

function JournalInsightsRedirect() {
  return <Navigate to="/journal?mode=learn" replace />;
}

function SettingsProvidersRedirect() {
  return <Navigate to="/settings?section=providers" replace />;
}

function SettingsDataRedirect() {
  return <Navigate to="/settings?section=data" replace />;
}

function SettingsExperimentsRedirect() {
  return <Navigate to="/settings?section=experiments" replace />;
}

function SettingsPrivacyRedirect() {
  return <Navigate to="/settings?section=privacy" replace />;
}

// Wrapper for asset redirect to get params
function AssetRedirectWrapper() {
  // This will be handled by the route param
  return null;
}

const App = () => {
  // Start journal queue sync runner exactly once at root
  useEffect(() => {
    startJournalQueueSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
          <Route element={<AppShell />}>
            {/* Redirects (Root) */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* PRIMARY ROUTES (6 tabs) */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/research" element={<Research />} />
            <Route path="/research/:assetId" element={<Research />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/journal/:entryId" element={<JournalEntry />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/insights/:insightId" element={<Insights />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* LEGACY ROUTE REDIRECTS */}
            {/* Chart → Research */}
            <Route path="/chart" element={<ChartRedirect />} />
            
            {/* Watchlist → Research with panel */}
            <Route path="/watchlist" element={<WatchlistRedirect />} />
            
            {/* Replay → Research with replay mode */}
            <Route path="/replay" element={<ReplayRedirect />} />
            
            {/* Asset → Research with asset */}
            <Route path="/asset/:assetId" element={<Navigate to="/research/:assetId" replace />} />
            
            {/* Oracle → Insights */}
            <Route path="/oracle" element={<OracleRedirect />} />
            <Route path="/oracle/inbox" element={<OracleInboxRedirect />} />
            <Route path="/oracle/status" element={<OracleStatusRedirect />} />
            <Route path="/oracle/:insightId" element={<Navigate to="/insights/:insightId" replace />} />
            
            {/* Learn → Journal with learn mode */}
            <Route path="/learn" element={<LearnRedirect />} />
            <Route path="/learn/:id" element={<LearnRedirect />} />
            
            {/* Handbook → Journal with playbook mode */}
            <Route path="/handbook" element={<HandbookRedirect />} />
            
            {/* Journal subroutes → Journal with mode params */}
            <Route path="/journal/review" element={<JournalReviewRedirect />} />
            <Route path="/journal/insights" element={<JournalInsightsRedirect />} />
            
            {/* Settings subroutes → Settings with section params */}
            <Route path="/settings/providers" element={<SettingsProvidersRedirect />} />
            <Route path="/settings/data" element={<SettingsDataRedirect />} />
            <Route path="/settings/experiments" element={<SettingsExperimentsRedirect />} />
            <Route path="/settings/privacy" element={<SettingsPrivacyRedirect />} />
          </Route>

            {/* 404 outside AppShell */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

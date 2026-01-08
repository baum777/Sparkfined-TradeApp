import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
<<<<<<< HEAD
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams, useParams } from "react-router-dom";
=======
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
>>>>>>> b029b84c6e75b685db3442e05518aa5e941f68bb
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
<<<<<<< HEAD
import OracleInbox from "@/pages/OracleInbox";
import OracleInsight from "@/pages/OracleInsight";
import OracleStatus from "@/pages/OracleStatus";
import SettingsProviders from "@/pages/SettingsProviders";
import SettingsData from "@/pages/SettingsData";
import SettingsExperiments from "@/pages/SettingsExperiments";
import SettingsPrivacy from "@/pages/SettingsPrivacy";
import Asset from "@/pages/Asset";
import Research from "@/pages/Research";
=======
import NotFound from "@/pages/NotFound";

// Journal queue sync runner
import { startJournalQueueSync } from "@/services/journal/queueStore";
>>>>>>> b029b84c6e75b685db3442e05518aa5e941f68bb

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
<<<<<<< HEAD
            <Route path="/journal/review" element={<Navigate to="/journal?mode=inbox&view=pending" replace />} />
            <Route path="/journal/insights" element={<Navigate to="/journal?mode=learn&view=pending" replace />} />
            <Route path="/journal" element={<JournalRoute />} />
            <Route path="/research/:assetId" element={<NavigateToResearch />} />
            <Route path="/research" element={<Research />} />
            <Route path="/chart" element={<ChartLegacyRedirect />} />
            <Route path="/replay" element={<ReplayLegacyRedirect />} />
=======
            <Route path="/research" element={<Research />} />
            <Route path="/research/:assetId" element={<Research />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/journal/:entryId" element={<JournalEntry />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/insights/:insightId" element={<Insights />} />
>>>>>>> b029b84c6e75b685db3442e05518aa5e941f68bb
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/settings" element={<SettingsPage />} />

<<<<<<< HEAD
            {/* Secondary Routes (Frozen Additions) */}
            <Route path="/journal/:entryId" element={<JournalEntry />} />

            <Route path="/oracle/inbox" element={<OracleInbox />} />
            <Route path="/oracle/status" element={<OracleStatus />} />
            <Route path="/oracle/:insightId" element={<OracleInsight />} />

            <Route path="/settings/providers" element={<SettingsProviders />} />
            <Route path="/settings/data" element={<SettingsData />} />
            <Route path="/settings/experiments" element={<SettingsExperiments />} />
            <Route path="/settings/privacy" element={<SettingsPrivacy />} />

            <Route path="/asset/:assetId" element={<Asset />} />

            {/* Existing Learn detail route (non-tab deep link) */}
            <Route path="/learn/:id" element={<LessonViewer />} />
=======
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
>>>>>>> b029b84c6e75b685db3442e05518aa5e941f68bb
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

function ChartLegacyRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/research${search}`} replace />;
}

function ReplayLegacyRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (params.get("view") !== "chart") {
    params.set("view", "chart");
  }
  params.set("replay", "true");
  const query = params.toString();
  return <Navigate to={`/research${query ? `?${query}` : ""}`} replace />;
}

function NavigateToResearch() {
  const { assetId } = useParams<{ assetId: string }>();
  const params = new URLSearchParams();
  params.set("view", "chart");
  if (assetId) {
    params.set("q", assetId);
  }
  const query = params.toString();
  return <Navigate to={`/research${query ? `?${query}` : ""}`} replace />;
}

function JournalRoute() {
  const [searchParams] = useSearchParams();
  const entryId = searchParams.get("entry");

  if (entryId) {
    const params = new URLSearchParams(searchParams);
    params.delete("entry");
    const query = params.toString();
    return (
      <Navigate
        to={`/journal/${encodeURIComponent(entryId)}${query ? `?${query}` : ""}`}
        replace
      />
    );
  }

  if (!searchParams.has("view")) {
    const params = new URLSearchParams(searchParams);
    params.set("view", "pending");
    return <Navigate to={`/journal?${params.toString()}`} replace />;
  }

  return <Journal />;
}

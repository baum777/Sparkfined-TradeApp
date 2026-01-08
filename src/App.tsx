import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import Dashboard from "@/pages/Dashboard";
import Journal from "@/pages/Journal";
import Learn from "@/pages/Learn";
import LessonViewer from "@/pages/LessonViewer";
import Chart from "@/pages/Chart";
import Replay from "@/pages/Replay";
import Alerts from "@/pages/Alerts";
import SettingsPage from "@/pages/SettingsPage";
import Watchlist from "@/pages/Watchlist";
import Oracle from "@/pages/Oracle";
import Handbook from "@/pages/Handbook";
import NotFound from "@/pages/NotFound";
import JournalEntry from "@/pages/JournalEntry";
import OracleInbox from "@/pages/OracleInbox";
import OracleInsight from "@/pages/OracleInsight";
import OracleStatus from "@/pages/OracleStatus";
import SettingsProviders from "@/pages/SettingsProviders";
import SettingsData from "@/pages/SettingsData";
import SettingsExperiments from "@/pages/SettingsExperiments";
import SettingsPrivacy from "@/pages/SettingsPrivacy";
import Asset from "@/pages/Asset";
import Research from "@/pages/Research";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            {/* Redirects (Frozen) */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Primary Routes (Frozen) */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/journal/review" element={<Navigate to="/journal?mode=inbox&view=pending" replace />} />
            <Route path="/journal/insights" element={<Navigate to="/journal?mode=learn&view=pending" replace />} />
            <Route path="/journal" element={<JournalRoute />} />
            <Route path="/research/:assetId" element={<NavigateToResearch />} />
            <Route path="/research" element={<Research />} />
            <Route path="/chart" element={<ChartLegacyRedirect />} />
            <Route path="/replay" element={<ReplayLegacyRedirect />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/oracle" element={<Oracle />} />
            <Route path="/handbook" element={<Handbook />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/settings" element={<SettingsPage />} />

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
          </Route>

          {/* 404 outside AppShell */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

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

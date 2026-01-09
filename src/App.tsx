import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

// Primary pages (canonical)
import Dashboard from "@/pages/Dashboard";
import Research from "@/pages/Research";
import Journal from "@/pages/Journal";
import JournalEntry from "@/pages/JournalEntry";
import Insights from "@/pages/Insights";
import Alerts from "@/pages/Alerts";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";
import NavigationMap from "@/pages/NavigationMap";

// Journal queue sync runner
import { startJournalQueueSync } from "@/services/journal/queueStore";

const queryClient = new QueryClient();

// Legacy redirect helpers (must preserve query params)
function preserveSearchTo(path: string, searchParams: URLSearchParams): string {
  const qs = searchParams.toString();
  return qs ? `${path}?${qs}` : path;
}

function ChartRedirect() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("view", "chart");
  return <Navigate to={preserveSearchTo("/research", params)} replace />;
}

function WatchlistRedirect() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("view", "chart");
  params.set("panel", "watchlist");
  return <Navigate to={preserveSearchTo("/research", params)} replace />;
}

function ReplayRedirect() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("view", "chart");
  params.set("replay", "true");
  return <Navigate to={preserveSearchTo("/research", params)} replace />;
}

function OracleRedirect() {
  const [searchParams] = useSearchParams();
  return <Navigate to={preserveSearchTo("/insights", searchParams)} replace />;
}

function OracleInboxRedirect() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("filter", "unread");
  return <Navigate to={preserveSearchTo("/insights", params)} replace />;
}

function OracleStatusRedirect() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("mode", "status");
  return <Navigate to={preserveSearchTo("/insights", params)} replace />;
}

function LearnRedirect() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("mode", "learn");
  return <Navigate to={preserveSearchTo("/journal", params)} replace />;
}

function HandbookRedirect() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("mode", "playbook");
  return <Navigate to={preserveSearchTo("/journal", params)} replace />;
}

function JournalReviewRedirect() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("mode", "inbox");
  if (!params.has("view")) params.set("view", "pending");
  return <Navigate to={preserveSearchTo("/journal", params)} replace />;
}

function JournalInsightsRedirect() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("mode", "learn");
  if (!params.has("view")) params.set("view", "pending");
  return <Navigate to={preserveSearchTo("/journal", params)} replace />;
}

function SettingsSectionRedirect({ section }: { section: string }) {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("section", section);
  return <Navigate to={preserveSearchTo("/settings", params)} replace />;
}

function AssetLegacyRedirect() {
  const { assetId } = useParams<{ assetId: string }>();
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  return <Navigate to={`/research/${encodeURIComponent(assetId ?? "")}${qs ? `?${qs}` : ""}`} replace />;
}

function OracleInsightLegacyRedirect() {
  const { insightId } = useParams<{ insightId: string }>();
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  return <Navigate to={`/insights/${encodeURIComponent(insightId ?? "")}${qs ? `?${qs}` : ""}`} replace />;
}

function JournalRoute() {
  const [searchParams] = useSearchParams();
  const entryId = searchParams.get("entry");

  // Legacy detail query param -> canonical path param
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

  // Canonical list state requires view=
  if (!searchParams.has("view")) {
    const params = new URLSearchParams(searchParams);
    params.set("view", "pending");
    return <Navigate to={`/journal?${params.toString()}`} replace />;
  }

  return <Journal />;
}

const App = () => {
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
              <Route path="/journal" element={<JournalRoute />} />
              <Route path="/journal/:entryId" element={<JournalEntry />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/insights/:insightId" element={<Insights />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* LEGACY ROUTE REDIRECTS */}
              <Route path="/chart" element={<ChartRedirect />} />
              <Route path="/replay" element={<ReplayRedirect />} />
              <Route path="/watchlist" element={<WatchlistRedirect />} />
              <Route path="/asset/:assetId" element={<AssetLegacyRedirect />} />

              <Route path="/oracle" element={<OracleRedirect />} />
              <Route path="/oracle/inbox" element={<OracleInboxRedirect />} />
              <Route path="/oracle/status" element={<OracleStatusRedirect />} />
              <Route path="/oracle/:insightId" element={<OracleInsightLegacyRedirect />} />

              <Route path="/learn" element={<LearnRedirect />} />
              <Route path="/learn/:id" element={<LearnRedirect />} />
              <Route path="/handbook" element={<HandbookRedirect />} />

              <Route path="/journal/review" element={<JournalReviewRedirect />} />
              <Route path="/journal/insights" element={<JournalInsightsRedirect />} />

              <Route path="/settings/providers" element={<SettingsSectionRedirect section="providers" />} />
              <Route path="/settings/data" element={<SettingsSectionRedirect section="data" />} />
              <Route path="/settings/privacy" element={<SettingsSectionRedirect section="privacy" />} />

              {/* Existing experiments page is also legacy -> section param */}
              <Route path="/settings/experiments" element={<SettingsSectionRedirect section="experiments" />} />
            </Route>

            {/* Dev utility (gated inside component) */}
            <Route path="/navigation" element={<NavigationMap />} />

            {/* 404 outside AppShell */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

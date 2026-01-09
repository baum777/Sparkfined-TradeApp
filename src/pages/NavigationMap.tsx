import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  PenLine,
  Lightbulb,
  Bell,
  Settings,
  ExternalLink,
} from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { primaryTabs, routeHelpers, type PrimaryTabKey } from "@/routes/routes";

type LinkItem = {
  label: string;
  to: string;
  kind?: "canonical" | "deep-link" | "legacy";
};

const iconByTab: Record<PrimaryTabKey, React.ComponentType<{ className?: string }>> =
  {
    dashboard: LayoutDashboard,
    research: Search,
    journal: PenLine,
    insights: Lightbulb,
    alerts: Bell,
    settings: Settings,
  };

const SAMPLE_SOLANA_ADDRESS = "So11111111111111111111111111111111111111112";

function linksForTab(key: PrimaryTabKey): LinkItem[] {
  switch (key) {
    case "dashboard":
      return [
        { label: "Open Dashboard", to: routeHelpers.dashboard(), kind: "canonical" },
        { label: "Root (redirects to Dashboard)", to: "/", kind: "legacy" },
        { label: "Not Found example", to: "/__does_not_exist__", kind: "legacy" },
      ];
    case "research":
      return [
        { label: "Open Research (canonical)", to: routeHelpers.research(), kind: "canonical" },
        {
          label: "Research with query (q=SOL)",
          to: routeHelpers.research({ q: "SOL" }),
          kind: "deep-link",
        },
        {
          label: "Research with Watchlist panel",
          to: routeHelpers.research({ panel: "watchlist" }),
          kind: "deep-link",
        },
        { label: "Research in Replay mode", to: routeHelpers.research({ replay: true }), kind: "deep-link" },
        {
          label: "Asset hub (research/:assetId)",
          to: routeHelpers.researchAsset(SAMPLE_SOLANA_ADDRESS),
          kind: "deep-link",
        },
        { label: "Legacy: /chart → /research", to: "/chart", kind: "legacy" },
        { label: "Legacy: /watchlist → /research", to: "/watchlist", kind: "legacy" },
        { label: "Legacy: /replay → /research", to: "/replay", kind: "legacy" },
      ];
    case "journal":
      return [
        { label: "Open Journal (pending)", to: routeHelpers.journal({ view: "pending" }), kind: "canonical" },
        {
          label: "Journal (confirmed)",
          to: routeHelpers.journal({ view: "confirmed" }),
          kind: "deep-link",
        },
        {
          label: "Journal (archived)",
          to: routeHelpers.journal({ view: "archived" }),
          kind: "deep-link",
        },
        {
          label: "Journal (mode=inbox)",
          to: routeHelpers.journal({ view: "pending", mode: "inbox" }),
          kind: "deep-link",
        },
        {
          label: "Journal (mode=learn)",
          to: routeHelpers.journal({ view: "pending", mode: "learn" }),
          kind: "deep-link",
        },
        {
          label: "Journal (mode=playbook)",
          to: routeHelpers.journal({ view: "pending", mode: "playbook" }),
          kind: "deep-link",
        },
        { label: "Legacy: /learn → /journal?mode=learn", to: "/learn", kind: "legacy" },
        { label: "Legacy: /handbook → /journal?mode=playbook", to: "/handbook", kind: "legacy" },
        { label: "Legacy: /journal/review → inbox mode", to: "/journal/review", kind: "legacy" },
        { label: "Legacy: /journal/insights → learn mode", to: "/journal/insights", kind: "legacy" },
      ];
    case "insights":
      return [
        { label: "Open Insights", to: routeHelpers.insights(), kind: "canonical" },
        { label: "Insights (filter=unread)", to: routeHelpers.insights({ filter: "unread" }), kind: "deep-link" },
        { label: "Insights (mode=status)", to: routeHelpers.insights({ mode: "status" }), kind: "deep-link" },
        { label: "Legacy: /oracle → /insights", to: "/oracle", kind: "legacy" },
        { label: "Legacy: /oracle/inbox → unread filter", to: "/oracle/inbox", kind: "legacy" },
        { label: "Legacy: /oracle/status → status mode", to: "/oracle/status", kind: "legacy" },
      ];
    case "alerts":
      return [
        { label: "Open Alerts", to: routeHelpers.alerts(), kind: "canonical" },
        { label: "Legacy: /alerts (same)", to: "/alerts", kind: "legacy" },
      ];
    case "settings":
      return [
        { label: "Open Settings", to: routeHelpers.settings(), kind: "canonical" },
        { label: "Settings: providers", to: routeHelpers.settings({ section: "providers" }), kind: "deep-link" },
        { label: "Settings: data", to: routeHelpers.settings({ section: "data" }), kind: "deep-link" },
        { label: "Settings: experiments", to: routeHelpers.settings({ section: "experiments" }), kind: "deep-link" },
        { label: "Settings: privacy", to: routeHelpers.settings({ section: "privacy" }), kind: "deep-link" },
        { label: "Legacy: /settings/providers", to: "/settings/providers", kind: "legacy" },
        { label: "Legacy: /settings/data", to: "/settings/data", kind: "legacy" },
        { label: "Legacy: /settings/experiments", to: "/settings/experiments", kind: "legacy" },
        { label: "Legacy: /settings/privacy", to: "/settings/privacy", kind: "legacy" },
      ];
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

function kindBadge(kind?: LinkItem["kind"]) {
  if (kind === "canonical") return <Badge variant="default">Canonical</Badge>;
  if (kind === "deep-link") return <Badge variant="secondary">Deep link</Badge>;
  if (kind === "legacy") return <Badge variant="outline">Legacy redirect</Badge>;
  return null;
}

export default function NavigationMap() {
  return (
    <PageContainer testId="page-navigation-map">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Navigation Map</h1>
          <p className="text-sm text-muted-foreground">
            Visuelle Übersicht aller Primary Tabs inkl. kanonischer Routen, Deep Links (Query-Params) und Legacy-Redirects.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {primaryTabs.map((tab) => {
            const Icon = iconByTab[tab.key];
            const items = linksForTab(tab.key);

            return (
              <Card key={tab.key} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-xl">{tab.label}</CardTitle>
                        <CardDescription className="mt-1">
                          <span className="font-mono">{tab.route}</span>
                        </CardDescription>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to={tab.route} aria-label={`Open ${tab.label}`}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open
                      </Link>
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Tip: die <span className="font-mono">Legacy redirect</span>-Links sollten in der App automatisch auf die kanonischen
                    Routen umleiten.
                  </div>

                  <div className="space-y-2">
                    {items.map((it) => (
                      <div
                        key={`${tab.key}:${it.to}:${it.label}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/30 px-3 py-2"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{it.label}</span>
                            {kindBadge(it.kind)}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono truncate">{it.to}</div>
                        </div>
                        <Button asChild size="sm" variant="ghost">
                          <Link to={it.to}>Go</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="justify-between border-t border-border/60">
                  <div className="text-xs text-muted-foreground">
                    data-testid: <span className="font-mono">{tab.tabTestId}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    page-testid: <span className="font-mono">{tab.pageTestId}</span>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}


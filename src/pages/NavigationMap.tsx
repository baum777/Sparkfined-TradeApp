import { Link } from "react-router-dom";
import { primaryTabs } from "@/routes/routes";
import { isDevNavEnabled } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

function NotFoundContent() {
  return (
    <div
      data-testid="page-notfound"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <div className="text-center space-y-4 px-4">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="text-xl text-muted-foreground">Page not found</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild className="mt-4">
          <Link to="/dashboard">
            <Home className="h-4 w-4 mr-2" />
            Return to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}

function NavCard({
  tabId,
  label,
  canonicalRoute,
  deepLink,
  legacyRoute,
}: {
  tabId: string;
  label: string;
  canonicalRoute: string;
  deepLink?: string;
  legacyRoute?: string;
}) {
  return (
    <div
      data-testid={`nav-card-${tabId}`}
      className="rounded-lg border border-border bg-card p-4 space-y-3"
    >
      <h3 className="font-semibold text-lg text-card-foreground">{label}</h3>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Canonical:</span>
          <Link
            to={canonicalRoute}
            data-testid={`nav-link-canonical-${tabId}`}
            className="text-primary hover:underline font-mono text-xs"
          >
            {canonicalRoute}
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Deep Link:</span>
          {deepLink ? (
            <Link
              to={deepLink}
              data-testid={`nav-link-deeplink-${tabId}`}
              className="text-primary hover:underline font-mono text-xs"
            >
              {deepLink}
            </Link>
          ) : (
            <span
              data-testid={`nav-link-deeplink-${tabId}`}
              className="text-muted-foreground font-mono text-xs"
            >
              —
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Legacy:</span>
          {legacyRoute ? (
            <Link
              to={legacyRoute}
              data-testid={`nav-link-legacy-${tabId}`}
              className="text-primary hover:underline font-mono text-xs"
            >
              {legacyRoute}
            </Link>
          ) : (
            <span
              data-testid={`nav-link-legacy-${tabId}`}
              className="text-muted-foreground font-mono text-xs"
            >
              —
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const NavigationMap = () => {
  if (!isDevNavEnabled()) {
    return <NotFoundContent />;
  }

  return (
    <div
      data-testid="page-navigation-map"
      className="min-h-screen bg-background p-6"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Navigation Map</h1>
          <p className="text-muted-foreground text-sm">
            Developer utility: Primary navigation routes and their mappings
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {primaryTabs.map((tab) => (
            <NavCard
              key={tab.key}
              tabId={tab.key}
              label={tab.label}
              canonicalRoute={tab.route}
              deepLink={tab.deepLink}
              legacyRoute={tab.legacyRoute}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default NavigationMap;

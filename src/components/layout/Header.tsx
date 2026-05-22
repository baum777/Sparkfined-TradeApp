/**
 * Header Component
 * Global header with offline status, quick actions, and user controls
 * Per Global UI Infrastructure spec
 */

import { useEffect, useState } from "react";
import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickActionsHeaderButton } from "@/components/quick-actions";
import { OfflineStatusBadge } from "@/components/offline";
import { Link, useLocation } from "react-router-dom";
import { dbService } from "@/services/db/db";

export function Header() {
  const location = useLocation();
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function refreshAlertsBadge() {
      try {
        const alerts = await dbService.getAllAlerts();
        if (!isMounted) return;
        const count = alerts.filter((alert) => alert.enabled && alert.status !== "paused").length;
        setActiveAlertsCount(count);
      } catch {
        if (!isMounted) return;
        setActiveAlertsCount(0);
      }
    }

    void refreshAlertsBadge();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  const badgeText = activeAlertsCount > 9 ? "9+" : String(activeAlertsCount);

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="h-full px-4 md:px-6 flex items-center justify-between">
        {/* Mobile Logo + Offline Status */}
        <div className="md:hidden flex items-center gap-2">
          <span className="text-lg font-semibold text-foreground tracking-tight">
            TradeApp
          </span>
          <OfflineStatusBadge compact />
        </div>

        {/* Desktop: Offline Status + Quick Actions Button */}
        <div className="hidden md:flex items-center gap-3">
          <OfflineStatusBadge showLastSynced />
          <QuickActionsHeaderButton />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
          >
            <Link to="/alerts" className="relative">
              <Bell className="h-5 w-5" />
              {activeAlertsCount > 0 && (
                <span
                  data-testid="header-alerts-badge"
                  className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] leading-4 text-destructive-foreground text-center"
                >
                  {badgeText}
                </span>
              )}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label="User menu"
          >
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

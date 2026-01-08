import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  primaryNavItems,
  isRouteActive,
  type NavItem,
} from "@/config/navigation";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const location = useLocation();

  // Separate Settings from other nav items (Settings anchored at bottom)
  const mainNavItems = primaryNavItems.filter((item) => item.path !== "/settings");
  const settingsItem = primaryNavItems.find((item) => item.path === "/settings");

  const renderNavItem = (item: NavItem) => {
    const isActive = isRouteActive(location.pathname, item);
    const Icon = item.icon;

    return (
      <Link
        key={item.path}
        to={item.path}
        data-testid={item.testId}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          isActive ? "nav-item-active" : "nav-item-inactive"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{item.label}</span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-lg font-semibold text-foreground tracking-tight">
            TradeApp
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapsedChange(!collapsed)}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Main Navigation (5 items) */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {mainNavItems.map(renderNavItem)}
      </nav>

      {/* Settings (anchored at bottom) */}
      {settingsItem && (
        <div className="px-2 py-2 border-t border-sidebar-border">
          {renderNavItem(settingsItem)}
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        {!collapsed && (
          <p className="text-xs text-muted-foreground">v0.1.0</p>
        )}
      </div>
    </aside>
  );
}

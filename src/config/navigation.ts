import {
  LayoutDashboard,
  Search,
  PenLine,
  Lightbulb,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { primaryTabs, type PrimaryTabKey } from "@/routes/routes";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  testId: string;
  activeRoutes?: string[];
}

export interface NavGroup {
  label: string;
  testId: string;
  triggerTestId: string;
  icon: LucideIcon;
  items: NavItem[];
  featureFlag?: string;
}

const iconByTab: Record<PrimaryTabKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  research: Search,
  journal: PenLine,
  insights: Lightbulb,
  alerts: Bell,
  settings: Settings,
};

// Desktop sidebar nav items (all 6 primary tabs)
export const primaryNavItems: NavItem[] = primaryTabs.map((tab) => ({
  label: tab.label,
  path: tab.route,
  icon: iconByTab[tab.key],
  testId: tab.tabTestId,
  activeRoutes:
    tab.key === "dashboard"
      ? ["/dashboard", "/"]
      : tab.key === "research"
        ? ["/research", "/chart", "/watchlist", "/replay", "/asset"]
        : tab.key === "insights"
          ? ["/insights", "/oracle"]
          : tab.key === "journal"
            ? ["/journal", "/learn", "/handbook"]
            : [tab.route],
}));

// Mobile bottom nav items (5 items - Settings excluded)
export const mobileNavItems: NavItem[] = primaryTabs
  .filter((tab) => tab.showInMobileNav !== false)
  .map((tab) => ({
    label: tab.label,
    path: tab.route,
    icon: iconByTab[tab.key],
    testId: tab.tabTestId,
    activeRoutes:
      tab.key === "dashboard"
        ? ["/dashboard", "/"]
        : tab.key === "research"
          ? ["/research", "/chart", "/watchlist", "/replay", "/asset"]
          : tab.key === "insights"
            ? ["/insights", "/oracle"]
            : tab.key === "journal"
              ? ["/journal", "/learn", "/handbook"]
              : [tab.route],
  }));

// Sidebar-only nav is no longer segmented; keep exports for backward compatibility.
export const sidebarOnlyItems: NavItem[] = [];
export const advancedNavGroup: NavGroup = {
  label: "Advanced",
  testId: "nav-advanced",
  triggerTestId: "nav-advanced-trigger",
  icon: LayoutDashboard,
  items: [],
};

export function isRouteActive(currentPath: string, navItem: NavItem): boolean {
  if (navItem.activeRoutes) {
    return navItem.activeRoutes.some(
      (route) => currentPath === route || currentPath.startsWith(route + "/")
    );
  }
  if (navItem.path === "/") {
    return currentPath === "/";
  }
  return currentPath.startsWith(navItem.path);
}

export function isDevNavEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_DEV_NAV === "true";
}

import {
  LayoutDashboard,
  BookOpen,
  LineChart,
  Play,
  Bell,
  Settings,
  PenLine,
  Eye,
  Sparkles,
  BookMarked,
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
  journal: PenLine,
  research: LineChart,
  alerts: Bell,
  watchlist: Eye,
  oracle: Sparkles,
  learn: BookOpen,
  handbook: BookMarked,
  settings: Settings,
};

export const primaryNavItems: NavItem[] = primaryTabs.map((tab) => ({
  label: tab.label,
  path: tab.route,
  icon: iconByTab[tab.key],
  testId: tab.tabTestId,
  activeRoutes:
    tab.key === "dashboard"
      ? ["/dashboard", "/"]
      : tab.key === "settings"
        ? ["/settings"]
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

// Mobile nav should expose all primary tabs (scrollable UI handles overflow)
export const mobileNavItems: NavItem[] = primaryNavItems;

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

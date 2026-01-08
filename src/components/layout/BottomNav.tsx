import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { mobileNavItems, isRouteActive } from "@/config/navigation";

export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border safe-area-bottom z-50"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around px-2 h-16">
        {mobileNavItems.map((item) => {
          const isActive = isRouteActive(location.pathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={item.testId}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[64px] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded-md",
                isActive ? "mobile-nav-active" : "mobile-nav-inactive"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

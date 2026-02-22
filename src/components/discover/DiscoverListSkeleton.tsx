import { Skeleton } from "@/components/ui/skeleton";

/**
 * Sprint 3: P0-3 - Domain-shaped skeleton for Discover token list
 * Matches real DiscoverTokenCard p-3 dimensions for layout stability
 */
export function DiscoverListSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className="grid gap-3"
      aria-busy="true"
      aria-label="Loading token list"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/50 bg-surface p-3 space-y-2"
        >
          {/* Header: Symbol + badge placeholders */}
          <div className="flex items-center gap-2 pr-12">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>

          {/* Token name placeholder */}
          <Skeleton className="h-3 w-3/4" />

          {/* Metrics grid - 3 columns */}
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

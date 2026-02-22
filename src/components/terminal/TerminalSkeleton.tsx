import { Skeleton } from "@/components/ui/skeleton";

/**
 * Sprint 3: P0-3 - Domain-shaped skeleton for Terminal view
 * Matches OrderForm and Chart container dimensions to prevent layout shift
 */
export function TerminalSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading trading terminal">
      {/* Chart area skeleton - matches typical chart container height */}
      <div className="rounded-xl border border-border/50 bg-surface p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-[200px] w-full rounded-md" />
      </div>

      {/* Order form skeleton - matches disabled form state */}
      <div className="rounded-xl border border-border/50 bg-surface p-3 space-y-3">
        {/* Side toggle skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-8" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>

        {/* Amount input skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Quick amounts skeleton */}
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-12 rounded-md" />
          ))}
        </div>

        {/* Fee preview skeleton - matches FeePreviewInline height */}
        <div className="rounded-md bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Primary CTA skeleton - matches h-12 w-full */}
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    </div>
  );
}

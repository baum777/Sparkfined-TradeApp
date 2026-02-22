import { Skeleton } from "@/components/ui/skeleton";

/**
 * Sprint 3: P0-3 - Domain-shaped skeleton for Journal Inbox
 * Matches real JournalInboxCard dimensions to prevent layout shift
 */
export function JournalInboxSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading journal entries">
      {/* Sticky date header placeholder */}
      <Skeleton className="h-4 w-16" />

      {/* Card skeletons matching JournalInboxCard p-3 sizing */}
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/50 bg-surface p-3 space-y-3"
        >
          {/* Header row: timestamp + pending badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>

          {/* Summary text lines */}
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

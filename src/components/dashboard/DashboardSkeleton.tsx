import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardSkeleton() {
  return (
    <div 
      data-testid="dashboard-loading"
      className="space-y-4 sm:space-y-6" 
      aria-label="Loading dashboard" 
      role="status"
    >
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 sm:h-9 w-32 sm:w-40" />
          <Skeleton className="h-4 w-48 sm:w-64" />
        </div>
        <Skeleton className="h-10 w-full sm:w-28" />
      </div>

      {/* Action Strip Skeleton */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 flex-1" />
        ))}
      </div>

      {/* Status & Progress Skeleton (4 tiles) */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card/50 border-border/50">
            <CardContent className="p-3 sm:p-4 space-y-2">
              <Skeleton className="h-3 w-16 sm:w-20" />
              <Skeleton className="h-5 sm:h-6 w-10 sm:w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Work Queue Skeleton */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2 sm:pb-3">
          <Skeleton className="h-4 w-20 sm:w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-background/50">
              <Skeleton className="h-7 w-7 rounded-md shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-24 sm:w-32" />
                <Skeleton className="h-3 w-16 sm:w-20" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Snapshots Skeleton (3 cards) */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-card/50 border-border/50">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-4 w-16 sm:w-20" />
                  <Skeleton className="h-3 w-24 sm:w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <span className="sr-only">Loading dashboard content...</span>
    </div>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

export interface StatusProgressProps {
  entriesToday: number;
  pendingReviews: number;
  unreadInsights: number;
  activeAlerts: number;
  streak?: string;
}

interface KpiTile {
  id: string;
  testId: string;
  label: string;
  value: number | string;
  tooltip: string;
}

export function StatusProgress({
  entriesToday,
  pendingReviews,
  unreadInsights,
  activeAlerts,
  streak,
}: StatusProgressProps) {
  const tiles: KpiTile[] = [
    {
      id: 'entries-today',
      testId: 'dashboard-kpi-entries-today',
      label: 'Entries Today',
      value: entriesToday,
      tooltip: 'Number of journal entries logged today',
    },
    {
      id: 'pending',
      testId: 'dashboard-kpi-pending',
      label: 'Pending Reviews',
      value: pendingReviews,
      tooltip: 'Journal entries awaiting your review',
    },
    {
      id: 'unread',
      testId: 'dashboard-kpi-unread',
      label: 'Unread Insights',
      value: unreadInsights,
      tooltip: 'AI-generated insights you haven\'t read yet',
    },
    {
      id: 'alerts-active',
      testId: 'dashboard-kpi-alerts-active',
      label: 'Active Alerts',
      value: activeAlerts,
      tooltip: 'Price alerts currently monitoring the market',
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <section 
        data-testid="dashboard-status-progress"
        aria-label="Status and progress"
        className="space-y-3"
      >
        <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <Card 
              key={tile.id} 
              data-testid={tile.testId}
              className="bg-card/50 border-border/50"
            >
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                      {tile.label}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          type="button"
                          className="shrink-0 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
                          aria-label={`Info about ${tile.label}`}
                        >
                          <Info className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px]">
                        <p className="text-xs">{tile.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-foreground">
                    {tile.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Streak subline (optional) */}
        {streak && (
          <p 
            data-testid="dashboard-streak"
            className="text-sm text-muted-foreground"
          >
            Current streak: <span className="font-medium text-foreground">{streak}</span>
          </p>
        )}
      </section>
    </TooltipProvider>
  );
}

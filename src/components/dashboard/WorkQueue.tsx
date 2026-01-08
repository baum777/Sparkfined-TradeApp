import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Bell, Lightbulb, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Work queue item types
export type WorkQueueItemType = 'journal' | 'insight' | 'alert';
export type WorkQueueItemStatus = 'triggered' | 'pending' | 'unread' | 'active' | 'confirmed' | 'read';

export interface WorkQueueItem {
  id: string;
  type: WorkQueueItemType;
  title: string;
  timestamp: string;
  status: WorkQueueItemStatus;
  route: string;
}

export interface WorkQueueProps {
  journalItems: WorkQueueItem[];
  insightItems: WorkQueueItem[];
  alertItems: WorkQueueItem[];
}

// Priority order for sorting
const statusPriority: Record<WorkQueueItemStatus, number> = {
  triggered: 1,
  pending: 2,
  unread: 3,
  active: 4,
  confirmed: 5,
  read: 6,
};

const statusVariant: Record<WorkQueueItemStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  triggered: 'destructive',
  pending: 'default',
  unread: 'default',
  active: 'secondary',
  confirmed: 'outline',
  read: 'outline',
};

const typeIcons = {
  journal: TrendingUp,
  insight: Lightbulb,
  alert: Bell,
};

const typeIconStyles = {
  journal: 'bg-primary/10 text-primary',
  insight: 'bg-chart-warning/10 text-chart-warning',
  alert: 'bg-chart-negative/10 text-chart-negative',
};

export function WorkQueue({ journalItems, insightItems, alertItems }: WorkQueueProps) {
  const navigate = useNavigate();

  // Build work queue with quotas and priority sorting
  const queueItems = useMemo(() => {
    // Apply quotas: max 2 from each source
    const quotaJournal = journalItems.slice(0, 2);
    const quotaInsights = insightItems.slice(0, 2);
    const quotaAlerts = alertItems.slice(0, 2);

    // Combine and sort by priority
    const combined = [...quotaJournal, ...quotaInsights, ...quotaAlerts];
    
    combined.sort((a, b) => {
      // Primary: status priority
      const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Secondary: timestamp (most recent first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Max 6 items total
    return combined.slice(0, 6);
  }, [journalItems, insightItems, alertItems]);

  // Empty state
  if (queueItems.length === 0) {
    return (
      <Card 
        data-testid="dashboard-work-queue"
        className="bg-card/50 border-border/50"
      >
        <CardContent 
          data-testid="dashboard-work-queue-empty"
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nothing in your queue
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Start exploring markets and logging trades.
          </p>
          <Button onClick={() => navigate('/research')}>
            Open Research
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      data-testid="dashboard-work-queue"
      className="bg-card/50 border-border/50"
    >
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Work Queue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {queueItems.map((item, index) => {
          const Icon = typeIcons[item.type];
          const iconStyle = typeIconStyles[item.type];

          return (
            <button
              key={item.id}
              data-testid={`dashboard-queue-item-${index}`}
              onClick={() => navigate(item.route)}
              className="w-full flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-background/50 border border-border/30 hover:bg-background/80 hover:border-border/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors text-left"
              aria-label={`${item.title} - ${item.status}`}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className={`p-1.5 rounded-md shrink-0 ${iconStyle}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <Badge 
                variant={statusVariant[item.status]}
                className="shrink-0 capitalize"
              >
                {item.status}
              </Badge>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

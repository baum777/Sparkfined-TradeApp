import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, TrendingDown, Bell, BookOpen } from 'lucide-react';
import type { RecentActivityStub } from '@/stubs/contracts';
import { formatDistanceToNow } from 'date-fns';

interface RecentEntriesProps {
  entries: RecentActivityStub[];
}

const typeIcons = {
  trade: { positive: TrendingUp, negative: TrendingDown },
  alert: Bell,
  lesson: BookOpen,
};

export function RecentEntries({ entries }: RecentEntriesProps) {
  const navigate = useNavigate();

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recent Entries
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 text-xs h-8 px-2 sm:px-3"
            onClick={() => navigate('/journal')}
            aria-label="View all journal entries"
          >
            <span className="hidden sm:inline">View all</span>
            <span className="sm:hidden">All</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map((entry) => {
            const isPositive = entry.description.includes('+');
            const Icon = entry.type === 'trade' 
              ? (isPositive ? typeIcons.trade.positive : typeIcons.trade.negative)
              : entry.type === 'alert' 
                ? typeIcons.alert 
                : typeIcons.lesson;
            
            const iconBg = entry.type === 'trade' 
              ? (isPositive ? 'bg-chart-positive/10' : 'bg-chart-negative/10')
              : entry.type === 'alert' 
                ? 'bg-chart-warning/10' 
                : 'bg-primary/10';
            
            const iconColor = entry.type === 'trade'
              ? (isPositive ? 'text-chart-positive' : 'text-chart-negative')
              : entry.type === 'alert'
                ? 'text-chart-warning'
                : 'text-primary';

            return (
              <button
                key={entry.id}
                onClick={() => navigate(`/journal/${encodeURIComponent(entry.id)}`)}
                className="w-full flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-background/50 border border-border/30 hover:bg-background/80 hover:border-border/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors text-left"
                aria-label={`View entry: ${entry.title}`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className={`p-1.5 rounded-md shrink-0 ${iconBg}`}>
                    <Icon className={`h-3.5 w-3.5 ${iconColor}`} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{entry.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                  {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function JournalSnapshotCard() {
  const navigate = useNavigate();
  
  // BACKEND_TODO: Fetch journal snapshot stats
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Journal Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Pending</span>
          <Badge variant="secondary">3</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Confirmed</span>
          <Badge variant="secondary">12</Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full gap-1.5"
          onClick={() => navigate('/journal')}
        >
          Open journal
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function AlertsSnapshotCard() {
  const navigate = useNavigate();
  
  // BACKEND_TODO: Fetch alerts snapshot stats
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Alerts Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Active</span>
          <Badge variant="secondary">5</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Triggered today</span>
          <Badge variant="secondary">2</Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full gap-1.5"
          onClick={() => navigate('/alerts')}
        >
          Manage alerts
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

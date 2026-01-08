import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, Lightbulb, Bell, ArrowRight } from 'lucide-react';

export interface SnapshotData {
  journal: {
    pending: number;
    confirmed: number;
  };
  insights: {
    unread: number;
    total: number;
  };
  alerts: {
    active: number;
    triggered: number;
  };
}

export interface SnapshotsProps {
  data: SnapshotData;
}

export function Snapshots({ data }: SnapshotsProps) {
  const navigate = useNavigate();

  const snapshots = [
    {
      id: 'journal',
      testId: 'dashboard-snapshot-journal',
      title: 'Journal',
      route: '/journal',
      icon: BookOpen,
      iconStyle: 'bg-primary/10 text-primary',
      stats: [
        { label: 'Pending', value: data.journal.pending },
        { label: 'Confirmed', value: data.journal.confirmed },
      ],
    },
    {
      id: 'insights',
      testId: 'dashboard-snapshot-insights',
      title: 'Insights',
      route: '/insights',
      icon: Lightbulb,
      iconStyle: 'bg-chart-warning/10 text-chart-warning',
      stats: [
        { label: 'Unread', value: data.insights.unread },
        { label: 'Total', value: data.insights.total },
      ],
    },
    {
      id: 'alerts',
      testId: 'dashboard-snapshot-alerts',
      title: 'Alerts',
      route: '/alerts',
      icon: Bell,
      iconStyle: 'bg-chart-negative/10 text-chart-negative',
      stats: [
        { label: 'Active', value: data.alerts.active },
        { label: 'Triggered', value: data.alerts.triggered },
      ],
    },
  ];

  return (
    <section 
      data-testid="dashboard-snapshots"
      aria-label="Quick snapshots"
      className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3"
    >
      {snapshots.map((snapshot) => {
        const Icon = snapshot.icon;
        
        return (
          <Card
            key={snapshot.id}
            data-testid={snapshot.testId}
            className="bg-card/50 border-border/50 hover:bg-card/70 hover:border-border/70 transition-colors cursor-pointer group"
            onClick={() => navigate(snapshot.route)}
            tabIndex={0}
            role="button"
            aria-label={`View ${snapshot.title}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(snapshot.route);
              }
            }}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${snapshot.iconStyle}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-foreground">
                      {snapshot.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {snapshot.stats.map((stat, i) => (
                        <span key={stat.label} className="text-xs text-muted-foreground">
                          {i > 0 && <span className="mr-2">•</span>}
                          <span className="font-medium text-foreground">{stat.value}</span> {stat.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <ArrowRight 
                  className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-1" 
                  aria-hidden="true" 
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

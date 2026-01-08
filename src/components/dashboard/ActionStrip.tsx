import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCheck, TrendingUp, Lightbulb } from 'lucide-react';

export interface ActionStripProps {
  pendingCount: number;
  unreadInsightsCount: number;
}

export function ActionStrip({ pendingCount, unreadInsightsCount }: ActionStripProps) {
  const navigate = useNavigate();

  return (
    <section 
      data-testid="dashboard-action-strip"
      aria-label="Quick actions"
      className="flex flex-col sm:flex-row gap-2 sm:gap-3"
    >
      {/* CTA 1: Review Pending */}
      <Button
        data-testid="dashboard-cta-review-pending"
        variant="outline"
        className="flex-1 justify-start gap-2 h-12"
        onClick={() => navigate('/journal?mode=inbox')}
      >
        <FileCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Review Pending</span>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="ml-auto">
            {pendingCount}
          </Badge>
        )}
      </Button>

      {/* CTA 2: Open Research */}
      <Button
        data-testid="dashboard-cta-open-research"
        variant="outline"
        className="flex-1 justify-start gap-2 h-12"
        onClick={() => navigate('/research')}
      >
        <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Open Research</span>
      </Button>

      {/* CTA 3: Unread Insights */}
      <Button
        data-testid="dashboard-cta-unread-insights"
        variant="outline"
        className="flex-1 justify-start gap-2 h-12"
        onClick={() => navigate('/insights?filter=unread')}
      >
        <Lightbulb className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Unread Insights</span>
        {unreadInsightsCount > 0 && (
          <Badge variant="destructive" className="ml-auto">
            {unreadInsightsCount}
          </Badge>
        )}
      </Button>
    </section>
  );
}

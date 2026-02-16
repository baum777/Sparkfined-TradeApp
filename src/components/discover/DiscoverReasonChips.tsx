import { Badge } from '@/components/ui/badge';
import type { Reason } from '@/features/discover/filter/types';
import { trimReasonsForUI } from '@/features/discover/filter/explain';

interface DiscoverReasonChipsProps {
  reasons: Reason[];
}

export function DiscoverReasonChips({ reasons }: DiscoverReasonChipsProps) {
  const trimmedReasons = trimReasonsForUI(reasons);

  if (trimmedReasons.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {trimmedReasons.map((reason, index) => (
        <Badge
          key={`${reason.code}-${index}`}
          variant={reason.code.includes('risk') || reason.code.includes('high') ? 'destructive' : 'secondary'}
          className="text-xs"
        >
          {reason.message}
        </Badge>
      ))}
    </div>
  );
}


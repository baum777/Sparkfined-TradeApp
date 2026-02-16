import { Badge } from '@/components/ui/badge';

interface DiscoverScoreBadgeProps {
  score: number;
}

export function DiscoverScoreBadge({ score }: DiscoverScoreBadgeProps) {
  // Color coding based on score
  const getVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
    if (score >= 70) return 'default';
    if (score >= 40) return 'secondary';
    return 'destructive';
  };

  return (
    <Badge variant={getVariant(score)} className="font-mono">
      {score.toFixed(0)}
    </Badge>
  );
}


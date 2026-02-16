import { Card, CardContent } from '@/components/ui/card';

interface ChartPanelProps {
  baseMint?: string;
  quoteMint?: string;
}

export function ChartPanel({ baseMint, quoteMint }: ChartPanelProps) {
  const pairLabel = baseMint && quoteMint 
    ? `${baseMint.slice(0, 4)}...${baseMint.slice(-4)} / ${quoteMint.slice(0, 4)}...${quoteMint.slice(-4)}`
    : 'Select a pair';

  return (
    <Card className="h-full">
      <CardContent className="flex h-full items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">{pairLabel}</p>
          <p className="mt-2 text-sm">Chart will be mounted here</p>
        </div>
      </CardContent>
    </Card>
  );
}


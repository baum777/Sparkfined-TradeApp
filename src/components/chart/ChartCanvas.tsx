import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

interface ChartCanvasProps {
  symbol: string;
  timeframe: string;
  isLoading?: boolean;
}

export function ChartCanvas({ symbol, timeframe, isLoading }: ChartCanvasProps) {
  if (isLoading) {
    return (
      <div
        data-testid="chart-canvas-container"
        className="sf-chartPlaceholder flex items-center justify-center"
      >
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    );
  }

  return (
    <div
      data-testid="chart-canvas-container"
      className="sf-chartPlaceholder"
    >
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Chart renders here</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {symbol} · {timeframe}
        </p>
      </div>
      {/* BACKEND_TODO: integrate chart library */}
    </div>
  );
}

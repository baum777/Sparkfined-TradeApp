import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, FileText, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OracleStub } from "@/stubs/contracts";

interface InsightCardProps {
  insight: OracleStub;
  onToggleRead: (id: string) => void;
}

const themeColors: Record<string, string> = {
  bullish: "bg-success/10 text-success border-success/20",
  bearish: "bg-destructive/10 text-destructive border-destructive/20",
  neutral: "bg-secondary text-secondary-foreground border-secondary",
  caution: "bg-warning/10 text-warning border-warning/20",
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return "Just now";
}

export function InsightCard({ insight, onToggleRead }: InsightCardProps) {
  // Extract symbol from title if present (stub heuristic)
  const symbolMatch = insight.title.match(/\b(BTC|ETH|SOL|AVAX|MATIC)\b/i);
  const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : null;

  return (
    <Card
      className={cn(
        "transition-all relative overflow-hidden",
        !insight.isRead && "border-primary/30 bg-primary/5"
      )}
    >
      {/* Left accent for unread */}
      {!insight.isRead && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}

      <CardContent className="py-4 pl-4 sm:pl-5">
        <div className="space-y-3">
          {/* Top row: badges + timestamp */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("text-xs capitalize", themeColors[insight.theme])}
            >
              {insight.theme}
            </Badge>
            {!insight.isRead && (
              <Badge variant="default" className="text-xs">
                New
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {formatTimeAgo(insight.createdAt)}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-medium text-foreground">{insight.title}</h3>

          {/* Summary */}
          <p className="text-sm text-muted-foreground line-clamp-3">
            {insight.summary}
          </p>

          {/* Actions row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" asChild>
              <Link to={symbol ? `/research?q=${encodeURIComponent(symbol)}` : "/research"}>
                <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                Open chart
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              {/* BACKEND_TODO: prefill journal note with insight context */}
              <Link to="/journal">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Save to Journal
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleRead(insight.id)}
              aria-pressed={insight.isRead}
              className="ml-auto"
            >
              {insight.isRead ? (
                <>
                  <Circle className="mr-1.5 h-3.5 w-3.5" />
                  Mark unread
                </>
              ) : (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Mark read
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

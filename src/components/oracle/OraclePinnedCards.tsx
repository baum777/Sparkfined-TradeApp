import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, FileText, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodayTakeawayCardProps {
  isRead: boolean;
  onMarkRead: () => void;
}

export function TodayTakeawayCard({ isRead, onMarkRead }: TodayTakeawayCardProps) {
  return (
    <Card
      className={cn(
        "border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 relative overflow-hidden",
        isRead && "opacity-80"
      )}
    >
      {/* Left accent for unread */}
      {!isRead && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}
      
      <CardContent className="py-5 px-4 sm:px-6">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Today's Takeaway</span>
                  {!isRead && (
                    <Badge variant="default" className="text-xs">New</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            
            {/* Read indicator */}
            {isRead && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5" />
                Read
              </div>
            )}
          </div>

          {/* Content */}
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Market showing signs of consolidation after recent volatility. 
              Key support levels are holding, but momentum indicators suggest 
              caution before entering new positions.
            </p>
            <ul className="space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Watch BTC 42K support level — a break could trigger broader weakness</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Avoid chasing pumps; wait for confirmation on higher timeframes</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="default" size="sm" asChild>
              <Link to="/research?q=BTC">
                <TrendingUp className="mr-2 h-4 w-4" />
                Open chart
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/journal">
                <FileText className="mr-2 h-4 w-4" />
                Log note
              </Link>
            </Button>
            {!isRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMarkRead}
                className="ml-auto"
              >
                <Check className="mr-1.5 h-4 w-4" />
                Mark read
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StreakBannerProps {
  show: boolean;
  streak: number;
}

export function StreakBanner({ show, streak }: StreakBannerProps) {
  if (!show) return null;

  return (
    <Card className="border-success/30 bg-success/5">
      <CardContent className="flex items-center gap-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
          <span className="text-lg">🔥</span>
        </div>
        <div className="text-sm">
          <span className="font-medium text-foreground">{streak} day streak!</span>
          <span className="text-muted-foreground"> Keep checking daily insights.</span>
        </div>
      </CardContent>
    </Card>
  );
}

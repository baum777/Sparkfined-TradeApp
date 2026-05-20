import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Settings2 } from "lucide-react";
import { CHART_TIMEFRAMES } from "./timeframes";

interface ChartTopBarProps {
  symbol: string;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  isReplayMode: boolean;
  onReplayToggle: (enabled: boolean) => void;
  onMobileToolsOpen: () => void;
  isMobile: boolean;
}

export function ChartTopBar({
  symbol,
  timeframe,
  onTimeframeChange,
  isReplayMode,
  onReplayToggle,
  onMobileToolsOpen,
  isMobile,
}: ChartTopBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card/50 border border-border/50 rounded-lg">
      {/* Left: Symbol badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm font-medium">
          {symbol}
        </Badge>
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Solana
        </Badge>
        {isReplayMode && (
          <Badge variant="default" className="text-xs bg-primary/20 text-primary">
            Replay Mode
          </Badge>
        )}
      </div>

      {/* Center/Right: Controls */}
      <div className="flex items-center gap-3">
        <div
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border border-border/50 bg-background/35 p-1"
          aria-label="Chart timeframe"
        >
          {CHART_TIMEFRAMES.map((tf) => {
            const isActive = timeframe === tf.value;

            return (
              <Tooltip key={tf.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Timeframe ${tf.tooltip}`}
                    aria-pressed={isActive}
                    data-testid={`chart-timeframe-${tf.value}`}
                    onClick={() => onTimeframeChange(tf.value)}
                    className={cn(
                      "h-7 min-w-9 rounded-full px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {tf.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{tf.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Replay toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="replay-toggle"
            checked={isReplayMode}
            onCheckedChange={onReplayToggle}
            aria-label="Toggle replay mode"
          />
          <Label htmlFor="replay-toggle" className="text-sm cursor-pointer hidden sm:inline">
            Replay
          </Label>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onMobileToolsOpen}
          className="h-8"
          data-testid="research-tools-open"
        >
          <Settings2 className="h-4 w-4" />
          <span className={isMobile ? "ml-1 hidden xs:inline" : "ml-1"}>Tools</span>
        </Button>
      </div>
    </div>
  );
}

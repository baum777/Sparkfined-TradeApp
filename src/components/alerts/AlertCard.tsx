import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  LineChart,
  Clock,
  CheckCircle2,
  XCircle,
  Circle,
  Timer,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import type {
  Alert,
  SimpleAlert,
  TwoStageAlert,
  DeadTokenAlert,
  AlertStage,
  DeadTokenStage,
} from "./types";

interface AlertCardProps {
  alert: Alert;
  onTogglePause: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelWatch?: (id: string) => void;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function getTypeBadgeLabel(type: Alert["type"]): string {
  switch (type) {
    case "SIMPLE":
      return "Simple";
    case "TWO_STAGE_CONFIRMED":
      return "2-Stage";
    case "DEAD_TOKEN_AWAKENING_V2":
      return "DeadToken";
  }
}

function getStageBadgeVariant(
  stage: AlertStage
): "default" | "secondary" | "outline" | "destructive" {
  switch (stage) {
    case "CONFIRMED":
      return "default";
    case "WATCHING":
      return "secondary";
    case "EXPIRED":
    case "CANCELLED":
      return "outline";
    default:
      return "secondary";
  }
}

function getConditionText(condition: string, targetPrice: number): string {
  const formattedPrice = targetPrice.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
  switch (condition) {
    case "ABOVE":
      return `Above $${formattedPrice}`;
    case "BELOW":
      return `Below $${formattedPrice}`;
    case "CROSS":
      return `Crosses $${formattedPrice}`;
    default:
      return `${condition} $${formattedPrice}`;
  }
}

function getCountdownText(targetDate: string | undefined): string | null {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const now = new Date();
  const mins = differenceInMinutes(target, now);
  if (mins <= 0) return "Expired";
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m left`;
}

// ─────────────────────────────────────────────────────────────
// STAGE TIMELINE (for Dead Token)
// ─────────────────────────────────────────────────────────────

const DEAD_TOKEN_STAGES: DeadTokenStage[] = ["AWAKENING", "SUSTAINED", "SECOND_SURGE"];

function DeadTokenTimeline({ currentStage }: { currentStage: DeadTokenStage }) {
  const currentIndex = DEAD_TOKEN_STAGES.indexOf(currentStage);

  return (
    <div className="flex items-center gap-1">
      {DEAD_TOKEN_STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const isSessionEnded = currentStage === "SESSION_ENDED";

        return (
          <div key={stage} className="flex items-center">
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                isSessionEnded
                  ? "bg-muted text-muted-foreground"
                  : isCompleted
                  ? "bg-primary/20 text-primary"
                  : isCurrent
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isCompleted && <CheckCircle2 className="h-3 w-3" />}
              {isCurrent && !isSessionEnded && <Circle className="h-3 w-3 fill-current" />}
              <span>{stage.replace("_", " ")}</span>
            </div>
            {idx < DEAD_TOKEN_STAGES.length - 1 && (
              <div
                className={`w-4 h-0.5 ${
                  isCompleted ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// INDICATOR CHIPS (for Two-Stage)
// ─────────────────────────────────────────────────────────────

function IndicatorChips({ indicators }: { indicators: TwoStageAlert["indicators"] }) {
  const triggeredCount = indicators.filter((i) => i.triggered).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {indicators.map((ind) => (
          <div
            key={ind.id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border ${
              ind.triggered
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted/50 border-border/50 text-muted-foreground"
            }`}
          >
            {ind.triggered ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            <span className="font-medium">{ind.label}</span>
            {ind.lastValue && (
              <span className="text-muted-foreground ml-1">({ind.lastValue})</span>
            )}
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        {triggeredCount} / 3 indicators triggered
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export function AlertCard({
  alert,
  onTogglePause,
  onDelete,
  onCancelWatch,
}: AlertCardProps) {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = () => {
    setIsDeleting(true);
    onDelete(alert.id);
  };

  const handleOpenChart = () => {
    navigate(`/research?q=${encodeURIComponent(alert.symbolOrAddress)}`);
  };

  const createdAtText = formatDistanceToNow(new Date(alert.createdAt), {
    addSuffix: true,
  });

  const isSimple = alert.type === "SIMPLE";
  const isTwoStage = alert.type === "TWO_STAGE_CONFIRMED";
  const isDeadToken = alert.type === "DEAD_TOKEN_AWAKENING_V2";

  return (
    <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors">
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              {alert.symbolOrAddress}
            </span>
            <Badge variant="outline" className="text-xs">
              {alert.timeframe}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {getTypeBadgeLabel(alert.type)}
            </Badge>
            <Badge variant={getStageBadgeVariant(alert.stage)} className="text-xs">
              {alert.stage}
            </Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {alert.stage !== "CONFIRMED" && alert.stage !== "EXPIRED" && (
              <Switch
                checked={alert.enabled}
                onCheckedChange={() => onTogglePause(alert.id)}
                aria-label={`Toggle ${alert.symbolOrAddress} alert ${
                  alert.enabled ? "off" : "on"
                }`}
              />
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleOpenChart}
              aria-label={`Open ${alert.symbolOrAddress} chart`}
            >
              <LineChart className="h-4 w-4" />
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${alert.symbolOrAddress} alert`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete alert?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the {alert.symbolOrAddress} alert.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Simple Alert Content */}
        {isSimple && (
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              {getConditionText(
                (alert as SimpleAlert).condition,
                (alert as SimpleAlert).targetPrice
              )}
            </p>
            <p className="text-xs text-muted-foreground">Created {createdAtText}</p>
            {(alert as SimpleAlert).triggeredAt && (
              <p className="text-xs text-primary">
                Triggered{" "}
                {formatDistanceToNow(new Date((alert as SimpleAlert).triggeredAt!), {
                  addSuffix: true,
                })}
              </p>
            )}
          </div>
        )}

        {/* Two-Stage Alert Content */}
        {isTwoStage && (
          <div className="space-y-3">
            {alert.stage === "WATCHING" && (
              <>
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Watching — needs 2/3</span>
                </div>
                <IndicatorChips indicators={(alert as TwoStageAlert).indicators} />
                {(alert as TwoStageAlert).expiresAt && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {getCountdownText((alert as TwoStageAlert).expiresAt)}
                  </Badge>
                )}
              </>
            )}

            {alert.stage === "CONFIRMED" && (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    Confirmed (2/3)
                  </span>
                </div>
                <IndicatorChips indicators={(alert as TwoStageAlert).indicators} />
                {(alert as TwoStageAlert).lastTriggeredAt && (
                  <p className="text-xs text-muted-foreground">
                    Last triggered{" "}
                    {formatDistanceToNow(
                      new Date((alert as TwoStageAlert).lastTriggeredAt!),
                      { addSuffix: true }
                    )}{" "}
                    • {(alert as TwoStageAlert).triggeredCount} total
                  </p>
                )}
              </>
            )}

            <p className="text-xs text-muted-foreground">Created {createdAtText}</p>

            {/* Cancel Watch action */}
            {alert.stage === "WATCHING" && onCancelWatch && (
              <>
                <Separator className="my-2" />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                      Cancel watch
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel watching?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will stop monitoring {alert.symbolOrAddress} for the
                        2-stage confirmation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep watching</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onCancelWatch(alert.id)}>
                        Cancel watch
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        )}

        {/* Dead Token Alert Content */}
        {isDeadToken && (
          <div className="space-y-3">
            {/* Stage Timeline */}
            <div className="overflow-x-auto pb-1">
              <DeadTokenTimeline
                currentStage={(alert as DeadTokenAlert).deadTokenStage}
              />
            </div>

            {/* Stage-specific labels */}
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {(alert as DeadTokenAlert).deadTokenStage === "INITIAL" &&
                  "Dead token detected → waiting for awakening"}
                {(alert as DeadTokenAlert).deadTokenStage === "AWAKENING" &&
                  "Awakening detected → monitoring volume growth"}
                {(alert as DeadTokenAlert).deadTokenStage === "SUSTAINED" &&
                  "Sustained growth confirmed"}
                {(alert as DeadTokenAlert).deadTokenStage === "SECOND_SURGE" &&
                  "Second surge confirmed"}
                {(alert as DeadTokenAlert).deadTokenStage === "SESSION_ENDED" &&
                  "Session ended"}
              </span>
            </div>

            {/* Session Panel */}
            {(alert as DeadTokenAlert).sessionStart && (
              <Card className="bg-muted/30 border-border/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Session started</span>
                    <span>
                      {formatDistanceToNow(
                        new Date((alert as DeadTokenAlert).sessionStart!),
                        { addSuffix: true }
                      )}
                    </span>
                  </div>
                  {(alert as DeadTokenAlert).sessionEndsAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Session ends</span>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {getCountdownText((alert as DeadTokenAlert).sessionEndsAt)}
                      </Badge>
                    </div>
                  )}
                  {(alert as DeadTokenAlert).windowEndsAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Current window</span>
                      <Badge variant="secondary" className="text-xs">
                        {getCountdownText((alert as DeadTokenAlert).windowEndsAt)}
                      </Badge>
                    </div>
                  )}
                  {(alert as DeadTokenAlert).cooldownEndsAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Cooldown</span>
                      <Badge variant="outline" className="text-xs">
                        <Timer className="h-3 w-3 mr-1" />
                        {getCountdownText((alert as DeadTokenAlert).cooldownEndsAt)}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground">Created {createdAtText}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

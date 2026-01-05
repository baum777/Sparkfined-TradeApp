import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  RefreshCw,
  Copy,
  AlertTriangle,
  Settings,
  Clock,
  Database,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/components/settings/useSettingsStore";
import type { JournalEntryLocal } from "@/services/journal/types";
import type { JournalInsightV1, InsightCardState } from "@/services/journal/insights/types";
import {
  getCachedInsight,
  setCachedInsight,
  getInsightAge,
} from "@/services/journal/insights/insightCache";
import {
  canGenerate,
  incrementUsage,
  getBudgetStatus,
} from "@/services/journal/insights/insightBudget";
import { generateLocalInsight } from "@/services/journal/insights/localInsightEngine";

interface JournalInsightCardProps {
  entry: JournalEntryLocal;
}

export function JournalInsightCard({ entry }: JournalInsightCardProps) {
  const { settings } = useSettingsStore();
  const [state, setState] = useState<InsightCardState>("idle");
  const [insight, setInsight] = useState<JournalInsightV1 | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load cached insight on mount/entry change
  useEffect(() => {
    const cached = getCachedInsight(entry.id);
    if (cached) {
      setInsight(cached);
      setState("ready");
    } else {
      setInsight(null);
      setState("idle");
    }
    setError(null);
  }, [entry.id]);

  const handleGenerate = useCallback(
    (forceRegenerate = false) => {
      // Check budget
      if (!canGenerate(settings)) {
        setState("blocked");
        return;
      }

      // If cached and not forcing regenerate, just use cache
      if (!forceRegenerate && insight) {
        setState("ready");
        return;
      }

      // Increment usage (regenerate always counts, new generation counts)
      if (forceRegenerate || !insight) {
        incrementUsage();
      }

      setState("loading");
      setError(null);

      // Simulate async for UX (local engine is fast)
      setTimeout(() => {
        try {
          const generated = generateLocalInsight(entry);
          setCachedInsight(generated);
          setInsight(generated);
          setState("ready");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to generate insight");
          setState("error");
        }
      }, 300); // Small delay for loading state visibility
    },
    [entry, insight, settings]
  );

  const handleCopy = useCallback(() => {
    if (!insight) return;

    try {
      const json = JSON.stringify(insight, null, 2);
      navigator.clipboard.writeText(json).then(
        () => {
          toast.success("Insight copied to clipboard");
        },
        () => {
          toast.error("Failed to copy insight");
        }
      );
    } catch {
      toast.error("Failed to copy insight");
    }
  }, [insight]);

  const budgetStatus = getBudgetStatus(settings);

  // Render loading skeleton
  if (state === "loading") {
    return (
      <Card
        className="border-border/50 bg-muted/20"
        data-testid="journal-insight-card"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">AI Insight</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render blocked state
  if (state === "blocked") {
    return (
      <Card
        className="border-border/50 bg-muted/20"
        data-testid="journal-insight-card"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              AI Insight
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent data-testid="journal-insight-blocked">
          <div className="flex items-start gap-3 text-muted-foreground">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm">
                Daily insights limit reached ({budgetStatus.current}/{budgetStatus.limit})
              </p>
              <Link
                to="/settings"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Settings className="h-3 w-3" />
                Manage in Settings
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (state === "error") {
    return (
      <Card
        className="border-destructive/30 bg-destructive/5"
        data-testid="journal-insight-card"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-destructive" />
            <CardTitle className="text-sm font-medium">AI Insight</CardTitle>
          </div>
        </CardHeader>
        <CardContent data-testid="journal-insight-error">
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error || "Failed to generate insight"}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate(true)}
              className="gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render idle state (no insight yet)
  if (state === "idle" || !insight) {
    return (
      <Card
        className="border-border/50 bg-muted/20"
        data-testid="journal-insight-card"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              AI Insight
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Generate insights for this entry
            </p>
            <Button
              data-testid="journal-insight-generate"
              variant="secondary"
              size="sm"
              onClick={() => handleGenerate(false)}
              className="gap-1.5"
            >
              <Sparkles className="h-3 w-3" />
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render ready state with insight
  const priorityColors = {
    P1: "bg-red-500/10 text-red-500 border-red-500/20",
    P2: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    P3: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  };

  return (
    <Card
      className="border-border/50 bg-muted/20"
      data-testid="journal-insight-card"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">AI Insight</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              data-testid="journal-insight-regenerate"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleGenerate(true)}
              title="Regenerate"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              data-testid="journal-insight-copy"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
              title="Copy JSON"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary (max 2 lines) */}
        <p className="text-sm text-foreground line-clamp-2">{insight.summary}</p>

        {/* Top improvements (max 3) */}
        {insight.improvements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Top improvements
            </h4>
            <div className="space-y-1.5">
              {insight.improvements.slice(0, 3).map((imp, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-5 shrink-0",
                      priorityColors[imp.priority]
                    )}
                  >
                    {imp.priority}
                  </Badge>
                  <span className="text-muted-foreground">{imp.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Meta row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {/* Cache badge */}
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              <span>cache: {insight.meta.cache}</span>
            </div>
            
            {/* Confidence */}
            <div className="flex items-center gap-1">
              <span>confidence: {Math.round(insight.confidence * 100)}%</span>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{getInsightAge(insight)}</span>
          </div>
        </div>

        {/* Over limit warning for admin fail-open */}
        {budgetStatus.exceeded && budgetStatus.failOpen && (
          <div className="flex items-center gap-1.5 text-xs text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            <span>Over limit (admin fail-open active)</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

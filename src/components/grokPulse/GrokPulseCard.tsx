/**
 * GrokPulseCard - Main sentiment display card with offline-first behavior
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Zap,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { fetchPulseFeed } from '@/services/api/grokPulse';
import type { GrokSentimentSnapshot, PulseHistoryPoint } from '../../../shared/contracts/grokPulse';
import { GrokPulseSparkline } from './GrokPulseSparkline';
import {
  getPulseSeverity,
  getSeverityBadgeVariant,
  getSeverityBorderClass,
  type PulseSeverity,
} from './severity';
import { getJournalPrompt } from './journalPrompts';

export interface JournalPayload {
  address: string;
  sentiment_term: string;
  cta_phrase: string;
  score: number;
  label: string;
  ts: number;
}

interface GrokPulseCardProps {
  /** ticker-like symbol oder Solana-Adresse */
  address: string;
  symbol?: string;
  onAddToJournal?: (payload: JournalPayload) => void;
}

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function CardSkeleton() {
  return (
    <Card className="border-l-4 border-l-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-16" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

export function GrokPulseCard({
  address,
  symbol,
  onAddToJournal,
}: GrokPulseCardProps) {
  // Fetch snapshot + (stub) history with offline-first behavior
  const {
    data: feed,
    isLoading: snapshotLoading,
    isError: snapshotError,
    error: snapshotErrorObj,
  } = useQuery({
    queryKey: ['feed', 'pulse', address],
    queryFn: () => fetchPulseFeed(address),
    staleTime: 60_000, // 1 minute
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const snapshot: GrokSentimentSnapshot | null = feed?.snapshot ?? null;
  const history: PulseHistoryPoint[] = feed?.history ?? [];
  const resolvedAddress = feed?.assetResolved?.address ?? address;
  const historyLoading = snapshotLoading && !feed;

  // Loading state
  if (snapshotLoading && !snapshot) {
    return (
      <div data-testid="grok-pulse-card">
        <CardSkeleton />
      </div>
    );
  }

  // Empty state (no snapshot available)
  if (!snapshot && !snapshotLoading) {
    return (
      <Card data-testid="grok-pulse-card" className="border-l-4 border-l-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Grok Pulse
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pulse data yet</p>
        </CardContent>
      </Card>
    );
  }

  // We have snapshot data (either fresh or cached)
  const severity: PulseSeverity = snapshot ? getPulseSeverity(snapshot) : 'Low';
  const prompt = snapshot ? getJournalPrompt(snapshot.sentiment_term) : null;

  const handleAddToJournal = () => {
    if (!snapshot) return;

    const payload: JournalPayload = {
      address: resolvedAddress,
      sentiment_term: snapshot.sentiment_term,
      cta_phrase: snapshot.cta_phrase,
      score: snapshot.score,
      label: snapshot.label,
      ts: snapshot.ts,
    };

    if (onAddToJournal) {
      onAddToJournal(payload);
    } else {
      toast({
        title: 'Journal integration pending',
        description: 'Journal entry creation will be available soon.',
      });
    }
  };

  return (
    <Card
      data-testid="grok-pulse-card"
      className={cn('border-l-4', getSeverityBorderClass(severity))}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Grok Pulse
            <Badge variant="outline" className="text-xs font-normal">
              {snapshot?.source === 'grok' ? 'Grok' : 'Fallback'}
            </Badge>
          </CardTitle>
          <Badge variant={getSeverityBadgeVariant(severity)}>{severity}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error banner (offline-first: show if error but we still have cached data) */}
        {snapshotError && snapshot && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-3 w-3" />
            <AlertDescription className="text-xs">
              Failed to refresh. Showing cached data.
            </AlertDescription>
          </Alert>
        )}

        {/* Main score + label + sparkline row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Big score */}
            <div className="text-3xl font-bold tabular-nums">
              {snapshot?.score !== undefined
                ? snapshot.score > 0
                  ? `+${snapshot.score}`
                  : snapshot.score
                : '—'}
            </div>

            {/* Label + sentiment term */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {snapshot?.label}
                </Badge>
                {/* Delta indicator */}
                {snapshot?.delta !== undefined && snapshot.delta !== 0 && (
                  <span
                    className={cn(
                      'text-xs flex items-center gap-0.5',
                      snapshot.delta > 0 ? 'text-green-500' : 'text-red-500'
                    )}
                  >
                    {snapshot.delta > 0 ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )}
                    {Math.abs(snapshot.delta)}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {snapshot?.sentiment_term}
              </p>
            </div>
          </div>

          {/* Sparkline */}
          {!historyLoading && history && (
            <GrokPulseSparkline history={history} severity={severity} />
          )}
        </div>

        {/* Confidence row */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Confidence</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium">
                    {snapshot?.confidence !== undefined
                      ? `${Math.round(snapshot.confidence * 100)}%`
                      : '—'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Model confidence in this sentiment assessment</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Progress
            value={snapshot?.confidence ? snapshot.confidence * 100 : 0}
            className="h-1.5"
          />
        </div>

        {/* Low confidence warning */}
        {snapshot?.low_confidence && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-xs text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Low confidence signal</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Fallback / low confidence — treat as signal, not truth</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* CTA pill */}
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
            {snapshot?.cta}
          </Badge>
          <span className="text-sm">{snapshot?.cta_phrase}</span>
        </div>

        {/* One liner + top snippet */}
        <div className="space-y-1">
          <p className="text-sm font-medium">{snapshot?.one_liner}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {snapshot?.top_snippet}
          </p>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground">
          {snapshot?.ts ? formatRelativeTime(snapshot.ts) : '—'}
        </p>

        {/* Journal Prompt Section */}
        {prompt && (
          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4" />
              {prompt.title}
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {prompt.questions.slice(0, 4).map((q, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-xs font-medium text-primary">{prompt.next}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAddToJournal}
            >
              <BookOpen className="h-3 w-3 mr-2" />
              Add to Journal
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

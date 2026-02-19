/**
 * ErrorFallback
 * 
 * Fallback UI shown when ErrorBoundary catches an error.
 * Provides friendly message, error ID, and action buttons.
 */

import { AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorFallbackProps {
  error: Error | null;
  errorId: string | null;
  scope?: string;
  onReset: () => void;
  onReload: () => void;
}

export function ErrorFallback({
  error,
  errorId,
  scope,
  onReset,
  onReload,
}: ErrorFallbackProps) {
  const title = scope
    ? `Something went wrong in ${scope}`
    : 'Something went wrong';

  const message = error?.message || 'An unexpected error occurred.';

  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <CardTitle>{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>

          {errorId && (
            <div className="rounded-md bg-muted p-2 text-xs font-mono text-muted-foreground">
              Error ID: {errorId}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={onReset} variant="outline" className="flex-1">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset UI
            </Button>
            <Button onClick={onReload} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


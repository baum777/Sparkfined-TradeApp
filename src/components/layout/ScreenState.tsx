import * as React from "react";
import { ErrorState, LoadingState } from "@/components/layout/PageStates";

export type ScreenStatus = "loading" | "error" | "ready";

export interface ScreenStateProps {
  status?: ScreenStatus;
  onRetry?: () => void;
  /** Optional skeleton/placeholder to show instead of the default spinner loading state */
  loadingVariant?: React.ReactNode;
  errorTitle?: string;
  errorMessage?: string;
  children?: React.ReactNode;
}

/**
 * Shared screen-state wrapper for consistent Loading + Error handling.
 * Empty states remain page-owned.
 */
export function ScreenState({
  status = "ready",
  onRetry,
  loadingVariant,
  errorTitle,
  errorMessage,
  children,
}: ScreenStateProps) {
  if (status === "loading") {
    return (
      <div data-testid="screenstate-loading">
        {loadingVariant ?? <LoadingState />}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div data-testid="screenstate-error">
        <ErrorState title={errorTitle} message={errorMessage} onRetry={onRetry} />
      </div>
    );
  }

  return <>{children}</>;
}



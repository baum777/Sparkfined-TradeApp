import { ApiHttpError } from '@/services/api/client';

export function getDiscoverErrorMessage(error: unknown): string {
  if (error instanceof ApiHttpError && error.code === 'PROVIDER_UNAVAILABLE') {
    return 'Provider unavailable';
  }
  return error instanceof Error ? error.message : 'Failed to load tokens';
}

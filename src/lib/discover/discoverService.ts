import { apiClient } from '@/services/api/client';
import type { Token } from '@/features/discover/filter/types';

/**
 * Discover Service
 * Fetches token data for Discover Overlay.
 */
export const discoverService = {
  /**
   * Fetch tokens for Discover overlay.
   * Returns only provider-backed API data (no runtime mock fallback).
   */
  async getTokens(): Promise<Token[]> {
    const response = await apiClient.get<unknown>('/discover/tokens');
    if (!Array.isArray(response)) {
      throw new Error('Invalid discover token payload');
    }
    return response as Token[];
  },
};

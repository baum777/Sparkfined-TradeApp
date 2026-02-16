import { apiClient } from '@/services/api/client';
import type { Token } from '@/features/discover/filter/types';

/**
 * Discover Service
 * Fetches token data for Discover Overlay
 */
export const discoverService = {
  /**
   * Fetch tokens for Discover overlay
   * Returns normalized Token[] ready for filter engine
   */
  async getTokens(): Promise<Token[]> {
    try {
      // API client already prefixes "/api", endpoint path must stay relative.
      const response = await apiClient.get<Token[]>('/discover/tokens');
      return response;
    } catch (error) {
      console.warn('Discover tokens endpoint unavailable, returning empty list', error);
      return [];
    }
  },
};


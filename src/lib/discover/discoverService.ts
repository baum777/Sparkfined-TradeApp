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
      // Try to fetch from API endpoint
      const response = await apiClient.get<Token[]>('/api/discover/tokens');
      return response;
    } catch (error) {
      // If endpoint doesn't exist, return empty array
      // In production, this would be a real endpoint
      console.warn('Discover tokens endpoint not available, returning empty list');
      return [];
    }
  },
};


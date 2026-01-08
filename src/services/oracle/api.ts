import { apiClient } from '../api/client';
import type { OracleDailyFeed, OracleReadState } from './types';

export async function fetchOracleDaily(params?: { date?: string }): Promise<OracleDailyFeed> {
  const qs = params?.date ? `?date=${encodeURIComponent(params.date)}` : '';
  return apiClient.get<OracleDailyFeed>(`/oracle/daily${qs}`);
}

export async function putOracleReadState(input: {
  id: string;
  isRead: boolean;
}): Promise<OracleReadState> {
  return apiClient.put<OracleReadState>('/oracle/read-state', input);
}

export async function bulkOracleReadState(input: {
  ids: string[];
  isRead: boolean;
}): Promise<{ updated: OracleReadState[] }> {
  // Contract allows POST/PUT; we use POST.
  return apiClient.post<{ updated: OracleReadState[] }>('/oracle/read-state/bulk', input);
}


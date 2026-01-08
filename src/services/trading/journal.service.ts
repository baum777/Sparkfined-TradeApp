/**
 * Journal Service
 * 
 * Verwaltet alle Trading-Journal-bezogenen API-Aufrufe
 */

import { apiClient } from '../api/client';

export interface JournalEntry {
  id: string;
  date: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  strategy: string;
  tags: string[];
  screenshots: string[];
  notes: string;
  emotions: string[];
  mistakes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryInput {
  date: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  strategy?: string;
  tags?: string[];
  screenshots?: string[];
  notes?: string;
  emotions?: string[];
  mistakes?: string[];
}

export interface JournalFilters {
  dateFrom?: string;
  dateTo?: string;
  symbol?: string;
  direction?: 'long' | 'short';
  strategy?: string;
  tags?: string[];
  minPnl?: number;
  maxPnl?: number;
  limit?: number;
  offset?: number;
}

export interface JournalStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  averagePnl: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  averageHoldingTime: number;
}

class JournalService {
  private readonly basePath = '/journal';

  /**
   * Holt alle Journal-Einträge mit optionalen Filtern
   */
  async getEntries(filters?: JournalFilters): Promise<JournalEntry[]> {
    const queryParams = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v.toString()));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });
    }

    const query = queryParams.toString();
    const endpoint = query ? `${this.basePath}?${query}` : this.basePath;

    return apiClient.get<JournalEntry[]>(endpoint);
  }

  /**
   * Holt einen einzelnen Journal-Eintrag
   */
  async getEntry(id: string): Promise<JournalEntry> {
    return apiClient.get<JournalEntry>(`${this.basePath}/${id}`);
  }

  /**
   * Erstellt einen neuen Journal-Eintrag
   */
  async createEntry(data: JournalEntryInput): Promise<JournalEntry> {
    // Berechne PnL
    const pnl = this.calculatePnL(
      data.direction,
      data.entryPrice,
      data.exitPrice,
      data.quantity
    );

    const entryData = {
      ...data,
      pnl: pnl.absolute,
      pnlPercent: pnl.percent,
    };

    return apiClient.post<JournalEntry>(this.basePath, entryData);
  }

  /**
   * Aktualisiert einen bestehenden Journal-Eintrag
   */
  async updateEntry(
    id: string,
    data: Partial<JournalEntryInput>
  ): Promise<JournalEntry> {
    return apiClient.patch<JournalEntry>(`${this.basePath}/${id}`, data);
  }

  /**
   * Löscht einen Journal-Eintrag
   */
  async deleteEntry(id: string): Promise<void> {
    await apiClient.delete<void>(`${this.basePath}/${id}`);
  }

  /**
   * Archiviert einen Journal-Eintrag
   */
  async archiveEntry(id: string): Promise<JournalEntry> {
    return apiClient.patch<JournalEntry>(`${this.basePath}/${id}/archive`, {
      archived: true,
    });
  }

  /**
   * Holt Statistiken für alle Journal-Einträge
   */
  async getStats(filters?: JournalFilters): Promise<JournalStats> {
    const queryParams = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && !['limit', 'offset'].includes(key)) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v.toString()));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });
    }

    const query = queryParams.toString();
    const endpoint = query 
      ? `${this.basePath}/stats?${query}` 
      : `${this.basePath}/stats`;

    return apiClient.get<JournalStats>(endpoint);
  }

  /**
   * Lädt Screenshots hoch für einen Journal-Eintrag
   */
  async uploadScreenshots(
    id: string,
    files: File[]
  ): Promise<string[]> {
    // BACKEND_TODO: Support multipart/form-data uploads (ApiClient currently JSON-only).
    // BACKEND_TODO: Replace with real upload endpoint integration.
    void id;
    void files;
    return [];
  }

  /**
   * Berechnet PnL für einen Trade
   */
  private calculatePnL(
    direction: 'long' | 'short',
    entryPrice: number,
    exitPrice: number,
    quantity: number
  ): { absolute: number; percent: number } {
    const isLong = direction === 'long';
    const priceChange = exitPrice - entryPrice;
    const absolute = isLong 
      ? priceChange * quantity 
      : -priceChange * quantity;
    const percent = isLong
      ? (priceChange / entryPrice) * 100
      : -(priceChange / entryPrice) * 100;

    return { absolute, percent };
  }

  /**
   * Exportiert Journal-Einträge als CSV
   */
  async exportToCSV(filters?: JournalFilters): Promise<Blob> {
    const queryParams = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v.toString()));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });
    }

    const query = queryParams.toString();
    const endpoint = query 
      ? `${this.basePath}/export/csv?${query}` 
      : `${this.basePath}/export/csv`;

    // Use raw mode to avoid envelope assumptions for file downloads.
    const response = await fetch(`${(apiClient as any)['config'].baseURL}${endpoint}`, {
      headers: (apiClient as any)['config'].headers,
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  }
}

// Singleton-Instanz
export const journalService = new JournalService();

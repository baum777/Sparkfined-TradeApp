/**
 * Performance Analytics Service
 * 
 * Verwaltet Performance-Metriken und Analysen
 */

import { apiClient } from '../api/client';

export interface PerformanceMetrics {
  period: {
    start: string;
    end: string;
  };
  overview: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnl: number;
    averagePnl: number;
    profitFactor: number;
  };
  streaks: {
    currentWinStreak: number;
    currentLossStreak: number;
    longestWinStreak: number;
    longestLossStreak: number;
  };
  timing: {
    averageHoldingTime: number; // in minutes
    bestTimeOfDay: string;
    worstTimeOfDay: string;
    bestDayOfWeek: string;
    worstDayOfWeek: string;
  };
  riskMetrics: {
    sharpeRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    recoveryFactor: number;
    averageRiskRewardRatio: number;
  };
}

export interface PerformanceByPeriod {
  period: string; // 'daily', 'weekly', 'monthly'
  data: Array<{
    date: string;
    trades: number;
    pnl: number;
    winRate: number;
  }>;
}

export interface PerformanceByStrategy {
  strategy: string;
  trades: number;
  winRate: number;
  totalPnl: number;
  averagePnl: number;
  profitFactor: number;
}

export interface PerformanceBySymbol {
  symbol: string;
  trades: number;
  winRate: number;
  totalPnl: number;
  averagePnl: number;
  lastTraded: string;
}

export interface DateRange {
  start: string;
  end: string;
}

class PerformanceService {
  private readonly basePath = '/analytics/performance';

  /**
   * Holt Performance-Metriken für einen bestimmten Zeitraum
   */
  async getMetrics(dateRange?: DateRange): Promise<PerformanceMetrics> {
    const queryParams = new URLSearchParams();
    
    if (dateRange) {
      queryParams.append('start', dateRange.start);
      queryParams.append('end', dateRange.end);
    }

    const query = queryParams.toString();
    const endpoint = query ? `${this.basePath}?${query}` : this.basePath;

    return apiClient.get<PerformanceMetrics>(endpoint);
  }

  /**
   * Holt Performance-Daten gruppiert nach Zeitperiode
   */
  async getPerformanceByPeriod(
    period: 'daily' | 'weekly' | 'monthly',
    dateRange?: DateRange
  ): Promise<PerformanceByPeriod> {
    const queryParams = new URLSearchParams({ period });
    
    if (dateRange) {
      queryParams.append('start', dateRange.start);
      queryParams.append('end', dateRange.end);
    }

    return apiClient.get<PerformanceByPeriod>(
      `${this.basePath}/by-period?${queryParams.toString()}`
    );
  }

  /**
   * Holt Performance-Daten gruppiert nach Strategie
   */
  async getPerformanceByStrategy(
    dateRange?: DateRange
  ): Promise<PerformanceByStrategy[]> {
    const queryParams = new URLSearchParams();
    
    if (dateRange) {
      queryParams.append('start', dateRange.start);
      queryParams.append('end', dateRange.end);
    }

    const query = queryParams.toString();
    const endpoint = query 
      ? `${this.basePath}/by-strategy?${query}` 
      : `${this.basePath}/by-strategy`;

    return apiClient.get<PerformanceByStrategy[]>(endpoint);
  }

  /**
   * Holt Performance-Daten gruppiert nach Symbol
   */
  async getPerformanceBySymbol(
    dateRange?: DateRange
  ): Promise<PerformanceBySymbol[]> {
    const queryParams = new URLSearchParams();
    
    if (dateRange) {
      queryParams.append('start', dateRange.start);
      queryParams.append('end', dateRange.end);
    }

    const query = queryParams.toString();
    const endpoint = query 
      ? `${this.basePath}/by-symbol?${query}` 
      : `${this.basePath}/by-symbol`;

    return apiClient.get<PerformanceBySymbol[]>(endpoint);
  }

  /**
   * Berechnet Sharpe Ratio
   * @param returns Array von Return-Werten
   * @param riskFreeRate Risikofreier Zinssatz (default: 0.02)
   */
  calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length === 0) return 0;

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce(
      (sum, r) => sum + Math.pow(r - meanReturn, 2),
      0
    ) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    return (meanReturn - riskFreeRate) / stdDev;
  }

  /**
   * Berechnet Maximum Drawdown
   * @param equity Array von Equity-Werten über Zeit
   */
  calculateMaxDrawdown(equity: number[]): { amount: number; percent: number } {
    if (equity.length === 0) {
      return { amount: 0, percent: 0 };
    }

    let maxEquity = equity[0];
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const currentEquity of equity) {
      if (currentEquity > maxEquity) {
        maxEquity = currentEquity;
      }

      const drawdown = maxEquity - currentEquity;
      const drawdownPercent = (drawdown / maxEquity) * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }

    return {
      amount: maxDrawdown,
      percent: maxDrawdownPercent,
    };
  }

  /**
   * Berechnet Profit Factor
   * @param winningTrades Array von gewinnenden Trades
   * @param losingTrades Array von verlierenden Trades
   */
  calculateProfitFactor(winningTrades: number[], losingTrades: number[]): number {
    const grossProfit = winningTrades.reduce((sum, trade) => sum + trade, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade, 0));

    if (grossLoss === 0) {
      return grossProfit > 0 ? Infinity : 0;
    }

    return grossProfit / grossLoss;
  }

  /**
   * Exportiert Performance-Report als PDF
   */
  async exportReport(dateRange?: DateRange): Promise<Blob> {
    const queryParams = new URLSearchParams();
    
    if (dateRange) {
      queryParams.append('start', dateRange.start);
      queryParams.append('end', dateRange.end);
    }

    const query = queryParams.toString();
    const endpoint = query 
      ? `${this.basePath}/export/pdf?${query}` 
      : `${this.basePath}/export/pdf`;

    // Use raw fetch for file download.
    const response = await fetch(`${(apiClient as any)['config'].baseURL}${endpoint}`, {
      headers: (apiClient as any)['config'].headers,
    });

    if (!response.ok) {
      throw new Error('Report export failed');
    }

    return response.blob();
  }
}

// Singleton-Instanz
export const performanceService = new PerformanceService();

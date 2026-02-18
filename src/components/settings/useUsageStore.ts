import { useState, useEffect, useCallback } from 'react';
import type { Provider, UseCase } from './types';
import type { AppUsageV1, UsageEvent, UsageCounters } from './usageTypes';
import { DEFAULT_USAGE, getTodayDateString, isUsageStale } from './usageTypes';

const STORAGE_KEY = 'app_usage_v1';

function loadUsage(): AppUsageV1 {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (stored) {
      const parsed = JSON.parse(stored) as AppUsageV1;
      
      // Reset if stale (from previous day)
      if (isUsageStale(parsed)) {
        const fresh = { ...DEFAULT_USAGE, date: getTodayDateString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        return fresh;
      }
      
      return parsed;
    }

    const fresh = { ...DEFAULT_USAGE, date: getTodayDateString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return { ...DEFAULT_USAGE, date: getTodayDateString() };
  }
}

export function useUsageStore(maxEvents = 200) {
  const [usage, setUsage] = useState<AppUsageV1>(() => loadUsage());

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  }, [usage]);

  // Check for day rollover
  useEffect(() => {
    const interval = setInterval(() => {
      if (isUsageStale(usage)) {
        setUsage({ ...DEFAULT_USAGE, date: getTodayDateString() });
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [usage]);

  const recordCall = useCallback((provider: Provider, useCase: UseCase, latencyMs?: number) => {
    setUsage(prev => {
      const counters = { ...prev.counters };
      
      // Increment calls
      if (!counters.callsToday[provider]) {
        counters.callsToday[provider] = {};
      }
      counters.callsToday[provider]![useCase] = (counters.callsToday[provider]![useCase] || 0) + 1;

      // Update avg latency
      if (latencyMs !== undefined) {
        if (!counters.avgLatencyMs[provider]) {
          counters.avgLatencyMs[provider] = {};
        }
        const prevAvg = counters.avgLatencyMs[provider]![useCase] || 0;
        const prevCount = counters.callsToday[provider]![useCase] || 1;
        counters.avgLatencyMs[provider]![useCase] = Math.round(
          (prevAvg * (prevCount - 1) + latencyMs) / prevCount
        );
      }

      counters.lastProviderUsed = provider;

      // Add event to ring buffer
      const event: UsageEvent = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        provider,
        useCase,
        type: 'call',
        latencyMs,
      };
      counters.events = [...counters.events.slice(-(maxEvents - 1)), event];

      return { ...prev, counters };
    });
  }, [maxEvents]);

  const recordError = useCallback((provider: Provider, useCase: UseCase, code: string, message: string) => {
    setUsage(prev => {
      const counters = { ...prev.counters };
      
      // Increment errors
      if (!counters.errorsToday[provider]) {
        counters.errorsToday[provider] = {};
      }
      counters.errorsToday[provider]![useCase] = (counters.errorsToday[provider]![useCase] || 0) + 1;

      // Set last error
      counters.lastError = {
        code,
        message,
        provider,
        useCase,
        ts: Date.now(),
      };

      // Add event
      const event: UsageEvent = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        provider,
        useCase,
        type: 'error',
        errorCode: code,
        errorMessage: message,
      };
      counters.events = [...counters.events.slice(-(maxEvents - 1)), event];

      return { ...prev, counters };
    });
  }, [maxEvents]);

  const recordCacheHit = useCallback((module: string) => {
    setUsage(prev => {
      const counters = { ...prev.counters };
      counters.cacheHitsToday[module] = (counters.cacheHitsToday[module] || 0) + 1;

      return { ...prev, counters };
    });
  }, []);

  const resetCounters = useCallback(() => {
    setUsage({ ...DEFAULT_USAGE, date: getTodayDateString() });
  }, []);

  // Computed stats
  const totalCallsToday = Object.values(usage.counters.callsToday).reduce<number>((acc, providerCalls) => {
    return acc + Object.values(providerCalls || {}).reduce<number>((sum, count) => sum + (count ?? 0), 0);
  }, 0);

  const totalErrorsToday = Object.values(usage.counters.errorsToday).reduce<number>((acc, providerErrors) => {
    return acc + Object.values(providerErrors || {}).reduce<number>((sum, count) => sum + (count ?? 0), 0);
  }, 0);

  const totalCacheHits = Object.values(usage.counters.cacheHitsToday).reduce<number>(
    (sum, count) => sum + (count ?? 0),
    0
  );

  const overallAvgLatency = (() => {
    let total = 0;
    let count = 0;
    Object.values(usage.counters.avgLatencyMs).forEach(providerLatency => {
      Object.values(providerLatency || {}).forEach(avg => {
        if (avg) {
          total += avg;
          count++;
        }
      });
    });
    return count > 0 ? Math.round(total / count) : 0;
  })();

  const exportDiagnostics = useCallback(() => {
    return JSON.stringify(usage, null, 2);
  }, [usage]);

  return {
    usage,
    recordCall,
    recordError,
    recordCacheHit,
    resetCounters,
    totalCallsToday,
    totalErrorsToday,
    totalCacheHits,
    overallAvgLatency,
    exportDiagnostics,
  };
}

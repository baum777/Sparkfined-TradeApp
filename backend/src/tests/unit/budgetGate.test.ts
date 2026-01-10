import { describe, it, expect, beforeEach } from 'vitest';
import { checkAndConsumeBudget } from '../../lib/budget/budgetGate.js';
import { usageTracker } from '../../lib/usage/usageTracker.js';
import { checkRateLimit } from '../../lib/rateLimit/limiter.js';
import { AppSettingsV1 } from '../../lib/budget/types.js';

describe('Budget Gate & Rate Limiter', () => {
  beforeEach(() => {
    // Reset usage tracker state if needed, or use separate keys
    // Since we use in-memory KV for tests (assuming no Env vars set), we can just clear it?
    // My KVStore doesn't expose clear.
    // I'll use unique userIds/IPs for each test.
  });

  it('should block when daily limit exceeded', async () => {
    const userId = 'user-limit-test';
    const settings: AppSettingsV1 = {
      tier: 'free',
      customBudgets: {
        'openai:journal': 1 
      }
    };
    
    // 1st call - should pass
    let result = await checkAndConsumeBudget({
        provider: 'openai',
        useCase: 'journal',
        userId,
        now: Date.now(),
        settings
    });
    expect(result.allowed).toBe(true);
    
    // Record usage (simulating post-call)
    await usageTracker.recordCall('openai', 'journal');

    // 2nd call - should fail (usage is 1, limit is 1. 1 >= 1 => fail)
    result = await checkAndConsumeBudget({
        provider: 'openai',
        useCase: 'journal',
        userId,
        now: Date.now(),
        settings
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily limit');
  });

  it('should allow overage if adminFailOpen is true', async () => {
    const userId = 'admin-user';
    const settings: AppSettingsV1 = {
      tier: 'free',
      customBudgets: { 'openai:journal': 0 }, // blocked immediately
      adminFailOpen: true
    };

    const result = await checkAndConsumeBudget({
        provider: 'openai',
        useCase: 'journal',
        userId,
        now: Date.now(),
        settings
    });
    
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('overage_allowed');
  });

  it('should enforce rate limits', async () => {
    const ip = '127.0.0.1';
    // Global limit is 60.
    // We'll simulate 61 calls.
    
    // Mock the KV store to return high count directly?
    // Or just loop. Loop 61 times in memory is fast.
    
    let blocked = false;
    for (let i = 0; i < 65; i++) {
        const res = await checkRateLimit(ip);
        if (!res.allowed) {
            blocked = true;
            break;
        }
    }
    expect(blocked).toBe(true);
  });

  it('should track usage stats correctly', async () => {
      const now = Date.now();
      await usageTracker.recordCall('openai', 'insights', now);
      await usageTracker.recordLatency('openai', 'insights', 100, now);
      await usageTracker.recordLatency('openai', 'insights', 200, now);
      
      const stats = await usageTracker.getUseCaseStats('openai', 'insights', now);
      expect(stats.calls).toBeGreaterThanOrEqual(1);
      expect(stats.latencyCount).toBeGreaterThanOrEqual(2);
      expect(stats.latencyMean).toBe(150);
  });
});


import { kv } from '../kv';
import { usageTracker } from '../usage/usageTracker';
import { BudgetCheckParams, BudgetResult, TIER_LIMITS } from './types';

class BudgetGate {
  private static instance: BudgetGate;

  static getInstance(): BudgetGate {
    if (!BudgetGate.instance) {
      BudgetGate.instance = new BudgetGate();
    }
    return BudgetGate.instance;
  }

  async checkAndConsumeBudget(params: BudgetCheckParams): Promise<BudgetResult> {
    const { provider, useCase, settings, now, userId } = params;
    const tier = settings.tier || 'free';
    const tierConfig = TIER_LIMITS[tier];

    // 1. Resolve limits
    const limitKey = `${provider}:${useCase}`;
    const dailyLimit = settings.customBudgets?.[limitKey] ?? tierConfig[limitKey];

    if (dailyLimit === undefined) {
      if (settings.adminFailOpen) {
        return { allowed: true, reason: 'admin_fail_open' };
      }
      return { 
        allowed: false, 
        reason: `Capability ${limitKey} not available on ${tier} tier`,
        recoverable: false
      };
    }

    // 2. Read current usage
    const currentUsage = await usageTracker.getUsage(provider, useCase, now);

    // 3. Enforce Daily Limit
    if (currentUsage >= dailyLimit) {
       if (settings.adminFailOpen) {
          await this.markOverage(params);
          return { allowed: true, reason: 'overage_allowed' };
       }
       return {
         allowed: false,
         reason: `Daily limit of ${dailyLimit} exceeded for ${limitKey}`,
         recoverable: true 
       };
    }

    // 4. Enforce Concurrency
    if (userId) {
        const maxConcurrent = tierConfig['global:maxConcurrentCalls'];
        if (maxConcurrent) {
            const acquired = await this.acquireConcurrencySlot(userId, maxConcurrent);
            if (!acquired) {
                if (settings.adminFailOpen) {
                    await this.markOverage(params);
                    return { allowed: true, reason: 'concurrency_overage' };
                }
                return {
                    allowed: false,
                    reason: 'Too many concurrent requests',
                    recoverable: true
                };
            }
        }
    }

    return { allowed: true, remaining: dailyLimit - currentUsage };
  }

  async acquireConcurrencySlot(userId: string, maxConcurrent: number): Promise<boolean> {
     const key = `budget:v1:concurrency:user:${userId}`;
     // In api kv wrapper, incr returns number
     const current = await kv.incr(key, 1, 60); // 60s TTL safety net in case of crash
     if (current > maxConcurrent) {
         await kv.incr(key, -1); // Revert
         return false;
     }
     return true;
  }
  
  async releaseConcurrencySlot(userId: string): Promise<void> {
     const key = `budget:v1:concurrency:user:${userId}`;
     await kv.incr(key, -1);
  }

  async markOverage(params: BudgetCheckParams): Promise<void> {
      const date = new Date(params.now).toISOString().split('T')[0];
      const key = `usage:v1:overage:${date}:${params.provider}:${params.useCase}`;
      await kv.incr(key, 1, 35 * 24 * 3600);
  }
}

export const budgetGate = BudgetGate.getInstance();

export async function checkAndConsumeBudget(params: BudgetCheckParams): Promise<BudgetResult> {
  return budgetGate.checkAndConsumeBudget(params);
}

export async function releaseConcurrency(userId: string): Promise<void> {
    return budgetGate.releaseConcurrencySlot(userId);
}


import { ServerResponse } from 'http';
import { ParsedRequest } from '../http/router.js';
import { sendJson } from '../http/response.js';
import { usageTracker } from '../lib/usage/usageTracker.js';

export async function handleUsageSummary(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const now = Date.now();
  
  const openaiJournal = await usageTracker.getUseCaseStats('openai', 'journal', now);
  const openaiInsights = await usageTracker.getUseCaseStats('openai', 'insights', now);
  const openaiCharts = await usageTracker.getUseCaseStats('openai', 'charts', now);
  
  const deepseekReasoning = await usageTracker.getUseCaseStats('deepseek', 'reasoning', now);
  const deepseekCritic = await usageTracker.getUseCaseStats('deepseek', 'reasoning_critic', now);
  
  const grokPulse = await usageTracker.getUseCaseStats('grok', 'grok_pulse', now);
  
  const totalCalls = openaiJournal.calls + openaiInsights.calls + openaiCharts.calls + 
                     deepseekReasoning.calls + deepseekCritic.calls + grokPulse.calls;
                     
  const totalErrors = openaiJournal.errors + openaiInsights.errors + openaiCharts.errors +
                      deepseekReasoning.errors + deepseekCritic.errors + grokPulse.errors;
  
  const totalLatencySum = openaiJournal.latencySum + openaiInsights.latencySum + openaiCharts.latencySum +
                          deepseekReasoning.latencySum + deepseekCritic.latencySum + grokPulse.latencySum;
                          
  const totalLatencyCount = openaiJournal.latencyCount + openaiInsights.latencyCount + openaiCharts.latencyCount +
                            deepseekReasoning.latencyCount + deepseekCritic.latencyCount + grokPulse.latencyCount;

  const avgLatencyMs = totalLatencyCount > 0 ? totalLatencySum / totalLatencyCount : 0;

  void req;
  sendJson(res, {
    today: {
      openai: {
        journal: openaiJournal,
        insights: openaiInsights,
        charts: openaiCharts,
      },
      deepseek: {
        reasoning: deepseekReasoning,
        reasoning_critic: deepseekCritic,
      },
      grok: {
        grok_pulse: grokPulse,
      },
    },
    totals: {
      calls: totalCalls,
      errors: totalErrors,
      avgLatencyMs,
    },
    lastError: null,
  });
}

import { z } from 'zod';
import { routeLLMRequest } from '../../reasoning/llmRouter';
import { getSourceAdapter } from './adapter';
import { PulseLabel, type PulseSnapshot } from './types';
import { logger } from '../../logger';

const PulseSchema = z.object({
  label: z.nativeEnum(PulseLabel),
  score: z.number().min(-100).max(100),
  confidence: z.number().min(0).max(1),
  drivers: z.array(z.string()).max(5),
  reasoning_short: z.string(),
  top_sources: z.array(z.object({
    name: z.string(),
    url: z.string().optional(),
    ts: z.number().optional(),
  })).max(10),
});

export async function generatePulse(query: string): Promise<PulseSnapshot> {
  const start = Date.now();
  
  // 1. Get Sources
  const adapter = getSourceAdapter();
  const items = await adapter.getItems(query);

  // 2. Prepare Prompt
  if (items.length === 0) {
    return {
      query,
      ts: start,
      label: PulseLabel.UNKNOWN,
      score: 0,
      confidence: 0,
      drivers: ['No recent data found'],
      sources: [],
      meta: {
        model: 'heuristic',
        latency_ms: Date.now() - start,
        version: 'v1',
        cache: 'miss',
      },
    };
  }

  // Cap items to N=40
  const limitedItems = items.slice(0, 40);
  const itemsText = limitedItems
    .map(i => `- [${new Date(i.ts).toISOString()}] ${i.text}`)
    .join('\n');

  const systemPrompt = `You are a crypto narrative analyst (Grok Pulse). 
Your job is to analyze the following social/news stream for the query "${query}" and extract sentiment signal.
Analyze the items and output STRICT JSON only matching this schema:
{
  "label": "MOON" | "STRONG_BULL" | "BULL" | "NEUTRAL" | "BEAR" | "STRONG_BEAR" | "RUG" | "UNKNOWN",
  "score": number (-100 to 100),
  "confidence": number (0.0 to 1.0),
  "drivers": ["driver 1", "driver 2", ...], // max 5, short
  "reasoning_short": "one sentence summary",
  "top_sources": [ { "name": "source name", "url": "..." } ]
}
Rules:
- If sources are spammy or irrelevant, set confidence low.
- "MOON" is reserved for extreme viral velocity.
- "RUG" is for scam confirmations.
`;

  // 3. Call LLM
  try {
    const response = await routeLLMRequest('grok_pulse', {
      prompt: itemsText,
      system: systemPrompt,
      timeoutMs: 15000,
      jsonOnly: true,
    });

    const parsed = PulseSchema.parse(response.parsed);

    return {
      query,
      ts: start,
      label: parsed.label,
      score: parsed.score,
      confidence: parsed.confidence,
      drivers: parsed.drivers,
      sources: parsed.top_sources.map(s => ({
        name: s.name,
        url: s.url,
        ts: s.ts || start
      })),
      meta: {
        model: response.model,
        latency_ms: Date.now() - start,
        version: 'v1',
        cache: 'miss',
      },
    };
  } catch (error) {
    logger.error('Grok Pulse generation failed', { query, error: String(error) });
    
    // Return recoverable error state
    return {
      query,
      ts: start,
      label: PulseLabel.UNKNOWN,
      score: 0,
      confidence: 0,
      drivers: ['Analysis failed, please retry'],
      sources: [],
      meta: {
        model: 'error',
        latency_ms: Date.now() - start,
        version: 'v1',
        cache: 'miss',
      },
    };
  }
}


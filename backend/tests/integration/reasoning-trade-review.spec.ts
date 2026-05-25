import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'http';
import { request as httpRequest } from 'http';
import { createApp } from '../../src/app';
import { resetEnvCache } from '../../src/config/env';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function postJson(url: string, body: unknown): Promise<{ status: number; text: string }> {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers: {
          'content-type': 'application/json',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') });
        });
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

const assistantReview = {
  schemaVersion: 'trade_review_v1',
  referenceId: 'trade-review-endpoint-1',
  createdAt: '2026-05-08T10:00:00.000Z',
  assistantDecision: {
    decision: 'paper_trade_candidate',
    direction: 'long',
    confidence: 0.72,
    rationale: ['Setup is acceptable for paper review only.'],
  },
  marketDataQuality: {
    dataFreshness: 'fresh',
    asOf: '2026-05-08T09:59:45.000Z',
    sources: ['oracle.daily', 'chart.ta'],
    warnings: [],
  },
  riskDecision: {
    maxRiskPct: 1,
    stopLoss: 142.5,
    takeProfit: 154,
    positionSizing: 'paper_only',
    warnings: [],
  },
};

describe('POST /api/reasoning/trade-review', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = createServer((req, res) => app.handle(req, res));

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test';
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.test';
    process.env.LLM_MAX_RETRIES = '0';
    process.env.LLM_TIMEOUT_MS = '1000';
    resetEnvCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns assistantReview from the TradeReviewV1 output contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  type: 'trade-review',
                  referenceId: 'trade-review-endpoint-1',
                  verdict: 'MIXED',
                  decision: {
                    shouldRepeat: false,
                    reason: 'Paper review only until data quality and stop discipline are confirmed.',
                  },
                  highlights: ['Entry trigger is defined.'],
                  risks: [
                    {
                      label: 'Process risk',
                      severity: 'medium',
                      evidence: ['Trade remains paper only.'],
                    },
                  ],
                  fixes: [
                    {
                      action: 'Confirm invalidation before any paper entry.',
                      why: 'The assistant contract requires stop discipline.',
                    },
                  ],
                  questions: ['What invalidates the setup?'],
                  assistantReview,
                  critic: {
                    issues: [],
                    adjustedConfidence: 0.72,
                    notes: [],
                  },
                }),
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  issues: [],
                  adjustedConfidence: 0.72,
                  notes: [],
                }),
              },
            },
          ],
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const { status, text } = await postJson(`${baseUrl}/api/reasoning/trade-review`, {
      referenceId: 'trade-review-endpoint-1',
      context: {
        symbol: 'SOL',
        timeframe: '1h',
      },
    });
    const body = JSON.parse(text);

    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.data.status).toBe('ok');
    expect(body.data.data.assistantReview).toEqual(assistantReview);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

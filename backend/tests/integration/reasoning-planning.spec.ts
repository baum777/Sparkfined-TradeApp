import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { handleError } from '../../src/http/error';
import type { ParsedRequest } from '../../src/http/router';
import { resetEnvCache } from '../../src/config/env';
import { handleReasoningPlanning } from '../../src/routes/reasoning/planning';

const routeLLMRequestMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/clients/llmRouter', () => ({
  routeLLMRequest: routeLLMRequestMock,
}));

class ResponseStub {
  status = 200;
  headers: Record<string, string> = {};
  body = '';

  setHeader(key: string, value: number | string | readonly string[]): void {
    this.headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  writeHead(status: number, headers: Record<string, string>): void {
    this.status = status;
    for (const [key, value] of Object.entries(headers)) {
      this.setHeader(key, value);
    }
  }

  end(body: string): void {
    this.body = body;
  }

  json(): any {
    return JSON.parse(this.body);
  }
}

async function callPlanningHandler(body: unknown): Promise<ResponseStub> {
  const req: ParsedRequest = {
    method: 'POST',
    path: '/api/reasoning/planning',
    params: {},
    query: {},
    body,
    headers: {},
    userId: 'anon',
  };
  const res = new ResponseStub();

  try {
    await handleReasoningPlanning(req, res as any);
  } catch (error) {
    handleError(res as any, error);
  }

  return res;
}

function validPlanningRequest() {
  return {
    type: 'refactor-planning',
    scope: 'backend/src/lib/dominance',
    referenceId: 'PLAN-2026-REF-001',
    version: '2.0',
    context: {
      current_state: 'Dominance Layer uses mixed autonomy tiers',
      constraints: ['canonical-only', 'additive-contracts'],
      success_criteria: ['deterministic output', 'backward compatible'],
      risk_gates: ['core_engine'],
    },
    outputSchemaJson: JSON.stringify({
      type: 'object',
      required: ['plan_steps', 'next_action', 'confidence'],
    }),
  };
}

function validPlanningOutput() {
  return {
    plan_steps: [
      {
        id: 'step-1',
        action: 'Add a canonical planning prompt builder',
        owner_tier: 2,
        estimated_effort: 's',
        validation_gate: 'pnpm -C backend run test -- tests/unit/reasoning-planning.spec.ts',
        canonical_check: true,
      },
    ],
    risks: [
      {
        id: 'risk-1',
        description: 'Contract changes require review',
        severity: 'p1_review',
        mitigation: 'Keep the change additive-only',
      },
    ],
    gates: ['core_engine'],
    next_action: 'Open human review for the contract change',
    requires_human_review: true,
    confidence: 0.82,
  };
}

describe('POST /api/reasoning/planning', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test';
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.test';
    process.env.DEEPSEEK_MODEL_REASONING = 'deepseek-reasoner';
    resetEnvCache();
    routeLLMRequestMock.mockReset();
  });

  it('is registered in the backend app router', () => {
    const app = createApp();
    const routes = (app as any).routes as Array<{ method: string; pattern: RegExp }>;

    expect(routes.some((route) => route.method === 'POST' && route.pattern.test('/api/reasoning/planning'))).toBe(true);
  });

  it('returns a canonical envelope for valid planning requests', async () => {
    routeLLMRequestMock.mockResolvedValueOnce({
      model: 'deepseek-reasoner',
      rawText: JSON.stringify(validPlanningOutput()),
      parsed: validPlanningOutput(),
    });

    const res = await callPlanningHandler(validPlanningRequest());
    const body = res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body.data).toHaveProperty('status', 'ok');
    expect(body.data.data).toHaveProperty('next_action', 'Open human review for the contract change');
    expect(body.data.data.plan_steps[0]).toHaveProperty('canonical_check', true);
    expect(routeLLMRequestMock).toHaveBeenCalledWith(
      'reasoning',
      expect.objectContaining({
        jsonOnly: true,
        prompt: expect.stringContaining('TASK: PLAN_REFACTOR_PLANNING'),
      }),
      { userId: 'anon' }
    );
  });

  it('rejects invalid request bodies with a canonical validation error', async () => {
    const invalid = validPlanningRequest();
    delete (invalid as any).scope;

    const res = await callPlanningHandler(invalid);
    const body = res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(routeLLMRequestMock).not.toHaveBeenCalled();
  });

  it('returns a validation failure when the model output misses required fields', async () => {
    routeLLMRequestMock.mockResolvedValueOnce({
      model: 'deepseek-reasoner',
      rawText: '{"next_action":"missing plan steps"}',
      parsed: { next_action: 'missing plan steps' },
    });

    const res = await callPlanningHandler(validPlanningRequest());
    const body = res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body.data).toHaveProperty('status', 'error');
    expect(body.data.error).toHaveProperty('code', 'VALIDATION_FAILED');
    expect(body.data.confidence).toBe(0);
  });
});

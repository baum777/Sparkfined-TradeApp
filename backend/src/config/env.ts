import { z } from 'zod';
import { logger } from '../observability/logger.js';
import dotenv from 'dotenv';

// Load environment variables
export function loadEnv() {
  const result = dotenv.config();
  if (result.error) {
    logger.warn('Failed to load .env file', { error: String(result.error) });
  }
}

// Environment Schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  SERVICE_MODE: z.enum(['full', 'terminal', 'journal']).default('full'),
  DATABASE_PATH: z.string().default('./.data/tradeapp.sqlite'),
  API_BASE_PATH: z.string().default('/api'),

  // Legacy/compat fields used by some modules
  BACKEND_PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().default('sqlite:./.data/tradeapp.sqlite'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  JWT_SECRET: z.string().default('dev-secret'),
  
  // Auth
  API_KEY: z.string().optional(),
  
  // Push
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  
  // AI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_MODEL_JOURNAL: z.string().optional(),
  OPENAI_MODEL_INSIGHTS: z.string().optional(),
  OPENAI_MODEL_CHARTS: z.string().optional(),
  
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL_REASONING: z.string().default('deepseek-reasoner'),
  // Reasoning Router (DeepSeek R1 "thinking mode") + execution defaults
  DEEPSEEK_MODEL_ROUTER: z.string().default('deepseek-reasoner'),
  DEEPSEEK_MODEL_ANSWER: z.string().default('deepseek-chat'),
  OPUS_MODEL: z.string().optional(),

  // Grok Pulse
  GROK_API_KEY: z.string().optional(),
  GROK_BASE_URL: z.string().default('https://api.x.ai/v1'),
  MORALIS_API_KEY: z.string().optional(),
  // Dexpaprika (market data)
  DEXPAPRIKA_API_KEY: z.string().optional(),
  GROK_PULSE_CRON_SECRET: z.string().optional(),
  MAX_DAILY_GROK_CALLS: z.string().transform(Number).default('900'),
  PULSE_TOKEN_ADDRESSES: z.string().default(''), // comma-separated
  // Optional, best-effort ticker resolution map: "SOL=So111...,USDC=EPjF..."
  PULSE_TICKER_MAP: z.string().optional(),
  
  // Vercel KV (legacy) + Redis (Railway)
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // LLM Router / timeouts / retries
  LLM_ROUTER_ENABLED: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
  LLM_ROUTER_DEBUG: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  LLM_TIMEOUT_MS: z.string().transform(Number).default('20000'),
  LLM_MAX_RETRIES: z.string().transform(Number).default('2'),
  LLM_BUDGET_DEFAULT: z.enum(['low', 'medium', 'high']).default('low'),
  LLM_TIER_DEFAULT: z.enum(['free', 'standard', 'pro', 'high']).default('free'),
  // Deterministic fallback when router fails or primary provider fails (optional override).
  // Note: values align with RouterDecisionProvider.
  LLM_FALLBACK_PROVIDER: z.enum(['deepseek', 'openai', 'grok']).optional(),

  // Terminal / Swap (Jupiter)
  JUPITER_BASE_URL: z.string().default('https://quote-api.jup.ag/v6'),
  JUPITER_PLATFORM_FEE_ACCOUNT: z.string().optional(),
  TERMINAL_SWAP_REQUIRE_AUTH: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),

  // Solana Onchain (Helius) - optional for CI/build; required at runtime for terminal mode
  HELIUS_API_KEY: z.string().optional(),
  HELIUS_RPC_URL: z.string().optional(),
  HELIUS_DAS_RPC_URL: z.string().optional(),
  HELIUS_TIMEOUT_MS: z.string().transform(Number).optional(),
  // Enhanced transactions caps (determinism + cost control)
  HELIUS_ENHANCED_MAX_PAGES: z.string().transform(Number).optional(),
  HELIUS_ENHANCED_LIMIT: z.string().transform(Number).optional(),

  // Onchain gating tuning
  ONCHAIN_TUNING_PROFILE: z.enum(['default', 'conservative', 'aggressive']).default('default'),

  // Monitoring
  WATCHER_INTERVAL_MS: z.string().transform(Number).default('5000'),
  EVALUATION_BATCH_SIZE: z.string().transform(Number).default('200'),
  EVENT_RETENTION_DAYS: z.string().transform(Number).default('30'),
  SSE_HEARTBEAT_MS: z.string().transform(Number).default('20000'),
});

export type Env = z.infer<typeof envSchema>;
export type BackendEnv = Env;

let envCache: Env | null = null;

/**
 * Get environment config. Lazy-parsed, cached.
 * - strict=false (default): Never throws. On parse failure, returns defaults. Safe for CI/lint/typecheck.
 * - strict=true: Throws with clear message if validation fails. Use at server startup only.
 */
export function getEnv(opts?: { strict?: boolean }): Env {
  const strict = opts?.strict === true;

  if (envCache) {
    if (strict) {
      validateRequiredForRuntime(envCache);
    }
    return envCache;
  }

  const parsed = envSchema.safeParse(process.env);

  if (parsed.success) {
    envCache = parsed.data;
    if (strict) {
      validateRequiredForRuntime(envCache);
    }
    return envCache;
  }

  // Parse failed
  if (strict) {
    logger.error('Invalid environment variables', { errors: parsed.error.format() });
    throw new Error(
      `Invalid environment variables: ${parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ')}`
    );
  }

  // Non-strict: return defaults so CI/lint/typecheck can run without secrets
  logger.warn('Env parse failed, using defaults (strict=false)', {
    issues: parsed.error.issues.map((i) => i.path.join('.')),
  });
  envCache = envSchema.parse({}) as Env;
  return envCache;
}

/**
 * Validate that runtime-required vars are set. Called only when strict=true.
 * Skipped in test env so CI can run without production secrets.
 */
function validateRequiredForRuntime(env: Env): void {
  if (env.NODE_ENV === 'test') return;

  const mode = env.SERVICE_MODE;
  if (mode === 'terminal' || mode === 'full') {
    if (!env.HELIUS_API_KEY?.trim()) {
      throw new Error('HELIUS_API_KEY is required when SERVICE_MODE is terminal or full');
    }
  }
}

export function resetEnvCache(): void {
  envCache = null;
}

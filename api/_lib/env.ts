/**
 * Environment Configuration for Vercel Serverless
 * Validates and provides typed access to environment variables
 */

import { z } from 'zod';

// Define the schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Auth (JWT)
  AUTH_JWT_SECRET: z.string().min(32, 'JWT Secret must be at least 32 chars'),
  AUTH_JWT_ISSUER: z.string().default('tradeapp-api'),
  AUTH_JWT_AUDIENCE: z.string().default('tradeapp-ui'),
  AUTH_JWT_CLOCK_TOLERANCE_SECONDS: z.coerce.number().default(30),

  // Vercel KV
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  KV_REST_API_READ_ONLY_TOKEN: z.string().optional(),
  
  // Security / Internal
  CRON_SECRET: z.string().optional(),
  
  // External providers (optional)
  DEXPAPRIKA_API_KEY: z.string().optional(),
  DEXPAPRIKA_BASE_URL: z.string().default('https://api.dexpaprika.com'),
  
  MORALIS_API_KEY: z.string().optional(),
  MORALIS_BASE_URL: z.string().default('https://solana-gateway.moralis.io'),

  // Onchain Snapshot Config
  ONCHAIN_CONTEXT_PROVIDER_TIMEOUT_MS: z.coerce.number().default(1200),
  ONCHAIN_CONTEXT_TOTAL_BUDGET_MS: z.coerce.number().default(2000),
  
  // AI (optional)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL_JOURNAL: z.string().optional(),
  OPENAI_MODEL_INSIGHTS: z.string().optional(),
  OPENAI_MODEL_CHARTS: z.string().optional(),
  
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().optional(),
  DEEPSEEK_MODEL_REASONING: z.string().optional(),

  // Grok Pulse
  GROK_API_KEY: z.string().optional(),
  GROK_BASE_URL: z.string().optional(),
  GROK_MODEL_PULSE: z.string().optional(),
  GROK_PULSE_REFRESH_SECRET: z.string().optional(),

  OPUS_MODEL: z.string().optional(),
  REASONING_BACKEND_URL: z.string().optional(),

  // Phase B: Auto Trade Capture
  AUTO_CAPTURE_ENABLED: z.string().transform(v => v === 'true').default('false'),
  // Phase C: Intelligence
  AUTO_CAPTURE_INTELLIGENCE_ENABLED: z.string().transform(v => v === 'true').default('false'),
  SYMBOL_RESOLUTION_ENABLED: z.string().transform(v => v === 'true').default('false'),

  HELIUS_WEBHOOK_SECRET: z.string().optional(),
  HELIUS_API_KEY: z.string().optional(),
  HELIUS_WEBHOOK_ID: z.string().optional(),
  HELIUS_SOURCE_LABEL: z.string().default('helius'),
});

export type BackendEnv = z.infer<typeof envSchema>;

let cachedEnv: BackendEnv | null = null;

export function getEnv(): BackendEnv {
  if (cachedEnv) return cachedEnv;

  const rawEnv = process.env;
  
  // In dev/test, provide defaults for JWT if missing to simplify local setup
  // but do NOT provide defaults for production secrets
  const isProd = rawEnv.NODE_ENV === 'production';
  
  // Safe defaults for dev/test only
  const defaults = !isProd ? {
    AUTH_JWT_SECRET: rawEnv.AUTH_JWT_SECRET || 'dev-secret-must-be-at-least-32-bytes-long',
    AUTH_JWT_ISSUER: rawEnv.AUTH_JWT_ISSUER || 'tradeapp-api',
    AUTH_JWT_AUDIENCE: rawEnv.AUTH_JWT_AUDIENCE || 'tradeapp-ui',
  } : {};

  const result = envSchema.safeParse({
    ...rawEnv,
    ...defaults
  });

  if (!result.success) {
    // In production, failure to parse required envs is fatal
    if (isProd) {
      console.error('❌ Invalid environment variables:', JSON.stringify(result.error.format(), null, 2));
      throw new Error('Invalid environment variables');
    } else {
      console.warn('⚠️ Invalid environment variables (non-fatal in dev):', JSON.stringify(result.error.format(), null, 2));
      // In dev, we might return a partial object cast to BackendEnv or throw.
      // For safety, let's throw if JWT is invalid even in dev, but generally we populated a valid default above.
      throw new Error('Invalid environment variables: ' + result.error.issues.map(i => i.message).join(', '));
    }
  }

  // Additional Prod Guards
  if (isProd && !result.data.CRON_SECRET) {
     throw new Error('CRON_SECRET is required in production');
  }

  // Phase B Guard: Auto Capture requires Helius config
  if (result.data.AUTO_CAPTURE_ENABLED) {
    if (!result.data.HELIUS_WEBHOOK_SECRET || !result.data.HELIUS_API_KEY || !result.data.HELIUS_WEBHOOK_ID) {
       // In Prod this should be fatal, in Dev we warn
       const msg = 'AUTO_CAPTURE_ENABLED is true but Helius config is missing (WEBHOOK_SECRET, API_KEY, WEBHOOK_ID)';
       if (isProd) {
          throw new Error(msg);
       } else {
          console.warn(`⚠️ ${msg}`);
       }
    }
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function resetEnvCache() {
  cachedEnv = null;
}

// Helpers
export function isDev() {
  return getEnv().NODE_ENV === 'development';
}

export function isTest() {
  return getEnv().NODE_ENV === 'test';
}

export function hasVercelKV() {
  const env = getEnv();
  return !!(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
}


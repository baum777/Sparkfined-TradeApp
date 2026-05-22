import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default(''),
  API_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default(''),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  WATCHER_INTERVAL_MS: z.coerce.number().default(5000),
  EVALUATION_BATCH_SIZE: z.coerce.number().default(200),
  EVENT_RETENTION_DAYS: z.coerce.number().default(30),
  SSE_HEARTBEAT_MS: z.coerce.number().default(20000),
  ERROR_DEDUPE_MINUTES: z.coerce.number().default(10),
});

export const env = envSchema.parse(process.env);

const requiredServiceEnvKeys = [
  'DATABASE_URL',
  'API_KEY',
  'VAPID_SUBJECT',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY'
] as const;

export const getMissingServiceEnvKeys = () =>
  requiredServiceEnvKeys.filter((key) => env[key].trim().length === 0);

export const assertRequiredServiceEnv = () => {
  const missing = getMissingServiceEnvKeys();

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

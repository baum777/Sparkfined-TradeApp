import { getEnv, type BackendEnv } from './env.js';

/**
 * Application Configuration
 * Derives configuration values from environment
 */

export interface AppConfig {
  env: BackendEnv;
  isDev: boolean;
  isTest: boolean;
  isProd: boolean;
  server: {
    port: number;
    apiBasePath: string;
  };
  database: {
    url: string;
    path: string;
  };
  logging: {
    level: BackendEnv['LOG_LEVEL'];
  };
  version: string;
}

export function createConfig(): AppConfig {
  const env = getEnv();

  // Extract SQLite file path from DATABASE_URL (format: sqlite:./path/to/file.sqlite)
  const dbPath = env.DATABASE_URL.replace(/^sqlite:/, '');

  return {
    env,
    isDev: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
    isProd: env.NODE_ENV === 'production',
    server: {
      port: env.PORT ?? env.BACKEND_PORT,
      apiBasePath: env.API_BASE_PATH,
    },
    database: {
      url: env.DATABASE_URL,
      path: dbPath,
    },
    logging: {
      level: env.LOG_LEVEL,
    },
    version: process.env.npm_package_version || '1.0.0',
  };
}

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = createConfig();
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

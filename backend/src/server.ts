import { createServer, type Server as HTTPServer } from 'http';
import { join } from 'path';
import { loadEnv, getEnv } from './config/env.js';
import { getConfig } from './config/config.js';
import { initDatabase, closeDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { kvCleanupExpired } from './db/kv.js';
import { alertEventsCleanup } from './domain/alerts/eventsRepo.js';
import { oracleClearOldDaily } from './domain/oracle/repo.js';
import { taCacheCleanup } from './domain/ta/cacheRepo.js';
import { createApp } from './app.js';
import { logger } from './observability/logger.js';
import { startScheduledJobs } from './jobs/scheduler.js';

/**
 * Backend Server Entry Point
 */

// Load environment first
loadEnv();

// Strict validation at server startup only (throws if required vars missing)
getEnv({ strict: true });

const config = getConfig();

// Initialize database
await initDatabase(config.database.url);

// Run migrations
const migrationsDir = join(process.cwd(), 'migrations');
await runMigrations(migrationsDir);

// Create router
const app = createApp();

// Start scheduled jobs (cron replacements)
const scheduledJobs = startScheduledJobs();

// Create HTTP server
const server: HTTPServer = createServer((req, res) => {
  // CORS headers for development
  if (config.isDev) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id, Idempotency-Key');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
  }
  
  app.handle(req, res);
});

// Cleanup jobs
async function runCleanupJobs(): Promise<void> {
  logger.debug('Running cleanup jobs');
  
  try {
    const kvCleaned = await kvCleanupExpired();
    const eventsCleaned = await alertEventsCleanup();
    const oracleCleaned = await oracleClearOldDaily();
    const taCleaned = await taCacheCleanup();
    
    logger.info('Cleanup complete', {
      kv: kvCleaned,
      events: eventsCleaned,
      oracle: oracleCleaned,
      ta: taCleaned,
    });
  } catch (error) {
    logger.error('Cleanup job failed', { error: String(error) });
  }
}

// Run cleanup on start and every 10 minutes
runCleanupJobs();
const cleanupInterval = setInterval(runCleanupJobs, 10 * 60 * 1000);

// Graceful shutdown
function shutdown(): void {
  logger.info('Shutting down server...');
  
  clearInterval(cleanupInterval);
  scheduledJobs.stop();
  
  server.close(() => {
    closeDatabase()
      .then(() => {
        logger.info('Server shut down complete');
        process.exit(0);
      })
      .catch(error => {
        logger.error('Shutdown failed while closing database', { error: String(error) });
        process.exit(1);
      });
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
// Railway requires binding to 0.0.0.0 (all interfaces)
const host = '0.0.0.0';
const port = config.server.port;

server.listen(port, host, () => {
  logger.info(`Server started`, {
    host,
    port,
    env: config.env.NODE_ENV,
    mode: config.env.SERVICE_MODE,
    apiBasePath: config.server.apiBasePath,
  });
});

export { server };

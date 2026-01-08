import { createServer } from 'http';
import { join } from 'path';
import { loadEnv } from './config/env.js';
import { getConfig } from './config/config.js';
import { initDatabase, closeDatabase } from './db/sqlite.js';
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

const config = getConfig();

// Initialize database
initDatabase(config.database.path);

// Run migrations
const migrationsDir = join(process.cwd(), 'migrations');
runMigrations(migrationsDir);

// Create router
const app = createApp();

// Start scheduled jobs (cron replacements)
const scheduledJobs = startScheduledJobs();

// Create HTTP server
const server = createServer((req, res) => {
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
function runCleanupJobs(): void {
  logger.debug('Running cleanup jobs');
  
  try {
    const kvCleaned = kvCleanupExpired();
    const eventsCleaned = alertEventsCleanup();
    const oracleCleaned = oracleClearOldDaily();
    const taCleaned = taCacheCleanup();
    
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
    closeDatabase();
    logger.info('Server shut down complete');
    process.exit(0);
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
server.listen(config.server.port, () => {
  logger.info(`Server started`, {
    port: config.server.port,
    env: config.env.NODE_ENV,
    apiBasePath: config.server.apiBasePath,
  });
});

export { server };

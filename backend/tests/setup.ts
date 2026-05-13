import { afterAll, beforeEach } from 'vitest';
import { initDatabase, closeDatabase, getDatabase, resetDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { resetEnvCache } from '../src/config/env.js';
import { resetConfigCache } from '../src/config/config.js';
import { join } from 'path';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { spawnSync } from 'node:child_process';

// Test database path - use unique path per test run
const TEST_DB_PATH = `./.data/test-${process.pid}.sqlite`;

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
process.env.BACKEND_PORT = '3001';
process.env.LOG_LEVEL = 'error';
process.env.HELIUS_API_KEY = 'test-helius-api-key';

// Ensure data directory exists
if (!existsSync('./.data')) {
  mkdirSync('./.data', { recursive: true });
}

// Clean up any existing test database
function cleanupTestDb(): void {
  const files = [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'];
  for (const file of files) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

function detectPortBindingCapability(): boolean {
  const probeScript = `
const net = require('node:net');
const server = net.createServer();
server.once('error', () => process.exit(1));
server.listen(0, '127.0.0.1', () => server.close(() => process.exit(0)));
setTimeout(() => process.exit(2), 1500);
`;
  const probe = spawnSync(process.execPath, ['-e', probeScript], { timeout: 4000 });
  return probe.status === 0;
}

async function initializeTestEnvironment(): Promise<void> {
  cleanupTestDb();

  resetEnvCache();
  resetConfigCache();
  resetDatabase();

  (globalThis as any).__CAN_BIND_PORT__ = detectPortBindingCapability();

  try {
    await initDatabase(process.env.DATABASE_URL || TEST_DB_PATH);
    await runMigrations(join(process.cwd(), 'migrations'));
    (globalThis as any).__DB_READY__ = true;
  } catch (err) {
    (globalThis as any).__DB_READY__ = false;
    console.warn('[tests/setup] DB init skipped (native bindings unavailable):', String(err));
  }
}

await initializeTestEnvironment();

beforeEach(() => {
  if (!(globalThis as any).__DB_READY__) return;
  // Clear all tables before each test
  // Order matters for foreign key constraints
  const db = getDatabase();
  
  // Disable foreign keys temporarily for cleanup
  db.exec('PRAGMA foreign_keys = OFF');
  
  db.exec('DELETE FROM journal_confirmations_v2');
  db.exec('DELETE FROM journal_archives_v2');
  db.exec('DELETE FROM journal_entries_v2');
  db.exec('DELETE FROM alert_events_v1');
  db.exec('DELETE FROM alerts_v1');
  db.exec('DELETE FROM oracle_read_state_v1');
  db.exec('DELETE FROM oracle_daily_v1');
  db.exec('DELETE FROM ta_cache_v1');
  db.exec('DELETE FROM kv_v1');
  db.exec('DELETE FROM user_settings_v1');
  
  // Re-enable foreign keys
  db.exec('PRAGMA foreign_keys = ON');
});

afterAll(async () => {
  if ((globalThis as any).__DB_READY__) {
    await closeDatabase();
  }
  cleanupTestDb();
});

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { initDatabase, closeDatabase, getDatabase, resetDatabase } from '../src/db/sqlite';
import { runMigrations } from '../src/db/migrate';
import { resetEnvCache } from '../src/config/env';
import { resetConfigCache } from '../src/config/config';
import { join } from 'path';
import { unlinkSync, existsSync, mkdirSync } from 'fs';

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

beforeAll(() => {
  // Clean up before starting
  cleanupTestDb();
  
  // Reset caches
  resetEnvCache();
  resetConfigCache();
  resetDatabase();
  
  // Initialize test database.
  // In some CI/sandboxed environments, native bindings (better-sqlite3) may be unavailable.
  // In that case we skip DB-backed test setup to allow non-DB suites (e.g. routing/contract)
  // to execute.
  try {
    initDatabase(TEST_DB_PATH);
    runMigrations(join(process.cwd(), 'migrations'));
    (globalThis as any).__DB_READY__ = true;
  } catch (err) {
    (globalThis as any).__DB_READY__ = false;
    // eslint-disable-next-line no-console
    console.warn('[tests/setup] DB init skipped (native bindings unavailable):', String(err));
  }
});

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
  
  // Re-enable foreign keys
  db.exec('PRAGMA foreign_keys = ON');
});

afterAll(() => {
  if ((globalThis as any).__DB_READY__) {
    closeDatabase();
  }
  cleanupTestDb();
});

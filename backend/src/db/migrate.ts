import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { getDatabase, initDatabase } from './index.js';
import { logger } from '../observability/logger.js';

/**
 * Database Migration Runner
 * Applies SQL migrations in order, tracking applied versions
 */

const MIGRATIONS_TABLE = 'schema_migrations';

interface MigrationRow {
  version: string;
  applied_at: string;
}

async function ensureMigrationsTable(): Promise<void> {
  const db = getDatabase();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const db = getDatabase();

  const rows = await db
    .prepare(`SELECT version FROM ${MIGRATIONS_TABLE}`)
    .all<MigrationRow>();

  return new Set(rows.map(r => r.version));
}

async function applyMigration(version: string, sql: string): Promise<void> {
  const db = getDatabase();

  // Check if already applied (double-check for safety)
  const existing = await db
    .prepare(`SELECT 1 FROM ${MIGRATIONS_TABLE} WHERE version = ?`)
    .get(version);
  if (existing) {
    logger.debug('Migration already applied, skipping', { version });
    return;
  }

  await db.transaction(async () => {
    // Execute the migration SQL
    await db.exec(sql);

    // Record the migration
    await db
      .prepare(`
        INSERT INTO ${MIGRATIONS_TABLE} (version, applied_at)
        VALUES (?, ?)
      `)
      .run(version, new Date().toISOString());
  });

  logger.info('Applied migration', { version });
}

export async function runMigrations(migrationsDir: string): Promise<void> {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();

  // Get all migration files
  let files: string[];
  try {
    files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch (error) {
    logger.warn('No migrations directory found, skipping migrations', { dir: migrationsDir });
    return;
  }

  for (const file of files) {
    const version = file.replace('.sql', '');

    if (applied.has(version)) {
      logger.debug('Migration already applied', { version });
      continue;
    }

    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    await applyMigration(version, sql);
  }

  logger.info('Migrations complete', { total: files.length, applied: files.length - applied.size });
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const { loadEnv, getEnv } = await import('../config/env.js');

  loadEnv();
  const env = getEnv();

  await initDatabase(env.DATABASE_URL);
  await runMigrations(join(process.cwd(), 'migrations'));

  console.log('Migrations complete');
  process.exit(0);
}

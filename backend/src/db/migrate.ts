import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { getDatabase } from './sqlite.js';
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

function ensureMigrationsTable(): void {
  const db = getDatabase();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

function getAppliedMigrations(): Set<string> {
  const db = getDatabase();
  
  const rows = db.prepare(`SELECT version FROM ${MIGRATIONS_TABLE}`).all() as MigrationRow[];
  
  return new Set(rows.map(r => r.version));
}

function applyMigration(version: string, sql: string): void {
  const db = getDatabase();
  
  // Check if already applied (double-check for safety)
  const existing = db.prepare(`SELECT 1 FROM ${MIGRATIONS_TABLE} WHERE version = ?`).get(version);
  if (existing) {
    logger.debug('Migration already applied, skipping', { version });
    return;
  }
  
  db.transaction(() => {
    // Execute the migration SQL
    db.exec(sql);
    
    // Record the migration
    db.prepare(`
      INSERT INTO ${MIGRATIONS_TABLE} (version, applied_at)
      VALUES (?, ?)
    `).run(version, new Date().toISOString());
  })();
  
  logger.info('Applied migration', { version });
}

export function runMigrations(migrationsDir: string): void {
  ensureMigrationsTable();
  
  const applied = getAppliedMigrations();
  
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
    
    applyMigration(version, sql);
  }
  
  logger.info('Migrations complete', { total: files.length, applied: files.length - applied.size });
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const { initDatabase } = await import('./sqlite.js');
  const { loadEnv, getEnv } = await import('../config/env.js');
  
  loadEnv();
  const env = getEnv();
  const dbPath = env.DATABASE_URL.replace(/^sqlite:/, '');
  
  initDatabase(dbPath);
  runMigrations(join(process.cwd(), 'migrations'));
  
  console.log('Migrations complete');
  process.exit(0);
}

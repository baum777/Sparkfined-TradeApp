import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from '../observability/logger.js';
import type { DatabaseClient, PreparedStatement, StatementResult } from './types.js';

/**
 * SQLite Database Connection
 * Adapter to the async DatabaseClient interface.
 */

export function createSqliteClient(dbPath: string): DatabaseClient {
  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info('Created database directory', { dir });
  }

  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  logger.info('SQLite database initialized', { path: dbPath });

  return {
    prepare(sql: string): PreparedStatement {
      const stmt = db.prepare(sql);
      return {
        run: async (...params: unknown[]): Promise<StatementResult> => {
          const result = stmt.run(...params);
          return { changes: result.changes };
        },
        get: async <T = unknown>(...params: unknown[]): Promise<T | undefined> => {
          return stmt.get(...params) as T | undefined;
        },
        all: async <T = unknown>(...params: unknown[]): Promise<T[]> => {
          return stmt.all(...params) as T[];
        },
      };
    },
    exec: async (sql: string): Promise<void> => {
      db.exec(sql);
    },
    transaction: async <T>(fn: () => Promise<T> | T): Promise<T> => {
      db.exec('BEGIN');
      try {
        const result = await fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: async (): Promise<void> => {
      db.close();
      logger.info('SQLite database closed');
    },
  };
}

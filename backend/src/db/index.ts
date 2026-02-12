import { createSqliteClient } from './sqlite.js';
import { createPostgresClient } from './postgres.js';
import type { DatabaseClient } from './types.js';

export * from './migrate.js';
export * from './kv.js';
export * from './types.js';

let db: DatabaseClient | null = null;

function isPostgresUrl(databaseUrl: string): boolean {
  return databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://');
}

export async function initDatabase(databaseUrl: string): Promise<DatabaseClient> {
  if (db) {
    return db;
  }

  if (isPostgresUrl(databaseUrl)) {
    db = await createPostgresClient(databaseUrl);
  } else {
    const dbPath = databaseUrl.replace(/^sqlite:/, '');
    db = createSqliteClient(dbPath);
  }

  return db;
}

export function getDatabase(): DatabaseClient {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

// For testing
export function resetDatabase(): void {
  db = null;
}

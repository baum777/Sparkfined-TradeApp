import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { logger } from '../observability/logger.js';
import type { DatabaseClient, PreparedStatement, StatementResult } from './types.js';

const conflictTargets: Record<string, string[]> = {
  kv_v1: ['key'],
  ta_cache_v1: ['key'],
  user_settings_v1: ['user_id'],
  oracle_daily_v1: ['date'],
  oracle_read_state_v1: ['user_id', 'id'],
  journal_confirmations_v2: ['user_id', 'entry_id'],
  journal_archives_v2: ['user_id', 'entry_id'],
  journal_market_snapshots_v1: ['user_id', 'entry_id'],
  journal_delta_snapshots_v1: ['user_id', 'entry_id', 'window'],
  journal_order_pressure_v1: ['user_id', 'entry_id'],
};

const transactionStore = new AsyncLocalStorage<PoolClient>();

function rewriteInsertOrReplace(sql: string): string {
  const match = sql.match(
    /INSERT OR REPLACE INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/is
  );

  if (!match) return sql;

  const table = match[1];
  const columns = match[2].split(',').map(col => col.trim()).filter(Boolean);
  const values = match[3];
  const conflict = conflictTargets[table];

  if (!conflict || columns.length === 0) {
    return sql.replace(/INSERT OR REPLACE INTO/i, 'INSERT INTO');
  }

  const updateSet = columns.map(col => `${col} = EXCLUDED.${col}`).join(', ');

  const replacement = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values}) ON CONFLICT (${conflict.join(
    ', '
  )}) DO UPDATE SET ${updateSet}`;

  return sql.replace(match[0], replacement);
}

function buildParams(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
  return { text, values: params };
}

function buildNamedParams(
  sql: string,
  params: Record<string, unknown>
): { text: string; values: unknown[] } {
  const names: string[] = [];
  const text = sql.replace(/@([a-zA-Z0-9_]+)/g, (_, name: string) => {
    names.push(name);
    return `$${names.length}`;
  });
  const values = names.map(name => params[name]);
  return { text, values };
}

function normalizeQuery(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  const rewritten = rewriteInsertOrReplace(sql);

  if (params.length === 0) {
    return { text: rewritten, values: [] };
  }

  if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0])) {
    return buildNamedParams(rewritten, params[0] as Record<string, unknown>);
  }

  return buildParams(rewritten, params);
}

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
}

export async function createPostgresClient(databaseUrl: string): Promise<DatabaseClient> {
  const pool = new Pool({ connectionString: databaseUrl });

  async function runQuery<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[]
  ): Promise<QueryResult<T>> {
    const txClient = transactionStore.getStore();
    if (txClient) {
      return txClient.query<T>(text, values as any[]);
    }
    return pool.query<T>(text, values as any[]);
  }

  const client: DatabaseClient = {
    prepare(sql: string): PreparedStatement {
      return {
        run: async (...params: unknown[]): Promise<StatementResult> => {
          const { text, values } = normalizeQuery(sql, params);
          const result = await runQuery(text, values);
          return { changes: result.rowCount ?? 0 };
        },
        get: async <T = unknown>(...params: unknown[]): Promise<T | undefined> => {
          const { text, values } = normalizeQuery(sql, params);
          const result = await runQuery<T>(text, values);
          return result.rows[0];
        },
        all: async <T = unknown>(...params: unknown[]): Promise<T[]> => {
          const { text, values } = normalizeQuery(sql, params);
          const result = await runQuery<T>(text, values);
          return result.rows;
        },
      };
    },
    exec: async (sql: string): Promise<void> => {
      const statements = splitStatements(sql);
      for (const statement of statements) {
        await runQuery(statement, []);
      }
    },
    transaction: async <T>(fn: () => Promise<T> | T): Promise<T> => {
      const txClient = await pool.connect();
      try {
        await txClient.query('BEGIN');
        const result = await transactionStore.run(txClient, fn);
        await txClient.query('COMMIT');
        return result;
      } catch (error) {
        await txClient.query('ROLLBACK');
        throw error;
      } finally {
        txClient.release();
      }
    },
    close: async (): Promise<void> => {
      await pool.end();
      logger.info('Postgres pool closed');
    },
  };

  await pool.query('SELECT 1');
  logger.info('Postgres connection established');

  return client;
}


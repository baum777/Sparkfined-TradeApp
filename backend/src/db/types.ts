export interface StatementResult {
  changes: number;
}

export type StatementParams = unknown[] | Record<string, unknown> | undefined;

export interface PreparedStatement {
  run: (...params: unknown[]) => Promise<StatementResult>;
  get: <T = unknown>(...params: unknown[]) => Promise<T | undefined>;
  all: <T = unknown>(...params: unknown[]) => Promise<T[]>;
}

export interface DatabaseClient {
  prepare: (sql: string) => PreparedStatement;
  exec: (sql: string) => Promise<void>;
  transaction: <T>(fn: () => Promise<T> | T) => Promise<T>;
  close: () => Promise<void>;
}


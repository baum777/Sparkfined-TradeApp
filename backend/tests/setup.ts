import { afterAll, beforeEach } from 'vitest';
import { initDatabase, closeDatabase, getDatabase, resetDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { resetEnvCache } from '../src/config/env.js';
import { resetConfigCache } from '../src/config/config.js';
import { join } from 'path';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { Server, type IncomingHttpHeaders, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { PassThrough } from 'stream';
import { EventEmitter } from 'events';
import { createRequire, syncBuiltinESMExports } from 'module';
import { spawnSync } from 'node:child_process';

// Test database path - use unique path per test run
const TEST_DB_PATH = `./.data/test-${process.pid}.sqlite`;

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
process.env.BACKEND_PORT = '3001';
process.env.LOG_LEVEL = 'error';
process.env.HELIUS_API_KEY = 'test-helius-api-key';

type HeaderValue = string | number | readonly string[];
type VirtualBinding = {
  port: number;
  host: string;
};

const originalFetch = globalThis.fetch.bind(globalThis);
const originalListen = Server.prototype.listen;
const originalAddress = Server.prototype.address;
const originalClose = Server.prototype.close;
const requireCjs = createRequire(import.meta.url);
const httpCjs = requireCjs('node:http') as typeof import('http');
const originalHttpRequest = httpCjs.request.bind(httpCjs);

const virtualBindings = new WeakMap<Server, VirtualBinding>();
const virtualServersByPort = new Map<number, Server>();
let nextVirtualPort = 46000;

function isLocalVirtualUrl(url: URL): boolean {
  return (url.hostname === '127.0.0.1' || url.hostname === 'localhost') && url.port.length > 0;
}

function toAddressInfo(binding: VirtualBinding): AddressInfo {
  return {
    address: binding.host,
    family: binding.host.includes(':') ? 'IPv6' : 'IPv4',
    port: binding.port,
  };
}

function normalizeRequestHeaders(headers: Headers): IncomingHttpHeaders {
  const out: IncomingHttpHeaders = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function buildFetchResponse(params: {
  statusCode: number;
  headers: Map<string, HeaderValue>;
  body: Buffer;
}): Response {
  const responseHeaders = new Headers();
  for (const [name, value] of params.headers.entries()) {
    if (Array.isArray(value)) {
      for (const item of value) responseHeaders.append(name, String(item));
      continue;
    }
    responseHeaders.set(name, String(value));
  }

  const hasBody = ![204, 205, 304].includes(params.statusCode);
  return new Response(hasBody ? params.body : null, {
    status: params.statusCode,
    headers: responseHeaders,
  });
}

async function dispatchVirtualHttpRequest(server: Server, request: Request): Promise<Response> {
  const bodyBuffer = request.method === 'GET' || request.method === 'HEAD'
    ? null
    : Buffer.from(await request.arrayBuffer());

  const req = new PassThrough() as unknown as {
    method?: string;
    url?: string;
    headers: IncomingHttpHeaders;
    on: (event: string, listener: (...args: any[]) => void) => any;
    emit: (event: string, ...args: any[]) => boolean;
  };
  req.method = request.method;
  const url = new URL(request.url);
  req.url = `${url.pathname}${url.search}`;
  req.headers = normalizeRequestHeaders(request.headers);

  let statusCode = 200;
  const headers = new Map<string, HeaderValue>();
  const chunks: Buffer[] = [];
  let finished = false;

  const responseDone = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Virtual HTTP request timed out: ${request.method} ${request.url}`));
    }, 15_000);

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve();
    };

    const res = {
      statusCode,
      setHeader(name: string, value: HeaderValue) {
        headers.set(name.toLowerCase(), value);
        return this;
      },
      writeHead(code: number, providedHeaders?: Record<string, HeaderValue>) {
        statusCode = code;
        this.statusCode = code;
        if (providedHeaders) {
          for (const [key, value] of Object.entries(providedHeaders)) {
            headers.set(key.toLowerCase(), value);
          }
        }
        return this;
      },
      write(chunk?: string | Buffer) {
        if (chunk !== undefined) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        return true;
      },
      end(chunk?: string | Buffer) {
        if (chunk !== undefined) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        }
        finish();
        return this;
      },
    } as unknown as ServerResponse;

    try {
      server.emit('request', req as any, res);
      queueMicrotask(() => {
        if (bodyBuffer && bodyBuffer.length > 0) {
          req.emit('data', bodyBuffer);
        }
        req.emit('end');
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });

  await responseDone;
  return buildFetchResponse({
    statusCode,
    headers,
    body: Buffer.concat(chunks),
  });
}

function installVirtualHttpTransport(): void {
  Server.prototype.listen = function patchedListen(this: Server, ...args: any[]): Server {
    const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
    const portArg = typeof args[0] === 'number' ? args[0] : 0;
    const hostArg = typeof args[1] === 'string' ? args[1] : '127.0.0.1';
    const port = portArg > 0 ? portArg : nextVirtualPort++;
    const host = hostArg || '127.0.0.1';

    const existing = virtualBindings.get(this);
    if (existing) {
      virtualServersByPort.delete(existing.port);
    }

    const binding: VirtualBinding = { port, host };
    virtualBindings.set(this, binding);
    virtualServersByPort.set(port, this);

    process.nextTick(() => {
      this.emit('listening');
      callback?.();
    });

    return this;
  };

  Server.prototype.address = function patchedAddress(this: Server): AddressInfo | string | null {
    const binding = virtualBindings.get(this);
    if (binding) return toAddressInfo(binding);
    return originalAddress.call(this);
  };

  Server.prototype.close = function patchedClose(this: Server, callback?: (err?: Error) => void): Server {
    const binding = virtualBindings.get(this);
    if (!binding) {
      return originalClose.call(this, callback as any);
    }

    virtualServersByPort.delete(binding.port);
    virtualBindings.delete(this);
    process.nextTick(() => {
      this.emit('close');
      callback?.();
    });
    return this;
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (!isLocalVirtualUrl(url)) {
      return originalFetch(request);
    }

    const port = Number(url.port);
    const server = virtualServersByPort.get(port);
    if (!server) {
      throw new Error(`No virtual server bound on port ${url.port} for ${request.method} ${request.url}`);
    }

    return dispatchVirtualHttpRequest(server, request);
  }) as typeof fetch;

  httpCjs.request = function patchedHttpRequest(options: any, callback?: (res: any) => void): any {
    const requestOptions = (() => {
      if (typeof options === 'string' || options instanceof URL) {
        const u = new URL(String(options));
        return {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port,
          path: `${u.pathname}${u.search}`,
          method: 'GET',
          headers: {} as Record<string, string>,
        };
      }
      return {
        protocol: options?.protocol || 'http:',
        hostname: options?.hostname || options?.host || '127.0.0.1',
        port: options?.port ? String(options.port) : '',
        path: options?.path || '/',
        method: options?.method || 'GET',
        headers: (options?.headers || {}) as Record<string, string>,
      };
    })();

    const url = new URL(
      `${requestOptions.protocol}//${requestOptions.hostname}:${requestOptions.port || 80}${requestOptions.path}`
    );
    if (!isLocalVirtualUrl(url)) {
      return originalHttpRequest(options as any, callback as any);
    }

    const server = virtualServersByPort.get(Number(url.port));
    if (!server) {
      const reqEmitter = new EventEmitter();
      queueMicrotask(() => {
        reqEmitter.emit('error', new Error(`No virtual server bound on port ${url.port}`));
      });
      return reqEmitter;
    }

    const reqEmitter = new EventEmitter() as EventEmitter & {
      write: (chunk: string | Buffer) => boolean;
      end: (chunk?: string | Buffer) => void;
    };
    const bodyChunks: Buffer[] = [];

    reqEmitter.write = (chunk: string | Buffer): boolean => {
      bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    };

    reqEmitter.end = (chunk?: string | Buffer): void => {
      if (chunk !== undefined) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }

      void (async () => {
        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(requestOptions.headers)) {
            headers.set(name, String(value));
          }

          const response = await dispatchVirtualHttpRequest(
            server,
            new Request(url.toString(), {
              method: requestOptions.method,
              headers,
              body: bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : undefined,
            })
          );

          const incoming = new PassThrough() as unknown as {
            statusCode?: number;
            headers?: IncomingHttpHeaders;
            on: (event: string, listener: (...args: any[]) => void) => any;
            emit: (event: string, ...args: any[]) => boolean;
          };
          incoming.statusCode = response.status;

          const responseHeaders: IncomingHttpHeaders = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key.toLowerCase()] = value;
          });
          const setCookie = (response.headers as any).getSetCookie?.();
          if (Array.isArray(setCookie) && setCookie.length > 0) {
            responseHeaders['set-cookie'] = setCookie;
          }
          incoming.headers = responseHeaders;

          callback?.(incoming as any);
          reqEmitter.emit('response', incoming as any);

          const bodyBuffer = Buffer.from(await response.arrayBuffer());
          if (bodyBuffer.length > 0) {
            incoming.emit('data', bodyBuffer);
          }
          incoming.emit('end');
        } catch (error) {
          reqEmitter.emit('error', error);
        }
      })();
    };

    return reqEmitter;
  } as typeof httpCjs.request;

  syncBuiltinESMExports();
}

installVirtualHttpTransport();

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
  db.exec('DELETE FROM auth_users_v1');
  
  // Re-enable foreign keys
  db.exec('PRAGMA foreign_keys = ON');
});

afterAll(async () => {
  if ((globalThis as any).__DB_READY__) {
    await closeDatabase();
  }
  cleanupTestDb();
});

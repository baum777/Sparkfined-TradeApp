import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, IncomingHttpHeaders, ServerResponse } from 'node:http';
import { createApp } from '../../src/app';

type HeaderValue = string | string[];

class MockServerResponse extends EventEmitter {
  statusCode = 200;
  private headers = new Map<string, HeaderValue>();
  private chunks: Buffer[] = [];

  setHeader(name: string, value: number | string | readonly string[]): void {
    if (Array.isArray(value)) {
      this.headers.set(name.toLowerCase(), value.map(String));
      return;
    }
    this.headers.set(name.toLowerCase(), String(value));
  }

  writeHead(statusCode: number, headers?: Record<string, number | string | readonly string[]>): this {
    this.statusCode = statusCode;
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        this.setHeader(name, value);
      }
    }
    return this;
  }

  end(chunk?: Buffer | string): this {
    if (chunk !== undefined) {
      this.write(chunk);
    }
    this.emit('finish');
    return this;
  }

  write(chunk: Buffer | string): boolean {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  }

  toResponse(): Response {
    const headers = new Headers();
    for (const [name, value] of this.headers.entries()) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, item);
        continue;
      }
      headers.set(name, value);
    }

    return new Response(Buffer.concat(this.chunks), {
      status: this.statusCode,
      headers,
    });
  }
}

function normalizeHeaders(input?: HeadersInit): IncomingHttpHeaders {
  const headers = new Headers(input);
  const normalized: IncomingHttpHeaders = {};

  for (const [name, value] of headers.entries()) {
    normalized[name.toLowerCase()] = value;
  }

  return normalized;
}

function normalizeBody(body?: BodyInit | null): Buffer | undefined {
  if (body == null) return undefined;
  if (typeof body === 'string') return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    throw new Error('Blob bodies are not supported by the in-memory test client.');
  }
  throw new Error(`Unsupported request body type: ${Object.prototype.toString.call(body)}`);
}

function normalizePath(input: string): string {
  if (/^https?:\/\//i.test(input)) {
    const url = new URL(input);
    return `${url.pathname}${url.search}`;
  }
  return input.startsWith('/') ? input : `/${input}`;
}

export type AppFetch = (input: string, init?: RequestInit) => Promise<Response>;

export function createAppFetch(): AppFetch {
  return async (input, init) => {
    const app = createApp();
    const req = new PassThrough() as PassThrough & IncomingMessage;
    const res = new MockServerResponse();
    const body = normalizeBody(init?.body);

    req.method = (init?.method?.toUpperCase() ?? 'GET') as IncomingMessage['method'];
    req.url = normalizePath(input);
    req.headers = normalizeHeaders(init?.headers);

    const finished = new Promise<void>((resolve) => {
      res.once('finish', () => resolve());
    });

    const handled = app.handle(req, res as unknown as ServerResponse);

    if (body) {
      req.write(body);
    }
    req.end();

    await Promise.all([handled, finished]);
    return res.toResponse();
  };
}

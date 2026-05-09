import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'http';
import { applyServerSecurity } from '../../src/http/serverSecurity.js';
import type { AppConfig } from '../../src/config/config.js';

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader: (name: string, value: string) => void;
  writeHead: (status: number, headers?: Record<string, string>) => void;
  end: (chunk?: string) => void;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(status, headers) {
      this.statusCode = status;
      if (!headers) return;
      for (const [k, v] of Object.entries(headers)) this.headers[k] = v;
    },
    end(chunk) {
      this.body = chunk || '';
    },
  };
}

function createMockReq(input: {
  method: string;
  origin?: string;
}): IncomingMessage {
  return {
    method: input.method,
    headers: input.origin ? { origin: input.origin } : {},
  } as IncomingMessage;
}

function createConfig(input: {
  isDev: boolean;
  isProd: boolean;
  corsOrigins?: string;
}): AppConfig {
  return {
    isDev: input.isDev,
    isProd: input.isProd,
    isTest: !input.isDev && !input.isProd,
    env: {
      BACKEND_CORS_ORIGINS: input.corsOrigins,
    },
    server: { port: 3000, apiBasePath: '/api' },
    database: { url: 'sqlite:./.data/test.sqlite', path: './.data/test.sqlite' },
    logging: { level: 'info' },
    version: 'test',
  } as unknown as AppConfig;
}

describe('server security headers', () => {
  it('sets baseline security headers on normal responses', () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockResponse();
    const config = createConfig({ isDev: true, isProd: false });

    const finished = applyServerSecurity(req, res as any, config);

    expect(finished).toBe(false);
    expect(res.headers['X-Frame-Options']).toBe('DENY');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['Permissions-Policy']).toContain('camera=()');
    expect(res.headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(res.headers['Strict-Transport-Security']).toBeUndefined();
  });

  it('adds HSTS in production', () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockResponse();
    const config = createConfig({
      isDev: false,
      isProd: true,
      corsOrigins: 'https://app.example',
    });

    applyServerSecurity(req, res as any, config);

    expect(res.headers['Strict-Transport-Security']).toContain('max-age=31536000');
  });

  it('rejects disallowed preflight origin', () => {
    const req = createMockReq({
      method: 'OPTIONS',
      origin: 'https://blocked.example',
    });
    const res = createMockResponse();
    const config = createConfig({
      isDev: false,
      isProd: true,
      corsOrigins: 'https://allowed.example',
    });

    const finished = applyServerSecurity(req, res as any, config);

    expect(finished).toBe(true);
    expect(res.statusCode).toBe(403);
  });
});

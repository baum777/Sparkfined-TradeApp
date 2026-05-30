import { expect, test, type Page } from '@playwright/test';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const authE2eEnabled = process.env.AUTH_E2E === '1';
const backendPort = process.env.AUTH_E2E_BACKEND_PORT ?? '3000';
const frontendPort = process.env.PLAYWRIGHT_PORT ?? '5173';
const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
const testDbPath = join('backend', '.data', `e2e-auth-${process.pid}.sqlite`);

let backend: ChildProcessWithoutNullStreams | undefined;
let frontend: ChildProcessWithoutNullStreams | undefined;

test.skip(!authE2eEnabled, 'Set AUTH_E2E=1 to run the auth-enabled browser flow against local Vite + backend.');
test.describe.configure({ mode: 'serial' });

function removeTestDb(): void {
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${testDbPath}${suffix}`;
    if (existsSync(file)) {
      rmSync(file, { force: true });
    }
  }
}

function collectProcessOutput(child: ChildProcessWithoutNullStreams, label: string): string[] {
  const lines: string[] = [];
  const append = (chunk: Buffer) => {
    const text = chunk.toString();
    lines.push(`[${label}] ${text}`);
    if (lines.length > 80) {
      lines.splice(0, lines.length - 80);
    }
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return lines;
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

async function stopProcess(child: ChildProcessWithoutNullStreams | undefined): Promise<void> {
  if (!child || child.exitCode !== null) return;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5_000);
    child.once('close', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

test.beforeAll(async () => {
  removeTestDb();

  backend = spawn('corepack', ['pnpm', '-C', 'backend', 'exec', 'tsx', 'src/server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      SERVICE_MODE: 'full',
      BACKEND_PORT: backendPort,
      BACKEND_CORS_ORIGINS: frontendBaseUrl,
      DATABASE_URL: `sqlite:./.data/e2e-auth-${process.pid}.sqlite`,
      HELIUS_API_KEY: 'test-helius-api-key',
      JWT_SECRET: 'test-secret-which-is-long-enough-for-auth-e2e',
      LOG_LEVEL: 'error',
      RATE_LIMIT_STORE: 'memory',
    },
  });
  const backendOutput = collectProcessOutput(backend, 'backend');

  frontend = spawn('corepack', ['pnpm', 'exec', 'vite', '--host', '127.0.0.1', '--port', frontendPort, '--strictPort'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_ENABLE_AUTH: 'true',
      VITE_E2E_WALLET_MOCK: process.env.VITE_E2E_WALLET_MOCK ?? '1',
    },
  });
  const frontendOutput = collectProcessOutput(frontend, 'frontend');

  try {
    await Promise.all([
      waitForUrl(`${backendBaseUrl}/api/health/ready`, 120_000),
      waitForUrl(frontendBaseUrl, 120_000),
    ]);
  } catch (error) {
    throw new Error(
      [
        String(error),
        ...backendOutput.slice(-20),
        ...frontendOutput.slice(-20),
      ].join('\n')
    );
  }
});

test.afterAll(async () => {
  await Promise.all([stopProcess(frontend), stopProcess(backend)]);
  removeTestDb();
});

async function expectAccountAccessSignedOut(page: Page): Promise<void> {
  await expect(page.getByTestId('settings-auth-access')).toBeVisible();
  await expect(page.getByText('Auth flag enabled')).toBeVisible();
  await expect(page.getByText('Signed out')).toBeVisible();
}

test('auth-enabled settings flow registers, logs out, logs in, and bootstraps session on reload', async ({ page }) => {
  test.setTimeout(120_000);

  const email = `auth-e2e-${Date.now()}@example.com`;
  const password = 'CorrectHorseBatteryStaple!48';

  await page.goto('/settings?section=auth', { waitUntil: 'domcontentloaded' });
  await expectAccountAccessSignedOut(page);

  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Username').fill('auth-e2e-user');
  await page.getByLabel('Password').fill(password);

  const registerResponse = page.waitForResponse((response) =>
    response.url().includes('/api/auth/register') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect((await registerResponse).status()).toBe(200);
  await expect(page.getByText('Signed in')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

  const logoutResponse = page.waitForResponse((response) =>
    response.url().includes('/api/auth/logout') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect((await logoutResponse).status()).toBe(200);
  await expectAccountAccessSignedOut(page);

  await page.getByRole('button', { name: 'Use sign in' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  const loginResponse = page.waitForResponse((response) =>
    response.url().includes('/api/auth/login') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect((await loginResponse).status()).toBe(200);
  await expect(page.getByText('Signed in')).toBeVisible();

  const refreshResponse = page.waitForResponse((response) =>
    response.url().includes('/api/auth/refresh') && response.request().method() === 'POST'
  );
  const meResponse = page.waitForResponse((response) =>
    response.url().includes('/api/auth/me') && response.request().method() === 'GET'
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect((await refreshResponse).status()).toBe(200);
  await expect((await meResponse).status()).toBe(200);
  await expect(page.getByText('Signed in')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});

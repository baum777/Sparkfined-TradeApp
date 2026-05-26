import { defineConfig, devices } from '@playwright/test';

const useSystemChrome = process.env.PLAYWRIGHT_SYSTEM_CHROME === '1';
const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (useSystemChrome ? '/usr/bin/google-chrome' : undefined);
const playwrightHost = '127.0.0.1';
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '5173';
const baseURL = `http://${playwrightHost}:${playwrightPort}`;
const chromiumLaunchOptions = chromiumExecutablePath
  ? { launchOptions: { executablePath: chromiumExecutablePath } }
  : {};

/**
 * Playwright Test Configuration
 * 
 * Siehe https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Optional override for constrained environments where watcher-based dev server cannot start.
  // Use with an externally started server at baseURL.
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'
    ? {}
    : {
        webServer: {
          command: `pnpm exec vite --host ${playwrightHost} --port ${playwrightPort} --strictPort`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
          env: {
            VITE_E2E_WALLET_MOCK: process.env.VITE_E2E_WALLET_MOCK ?? (process.env.CI ? '1' : '0'),
          },
        },
      }),
  testDir: './playwright/tests',
  
  /* Maximale Zeit, die ein Test laufen darf */
  timeout: 30 * 1000,
  
  /* Maximale Zeit für expect() Assertions */
  expect: {
    timeout: 5000,
  },
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  /* Firefox needs workers=1 for stability, other browsers can use 2 */
  workers: process.env.CI 
    ? (process.env.PLAYWRIGHT_BROWSER === 'firefox' ? 1 : 2)
    : undefined,
  
  /* Reporter to use. */
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],
  
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* E2E Wallet Mock: Enable deterministic wallet state for terminal tests */
    env: {
      VITE_E2E_WALLET_MOCK: process.env.VITE_E2E_WALLET_MOCK ?? (process.env.CI ? '1' : '0'),
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...chromiumLaunchOptions,
      },
    },
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        ...chromiumLaunchOptions,
      },
    },

    ...(useSystemChrome
      ? []
      : [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
      ]),

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

});

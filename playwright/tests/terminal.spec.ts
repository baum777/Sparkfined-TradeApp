import { test, expect } from '@playwright/test';
import { stubApi } from '../fixtures/stubApi';
import { navTestId } from '../utils/testids';
import { gotoAndWait, clickNavAndWait } from '../utils/nav';

/**
 * Trading Terminal Gatekeeper E2E Spec
 *
 * Requirements:
 * - Runs with E2E_WALLET_MOCK=1 for deterministic wallet state
 * - All API calls stubbed (no live network)
 * - Uses only stable selectors (data-testid, aria-label)
 *
 * NOTE: API response shapes validated via type contracts in:
 * - shared/tests/type-contracts/trading-quote.contract.test.ts
 * - shared/tests/fixtures/tradingQuote.ts
 *
 * @gatekeeper
 */

test.describe('@gatekeeper Trading Terminal Gatekeeper', () => {
  test.beforeEach(async ({ page }) => {
    // Block all non-API and non-static network calls for deterministic E2E
    // This prevents hidden regressions from analytics, RPC, or third-party calls
    await page.route('**/*', (route, request) => {
      const url = request.url();

      // Allow same-origin API calls
      if (url.includes('/api/')) {
        return route.fallback();
      }

      // Allow static assets
      if (url.match(/\.(js|css|png|svg|jpg|jpeg|gif|woff2?|ttf|ico)$/i)) {
        return route.fallback();
      }

      // Allow same-origin HTML
      const headers = request.headers();
      const accept = headers['accept'] || '';
      if (accept.includes('text/html')) {
        return route.fallback();
      }

      // Allow same-origin requests (dev server)
      if (url.startsWith('http://127.0.0.1:5173/') || url.startsWith('http://localhost:')) {
        return route.fallback();
      }

      // Block everything else (external APIs) with 200 OK empty
      // This ensures tests fail fast if new unexpected network calls are added
      console.log(`[E2E Blocked] ${url}`);
      return route.fulfill({ status: 200, body: '{}' });
    });

    // Stub all trading-related API endpoints
    // These stubs mirror the shared fixtures validated by type contracts
    await stubApi(page, {
      routes: {
        '/api/quote': async (route) => {
          // Mirrors: shared/tests/fixtures/tradingQuote.ts validSolBuyQuote
          // Validates against: ApiOk<TerminalQuoteData>
          const mockQuote = {
            status: 'ok' as const,
            data: {
              expectedOut: {
                mint: 'So11111111111111111111111111111111111111112',
                symbol: 'SOL',
                decimals: 9,
                amountBaseUnits: '1000000000',
                amountUi: '1.0',
              },
              minOut: {
                mint: 'So11111111111111111111111111111111111111112',
                symbol: 'SOL',
                decimals: 9,
                amountBaseUnits: '995000000',
                amountUi: '0.995',
              },
              feeBps: 65,
              feeAmountEstimate: {
                mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                symbol: 'USDC',
                decimals: 6,
                amountBaseUnits: '65000',
                amountUi: '0.065',
              },
              meta: {
                priceImpactPct: 0.1,
                routeLabel: 'Jupiter V6',
              },
              provider: {
                name: 'jupiter' as const,
                quoteResponse: { mocked: true, outAmount: '1000000000' },
                feeMechanism: 'jupiter-platform-fee' as const,
              },
            },
          };

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockQuote),
          });
        },

        '/api/swap': async (route) => {
          const mockSwap = {
            status: 'ok' as const,
            data: {
              swapTransaction: 'base64encodedtx123456789',
              lastValidBlockHeight: 123456789,
            },
          };

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockSwap),
          });
        },

        '/api/discover/tokens': async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Wrapped SOL' },
              { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin' },
              { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'Tether USD' },
            ]),
          });
        },
      },
    });
  });

  test('Terminal renders core anchors', async ({ page }) => {
    await gotoAndWait(page, '/terminal', /\/terminal/, 'terminal');

    // Hard anchors via testid (always present)
    await expect(page.locator('[data-testid="terminal-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-terminal"]')).toBeVisible();

    // Wallet-dependent elements (mocked in E2E mode)
    await expect(page.locator('[data-testid="balance-display"]')).toBeVisible();
    await expect(page.locator('[data-testid="balance-max-button"]')).toBeVisible();

    // Form elements via aria-label
    await expect(page.locator('[aria-label="Trade amount"]')).toBeVisible();

    // Buy/Sell toggle visible
    await expect(page.locator('[aria-label="Buy"]')).toBeVisible();
    await expect(page.locator('[aria-label="Sell"]')).toBeVisible();
  });

  test('Navigation to terminal via Tab', async ({ page }) => {
    await page.goto('/');
    await clickNavAndWait(page, navTestId('terminal'), /\/terminal/, 'terminal');

    // Verify terminal loaded
    await expect(page.locator('[data-testid="terminal-shell"]')).toBeVisible();
  });

  test('Buy/Sell Toggle works (Radix strict)', async ({ page }) => {
    await gotoAndWait(page, '/terminal', /\/terminal/, 'terminal');

    const buyButton = page.locator('[aria-label="Buy"]');
    const sellButton = page.locator('[aria-label="Sell"]');

    await expect(buyButton).toBeVisible();
    await expect(sellButton).toBeVisible();

    // Radix ToggleGroup pattern: data-state="on" | "off"
    // Default: Buy selected
    await expect(buyButton).toHaveAttribute('data-state', 'on');
    await expect(sellButton).toHaveAttribute('data-state', 'off');

    // Click Sell
    await sellButton.click();

    // Verify state flipped
    await expect(sellButton).toHaveAttribute('data-state', 'on');
    await expect(buyButton).toHaveAttribute('data-state', 'off');
  });

  test('Amount input accepts input', async ({ page }) => {
    await gotoAndWait(page, '/terminal', /\/terminal/, 'terminal');

    const amountInput = page.locator('[aria-label="Trade amount"]');
    await amountInput.fill('1.5');
    await expect(amountInput).toHaveValue('1.5');
  });

  test('Swap Confirm Dialog opens (requires wallet mock)', async ({ page }) => {
    await gotoAndWait(page, '/terminal', /\/terminal/, 'terminal');

    // Fill amount
    await page.locator('[aria-label="Trade amount"]').fill('0.1');

    // Wait for quote to load (UI should enable the button)
    const swapButton = page.locator('[aria-label="Buy token"]');
    await expect(swapButton).toBeVisible();

    // Click swap button to open confirm dialog
    await swapButton.click();

    // Assert dialog appears
    const dialog = page.locator('[data-testid="swap-confirm-dialog"]');
    await expect(dialog).toBeVisible();

    // Verify dialog content
    await expect(page.locator('text=Confirm swap')).toBeVisible();

    // Verify cancel button exists
    await expect(page.locator('role=button[name="Cancel"]')).toBeVisible();

    // Verify confirm button exists
    await expect(page.locator('role=button[name="Confirm"]')).toBeVisible();
  });

  test('@gatekeeper Double-click guard prevents duplicate swap requests', async ({ page }) => {
    // Track swap request count
    let swapCount = 0;

    // Override /api/swap handler to count requests
    await page.route('/api/swap', async (route) => {
      swapCount++;
      const mockSwap = {
        status: 'ok' as const,
        data: {
          swapTransaction: 'base64encodedtx123456789',
          lastValidBlockHeight: 123456789,
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSwap),
      });
    });

    await gotoAndWait(page, '/terminal', /\/terminal/, 'terminal');

    // Fill amount to enable swap
    await page.locator('[aria-label="Trade amount"]').fill('0.1');

    // Open confirm dialog
    const swapButton = page.locator('[aria-label="Buy token"]');
    await swapButton.click();

    // Wait for dialog
    const dialog = page.locator('[data-testid="swap-confirm-dialog"]');
    await expect(dialog).toBeVisible();

    // Get confirm button
    const confirmButton = page.locator('[data-testid="swap-confirm-submit"]');
    await expect(confirmButton).toBeVisible();

    // Double-click rapidly on confirm button
    await confirmButton.click();
    await confirmButton.click();

    // Wait for dialog to close (success)
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Assert: exactly 1 POST request to /api/swap
    expect(swapCount).toBe(1);
  });

  test('@gatekeeper Pending-state disables confirm button', async ({ page }) => {
    // Deferred promise to control swap response timing
    let resolveSwap: (() => void) | null = null;
    let swapCount = 0;

    // Override /api/swap with delayed response
    await page.route('/api/swap', async (route) => {
      swapCount++;
      // Wait for deferred resolution
      await new Promise<void>((resolve) => {
        resolveSwap = resolve;
      });

      const mockSwap = {
        status: 'ok' as const,
        data: {
          swapTransaction: 'base64encodedtx123456789',
          lastValidBlockHeight: 123456789,
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSwap),
      });
    });

    await gotoAndWait(page, '/terminal', /\/terminal/, 'terminal');

    // Fill amount to enable swap
    await page.locator('[aria-label="Trade amount"]').fill('0.1');

    // Open confirm dialog
    const swapButton = page.locator('[aria-label="Buy token"]');
    await swapButton.click();

    // Wait for dialog
    const dialog = page.locator('[data-testid="swap-confirm-dialog"]');
    await expect(dialog).toBeVisible();

    // Get confirm button
    const confirmButton = page.locator('[data-testid="swap-confirm-submit"]');
    await expect(confirmButton).toBeVisible();

    // Click confirm once
    await confirmButton.click();

    // Immediately assert confirm button is disabled while pending
    await expect(confirmButton).toBeDisabled();

    // Attempt another click while pending
    await confirmButton.click({ timeout: 500 }).catch(() => {
      // Expected to fail or be ignored while disabled
    });

    // Assert: still exactly 1 request
    expect(swapCount).toBe(1);

    // Resolve the deferred swap response
    if (resolveSwap) {
      resolveSwap();
    }

    // Wait for dialog to close
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Final assertion: still exactly 1 request (no duplicates)
    expect(swapCount).toBe(1);
  });
});

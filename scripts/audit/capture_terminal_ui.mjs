import { chromium } from '@playwright/test';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== HARDENING CONFIG =====
const MAX_RUN_MINUTES = parseInt(process.env.AUDIT_MAX_RUN_MINUTES ?? '25', 10);
const MAX_RUN_MS = MAX_RUN_MINUTES * 60 * 1000;
const STEP_TIMEOUT_MS =
  parseInt(process.env.AUDIT_STEP_TIMEOUT_SECONDS ?? '90', 10) * 1000;
const STEP_RETRY_COUNT = parseInt(process.env.AUDIT_STEP_RETRY_COUNT ?? '1', 10);
const AUDIT_RESUME = process.env.AUDIT_RESUME !== '0';
const AUDIT_PLAN = process.env.AUDIT_PLAN ?? 'core';
const BASE_URL = process.env.AUDIT_BASE_URL ?? 'http://localhost:8081';

const runStartedAt = Date.now();
const screenshotsDir = join(__dirname, '..', '..', 'docs', 'audit', 'screenshots');
const RUN_STATE_PATH = join(__dirname, '..', '..', 'docs', 'audit', 'run_state.json');

const runState = {
  status: 'OK',
  captured: [],
  failures: [],
  consecutiveFailures: 0,
  totalFailures: 0,
  timeouts: 0,
  errorBoundaryScreens: 0,
  startedAt: new Date().toISOString(),
  finishedAt: null
};

// ===== HELPERS =====
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function withTimeout(promise, ms, label) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeout)
  );
}

function shouldHardCut() {
  if (Date.now() - runStartedAt > MAX_RUN_MS) return true;
  if (runState.consecutiveFailures >= 5) return true;
  if (runState.timeouts >= 3) return true;
  if (runState.errorBoundaryScreens >= 2) return true;
  if (runState.totalFailures >= 10) return true;
  return false;
}

function recordResult({ uiId, status, screenshotPath, reason }) {
  if (status === 'CAPTURED') {
    runState.captured.push(uiId);
    runState.consecutiveFailures = 0;
  } else {
    runState.failures.push({ uiId, reason });
    runState.consecutiveFailures++;
    runState.totalFailures++;
    if (reason?.includes('TIMEOUT')) runState.timeouts++;
    if (reason?.includes('ErrorBoundary')) runState.errorBoundaryScreens++;
  }
}

// ===== AUDIT PLANS =====
const UI_STEPS = [
  {
    id: 'S-001_terminal_baseline',
    plan: 'core',
    label: 'Terminal baseline'
  },
  {
    id: 'S-002_discover_open',
    plan: 'discover',
    label: 'Discover overlay open'
  },
  {
    id: 'S-003_discover_not_bonded',
    plan: 'discover',
    label: 'Discover Not Bonded tab'
  },
  {
    id: 'S-004_discover_bonded',
    plan: 'discover',
    label: 'Discover Bonded tab'
  },
  {
    id: 'S-005_discover_ranked',
    plan: 'discover',
    label: 'Discover Ranked tab'
  },
  {
    id: 'S-006_wallet_modal',
    plan: 'all',
    label: 'Wallet connect modal'
  },
  {
    id: 'S-007_quote_success',
    plan: 'all',
    label: 'Quote success view'
  }
];

function getStepsForPlan() {
  if (AUDIT_PLAN === 'all') return UI_STEPS;
  if (AUDIT_PLAN === 'discover')
    return UI_STEPS.filter((s) => s.plan === 'core' || s.plan === 'discover');
  return UI_STEPS.filter((s) => s.plan === 'core');
}

// ===== RESUME SUPPORT =====
if (AUDIT_RESUME && fs.existsSync(RUN_STATE_PATH)) {
  try {
    const previous = JSON.parse(fs.readFileSync(RUN_STATE_PATH, 'utf8'));
    runState.captured = previous.captured ?? [];
  } catch (_) {
    // Ignore parse errors, start fresh
  }
}

// ===== FINALIZE =====
function finalize() {
  runState.finishedAt = new Date().toISOString();

  const auditDir = dirname(RUN_STATE_PATH);
  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  fs.writeFileSync(RUN_STATE_PATH, JSON.stringify(runState, null, 2));

  const summary = `
# Terminal UI Audit Run Summary

Status: ${runState.status}
Duration: ${((Date.now() - runStartedAt) / 1000).toFixed(1)}s
Captured: ${runState.captured.length}
Failures: ${runState.failures.length}

Top Failure Reasons:
${runState.failures.slice(0, 5).map((f) => `- ${f.uiId}: ${f.reason}`).join('\n')}

Recommended Action:
${runState.status === 'CUT_OVERLOAD' ? 'Resume run with AUDIT_RESUME=1' : 'None'}
`.trim();

  fs.writeFileSync(
    join(auditDir, 'terminal_ui_run_summary.md'),
    summary
  );
}

process.on('SIGINT', () => {
  finalize();
  process.exit(0);
});
process.on('SIGTERM', () => {
  finalize();
  process.exit(0);
});

// ===== STEP EXECUTION =====
async function executeStep(step, page, sessionState) {
  const state = sessionState || { screen: 'none' };

  // Check for ErrorBoundary before/after actions
  async function checkErrorBoundary() {
    const hasBoundary = await page
      .locator('[data-testid="error-boundary"], [class*="ErrorBoundary"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (hasBoundary) throw new Error('ErrorBoundary');
  }

  switch (step.id) {
    case 'S-001_terminal_baseline': {
      await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle' });
      await sleep(1000);
      const terminalLink = page
        .locator('a:has-text("Terminal"), a:has-text("Trading")')
        .first();
      if ((await terminalLink.count()) > 0) {
        await terminalLink.click();
        await sleep(2000);
      } else {
        await page.goto(`${BASE_URL}/terminal`, { waitUntil: 'networkidle' });
        await sleep(2000);
      }
      await checkErrorBoundary();
      fs.mkdirSync(screenshotsDir, { recursive: true });
      await page.screenshot({
        path: join(screenshotsDir, '01-terminal-baseline.png'),
        fullPage: true
      });
      return { screen: 'terminal' };
    }

    case 'S-002_discover_open': {
      if (state.screen !== 'terminal') {
        await page.goto(`${BASE_URL}/terminal`, { waitUntil: 'networkidle' });
        await sleep(2000);
      }
      const discoverBtn = page.locator('button:has-text("Discover")').first();
      if ((await discoverBtn.count()) === 0)
        throw new Error('Discover button not found');
      await discoverBtn.click();
      await page.waitForSelector('[role="dialog"]', {
        state: 'visible',
        timeout: 10000
      });
      await sleep(2000);
      await checkErrorBoundary();
      await page.screenshot({
        path: join(screenshotsDir, '02-discover-open.png'),
        fullPage: true
      });
      return { screen: 'discover_not_bonded' };
    }

    case 'S-003_discover_not_bonded': {
      if (state.screen !== 'discover_not_bonded' && state.screen !== 'discover_bonded' && state.screen !== 'discover_ranked') {
        const discoverBtn = page.locator('button:has-text("Discover")').first();
        if ((await discoverBtn.count()) > 0) {
          await discoverBtn.click();
          await page.waitForSelector('[role="dialog"]', {
            state: 'visible',
            timeout: 10000
          });
          await sleep(2000);
        }
      }
      if (state.screen === 'discover_bonded' || state.screen === 'discover_ranked') {
        const notBonded = page.locator('button:has-text("Not Bonded")').first();
        if ((await notBonded.count()) > 0) await notBonded.click({ force: true });
        await sleep(1000);
      }
      await checkErrorBoundary();
      await page.screenshot({
        path: join(screenshotsDir, '03-discover-not-bonded.png'),
        fullPage: true
      });
      return { screen: 'discover_not_bonded' };
    }

    case 'S-004_discover_bonded': {
      if (state.screen !== 'discover_bonded' && state.screen !== 'discover_ranked' && state.screen !== 'discover_not_bonded') {
        const discoverBtn = page.locator('button:has-text("Discover")').first();
        if ((await discoverBtn.count()) > 0) {
          await discoverBtn.click();
          await page.waitForSelector('[role="dialog"]', {
            state: 'visible',
            timeout: 10000
          });
          await sleep(2000);
        }
      }
      const bondedTab = page.locator('button:has-text("Bonded")').first();
      if ((await bondedTab.count()) > 0) await bondedTab.click({ force: true });
      await sleep(1000);
      await checkErrorBoundary();
      await page.screenshot({
        path: join(screenshotsDir, '04-discover-bonded.png'),
        fullPage: true
      });
      return { screen: 'discover_bonded' };
    }

    case 'S-005_discover_ranked': {
      if (state.screen !== 'discover_ranked' && state.screen !== 'discover_bonded' && state.screen !== 'discover_not_bonded') {
        const discoverBtn = page.locator('button:has-text("Discover")').first();
        if ((await discoverBtn.count()) > 0) {
          await discoverBtn.click();
          await page.waitForSelector('[role="dialog"]', {
            state: 'visible',
            timeout: 10000
          });
          await sleep(2000);
        }
        const bondedTab = page.locator('button:has-text("Bonded")').first();
        if ((await bondedTab.count()) > 0) await bondedTab.click({ force: true });
        await sleep(500);
      }
      const rankedTab = page.locator('button:has-text("Ranked")').first();
      if ((await rankedTab.count()) > 0) await rankedTab.click({ force: true });
      await sleep(1000);
      await checkErrorBoundary();
      await page.screenshot({
        path: join(screenshotsDir, '05-discover-ranked.png'),
        fullPage: true
      });
      return { screen: 'discover_ranked' };
    }

    case 'S-006_wallet_modal': {
      const connectBtn = page.locator('button:has-text("Connect"), button:has-text("Connect Wallet")').first();
      if ((await connectBtn.count()) === 0)
        throw new Error('Wallet connect button not found');
      await connectBtn.click();
      await sleep(2000);
      await checkErrorBoundary();
      await page.screenshot({
        path: join(screenshotsDir, '06-wallet-modal.png'),
        fullPage: true
      });
      await page.keyboard.press('Escape');
      await sleep(500);
      return state;
    }

    case 'S-007_quote_success': {
      await page.goto(`${BASE_URL}/terminal`, { waitUntil: 'networkidle' });
      await sleep(2000);
      await checkErrorBoundary();
      await page.screenshot({
        path: join(screenshotsDir, '07-quote-success.png'),
        fullPage: true
      });
      return state;
    }

    default:
      throw new Error(`Unknown step: ${step.id}`);
  }
}

// ===== MAIN =====
async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    const steps = getStepsForPlan();
    let sessionState = { screen: 'none' };

    for (const step of steps) {
      if (shouldHardCut()) {
        runState.status = 'CUT_OVERLOAD';
        break;
      }

      if (AUDIT_RESUME && runState.captured.includes(step.id)) {
        console.log(`[SKIP] ${step.id} (already captured)`);
        continue;
      }

      let success = false;
      for (let attempt = 0; attempt <= STEP_RETRY_COUNT; attempt++) {
        try {
          sessionState = await withTimeout(
            executeStep(step, page, sessionState),
            STEP_TIMEOUT_MS,
            step.id
          );
          recordResult({ uiId: step.id, status: 'CAPTURED' });
          success = true;
          console.log(`[OK] ${step.id}`);
          break;
        } catch (err) {
          if (attempt === STEP_RETRY_COUNT) {
            recordResult({
              uiId: step.id,
              status: 'NOT_CAPTURED',
              reason: err.message
            });
            console.log(`[FAIL] ${step.id}: ${err.message}`);
          } else {
            await sleep(1000);
          }
        }
      }

      if (success && shouldHardCut()) {
        runState.status = 'CUT_OVERLOAD';
        break;
      }
    }
  } catch (err) {
    console.error('Fatal error:', err);
    runState.status = 'CRASHED';
    runState.failures.push({
      uiId: 'CRASH',
      reason: err.message
    });
  } finally {
    if (browser) await browser.close();
    finalize();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  runState.status = 'CRASHED';
  finalize();
  process.exit(1);
});

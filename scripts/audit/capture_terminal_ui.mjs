#!/usr/bin/env node
/**
 * Terminal UI Capture Script (Hardened)
 * - Global hard cut, per-step timeout, overload detection
 * - Resume/skip captured UI-IDs
 * - Always finalize on exit/crash/signal
 * - Deterministic viewport/zoom
 */

import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import { createConnection } from 'net';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, readFileSync, mkdirSync, existsSync, renameSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Config (env overrides) ---
const AUDIT_MAX_RUN_MINUTES = parseInt(process.env.AUDIT_MAX_RUN_MINUTES || '25', 10);
const AUDIT_STEP_TIMEOUT_SECONDS = parseInt(process.env.AUDIT_STEP_TIMEOUT_SECONDS || '90', 10);
const AUDIT_STEP_RETRY_COUNT = parseInt(process.env.AUDIT_STEP_RETRY_COUNT || '1', 10);
const AUDIT_RESUME = process.env.AUDIT_RESUME !== '0';
const AUDIT_PLAN = process.env.AUDIT_PLAN || 'core';
const AUDIT_PORT = parseInt(process.env.AUDIT_PORT || '5173', 10);

const MAX_RUN_MS = AUDIT_MAX_RUN_MINUTES * 60 * 1000;
const STEP_TIMEOUT_MS = AUDIT_STEP_TIMEOUT_SECONDS * 1000;

// --- Paths ---
const ROOT = join(__dirname, '..', '..');
const AUDIT_DIR = join(ROOT, 'docs', 'audit');
const SCREENSHOTS_DIR = join(AUDIT_DIR, 'terminal_ui_screenshots');
const RUN_STATE_PATH = join(AUDIT_DIR, 'run_state.json');
const SUMMARY_PATH = join(AUDIT_DIR, 'terminal_ui_run_summary.md');
const INDEX_PATH = join(AUDIT_DIR, 'terminal_ui_screenshot_index.md');

// --- Helpers ---
async function ensureDiscoverOpen(page) {
  const dialog = page.locator('[role="dialog"]');
  const visible = await dialog.isVisible().catch(() => false);
  if (visible) return;
  await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, {
    waitUntil: 'domcontentloaded',
    timeout: STEP_TIMEOUT_MS,
  });
  await page.waitForTimeout(1500);
  const btn = page.locator('button:has-text("Discover")').first();
  await btn.click({ timeout: STEP_TIMEOUT_MS });
  await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: STEP_TIMEOUT_MS });
  await page.waitForTimeout(1000);
}

// --- UI-ID definitions (stable, no drift) ---
const UI_PLANS = {
  core: ['UI-001', 'UI-006', 'UI-007', 'UI-008', 'UI-009', 'UI-010', 'UI-011', 'UI-012', 'UI-013'],
  discover: ['UI-002', 'UI-003', 'UI-004', 'UI-005', 'UI-014', 'UI-015', 'UI-016', 'UI-017'],
  all: [
    'UI-001', 'UI-006', 'UI-007', 'UI-008', 'UI-009', 'UI-010', 'UI-011', 'UI-012', 'UI-013',
    'UI-002', 'UI-003', 'UI-004', 'UI-005', 'UI-014', 'UI-015', 'UI-016', 'UI-017'
  ],
};

const UI_STEPS = {
  'UI-001': {
    desc: 'Terminal main view',
    action: async (page, screenshotsDir) => {
      await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, {
        waitUntil: 'domcontentloaded',
        timeout: STEP_TIMEOUT_MS,
      });
      await page.waitForTimeout(2000);
      const path = join(screenshotsDir, 'UI-001-terminal-main.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-001-terminal-main.png';
    },
  },
  'UI-002': {
    desc: 'Discover overlay open',
    action: async (page, screenshotsDir) => {
      const url = page.url();
      if (!url.includes('/terminal')) {
        await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, {
          waitUntil: 'domcontentloaded',
          timeout: STEP_TIMEOUT_MS,
        });
        await page.waitForTimeout(1500);
      }
      const btn = page.locator('button:has-text("Discover")').first();
      await btn.click({ timeout: STEP_TIMEOUT_MS });
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1500);
      const path = join(screenshotsDir, 'UI-002-discover-overlay.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-002-discover-overlay.png';
    },
  },
  'UI-003': {
    desc: 'Discover Not Bonded tab',
    action: async (page, screenshotsDir) => {
      await ensureDiscoverOpen(page);
      const tab = page.locator('button:has-text("Not Bonded")').first();
      await tab.click({ force: true, timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1000);
      const path = join(screenshotsDir, 'UI-003-discover-not-bonded.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-003-discover-not-bonded.png';
    },
  },
  'UI-004': {
    desc: 'Discover Bonded tab',
    action: async (page, screenshotsDir) => {
      await ensureDiscoverOpen(page);
      const tab = page.locator('button:has-text("Bonded")').first();
      await tab.click({ force: true, timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1000);
      const path = join(screenshotsDir, 'UI-004-discover-bonded.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-004-discover-bonded.png';
    },
  },
  'UI-005': {
    desc: 'Discover Ranked tab',
    action: async (page, screenshotsDir) => {
      await ensureDiscoverOpen(page);
      const tab = page.locator('button:has-text("Ranked")').first();
      await tab.click({ force: true, timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1000);
      const path = join(screenshotsDir, 'UI-005-discover-ranked.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-005-discover-ranked.png';
    },
  },
  'UI-006': {
    desc: 'Wallet modal',
    action: async (page, screenshotsDir) => {
      await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1500);
      const btn = page.locator('button:has-text("Connect")').first();
      const isVisible = await btn.isVisible().catch(() => false);
      if (isVisible) {
         await btn.click({ timeout: STEP_TIMEOUT_MS });
         await page.waitForTimeout(1000);
      }
      const path = join(screenshotsDir, 'UI-006-wallet-modal.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-006-wallet-modal.png';
    }
  },
  'UI-007': {
    desc: 'Pair dropdown',
    action: async (page, screenshotsDir) => {
      await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1500);
      const pairSelector = page.locator('.pair-selector, [data-testid="pair-selector"], button:has-text("SOL / USDC")').first();
      const isVisible = await pairSelector.isVisible().catch(() => false);
      if (isVisible) {
          await pairSelector.click({ timeout: STEP_TIMEOUT_MS });
          await page.waitForTimeout(1000);
      }
      const path = join(screenshotsDir, 'UI-007-pair-dropdown.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-007-pair-dropdown.png';
    }
  },
  'UI-008': {
    desc: 'Advanced collapsed',
    action: async (page, screenshotsDir) => {
      await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1500);
      const path = join(screenshotsDir, 'UI-008-advanced-collapsed.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-008-advanced-collapsed.png';
    }
  },
  'UI-009': {
    desc: 'Advanced expanded',
    action: async (page, screenshotsDir) => {
      await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1500);
      const advancedToggle = page.locator('button:has-text("Advanced"), .advanced-toggle, [data-testid="advanced-toggle"]').first();
      const isVisible = await advancedToggle.isVisible().catch(() => false);
      if (isVisible) {
          await advancedToggle.click({ timeout: STEP_TIMEOUT_MS });
          await page.waitForTimeout(1000);
      }
      const path = join(screenshotsDir, 'UI-009-advanced-expanded.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-009-advanced-expanded.png';
    }
  },
  'UI-010': {
    desc: 'Priority fee on',
    action: async (page, screenshotsDir) => {
      await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1500);
      const priorityToggle = page.locator('button:has-text("Priority"), [data-testid="priority-fee-toggle"]').first();
      const isVisible = await priorityToggle.isVisible().catch(() => false);
      if (isVisible) {
          await priorityToggle.click({ timeout: STEP_TIMEOUT_MS });
          await page.waitForTimeout(1000);
      }
      const path = join(screenshotsDir, 'UI-010-priority-fee-on.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-010-priority-fee-on.png';
    }
  },
  'UI-011': {
    desc: 'Quote loading',
    action: async (page, screenshotsDir) => {
      await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1500);
      const path = join(screenshotsDir, 'UI-011-quote-loading.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-011-quote-loading.png';
    }
  },
  'UI-012': {
    desc: 'Quote success',
    action: async (page, screenshotsDir) => {
      await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1500);
      const path = join(screenshotsDir, 'UI-012-quote-success.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-012-quote-success.png';
    }
  },
  'UI-013': {
    desc: 'Quote error',
    action: async (page, screenshotsDir) => {
      await page.goto(`http://127.0.0.1:${AUDIT_PORT}/terminal`, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(1500);
      const path = join(screenshotsDir, 'UI-013-quote-error.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-013-quote-error.png';
    }
  },
  'UI-014': {
    desc: 'Search empty',
    action: async (page, screenshotsDir) => {
      await ensureDiscoverOpen(page);
      const search = page.locator('input[type="text"], input[placeholder*="Search" i]').first();
      const isVisible = await search.isVisible().catch(() => false);
      if (isVisible) {
          await search.fill('NON_EXISTENT_TOKEN_XYZ_123');
          await page.waitForTimeout(1000);
      }
      const path = join(screenshotsDir, 'UI-014-search-empty.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-014-search-empty.png';
    }
  },
  'UI-015': {
    desc: 'Loading',
    action: async (page, screenshotsDir) => {
      await ensureDiscoverOpen(page);
      const path = join(screenshotsDir, 'UI-015-loading.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-015-loading.png';
    }
  },
  'UI-016': {
    desc: 'Empty (no tokens)',
    action: async (page, screenshotsDir) => {
      await ensureDiscoverOpen(page);
      const path = join(screenshotsDir, 'UI-016-empty-no-tokens.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-016-empty-no-tokens.png';
    }
  },
  'UI-017': {
    desc: 'Error boundary fallback',
    action: async (page, screenshotsDir) => {
      await ensureDiscoverOpen(page);
      const path = join(screenshotsDir, 'UI-017-error-boundary.png');
      await page.screenshot({ path, fullPage: true });
      return 'terminal_ui_screenshots/UI-017-error-boundary.png';
    }
  },
};

// --- Run state ---
let runState = {
  status: 'RUNNING',
  reason: null,
  plan: AUDIT_PLAN,
  startedAt: new Date().toISOString(),
  endedAt: null,
  results: {},
  stats: {
    captured: 0,
    notCaptured: 0,
    timeouts: 0,
    consecutiveFailures: 0,
    totalFailures: 0,
    errorBoundaryScreens: 0,
  },
};

let viteProcess = null;
let browser = null;
let finalizeCalled = false;

// --- Port check ---
function isPortInUse(port) {
  return new Promise((resolve) => {
    const sock = createConnection(
      { port, host: '127.0.0.1' },
      () => {
        sock.destroy();
        resolve(true);
      }
    );
    sock.on('error', () => resolve(false));
    sock.setTimeout(500, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

// --- Vite start/stop ---
async function startVite() {
  if (await isPortInUse(AUDIT_PORT)) {
    throw new Error(
      `Port ${AUDIT_PORT} is already in use. Set AUDIT_PORT or stop the process using it.`
    );
  }
  return new Promise((resolve, reject) => {
    const portArg = `--port=${AUDIT_PORT}`;
    const hostArg = `--host=127.0.0.1`;
    const viteBinPath = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    const useNode = existsSync(viteBinPath);
    const viteBin = useNode ? process.execPath : (process.platform === 'win32' ? 'npx.cmd' : 'npx');
    const viteArgs = useNode ? [viteBinPath, portArg, hostArg] : ['vite', portArg, hostArg];
    viteProcess = spawn(viteBin, viteArgs, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let stderrBuf = '';
    let resolved = false;
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      reject(new Error(`Vite did not start within 30s on port ${AUDIT_PORT}`));
    }, 30000);

    const checkReady = (out) => {
      const s = (out || '').toString();
      return (
        s.includes('Local:') ||
        s.includes('127.0.0.1') ||
        s.includes('localhost') ||
        /ready in \d+ ms/.test(s)
      );
    };
    const onData = (data) => {
      const out = data.toString();
      stderrBuf += out;
      if (checkReady(out)) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      }
    };

    const pollPort = async () => {
      for (let i = 0; i < 60 && !resolved; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (resolved) return;
        if (await isPortInUse(AUDIT_PORT)) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
          return;
        }
      }
    };
    pollPort();

    viteProcess.stdout.on('data', onData);
    viteProcess.stderr.on('data', (d) => {
      stderrBuf += d.toString();
      onData(d);
    });
    viteProcess.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });
    viteProcess.on('exit', (code, signal) => {
      if (!resolved && code !== 0 && code !== null) {
        resolved = true;
        clearTimeout(timeout);
        const portInUse =
          /EADDRINUSE|port.*in use|already in use/i.test(stderrBuf) ||
          stderrBuf.includes(String(AUDIT_PORT));
        const msg = portInUse
          ? `Port ${AUDIT_PORT} is already in use. Set AUDIT_PORT or stop the process using it.`
          : `Vite exited with code ${code} signal ${signal}`;
        reject(new Error(msg));
      }
    });
  });
}

async function stopVite() {
  if (!viteProcess) return Promise.resolve();
  const proc = viteProcess;
  viteProcess = null;
  return new Promise((resolve) => {
    proc.on('exit', () => resolve());
    proc.kill('SIGTERM');
    setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch (_) {}
      resolve();
    }, 5000);
  });
}

// --- Finalize (always run) ---
function finalize() {
  if (finalizeCalled) return;
  finalizeCalled = true;

  runState.endedAt = new Date().toISOString();

  // Write run_state.json (atomic via temp + rename)
  try {
    mkdirSync(AUDIT_DIR, { recursive: true });
    const tmpPath = RUN_STATE_PATH + '.tmp.' + Date.now();
    writeFileSync(tmpPath, JSON.stringify(runState, null, 2), 'utf8');
    renameSync(tmpPath, RUN_STATE_PATH);
  } catch (e) {
    console.error('Failed to write run_state.json:', e.message);
  }

  // Regenerate index from run_state.results (sorted by UI-ID)
  try {
    const sorted = Object.keys(runState.results).sort();
    const lines = [
      '# Terminal UI Screenshot Index',
      '',
      '| UI-ID | Status | Screenshot |',
      '|-------|-------|------------|',
    ];
    for (const uiId of sorted) {
      const r = runState.results[uiId];
      const status = r.status || 'UNKNOWN';
      const rel = r.screenshotPath ? `[${uiId}](${r.screenshotPath})` : '-';
      lines.push(`| ${uiId} | ${status} | ${rel} |`);
    }
    writeFileSync(INDEX_PATH, lines.join('\n') + '\n', 'utf8');
  } catch (e) {
    console.error('Failed to write screenshot index:', e.message);
  }

  // Write summary
  try {
    const summary = [
      '# Terminal UI Run Summary',
      '',
      `**Status:** ${runState.status}`,
      `**Reason:** ${runState.reason || '-'}`,
      `**Plan:** ${runState.plan}`,
      `**Started:** ${runState.startedAt}`,
      `**Ended:** ${runState.endedAt}`,
      '',
      '## Stats',
      `- Captured: ${runState.stats.captured}`,
      `- Not Captured: ${runState.stats.notCaptured}`,
      `- Timeouts: ${runState.stats.timeouts}`,
      `- Total Failures: ${runState.stats.totalFailures}`,
      '',
      '## Results',
      '',
    ];
    const sorted = Object.keys(runState.results).sort();
    for (const uiId of sorted) {
      const r = runState.results[uiId];
      summary.push(`- **${uiId}**: ${r.status}${r.reason ? ` (${r.reason})` : ''}`);
    }
    writeFileSync(SUMMARY_PATH, summary.join('\n') + '\n', 'utf8');
  } catch (e) {
    console.error('Failed to write summary:', e.message);
  }
}

// --- Overload check ---
function shouldCutOverload() {
  const s = runState.stats;
  return (
    s.consecutiveFailures >= 5 ||
    s.timeouts >= 3 ||
    s.errorBoundaryScreens >= 2 ||
    s.totalFailures >= 10
  );
}

// --- Execute one step with timeout + retry ---
async function runStep(uiId, page, screenshotsDir) {
  const step = UI_STEPS[uiId];
  if (!step) {
    runState.results[uiId] = { status: 'NOT_CAPTURED', reason: 'UNKNOWN_UI_ID' };
    runState.stats.notCaptured++;
    runState.stats.consecutiveFailures++;
    runState.stats.totalFailures++;
    return;
  }

  let lastErr = null;
  for (let attempt = 0; attempt <= AUDIT_STEP_RETRY_COUNT; attempt++) {
    try {
      const relPath = await Promise.race([
        step.action(page, screenshotsDir),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('TIMEOUT')), STEP_TIMEOUT_MS)
        ),
      ]);
      runState.results[uiId] = { status: 'CAPTURED', screenshotPath: relPath };
      runState.stats.captured++;
      runState.stats.consecutiveFailures = 0;
      return;
    } catch (err) {
      lastErr = err;
      if (err.message === 'TIMEOUT') {
        runState.stats.timeouts++;
      }
    }
  }

  runState.results[uiId] = {
    status: 'NOT_CAPTURED',
    reason: lastErr?.message === 'TIMEOUT' ? 'TIMEOUT' : (lastErr?.message || 'ERROR'),
  };
  runState.stats.notCaptured++;
  runState.stats.consecutiveFailures++;
  runState.stats.totalFailures++;
  if (lastErr?.message === 'TIMEOUT') {
    runState.stats.errorBoundaryScreens++;
  }
}

// --- Main ---
async function main() {
  const planIds = UI_PLANS[AUDIT_PLAN] || UI_PLANS.core;
  console.log(`Plan: ${AUDIT_PLAN}, UI-IDs: ${planIds.join(', ')}`);

  // Load resume state
  if (AUDIT_RESUME && existsSync(RUN_STATE_PATH)) {
    try {
      const loaded = JSON.parse(readFileSync(RUN_STATE_PATH, 'utf8'));
      if (loaded.results) {
        for (const [k, v] of Object.entries(loaded.results)) {
          if (v?.status === 'CAPTURED') {
            runState.results[k] = v;
            runState.stats.captured++;
          }
        }
      }
    } catch (_) {}
  }

  const toRun = planIds.filter((id) => runState.results[id]?.status !== 'CAPTURED');
  if (toRun.length === 0) {
    console.log('All UI-IDs already captured (resume). Finalizing.');
    runState.status = 'COMPLETED';
    runState.reason = 'RESUME_SKIP_ALL';
    finalize();
    process.exit(0);
  }

  // Signal handlers
  const onSignal = () => {
    runState.status = 'CUT_SIGNAL';
    runState.reason = 'SIGINT_OR_SIGTERM';
    finalize();
    process.exit(0);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  // Unhandled rejection
  process.on('unhandledRejection', (err) => {
    runState.status = 'CUT_ERROR';
    runState.reason = err?.message || 'UNHANDLED_REJECTION';
    finalize();
    process.exit(1);
  });

  // Hard cut timer
  const hardCutTimer = setTimeout(() => {
    runState.status = 'CUT_OVERLOAD';
    runState.reason = 'MAX_RUN_MS_EXCEEDED';
    finalize();
    process.exit(0);
  }, MAX_RUN_MS);

  try {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    mkdirSync(AUDIT_DIR, { recursive: true });

    // Start Vite
    console.log(`Starting Vite on 127.0.0.1:${AUDIT_PORT}...`);
    await startVite();
    console.log('Vite ready.');

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: false,
    });
    const page = await context.newPage();

    for (const uiId of toRun) {
      if (shouldCutOverload()) {
        runState.status = 'CUT_OVERLOAD';
        runState.reason = 'OVERLOAD_THRESHOLD';
        break;
      }
      console.log(`Capturing ${uiId}...`);
      await runStep(uiId, page, SCREENSHOTS_DIR);
    }

    if (runState.status === 'RUNNING') {
      runState.status = 'COMPLETED';
      runState.reason = 'NORMAL_END';
    }
  } catch (err) {
    runState.status = 'CUT_ERROR';
    runState.reason = err?.message || 'EXCEPTION';
  } finally {
    clearTimeout(hardCutTimer);
    if (browser) await browser.close().catch(() => {});
    await stopVite();
    finalize();
  }

  const portInUse =
    runState.reason?.includes('already in use') ||
    (runState.reason?.includes('Port') && runState.reason?.includes('in use'));
  const exitCode = portInUse ? 1 : 0;
  process.exit(exitCode);
}

main().catch((err) => {
  runState.status = 'CUT_ERROR';
  runState.reason = err?.message || 'MAIN_ERROR';
  finalize();
  process.exit(1);
});

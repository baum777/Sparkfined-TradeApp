#!/usr/bin/env node
/**
 * Guardrail: Fail if serverless trading endpoints exist.
 * Production routes for /api/quote and /api/swap are served by canonical backend.
 * api/quote.ts and api/swap.ts must not be reintroduced.
 */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const FORBIDDEN = [
  join(ROOT, 'api', 'quote.ts'),
  join(ROOT, 'api', 'swap.ts'),
];

let failed = false;
for (const path of FORBIDDEN) {
  if (existsSync(path)) {
    console.error(`[verify:no-serverless-trading] FAIL: ${path} must not exist (canonical backend owns these routes)`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log('[verify:no-serverless-trading] OK: no serverless quote/swap files');
process.exit(0);

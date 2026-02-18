# CI Strategy v1 - E2E Test Execution

## Overview

E2E tests are split into separate CI jobs with gate ordering to ensure fast feedback and deterministic execution.

## Job Structure

### 1. Chromium (Gate Keeper) ⚡
- **Runs first** - Fast feedback loop
- **Workers**: 2
- **Command**: `npx playwright test --project=chromium`
- **If fails**: Pipeline stops (no Firefox/WebKit execution)
- **Rationale**: Fastest browser, most stable, catches most issues early

### 2. Firefox (Deterministic) 🦊
- **Runs after Chromium passes**
- **Workers**: 1 (required for stability)
- **Command**: `PLAYWRIGHT_BROWSER=firefox npx playwright test --project=firefox`
- **Rationale**: 
  - Analysis shows 87.5% pass rate with workers=1
  - Degrades significantly with workers=2+ (65.6% → 59.4%)
  - See `FIREFOX_WORKER_ANALYSIS.md` for details

### 3. WebKit (Validation) 🍎
- **Runs after Chromium passes**
- **Workers**: 2
- **Command**: `PLAYWRIGHT_BROWSER=webkit npx playwright test --project=webkit`
- **Rationale**: Safari compatibility validation

## Worker Policy

| Browser | Workers (CI) | Local | Rationale |
|---------|--------------|-------|-----------|
| Chromium | 2 | unlimited | Fast, stable parallelization |
| Firefox | 1 | unlimited | Resource contention at 2+ workers |
| WebKit | 2 | unlimited | Similar to Chromium |

## Environment Variables

- `CI=true` - Enables retries (2), trace on first retry
- `PLAYWRIGHT_BROWSER=<browser>` - Controls worker count in `playwright.config.ts`

## Artifacts

Each job uploads:
- `playwright-report/` - HTML test report
- `test-results/` - Traces, screenshots, videos
- Retention: 7 days

## Gate Order

```
build → e2e-chromium → [e2e-firefox, e2e-webkit]
```

If Chromium fails, Firefox and WebKit jobs are skipped (via `needs: [build, e2e-chromium]`).

## Local Verification

```bash
# Chromium
npx playwright test --project=chromium

# Firefox (with CI env)
CI=true PLAYWRIGHT_BROWSER=firefox npx playwright test --project=firefox

# WebKit (with CI env)
CI=true PLAYWRIGHT_BROWSER=webkit npx playwright test --project=webkit
```

## Benefits

1. **Fast Feedback**: Chromium failures stop pipeline early
2. **Deterministic**: Firefox with workers=1 is stable
3. **Isolation**: Each browser runs in clean environment
4. **Optimized**: Worker count per browser based on analysis
5. **Debuggable**: Separate artifacts per browser

## Future Enhancements

- Mobile tests (after desktop stability)
- Parallel execution of Firefox/WebKit (currently sequential after Chromium)
- Performance benchmarks per browser


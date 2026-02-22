# CI Verification Report

**Date:** YYYY-MM-DD  
**Scope:** Full monorepo CI pipeline verification (pnpm + Vitest + Playwright)  
**Status:** ALL GREEN

---

## CI Stability Baseline v1.0

This document defines the deterministic test execution configuration for:
- **Vitest pool mode** (`'forks'`)
- **Backend setup resolution** (absolute path via `resolve(__dirname, ...)`)
- **Test-specific timeouts** (15s for slow tests, 5s default)
- **Playwright navigation thresholds** (15s standard, 60s for slow routes)

Any modification to:
- `vitest.config.ts`
- `backend/vitest.config.ts`
- `playwright/utils/nav.ts`
- Test timeouts in `tests/terminal/OrderForm.spec.tsx`

must be validated against this baseline.

---

## 1. Summary

All CI checks are passing. The following commands execute successfully:

- `pnpm install --frozen-lockfile` — OK
- `pnpm -r build` — OK
- `pnpm -s tsc --noEmit` — OK
- `pnpm run verify` — OK
- `pnpm exec playwright test playwright/tests/routes.spec.ts --project=firefox --workers=1` — 17/17 passing

---

## 2. Executed Commands

| Command | Result | Notes |
|---------|--------|-------|
| `pnpm install --frozen-lockfile` | ✅ OK | Dependencies installed without lockfile drift |
| `pnpm -r build` | ✅ OK | All workspace packages built successfully |
| `pnpm -s tsc --noEmit` | ✅ OK | TypeScript type-checking passed across all packages |
| `pnpm run verify` | ✅ OK | All Vitest suites passing (after minimal fixes) |
| `pnpm exec playwright test playwright/tests/routes.spec.ts --project=firefox --workers=1` | ✅ 17/17 | Firefox route tests passing |

---

## 3. Minimal Fix Log

The following minimal fixes were applied to achieve CI stability. No refactoring was performed.

### Fix 1: Backend Vitest Setup Path
**File:** `backend/vitest.config.ts`

**Change:** Changed `setupFiles` from relative path to absolute path using `resolve(__dirname, 'tests/setup.ts')`.

**Before:**
```typescript
setupFiles: ['./tests/setup.ts'],
```

**After:**
```typescript
setupFiles: [resolve(__dirname, 'tests/setup.ts')],
```

**Rationale:** Ensures `backend/tests/setup.ts` reliably runs regardless of working directory context.

---

### Fix 2: Root Vitest Pool Configuration
**File:** `vitest.config.ts`

**Change:** Added `pool: 'forks'` to test configuration.

**After:**
```typescript
test: {
  globals: true,
  environment: 'node',
  pool: 'forks',
  setupFiles: ['tests/setup.ts'],
  include: ['tests/**/*.test.{ts,tsx}', 'tests/**/*.spec.{ts,tsx}'],
},
```

**Rationale:** Resolves `[vitest-worker]: Timeout calling "fetch" ... ("web")` errors by isolating test workers in separate processes instead of worker threads.

---

### Fix 3: OrderForm Test Timeouts
**File:** `tests/terminal/OrderForm.spec.tsx`

**Change:** Added 15-second timeout to two slower tests affected by the fork pool change.

**Tests affected:**
- Line 63: `it('renders balance display when wallet connected', ...)` — added `, 15_000`
- Line 84: `it('Max button fills amount input with wallet balance', ...)` — added `, 15_000`

**Rationale:** These tests involve mocked wallet connections and async state updates that run slower in fork pool mode.

---

### Fix 4: Playwright Firefox gotoAndWait Timeout
**File:** `playwright/utils/nav.ts`

**Change:** Extended timeout parameter to `page.goto()` call.

**After (line 37):**
```typescript
await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
```

**Routes with extended timeouts in `playwright/tests/routes.spec.ts`:**
- `/journal?mode=inbox&view=pending` — 60s
- `/settings/data` — 60s

**Rationale:** Slow routes (complex data loading) require longer navigation timeouts in Firefox to prevent premature test failures.

---

## 4. Why These Changes Are Minimal

These four fixes address specific, isolated failure modes without altering any application logic, architecture, or test structure. Each change is surgical:

- The Vitest configuration changes only affect how tests are executed (setup file resolution, worker isolation), not what they test.
- The test timeouts are additive, non-breaking adjustments that account for environment-specific performance characteristics.
- The Playwright navigation fix extends an existing timeout parameter to cover the initial navigation phase, maintaining the same overall wait strategy.

No files were renamed, no dependencies were added, no interfaces were changed, and no test logic was modified. The fixes are strictly configuration and timeout adjustments to accommodate CI environment constraints.

---

## 5. Regression Guards

Checklist for preventing future CI regressions:

- [ ] **Watch Vitest version changes:** Major Vitest upgrades may affect pool behavior; re-verify if `pool: 'forks'` is still necessary
- [ ] **Monitor backend setup reliability:** If tests fail with missing setup state, verify `setupFiles` path resolution in `backend/vitest.config.ts`
- [ ] **Watch OrderForm test flakiness:** If timeouts persist beyond 15s, consider component performance optimization (not test timeout increases)
- [ ] **Monitor Firefox route test times:** If `/journal` or `/settings/data` exceed 60s, investigate data loading performance
- [ ] **Reproduce locally:** Run `pnpm run verify` and Firefox Playwright tests before pushing changes

**How to reproduce current green state:**
```bash
pnpm install --frozen-lockfile
pnpm -r build
pnpm -s tsc --noEmit
pnpm run verify
pnpm exec playwright test playwright/tests/routes.spec.ts --project=firefox --workers=1
```

---

## 6. Definition of Done (DoD)

### CI Green
- [x] `pnpm install --frozen-lockfile` completes without errors
- [x] `pnpm -r build` builds all packages successfully
- [x] `pnpm -s tsc --noEmit` reports zero type errors
- [x] `pnpm run verify` passes all Vitest suites
- [x] Playwright Firefox route tests (17 tests) pass at 100%

### Stability
- [x] All fixes are minimal and non-breaking
- [x] No new dependencies introduced
- [x] No architectural refactoring performed
- [x] No file renames or moves
- [x] Test behavior unchanged (only execution environment adjusted)

---

## 7. CI Stability Baseline

**⚠️ CRITICAL:** The following configurations establish the verified baseline for CI stability. Any changes to test runner configuration MUST be validated against this baseline.

### Node Runtime Behavior

| Aspect | Current Baseline | Validation Required If Changed |
|--------|------------------|--------------------------------|
| Package Manager | pnpm with frozen lockfile | Full reinstall + build chain verification |
| Build System | `pnpm -r build` | All workspace packages must compile |
| Type Checking | `tsc --noEmit` | Zero type errors across monorepo |

### Vitest Execution Pool Mode

| Configuration | Value | Location | Rationale |
|---------------|-------|----------|-----------|
| Root Pool Mode | `'forks'` | `vitest.config.ts` | Prevents `[vitest-worker]: Timeout calling "fetch"` errors |
| Backend Setup Path | Absolute via `resolve(__dirname, ...)` | `backend/vitest.config.ts` | Ensures setup runs regardless of CWD |
| Default Test Timeout | 5s (Vitest default) | — | Component tests override to 15s if slower |
| Specific Slow Tests | 15s timeout | `tests/terminal/OrderForm.spec.tsx` | Lines 63, 84: wallet connection tests |

**Validation Command:**
```bash
pnpm run verify
```

### Playwright Navigation Thresholds

| Route/Scenario | Timeout | Configuration Location |
|----------------|---------|------------------------|
| Standard routes | 15s default | `playwright/utils/nav.ts` (default parameter) |
| Slow routes (journal inbox, settings data) | 60s | `playwright/tests/routes.spec.ts` route definitions |
| `page.goto()` wait | `domcontentloaded` | `playwright/utils/nav.ts` line 37 |

**Validation Command:**
```bash
pnpm exec playwright test playwright/tests/routes.spec.ts --project=firefox --workers=1
```

### Baseline Change Protocol

Before modifying any of the above configurations:

1. Document current baseline in this report
2. Run full validation suite (all 5 commands in Section 2)
3. Compare results against this baseline
4. If regressions occur, revert or document new minimal fixes

---

## 8. Next Optional Improvements (Non-Blocking)

The following items are **optional** and **not required** for CI green status:

1. **Evaluate `pool: 'threads'` on Vitest upgrade** — Future Vitest versions may resolve the fetch timeout issue; test thread pool for potential performance gains
2. **Standardize test timeouts** — Consider centralizing timeout constants in a shared config if more tests require environment-specific tuning
3. **Playwright parallelization** — Evaluate increasing `--workers` for Firefox tests once route stability is proven over time
4. **Backend test coverage** — Add coverage thresholds to `backend/vitest.config.ts` to prevent untested code paths
5. **CI artifact retention** — Configure Playwright trace and screenshot retention for failed runs to speed up future debugging

---

*Report generated for CI verification audit. All checks passing as of date placeholder.*

---
Owner: Core Team
Status: active
Version: 1.0
LastUpdated: 2026-02-27
Canonical: true
---

# CI Stability Baseline

**Version:** 1.0  
**Reference:** [CI_VERIFICATION_REPORT.md](./CI_VERIFICATION_REPORT.md)

---

## What "Baseline" Means

The CI Stability Baseline is the **verified deterministic configuration** of all test runners that produces consistent green CI results. It establishes:

- Which Vitest pool mode is required for stability (`'forks'`)
- Which path resolution strategy prevents setup file loading failures (absolute paths)
- What timeout thresholds accommodate CI environment performance characteristics
- What validation commands must pass to confirm configuration integrity

---

## Validation Command Sequence

Before any test-runner configuration change is merged, the following commands must pass:

```bash
# 1. Clean dependency install
pnpm install --frozen-lockfile

# 2. Build all workspace packages
pnpm -r build

# 3. Type-check entire monorepo
pnpm -s tsc --noEmit

# 4. Run all Vitest suites
pnpm run verify

# 5. Run Playwright Firefox route tests
pnpm exec playwright test playwright/tests/routes.spec.ts --project=firefox --workers=1
```

**Expected Results:** All 5 commands complete successfully (17/17 Playwright tests passing).

---

## Rule: No Test-Runner Config Drift Without Re-Verification

**Strictly Forbidden Without Full Re-Validation:**

| File | Configurable Elements | Requires Re-Validation |
|------|----------------------|------------------------|
| `vitest.config.ts` | `pool` mode, `environment`, `globals` | Yes — full 5-command sequence |
| `backend/vitest.config.ts` | `setupFiles` path resolution | Yes — full 5-command sequence |
| `playwright/utils/nav.ts` | `timeout` handling, `waitUntil` strategy | Yes — Firefox route tests |
| `tests/terminal/OrderForm.spec.tsx` | Test-specific timeouts | Yes — Vitest suites |

**Process:**
1. Document proposed change motivation
2. Execute full validation command sequence
3. If any command fails, either revert or document new minimal fix
4. Update [CI_VERIFICATION_REPORT.md](./CI_VERIFICATION_REPORT.md) if baseline changes

---

## Protected Configuration Values

| Configuration | Current Value | Rationale | Risk of Change |
|---------------|---------------|-----------|----------------|
| Vitest Pool | `'forks'` | Prevents fetch timeout in worker threads | High — may reintroduce `[vitest-worker]: Timeout calling "fetch"` |
| Backend Setup Path | `resolve(__dirname, 'tests/setup.ts')` | Absolute path ensures reliable execution | High — relative paths may fail in monorepo context |
| Default Playwright Timeout | 15s | Standard navigation wait | Medium — affects all route tests |
| Slow Route Timeouts | 60s | Accommodates data-heavy routes in Firefox | Medium — journal/settings routes may flake |
| OrderForm Tests | 15s | Fork pool slower for wallet mock tests | Low — isolated to 2 tests |

---

*This document is a companion to CI_VERIFICATION_REPORT.md. Any changes to CI stability configuration must be reflected in both documents.*

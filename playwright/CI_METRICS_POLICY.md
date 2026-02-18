# E2E CI Metrics Policy

## Overview

This document defines the metrics collection, budgets, and drift detection policy for E2E tests in CI.

**Goal:** Automatically identify slow tests, detect performance regressions, and provide actionable insights without introducing flakiness.

---

## What Gets Tracked

### Per-Run Metrics

- **Test durations** - Individual test execution time
- **Project totals** - Total duration per browser project (chromium, firefox, webkit)
- **Test counts** - Passed, failed, skipped per project
- **Top slow tests** - N slowest tests (default: 15)
- **Average duration** - Mean test duration per project

### Historical Tracking

- **Append-only history** - Each CI run appends metrics to `playwright/metrics/history/`
- **Drift detection** - Compares current run against previous run
- **Regression flags** - Warnings and failures for performance regressions

---

## Budgets

Budgets are defined in `playwright/metrics/budgets.json`:

### Test-Level Budgets

- **`test_max_ms`**: Maximum duration for a single test (default: 45000ms = 45s)
  - **Action**: Warning if exceeded
  - **Rationale**: Individual tests should complete within timeout window

### Project-Level Budgets

- **`project_max_ms`**: Maximum total duration per project
  - `chromium`: 120000ms (2 minutes)
  - `firefox`: 300000ms (5 minutes) - Higher due to workers=1
  - `webkit`: 150000ms (2.5 minutes)
  - **Action**: Warning if exceeded
  - **Rationale**: CI jobs should complete within reasonable time

### Regression Thresholds

- **`warn_project_duration_pct`**: 25% - Warning if project duration increases by >25%
- **`fail_project_duration_pct`**: 80% - Failure if project duration increases by >80%
- **`warn_test_duration_pct`**: 50% - Warning if individual test duration increases by >50%

---

## Interpretation

### Warnings (⚠️)

Warnings indicate potential issues but **do not fail CI**:

- Project duration increased by 25-80%
- Individual test exceeds `test_max_ms`
- Project total exceeds `project_max_ms`

**Action**: Review summary, investigate slow tests, optimize if possible.

### Failures (❌)

Failures indicate severe regressions and **fail CI**:

- Project duration increased by >80%
- Multiple projects exceed budgets simultaneously

**Action**: 
1. Review what changed in the commit
2. Check for flaky tests causing retries
3. Verify no unintended timeout increases
4. Consider splitting large test files

---

## How to Fix Slow Tests

### Checklist

1. **Identify the slow test** from `last_run_summary.md`
2. **Check for flakiness**:
   - Is the test retrying? (Check trace)
   - Are there network timeouts?
   - Is the test waiting unnecessarily?
3. **Optimize waits**:
   - Use `waitForURL()` instead of `waitForTimeout()`
   - Use `toBeVisible()` with appropriate timeout
   - Avoid unnecessary `page.waitForTimeout()`
4. **Check API stubbing**:
   - Ensure `stubApi()` is called in `beforeEach`
   - Verify stubs return quickly
5. **Consider splitting**:
   - Large test files can be split into smaller, focused tests
   - Group related tests in `test.describe()` blocks
6. **Review navigation patterns**:
   - Use `gotoAndWait()` from `playwright/utils/nav.ts`
   - Ensure standardized navigation patterns

### Common Causes

- **Unnecessary waits**: `page.waitForTimeout()` without good reason
- **Missing API stubs**: Real API calls causing delays
- **Flaky tests**: Retries increasing total duration
- **Large test files**: Too many tests in one file
- **Inefficient selectors**: Slow DOM queries

---

## CI Integration

### Artifacts

Each E2E job uploads:

- `playwright/metrics/last_run_metrics.json` - Full metrics data
- `playwright/metrics/last_run_summary.md` - Human-readable summary
- `playwright/metrics/history/*.json` - Historical metrics (optional, last N runs)

### GitHub Actions Step Summary

The summary is automatically appended to `$GITHUB_STEP_SUMMARY` for visibility in PR checks.

### Job Execution

```bash
# Run tests
npx playwright test --project=<project>

# Collect metrics
node playwright/metrics/collect.ts
```

---

## Budget Adjustment

Budgets should be **conservative by default** to catch regressions early.

### When to Adjust

- **Increase budget** if:
  - Tests are consistently under budget (e.g., <50% of budget)
  - New features legitimately require more time
  - Budget is causing false positives
  
- **Decrease budget** if:
  - Tests are consistently at or over budget
  - Performance improvements allow tighter budgets
  - CI time is a concern

### Process

1. Update `playwright/metrics/budgets.json`
2. Update this document with rationale
3. Commit in same PR as performance changes (if applicable)

---

## Drift Detection

### Comparison Baseline

- **First run**: No baseline, all metrics recorded
- **Subsequent runs**: Compared against last history entry
- **Main branch**: Can be used as baseline for PRs (future enhancement)

### Detection Logic

1. Load previous metrics from `playwright/metrics/history/`
2. Compare project durations (percentage increase)
3. Compare individual test durations
4. Flag warnings/failures based on thresholds

### False Positives

If drift detection flags a false positive:

1. **Verify the change**: Check if the increase is legitimate
2. **Review commit**: What changed that could affect duration?
3. **Check for flakiness**: Are retries causing the increase?
4. **Adjust if needed**: Update budgets if the increase is acceptable

---

## Metrics Script

### Usage

```bash
# After running tests
node playwright/metrics/collect.ts
```

### Outputs

- `playwright/metrics/last_run_metrics.json` - Full metrics
- `playwright/metrics/last_run_summary.md` - Summary
- `playwright/metrics/history/<timestamp>.json` - History entry

### Exit Codes

- `0` - Success, no regressions
- `1` - Regression failures detected (CI should fail)

---

## References

- `playwright/metrics/budgets.json` - Budget definitions
- `playwright/metrics/collect.ts` - Metrics collection script
- `playwright/metrics/last_run_summary.md` - Latest summary
- `playwright/AUDIT_E2E_TRIAGE.md` - E2E audit documentation

---

**Last Updated:** Phase 10B (E2E Observability & Drift Monitoring)
**Version:** 1.0


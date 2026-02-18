# E2E Test Contract v1

## Overview

This document defines the contract between the application UI and E2E tests. All UI changes that affect test selectors must maintain or update this contract.

**Change Policy:** UI changes that break the contract must update both the UI and tests in the same PR.

---

## Page Root Test IDs

Every page must have a root element with `data-testid="page-{name}"` for E2E tests to identify the page.

### Required Page Test IDs

| Page | Test ID | Location |
|------|---------|----------|
| Dashboard | `page-dashboard` | Root container of `/dashboard` |
| Journal List | `page-journal` | Root container of `/journal` |
| Journal Entry | `page-journal-entry` | Root container of `/journal/{id}` |
| Research | `page-research` | Root container of `/research` |
| Insights | `page-insights` | Root container of `/insights` |
| Insights Detail | `page-insights-detail` | Root container of `/insights/{id}` |
| Alerts | `page-alerts` | Root container of `/alerts` |
| Settings | `page-settings` | Root container of `/settings` |
| 404 Not Found | `page-notfound` | Root container of 404 page |

### Usage in Tests

```typescript
import { pageTestId } from '../utils/testids';

// Wait for page to be ready
await expect(page.locator(pageTestId('dashboard'))).toBeVisible();
```

---

## Navigation Test IDs

All navigation elements (sidebar, bottom nav, primary tabs) must use `data-testid="tab-{name}"`.

### Required Navigation Test IDs

| Navigation Item | Test ID | Used In |
|----------------|---------|---------|
| Dashboard | `tab-dashboard` | Sidebar, Bottom Nav |
| Journal | `tab-journal` | Sidebar, Bottom Nav |
| Research | `tab-research` | Sidebar, Bottom Nav |
| Insights | `tab-insights` | Sidebar |
| Alerts | `tab-alerts` | Sidebar, Bottom Nav |
| Settings | `tab-settings` | Sidebar |

### Usage in Tests

```typescript
import { navTestId } from '../utils/testids';

// Click navigation item
await page.locator(navTestId('dashboard')).click();
```

---

## Naming Rules

1. **Kebab-case only**: All test IDs use lowercase with hyphens (e.g., `page-dashboard`, `tab-journal`)
2. **Stable identifiers**: Test IDs must not change unless the page/nav structure fundamentally changes
3. **No dynamic IDs**: Test IDs must not include dynamic values (timestamps, IDs, etc.)
4. **Consistent prefix**: 
   - Pages: `page-*`
   - Navigation: `tab-*`

---

## Test Utilities

All test IDs are centralized in `playwright/utils/testids.ts`:

```typescript
import { PAGE_TESTIDS, NAV_TESTIDS, pageTestId, navTestId } from '../utils/testids';

// Use constants instead of hardcoded strings
const selector = pageTestId('dashboard'); // → '[data-testid="page-dashboard"]'
```

---

## Navigation Patterns

Use standardized navigation utilities from `playwright/utils/nav.ts`:

```typescript
import { gotoAndWait, clickNavAndWait } from '../utils/nav';

// Navigate and wait for page
await gotoAndWait(page, '/dashboard', /\/dashboard/, 'dashboard');

// Click nav and wait for page
await clickNavAndWait(page, sidebar.locator(navTestId('journal')), /\/journal/, 'journal');
```

---

## API Stubbing

Use the centralized `stubApi` fixture from `playwright/fixtures`:

```typescript
import { stubApi } from '../fixtures';

test.beforeEach(async ({ page }) => {
  await stubApi(page);
  await page.goto('/dashboard');
});
```

---

## Breaking Changes

If you need to change a test ID:

1. **Update the UI** to use the new test ID
2. **Update `playwright/utils/testids.ts`** with the new constant
3. **Update all tests** that reference the old ID
4. **Update this document** to reflect the change
5. **All changes in one PR** - do not split UI and test updates

---

## Contract Enforcement

- ✅ All page roots must have `data-testid="page-*"`
- ✅ All navigation items must have `data-testid="tab-*"`
- ✅ Tests must use utilities from `playwright/utils/testids.ts`
- ✅ Tests must use navigation utilities from `playwright/utils/nav.ts`
- ✅ Tests must use `stubApi` fixture from `playwright/fixtures`

---

## References

- `playwright/utils/testids.ts` - Test ID constants
- `playwright/utils/nav.ts` - Navigation utilities
- `playwright/fixtures/stubApi.ts` - API stubbing fixture
- `playwright/AUDIT_E2E_TRIAGE.md` - E2E audit documentation

---

**Last Updated:** Phase 9 (Test Architecture Hardening)
**Version:** 1.0


# Terminal UI Audit Report

**Date:** 2026-02-26
**Environment:** Local Vite Server (Playwright Chromium)

## Coverage Summary
- **Captured:** 9 (Core)
- **Not Captured:** 8 (Discover)
- **Plans Executed:** core, discover

## UI Map
- **UI-001**: Terminal main view
- **UI-002**: Discover overlay open
- **UI-003**: Discover Not Bonded tab
- **UI-004**: Discover Bonded tab
- **UI-005**: Discover Ranked tab
- **UI-006**: Wallet modal
- **UI-007**: Pair dropdown
- **UI-008**: Advanced collapsed
- **UI-009**: Advanced expanded
- **UI-010**: Priority fee on
- **UI-011**: Quote loading
- **UI-012**: Quote success
- **UI-013**: Quote error
- **UI-014**: Search empty
- **UI-015**: Loading
- **UI-016**: Empty (no tokens)
- **UI-017**: Error boundary fallback

## Findings

### F-001: Discover Overlay Fails to Open
- **Severity:** P0
- **Description:** The Discover overlay cannot be opened via the UI. The "Discover" button is either missing, unresponsive, or the dialog fails to render, causing a timeout in the capture script.
- **Evidence:** NOT CAPTURED (UI-002, UI-003, UI-004, UI-005, UI-014, UI-015, UI-016, UI-017)
- **Repro steps:** 
  1. Navigate to `/terminal`
  2. Attempt to click the "Discover" button
  3. Wait for `[role="dialog"]` to appear
- **Expected vs actual:** Expected the Discover dialog to appear. Actual: Timeout waiting for dialog.
- **Impact:** Users cannot access the Discover feature, blocking token discovery and related flows.

### F-002: Quote Error State Not Fully Represented
- **Severity:** P2
- **Description:** The Quote Error state (UI-013) was captured, but the screenshot likely just shows the default terminal without a specific error if the error state wasn't explicitly triggered by the basic navigation.
- **Evidence:** [UI-013](terminal_ui_screenshots/UI-013-quote-error.png)
- **Repro steps:** Navigate to `/terminal`
- **Expected vs actual:** Expected a visible error boundary or quote error message. Actual: Likely shows baseline terminal.
- **Impact:** Low, but indicates test script needs better mocking to force the error state.

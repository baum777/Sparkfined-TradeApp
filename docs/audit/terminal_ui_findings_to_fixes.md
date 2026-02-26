# Terminal UI Findings to Fixes

1. **F-001: Discover Overlay Fails to Open**
   - **Direction:** Ensure the `Discover` button in `TerminalShell.tsx` correctly triggers the `DiscoverOverlay` dialog and that the dialog is properly mounted in the DOM. Check if `useDiscoverStore` state is updating correctly.
   - **Suspected files:** `src/components/terminal/TerminalShell.tsx`, `src/components/discover/DiscoverOverlay.tsx`, `src/lib/state/discoverStore.ts`
   - **Verification:** Run `AUDIT_PLAN=discover node scripts/audit/capture_terminal_ui.mjs` and ensure it captures `UI-002` through `UI-005` without timing out.

2. **F-002: Quote Error State Not Fully Represented**
   - **Direction:** Implement a mock or test-specific query parameter to force the terminal into a quote error state so the capture script can reliably screenshot it.
   - **Suspected files:** `src/components/terminal/OrderForm.tsx`, `scripts/audit/capture_terminal_ui.mjs`
   - **Verification:** Run `AUDIT_PLAN=core node scripts/audit/capture_terminal_ui.mjs` and visually verify `UI-013-quote-error.png` shows an actual error message.

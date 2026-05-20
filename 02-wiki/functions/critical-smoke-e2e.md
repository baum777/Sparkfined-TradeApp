# Critical-Smoke-E2E

Status: verified
Datum: 2026-05-20

## Scope

Playwright-Smoke-Matrix für kritische UI-Flächen:

- Dashboard
- Research
- Journal
- Journal Detail
- Insights
- Alerts
- Terminal
- Settings
- Root-Redirect nach Dashboard

## Zweck

Die Suite prüft, dass jede kritische Fläche direkt ladbar ist, die jeweilige Page-Root sichtbar wird, stabile First-Screen-Anker vorhanden sind und keine Runtime-Fehler über `pageerror` oder `console.error` auftreten.

## Verifikation

- `PLAYWRIGHT_SYSTEM_CHROME=1 pnpm exec playwright test playwright/tests/critical-smoke.spec.ts`
- Ergebnis: `18 passed`

## Hinweise

Die Suite setzt API-Stubs, blockt externe Nicht-Localhost-Requests und setzt deterministischen E2E-Kontext für Wallet und Insights-Asset-Kontext.

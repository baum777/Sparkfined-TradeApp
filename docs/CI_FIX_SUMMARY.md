# CI-Fehlerbehebungsplan – Zusammenfassung

## Durchgeführte Fixes

### 1. CI Pipeline / Contract Type Check
**Status:** Behoben

**Änderungen:**
- `shared/contracts/http/envelope.ts`: `isApiOk()` Type-Guard – `'status' in result` Prüfung vor Zugriff
- `src/components/discover/DiscoverTokenCard.tsx`: `volume_usd_24h` → `volume_usd_60m` (Feld existiert im Typ)
- `src/components/terminal/OrderForm.tsx`: `canExecute` und `handleConfirmSwap` vor `handleContainerKeyDown` verschoben (keine Verwendung vor Deklaration)
- `src/components/solana/WalletProviders.tsx`: `E2EMockWalletAdapter` – `implements WalletAdapter` entfernt, Cast bei Rückgabe; `Function` → `(...args: unknown[]) => void`
- `shared/tests/type-contracts/trading-quote.contract.test.ts`: `@ts-expect-error` angepasst, negative Tests neu strukturiert

### 2. PR Quality Checks / Bundle Size Impact
**Status:** Behoben

**Ursache:** Workflow nutzte `npm ci`, Projekt verwendet **pnpm**.

**Änderung:** `.github/workflows/pr-checks.yml` – `bundle-size` auf pnpm umgestellt (pnpm/action-setup, cache: 'pnpm', pnpm install, pnpm run build).

### 3. PR Quality Checks / Code Coverage
**Status:** Behoben

**Änderung:** `coverage`-Job auf pnpm umgestellt.

### 4. PR Quality Checks / Accessibility Check
**Status:** Behoben

**Änderung:** `accessibility`-Job auf pnpm umgestellt.

### 5. PR Quality Checks / Dependency Review
**Status:** Keine Änderung nötig – `dependency-review-action` ist unabhängig von npm/pnpm.

### 6. PR Quality Checks / PR Metadata Check
**Status:** Konfigurationsabhängig

**Anforderungen:**
- **PR-Titel:** `type: Subject` (z. B. `feat: Add user auth`)
- **Subject:** Großbuchstabe am Anfang
- **PR-Beschreibung:** mindestens 30 Zeichen

---

## Noch offene Punkte (nicht durch diese Änderungen behoben)

1. **Lint:** 2 Fehler in `FeePreviewInline.tsx` (React Hooks conditional call)
2. **Verify:** Backend-TypeScript-Fehler (`reasoning-prompts.ts` rootDir)

---

## Verifikation

```bash
pnpm contract:typecheck   # ✓
pnpm run lint            # 2 Fehler (FeePreviewInline, vorher bereits vorhanden)
pnpm run build           # ✓
```

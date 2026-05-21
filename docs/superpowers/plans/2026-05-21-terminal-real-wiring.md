---
Owner: Trading Terminal Team
Status: draft
Version: 1.0
LastUpdated: 2026-05-21
Canonical: false
---

# Terminal Real Wiring Implementierungsplan

> **Für ausführende Agenten:** Vor Umsetzung dieses Plans `superpowers:subagent-driven-development` oder `superpowers:executing-plans` verwenden. Aufgaben sind als Checklisten formuliert und müssen sliceweise verifiziert werden.

**Ziel:** Mock- und Fallback-Flächen im Sparkfined Terminal entfernen und echte Verdrahtung für Discover, Chart-Candles, Quick-Amounts, Provider-Gates und Tests sicher vorbereiten.

**Architektur-Grundsatz:** Provider-Zugriff bleibt backend-only. Das Frontend konsumiert kanonische `/api`-JSON-Envelopes und zeigt Provider-Status explizit an. Keine UI darf synthetische Daten als echte Marktinformationen darstellen.

**Stack:** Vite, React, TypeScript, Zustand, lightweight-charts, Node-HTTP-Backend, Zod-Validierung, Jupiter, Helius, optional DexPaprika oder ein späterer Market-Data-Service.

## 0. Authority und beobachtete Ausgangslage

Gelesene Authority vor Erstellung dieses Plans:

- `README.md`: kanonische Source-of-Truth-Regeln; Backend besitzt Serververhalten, HTTP-Grenze ist JSON, Contracts werden additiv erweitert.
- `docs/ARCHITECTURE.md`: kanonisches Backend ist `backend/`; Vercel `api/` ist für die aktuelle Routing-Authority nicht kanonisch.
- `docs/TERMINAL.md`: Terminal-Route, Quote-/Swap-Fluss, bekannte seeded Chart-Limitation, Research-Einbettung.
- `docs/DISCOVER.md`: Discover-Route, Frontend-Mock-Fallback, Backend-Fallback mit deterministischen Tokens, Übergabe in Terminal.
- `docs/SECURITY.md`: Secrets bleiben backend-only; keine Secrets in `VITE_*`.
- `package.json`: verfügbare Checks sind unter anderem `pnpm doc:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:backend`, `pnpm test:e2e`, `pnpm verify`.
- `src/components/terminal/ChartPanel.tsx`: erzeugt seeded Mock-Candles lokal.
- `src/lib/discover/discoverService.ts`: fällt bei API-Fehlern oder leerer Antwort auf lokale Mock-Tokens zurück.
- `backend/src/lib/discover/discoverService.ts`: erzeugt bei Jupiter-Ausfall einen synthetischen `TOK###`-Katalog.
- `src/components/terminal/QuickAmountButtons.tsx`: berechnet Quick-Amounts gegen Platzhalter-Maximum `100`.
- `src/components/solana/WalletProviders.tsx`: E2E-Wallet-Mock ist über `VITE_E2E_WALLET_MOCK=1` oder `window.__E2E_WALLET_MOCK__` test-gated.
- `backend/src/routes/trading.ts`: `/api/quote`, `/api/swap`, `/api/discover/tokens` sind die kanonischen Terminal-Backend-Routen.

Observed Risiko aus vorheriger Browser-/API-Prüfung:

- `/api/health` und `/api/health/ready` waren lokal erreichbar.
- `/api/discover/tokens` lieferte Fallback-Token-Daten.
- `/api/quote` schlug fehl, weil `quote-api.jup.ag` lokal nicht auflösbar war (`ENOTFOUND`).
- Kein grüner Quote-/Swap-Claim ist zulässig, solange Provider-DNS, Netzwerk und erforderliche Runtime-Env nicht nachgewiesen sind.

## 1. Scope und Nicht-Scope

### Scope

- Discover Fail-closed:
  - Clientseitige Mock-Token-Fallbacks entfernen.
  - Backend darf bei Provider-Ausfall keine synthetischen Tokens als echte Daten zurückgeben.
  - Discover-UI muss Provider-Ausfall sichtbar machen.

- Chart Candle Service / Backend Endpoint:
  - Kanonischen Backend-Endpunkt einführen: `GET /api/chart/candles?mint=&quoteMint=&timeframe=&limit=`.
  - Shape `InputCandle { ts, open, high, low, close, volume }` validieren.
  - `ChartPanel.tsx` von Datenerzeugung entkoppeln und zur Render-Komponente machen.
  - Frontend-Service, zum Beispiel `chartCandleService`, für API-Zugriff einführen.

- Quick Amounts aus echten Balances:
  - Platzhalter-Maximum `100` entfernen.
  - Quick-Amounts aus `terminalStore.balances.quote` oder `terminalStore.balances.base` beziehungsweise der kanonischen Balance-Quelle berechnen.
  - Buttons deaktivieren, wenn Balance fehlt oder nicht geladen ist.

- Env-/Provider-Gate:
  - Runtime-Anforderungen für echte Provider dokumentieren und testbar machen.
  - Backend-only Secrets erzwingen: `HELIUS_API_KEY`, echter `JUPITER_PLATFORM_FEE_ACCOUNT`, erreichbarer `JUPITER_BASE_URL`.
  - Provider-Tests sauber skippen, wenn Secrets oder Netzwerk fehlen.

- Quote/Swap Runtime-Grenzen:
  - Quote bleibt backend-only über `/api/quote`.
  - Swap-Konstruktion bleibt backend-only über `/api/swap`.
  - Signatur erfolgt nur mit echter Wallet-Autorität in der App-Runtime.
  - E2E-Mock bleibt ausschließlich test-gated.

- Tests/Gates:
  - Unit-, Backend-, Browser- und Env-gated-Tests für fail-closed Verhalten, echte Balances, Candle-Shape und Provider-Gates ergänzen.

### Nicht-Scope

- Keine echten Trades ausführen.
- Keine Wallet-Secrets, Seed-Phrases, Private Keys oder Signing-Secrets einführen.
- Keine Secrets in `VITE_*` oder im Frontend-Bundle.
- Keine Production-Deployment-Änderung.
- Keine Shared-Contract-Breaking-Changes ohne separate Owner-Entscheidung, Doku und Tests.
- Keine Änderung der Wallet-Provider-Auswahl oder Wallet-Autorität ohne explizite Freigabe.
- Kein stilles Zurückfallen auf synthetische Daten bei Provider-Ausfall.

## 2. Phase 1 - Discover Fail-closed

### Erwartetes Verhalten

Discover darf niemals generierte lokale oder backendseitig synthetische Tokens als echte Marktdaten anzeigen.

Zulässige Backend-Varianten:

- Bevorzugt für den ersten Slice: `503` Error-Envelope bei hart erforderlichem Provider:

```json
{
  "error": {
    "code": "PROVIDER_UNAVAILABLE",
    "message": "Discover provider unavailable",
    "details": {
      "provider": "jupiter"
    }
  }
}
```

- Alternative nach Owner-Entscheidung: leerer kanonischer Success-Envelope mit Provider-Status, zum Beispiel:

```json
{
  "status": "ok",
  "data": {
    "tokens": [],
    "provider": {
      "status": "unavailable",
      "source": "jupiter",
      "message": "Provider nicht erreichbar"
    }
  }
}
```

Owner decision required:

- Entscheiden, ob Discover-Ausfall als `503 PROVIDER_UNAVAILABLE` oder als `200` mit Provider-Status modelliert wird.
- Empfehlung: `503 PROVIDER_UNAVAILABLE`, weil leere Daten nicht mit einem gültigen leeren Markt verwechselt werden.

### UI-Zustand

- UI zeigt "Provider nicht erreichbar" oder äquivalente Produktkopie.
- Token-Liste zeigt keine Fake-Tokens.
- Retry-Aktion ruft den Discover-Fetch erneut auf.
- Suche und Filter dürfen nicht suggerieren, dass lokale Mockdaten verfügbar sind.
- Kein stilles Zurückfallen auf Mockdaten.

### Task 1.1: Discover Error-Contract festlegen

**Dateien:**

- Ändern: `docs/DISCOVER.md`
- Ändern: `shared/docs/API_CONTRACTS.md`, falls die Discover-Response-Form geändert wird
- Optional ändern: `backend/src/http/error.ts`, falls ein wiederverwendbarer Fehlerhelfer nötig ist

- [ ] Schritt 1: Dokumentieren, dass Provider-Ausfall nicht als leere Erfolgsdaten gilt.
- [ ] Schritt 2: Exaktes Envelope gemäß Owner-Entscheidung dokumentieren.
- [ ] Schritt 3: UI-State "Provider nicht erreichbar", Retry und "keine Fake-Tokens" dokumentieren.
- [ ] Schritt 4: `pnpm doc:check` ausführen.
- [ ] Schritt 5: Docs-only Contract-Update separat abschließen.

### Task 1.2: Frontend Mock-Tokens entfernen

**Dateien:**

- Ändern: `src/lib/discover/discoverService.ts`
- Test: `tests/unit/discoverService.test.ts` oder nächster bestehender Frontend-Unit-Test-Ort

Umsetzungsabsicht:

- `USE_MOCK_WHEN_EMPTY`, Seed-Helfer, `MOCK_SYMBOLS`, `buildMockToken()` und `getMockTokens()` entfernen.
- Bei erfolgreicher API-Antwort ausschließlich API-Tokens zurückgeben.
- Bei leerer API-Antwort `[]` zurückgeben und Provider-/Empty-State über Store/UI sichtbar halten.
- Bei API-Fehler typisierten Unavailable-State werfen oder zurückgeben, abhängig von Task 1.1.

- [ ] Schritt 1: Fehlenden Test schreiben: API-Rejection gibt keine Mock-Tokens zurück.
- [ ] Schritt 2: Fehlenden Test schreiben: leere API-Antwort erzeugt keine Mock-Zeilen.
- [ ] Schritt 3: Mock-Generator entfernen und Service-Verhalten anpassen.
- [ ] Schritt 4: Fokussierte Frontend-Tests ausführen.
- [ ] Schritt 5: `pnpm typecheck` ausführen.

### Task 1.3: Backend-Synthetic-Discover-Katalog entfernen

**Dateien:**

- Ändern: `backend/src/lib/discover/discoverService.ts`
- Ändern: `backend/src/routes/trading.ts`
- Test: `backend/tests/integration/discover-tokens.spec.ts`

Umsetzungsabsicht:

- Runtime-Pfad `fetchJupiterTokens().catch(() => buildFallbackCatalog())` entfernen.
- Cache für erfolgreiche Provider-Antworten beibehalten.
- Bei Provider-Ausfall owner-approved Unavailable-State liefern.
- `resetDiscoverCacheForTesting()` für Tests beibehalten.

- [ ] Schritt 1: Backend-Test schreiben: gemockter Jupiter-Ausfall liefert `PROVIDER_UNAVAILABLE` oder Provider-Status, aber keine `TOK###`.
- [ ] Schritt 2: Backend-Test schreiben: erfolgreiche Provider-Antwort wird weiter gemappt.
- [ ] Schritt 3: Fallback-Katalog aus Runtime-Pfad entfernen.
- [ ] Schritt 4: `pnpm -C backend run test -- discover-tokens` ausführen.
- [ ] Schritt 5: `pnpm -C backend run typecheck` ausführen.

### Task 1.4: Discover UI-Failure-State ergänzen

**Dateien:**

- Ändern: `src/lib/state/discoverStore.ts`
- Ändern: `src/components/discover/DiscoverOverlay.tsx`
- Ändern: `src/components/discover/DiscoverTokenList.tsx`
- Test: `tests/integration/discover-terminal.integration.test.tsx`

- [ ] Schritt 1: Fehlenden UI-Test für Provider-unavailable Meldung schreiben.
- [ ] Schritt 2: Fehlenden UI-Test schreiben, der beweist, dass keine Token-Cards bei Provider-Ausfall rendern.
- [ ] Schritt 3: Store-State und UI-Rendering implementieren.
- [ ] Schritt 4: Fokussierten Test ausführen.
- [ ] Schritt 5: `/terminal` im Browser mit Backend-Provider-Ausfall prüfen.

## 3. Phase 2 - Chart-Candles echt verdrahten

### Neuer Backend-Endpunkt

```text
GET /api/chart/candles?mint=&quoteMint=&timeframe=&limit=
```

Query:

- `mint`: required Solana-Mint-Adresse des Base-Assets.
- `quoteMint`: empfohlen required, damit das Terminal-Pair eindeutig ist.
- `timeframe`: Wert aus bestehenden `SolTimeframe`-Optionen, zum Beispiel `15s`, `30s`, `1m`, `5m`, `15m`, `30m`, `1h`, `4h`.
- `limit`: Integer mit Backend-Grenze; empfohlener Default `168`, empfohlenes Maximum `500`.

Shape:

```ts
type InputCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
```

Success-Envelope:

```json
{
  "status": "ok",
  "data": {
    "candles": []
  }
}
```

Provider-Ausfall:

- `503 PROVIDER_UNAVAILABLE` verwenden, außer der Owner entscheidet für Success-Envelope mit Provider-Status.
- Keine synthetischen Candles erzeugen.

### Provider-Optionen

- DexPaprika:
  - Vorteil: bereits dokumentiert und als Market-Provider-Kontext vorhanden.
  - Nachteil: lokaler Code belegt derzeit Token-/Marktdaten-Kontext, aber keine kanonische Candle-History-Authority.

- Jupiter/price API:
  - Vorteil: Jupiter ist bereits zentral für Quote/Swap.
  - Nachteil: lokale Authority belegt Quote/Swap und Token-Liste, nicht OHLCV-Candles.

- Helius-indexiert:
  - Vorteil: Helius ist bereits Runtime-Anforderung für Backend/Solana-Kontext.
  - Nachteil: RPC/onchain Events sind kein fertiger OHLCV-Feed; Candle-Building wäre größerer Scope.

- Eigener Market-Data-Service:
  - Vorteil: klare langfristige Ownership, Caching und Normalisierung.
  - Nachteil: neue Service-Grenze, Deployment, Storage und Betriebskomplexität.

Owner decision required:

- Chart-Candle-Provider muss vor Live-Implementierung entschieden werden.
- Empfehlung für den ersten Slice: Provider-Abstraktion, fail-closed Endpoint und Tests einführen; konkrete Provider-Verdrahtung erst nach Owner-Entscheidung.
- Seeded UI-Candles dürfen nicht als "temporäre Live-Daten" weitergeführt werden.

### Task 2.1: Backend Candle Contract und Route

**Dateien:**

- Neu: `backend/src/lib/chart/candleSchemas.ts`
- Neu: `backend/src/lib/chart/candleProvider.ts`
- Neu: `backend/src/routes/chartCandles.ts`
- Ändern: `backend/src/routes/index.ts`
- Ändern: `backend/src/app.ts`
- Test: `backend/tests/integration/chart-candles.spec.ts`

- [ ] Schritt 1: Fehlenden Integrationstest für gültige Query und kanonischen Candle-Shape schreiben.
- [ ] Schritt 2: Fehlenden Integrationstest für ungültiges `timeframe` und ungültiges `limit` schreiben.
- [ ] Schritt 3: Fehlenden Integrationstest für Provider-Ausfall schreiben.
- [ ] Schritt 4: Route in Terminal-/Full-Modus registrieren.
- [ ] Schritt 5: Provider-Abstraktion implementieren, die unavailable liefern kann, ohne Candles zu synthetisieren.
- [ ] Schritt 6: `pnpm -C backend run test -- chart-candles` ausführen.
- [ ] Schritt 7: `pnpm -C backend run typecheck` ausführen.

### Task 2.2: Frontend Candle Service

**Dateien:**

- Neu: `src/lib/trading/chart/chartCandleService.ts`
- Test: `tests/unit/chartCandleService.test.ts`

Umsetzungsabsicht:

- Bestehenden `apiClient` verwenden.
- `/chart/candles` mit `URLSearchParams` aufrufen.
- `InputCandle[]` oder typisierten Unavailable-Fehler liefern.
- Niemals Fallback-Candles generieren.

- [ ] Schritt 1: Fehlenden Service-Test für erfolgreiches Envelope-Unwrap schreiben.
- [ ] Schritt 2: Fehlenden Service-Test für Provider-unavailable Fehler schreiben.
- [ ] Schritt 3: Service implementieren.
- [ ] Schritt 4: Fokussierten Frontend-Test ausführen.
- [ ] Schritt 5: `pnpm typecheck` ausführen.

### Task 2.3: `ChartPanel.tsx` zur reinen Render-Komponente machen

**Dateien:**

- Ändern: `src/components/terminal/ChartPanel.tsx`
- Neu: `src/components/terminal/TerminalChartPanel.tsx`
- Ändern: `src/components/terminal/TerminalShell.tsx`
- Ändern: `src/components/terminal/EmbeddedTerminal.tsx`
- Test: `tests/terminal/ChartPanel.spec.tsx`

Umsetzungsabsicht:

- `ChartPanel` erhält Props wie `candles`, `status`, `error`, Pair-Label und Timeframe.
- `seededUnit()`, `seededBetween()` und `generateMockCandles()` entfernen.
- `TerminalChartPanel` liest Pair-State aus `terminalStore`, lädt Candles und reicht Render-State weiter.
- Empty-State bedeutet "kein Pair", "keine Daten" oder "Provider nicht erreichbar", nicht generierte Chartdaten.

- [ ] Schritt 1: Fehlenden Test schreiben: Ohne Provider-Daten werden keine Candles intern erzeugt.
- [ ] Schritt 2: Fehlenden Test schreiben: übergebene Candles werden gerendert.
- [ ] Schritt 3: Render-Komponente refaktorisieren.
- [ ] Schritt 4: Stateful Wrapper mit API-Fetch ergänzen.
- [ ] Schritt 5: Component-Tests ausführen.
- [ ] Schritt 6: `/terminal` im Browser mit Provider-Ausfall und bei verfügbarer Env mit Provider-Daten prüfen.

## 4. Phase 3 - Quick Amounts real verdrahten

### Erwartetes Verhalten

Quick-Amount-Buttons berechnen ausschließlich aus echter spendierbarer Balance:

- Buy-Seite nutzt `terminalStore.balances.quote`.
- Sell-Seite nutzt `terminalStore.balances.base`.
- Betrag = `balance * percentage / 100`.
- Wenn Balance fehlt, lädt, ungültig ist oder die Wallet getrennt ist, sind Buttons disabled.
- Disabled-State kommuniziert "Balance nicht geladen" oder äquivalente Produktkopie.
- Kein Platzhalter-Maximum `100`.

### Task 3.1: Balance-basierte Quick-Amount-Berechnung

**Dateien:**

- Ändern: `src/components/terminal/QuickAmountButtons.tsx`
- Optional ändern: `src/components/terminal/OrderForm.tsx`
- Test: `tests/terminal/QuickAmountButtons.spec.tsx`

- [ ] Schritt 1: Fehlenden Test schreiben: Quote-Balance `200.00`, Buy-Seite, `25%` setzt `50.00`.
- [ ] Schritt 2: Fehlenden Test schreiben: Base-Balance `4.5`, Sell-Seite, `50%` setzt `2.25`.
- [ ] Schritt 3: Fehlenden Test schreiben: fehlende Balance disabled alle Quick-Amount-Buttons.
- [ ] Schritt 4: Balance-Selectoren und dezimal sichere Berechnung implementieren.
- [ ] Schritt 5: Accessible disabled Label oder Tooltip ergänzen.
- [ ] Schritt 6: Fokussierte Component-Tests ausführen.
- [ ] Schritt 7: `pnpm typecheck` ausführen.

### Task 3.2: Store-Boundary prüfen

**Dateien:**

- Nur falls nötig ändern: `src/lib/state/terminalStore.ts`
- Test: `tests/unit/terminalStore.test.ts`

Umsetzungsabsicht:

- Bestehende `balances.base`, `balances.quote` und `balances.loading` bevorzugen.
- Keine zweite Balance-Quelle einführen, solange bestehender Store ausreicht.
- Falls Dezimalpräzision einen Helper braucht, kleinen pure Helper mit Unit-Test ergänzen.

- [ ] Schritt 1: Bestätigen, dass aktueller Store genügend State liefert.
- [ ] Schritt 2: Helper-Test ergänzen, falls Berechnung extrahiert wird.
- [ ] Schritt 3: Store-API stabil halten, außer Tests belegen eine Lücke.

## 5. Phase 4 - Quote/Swap Runtime-Gate

### Runtime-Grenzen

- Quote läuft backend-only über `GET /api/quote`.
- Swap-Transaktionskonstruktion läuft backend-only über `POST /api/swap`.
- Wallet-Signatur passiert ausschließlich über echten Wallet-Adapter in der App-Runtime.
- `E2EMockWalletAdapter` bleibt nur erlaubt, wenn `VITE_E2E_WALLET_MOCK=1` oder ein explizites Test-Runtime-Flag gesetzt ist.
- Keine Implementierung darf `HELIUS_API_KEY`, `JUPITER_PLATFORM_FEE_ACCOUNT`, Wallet-Private-Keys oder andere Runtime-Secrets in `VITE_*` ablegen.

### Env-/Secret-Runbook-Punkte

Erforderlich für lokale Real-Provider-Verifikation:

- `backend/.env` oder Shell-Env enthält `HELIUS_API_KEY`.
- `JUPITER_PLATFORM_FEE_ACCOUNT` ist ein echter, owner-approved Fee-Account.
- `JUPITER_BASE_URL` ist aus dem Backend-Runtime-Host erreichbar.
- Netzwerk/DNS kann `quote-api.jup.ag` oder die konfigurierte Provider-Base-URL auflösen.
- Frontend nutzt weiter `/api` und Vite-Proxy; Provider-Secrets werden nicht an das Frontend geleakt.

### Task 4.1: Provider Preflight Gate

**Dateien:**

- Neu: `backend/src/lib/trading/providerPreflight.ts`
- Optional ändern: `backend/src/routes/health.ts`, falls Upstream-Status freigegeben wird
- Test: `backend/tests/integration/health-upstreams.spec.ts`

- [ ] Schritt 1: Test für fehlenden `JUPITER_PLATFORM_FEE_ACCOUNT` schreiben, wenn Fee-Basis-Punkte größer null sind.
- [ ] Schritt 2: Test für DNS-/Netzwerkfehler-Klassifikation schreiben.
- [ ] Schritt 3: Wiederverwendbares Preflight-Ergebnis ohne Secret-Logging implementieren.
- [ ] Schritt 4: Status in `/api/health/upstreams` oder dokumentiertem Terminal-Preflight-Endpunkt sichtbar machen.
- [ ] Schritt 5: Backend-Health-Tests ausführen.

### Task 4.2: Quote/Swap E2E-Grenzen

**Dateien:**

- Nur Tests ändern: bestehende Playwright-/E2E-Tests nach nächster Repo-Konvention
- Wallet-Runtime-Verhalten nicht erweitern, außer um bestehendes Gating zu prüfen

- [ ] Schritt 1: Env-gated Browser-Test ergänzen: skip, wenn echte Provider-Env oder DNS fehlt.
- [ ] Schritt 2: Browser-Assertion ergänzen: ohne Wallet darf Quote laden, Swap bleibt disabled.
- [ ] Schritt 3: Browser-Assertion ergänzen: Test-Wallet-Mock ist nur mit explizitem E2E-Flag aktiv.
- [ ] Schritt 4: Test-Logging unterscheidet skipped Provider-Gate von passed Provider-Gate.

## 6. Phase 5 - Tests und Gates

### Unit

- Discover:
  - API-Ausfall gibt keinen Mock zurück.
  - Leere API-Antwort erzeugt keine Mock-Tokens.
  - Provider-unavailable State wird an UI-Schicht weitergegeben.

- Quick Amounts:
  - Prozentrechnung nutzt echte Quote-/Base-Balance.
  - Fehlende Balance deaktiviert Buttons.
  - Dezimalstrings erzeugen keine ungültigen Amount-Werte.

- Chart:
  - `ChartPanel` rendert übergebene Candles.
  - `ChartPanel` erzeugt keine Candles intern.
  - Candle-Service unwrappt kanonischen Envelope und verarbeitet Provider-Fehler.

### Backend

- `/api/discover/tokens`:
  - Provider-Ausfall liefert owner-approved Unavailable-State.
  - Provider-Erfolg mappt Token-Liste.
  - Keine `TOK###`-Daten werden bei Provider-Ausfall zurückgegeben.

- `/api/chart/candles`:
  - Query wird validiert.
  - Response erfüllt `InputCandle { ts, open, high, low, close, volume }`.
  - Provider-Ausfall liefert klaren Status oder Error.

- Provider Preflight:
  - Fehlende Env wird als unavailable klassifiziert.
  - DNS-/Netzwerkfehler werden nicht als Pass gemeldet.
  - Kein Secret-Wert erscheint in Logs oder Error-Details.

### Browser

- `/terminal` ohne Provider:
  - Discover zeigt "Provider nicht erreichbar".
  - Chart zeigt Provider-unavailable oder No-Data-State.
  - Keine Fake-Token-Cards und keine Fake-Candles erscheinen.

- `/terminal` mit Provider:
  - Quote lädt über echtes Backend/Jupiter, wenn DNS und Env verfügbar sind.
  - Chart rendert echte Candles, wenn gewählter Provider verfügbar ist.
  - Swap bleibt durch echte Wallet-Autorität gated.

### Env-gated

- Tests mit echten Providern skippen sauber, wenn Secrets oder Netzwerk fehlen.
- Ein geskipptes Provider-Gate darf nicht als grüne Provider-Verifikation zusammengefasst werden.
- `ENOTFOUND`, Timeout oder fehlendes Secret erzeugt `SKIPPED` oder `FAIL` nach Testtyp, niemals stillen Fallback.

## 7. Reihenfolge der Umsetzung

1. Error-/Provider-State Contracts dokumentieren.
2. Discover-Mocks entfernen und UI-Fail-State ergänzen.
3. Quick-Amounts Placeholder entfernen.
4. Chart Backend Contract und Service einführen.
5. `ChartPanel` von Mock-Erzeugung entkoppeln.
6. Provider-Env-Gate und Tests ergänzen.
7. Erst danach echte Quote/Swap-End-to-End-Verifikation durchführen.

Begründung:

- Discover Fail-closed entfernt zuerst sichtbar irreführende Marktdaten.
- Quick Amounts können mit bestehendem Balance-State korrigiert werden und blockieren nicht auf Provider-Auswahl.
- Chart-Candles brauchen eine Owner-Entscheidung zum Provider; Contract und fail-closed Endpoint können vorher vorbereitet werden.
- Quote/Swap darf erst als echt verifiziert gelten, wenn Runtime-Env und Netzwerk nachgewiesen sind.

## 8. Risiken / Stop Conditions

Implementierung stoppen und Owner-Review anfordern, wenn einer dieser Punkte eintritt:

- Externe Provider sind aus der Runtime nicht erreichbar.
- Chart-Provider ist nicht entschieden.
- Env/Secrets fehlen.
- Error-UI fehlt.
- Provider-Ausfall würde sonst eine leere, fake oder irreführende UI erzeugen.
- Shared- oder HTTP-Contract würde ohne Doku/Test brechen.
- Wallet-/Swap-Flows würden ohne explizite Wallet-Autorität erweitert.
- Tests benötigen echte Secrets, können aber nicht sauber skippen.
- Ein Codepfad verlangt Secrets in `VITE_*`.
- Automatisierte Verifikation würde einen echten Trade ausführen.

## 9. Verifikation für diesen Plan-Slice

Für diesen docs-only Slice ausführen:

```bash
git diff --check docs/superpowers/plans/2026-05-21-terminal-real-wiring.md
pnpm doc:check
```

Zusätzlicher sinnvoller Check für ungetrackte neue Datei:

```bash
git diff --no-index --check /dev/null docs/superpowers/plans/2026-05-21-terminal-real-wiring.md
```

`pnpm verify` ist für diesen Slice nur dann passend, wenn der Owner bewusst den breiten Full-Gate über Backend-Install, Backend-Build, Backend-Tests, Frontend-Build, Vitest und weitere Checks verlangt. Für den docs-only Slice ist `pnpm verify` standardmäßig zu breit und darf begründet geskippt werden.

## 10. Ergänzende Verifikationskommandos für spätere Implementierung

Discover Slice:

```bash
pnpm typecheck
pnpm exec vitest run tests/integration/discover-terminal.integration.test.tsx
pnpm -C backend run test -- discover-tokens
```

Quick Amounts Slice:

```bash
pnpm exec vitest run tests/terminal/QuickAmountButtons.spec.tsx
pnpm typecheck
```

Chart Slice:

```bash
pnpm -C backend run test -- chart-candles
pnpm exec vitest run tests/terminal/ChartPanel.spec.tsx
pnpm typecheck
```

Provider-gated Browser Slice:

```bash
pnpm exec playwright test --grep @terminal-provider
```

Full Gate nach Implementierung und verfügbarer Provider-Env:

```bash
pnpm verify
```

## 11. Plan Self-Review

- Spec-Abdeckung: Scope, Nicht-Scope, Discover, Chart-Candles, Quick Amounts, Quote/Swap Runtime-Gates, Tests, Reihenfolge, Risiken und Stop Conditions sind auf ausführbare Tasks gemappt.
- Placeholder-Scan: Keine offene Implementierungsattrappe wird als Zielzustand verwendet. Provider-Auswahl ist explizit als `Owner decision required` markiert.
- Type-Konsistenz: `InputCandle` nutzt den geforderten Shape `ts`, `open`, `high`, `low`, `close`, `volume`.
- Scope-Check: Dieser Plan ist bewusst mehrphasig; der erste ausführbare Slice ist Discover Fail-closed mit UI-State, nicht das gesamte Real-Wiring-Programm.

## 12. Recommended Next Gate

Kleinster sicherer Implementierungs-Slice:

1. Discover-Unavailable-Contract entscheiden; empfohlen ist `503 PROVIDER_UNAVAILABLE`.
2. `docs/DISCOVER.md` und API-Contract-Notizen aktualisieren.
3. Frontend-Discover-Mock-Fallback entfernen.
4. Backend-Synthetic-Discover-Fallback entfernen.
5. Discover Provider-unavailable UI und Tests ergänzen.

Dieser Slice entfernt Fake-Marktdaten, ohne Wallet-Signing, Quote-/Swap-Ausführung, Chart-Provider-Auswahl oder Production-Deployment zu berühren.

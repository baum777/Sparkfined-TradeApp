## Production Readiness Review (Vercel) — TradeApp

**Datum**: 2026-01-01  
**Scope**: Vercel (Production), Frontend (Vite/React) + Backend (Node/TS) + Service Worker  
**Hard Rule**: Review-only (keine Implementierung).

---

## Executive Summary

**Aktueller Gesamtstatus: NO-GO** für einen sicheren Production-Deploy auf Vercel.

**Top-Blocker (müssen vor Go-Live gelöst werden):**
- **Backend ist nicht Vercel-kompatibel**: es ist als dauerhaft laufender Node-HTTP-Server gebaut (kein Vercel Functions-Entry), nutzt **lokale SQLite-Datei** und führt **Migrations + Cleanup per `setInterval`** aus. Auf Vercel ist das entweder nicht lauffähig oder nicht persistent/sicher.
- **Kein Vercel-Routing/SPA-Fallback konfiguriert**: Es existiert **kein** `vercel.json`. Für React Router braucht es ein **Rewrite auf `index.html`** (sonst 404 auf Deep Links/Refresh). Zusätzlich ist `/api` nicht geroutet.
- **API-Integration ist uneindeutig**: Frontend defaultet auf `VITE_API_URL` oder `"/api"`, aber der **Service Worker hardcodet `"/api"`**. Wenn Backend auf separater Domain läuft, brechen SW-Jobs/Notifications.
- **Frontend TypeScript ist nicht “strict”**: `tsconfig.app.json` hat `"strict": false` und mehrere strenge Checks deaktiviert → erhöhtes Risiko für Runtime-Fehler, besonders bei Refactors.

---

## Status Ampel (Red / Yellow / Green)

| System | Status | Warum | Wichtigste Remediation |
|---|---|---|---|
| Frontend Build (Vite) | **🟡 Yellow** | Build an sich ist standard, aber SPA-Fallback + SW-Cache-Header fehlen | `vercel.json` Rewrites + Headers definieren |
| Frontend Runtime (Routing) | **🔴 Red** | Ohne SPA-Rewrite brechen Deep Links | SPA fallback rewrite |
| Backend (Runtime/Hosting) | **🔴 Red** | Architektur (Server+SQLite+Intervals) passt nicht zu Vercel | Backend-Deployment-Strategie festlegen (Functions vs extern) |
| Datenpersistenz | **🔴 Red** | SQLite-Datei `./.data/*.sqlite` ist auf Vercel nicht persistent | Managed DB wählen (Postgres/…); Migrations-Runbook |
| Auth & Identity | **🔴 Red** | Backend nutzt Bearer-Token als `userId` ohne Verifikation; Frontend speichert Tokens in `localStorage` | Auth-Design + Token Storage Hardening |
| Rate Limiting / Abuse-Schutz | **🔴 Red** | Rate limiting wird nur im TA-Endpoint enforced | Rate-limits in allen API-Routen konsequent anwenden |
| Service Worker / Background Tasks | **🟡 Yellow** | Polling läuft nur, solange Tab offen ist; `/api` hardcoded | Erwartung klar dokumentieren + SW-Config/Headers |
| Observability (Logs/Tracing) | **🟡 Yellow** | Console-Logs vorhanden, aber Request-ID ist global (nicht async-sicher) | Async-sichere Request-Context-Lösung (z.B. AsyncLocalStorage) |
| CI / Qualitätsgates | **🟢 Green** (für Frontend) | CI führt Lint/TS-Check/Build/E2E aus, Node 20 | Sicherstellen, dass Vercel-Deploy nur nach grünem CI passiert |

---

## A) Build & CI (Ist-Zustand + Risiken)

### Erwartete Versionen
- **Node.js**: **20.x** (CI setzt `node-version: '20'`)  
  - **Betroffene Dateien**: `.github/workflows/ci.yml`, `.github/workflows/pr-checks.yml`, `.github/workflows/deploy.yml`
- **Package Manager**: **npm** (Lockfiles: `package-lock.json`, `backend/package-lock.json`)  
  - **Wichtig**: Es gibt **kein** `pnpm-lock.yaml`. Die Frage nach pnpm/pnpm-lock ist aktuell **nicht anwendbar**; wenn ihr pnpm standardisieren wollt, muss das bewusst umgestellt werden (inkl. Lockfile + CI/Vercel Settings).

### CI-Gating (was existiert, was fehlt)
- **Vorhanden**:
  - ESLint + Typecheck + Build in CI
  - Playwright E2E Tests (Chromium/Firefox Matrix)
- **Risiko/Gap**:
  - Vercel-Deploy ist nicht in CI integriert; `deploy.yml` ist derzeit placeholder (keine echte Vercel-Action).
  - Prettier ist optional und non-blocking (ok, aber Style Drift möglich).

### TypeScript Striktheit
- **Frontend**: `tsconfig.app.json` hat `"strict": false` und mehrere Checks deaktiviert.  
  - **Impact**: Type-safety niedriger → mehr Risiko für Production-only Bugs (Null/undefined, falsche Payloads, unhandled cases).
  - **Remediation**:
    - **[ ]** Striktheit schrittweise erhöhen (mindestens `strictNullChecks` aktivieren), mit klarer Migration-Strategie.
    - **[ ]** CI so konfigurieren, dass Typecheck in Production-Mode repräsentativ ist.
- **Backend**: `backend/tsconfig.json` ist **strict** (gut).

### Vercel Build/Install/Output (konkret)
- **Install Command (empfohlen)**: `npm ci`
- **Build Command (empfohlen)**: `npm run build`
- **Output Directory**: `dist`
- **Spezialfall Service Worker**: `vite.config.ts` baut `src/sw/service-worker.ts` als separaten Rollup-Entry und schreibt `sw.js` in die Root von `dist`.  
  - **Production-Risiko**: `sw.js` darf nicht “immutable” gecacht werden; sonst bleiben Clients auf alten SW-Versionen hängen.

### Build Cache (Vercel)
- **Befund**: Keine Vercel-spezifische Cache-Konfiguration im Repo.
- **Impact**: Vercel nutzt Standard-Caching (Dependencies/build output), was ok ist — aber **`sw.js`** benötigt explizit fail-safe Headers (siehe Vercel Config).

---

## B) Vercel Configuration (Ist: fehlt)

### Befund
- **Kein** `vercel.json` im Repo.

### Impact
- **Routing**:
  - React Router Deep Links (z.B. `/settings`, `/journal/...`) können auf Vercel als 404 enden, wenn kein SPA-Fallback gesetzt ist.
- **API**:
  - `/api/*` Requests laufen auf Vercel ins Leere, falls kein Backend als Vercel Functions existiert und kein Rewrite zu externer API gesetzt ist.
- **Service Worker**:
  - Ohne explizite Header kann `sw.js` unerwünscht gecacht werden.

### Remediation (konkret)
- **[ ]** `vercel.json` hinzufügen mit:
  - **SPA Fallback Rewrite** (alle non-file Routen → `/index.html`)
  - **/api Rewrite** (entweder zu Vercel Functions oder zu externer Backend-URL)
  - **Headers**:
    - `sw.js`: `Cache-Control: no-cache, no-store, must-revalidate` (fail-safe)
    - Security Headers (CSP/HSTS/…; siehe Security-Sektion)

### Explizite Antworten (Edge/Serverless)
- **Was läuft als Edge?**: Aktuell **nichts** (keine Vercel Edge Functions im Repo).
- **Was läuft als Serverless?**: Aktuell **nichts** (keine `/api` Vercel Functions).
- **Cold-start Risiken?**: Wenn das Backend auf Vercel Functions portiert würde:
  - **hoch**, da DB-Init/Migrations/SQLite/Native Addons (better-sqlite3) typischerweise Cold-Start + Build-Komplexität erhöhen.

### Cron Jobs / Region / Limits (explizit)
- **Cron Jobs**: Aktuell **keine** Vercel Cron Konfiguration im Repo (und Backend-Jobs laufen derzeit via `setInterval`, was in Vercel-Umgebungen nicht verlässlich ist).
- **Region**: Nicht konfiguriert (Risk: unklare Latenz/Compliance).
- **Max Execution Time / Memory**: Nicht konfiguriert; bei Functions muss das bewusst gewählt werden (insb. für teure Endpoints wie TA).

---

## C) Environment Variables (Inventar + Lücken)

### Frontend (Vite Build-Time)
Gefunden/benutzt:
- `VITE_API_URL` (API Base URL, Default `/api`)
- `VITE_ENABLE_DEV_NAV` (Feature Flag)

In `.env.example` zusätzlich dokumentiert (teils optional):
- `VITE_ENABLE_ANALYTICS`
- `VITE_APP_VERSION`
- `VITE_SENTRY_DSN` (optional)
- `VITE_ANALYTICS_ID` (optional)

**Risiko**:
- Service Worker nutzt `VITE_API_URL` (Build-time) bzw. fallback `"/api"` (`src/sw/sw-alerts.ts`, `src/sw/sw-oracle.ts`).  
  - **Impact**: Wenn Backend nicht same-origin unter `/api` läuft und `VITE_API_URL` nicht korrekt gesetzt ist, funktionieren SW Polling/Notifications nicht (Routing/CORS).
  - **Remediation**: Architektur-Entscheid treffen:
    - **Option A (fail-safe)**: Backend same-origin `/api` via Vercel rewrite/proxy (empfohlen; dann `VITE_API_URL="/api"`).
    - **Option B**: `VITE_API_URL` direkt auf externe API setzen und CORS/Auth sauber lösen.

### Backend (Runtime)
Env-Schema definiert:
- `NODE_ENV` (`development` | `test` | `production`, default `development`)
- `BACKEND_PORT` (default `3000`)
- `API_BASE_PATH` (default `'/api'`)
- `DATABASE_URL` (default `sqlite:./.data/tradeapp.sqlite`)
- `LOG_LEVEL` (`debug` | `info` | `warn` | `error`, default `info`)

**Risiko (Vercel)**:
- Default `DATABASE_URL` zeigt auf lokale Datei → auf Vercel **nicht persistent**.

---

## D) Backend Production Safety (Error Handling, Logging, Rate Limits, Idempotency, Timeouts)

### Architektur-Fit zu Vercel
**Befund**: Backend startet als eigener HTTP-Server (`createServer(...).listen(...)`) und führt beim Start:
- DB init (`initDatabase(...)`)
- Migration Runner (`runMigrations(...)`)
- Cleanup Jobs via `setInterval(...)`

**Impact**:
- Vercel ist primär für **Serverless Functions / Edge Functions** oder statische Frontends. Ein dauerhaft laufender Serverprozess ist dort i.d.R. **nicht der richtige Deployment-Mechanismus**.
- Migrations + Intervals auf “Server Start” sind in Serverless-Kontexten **nicht deterministisch** und können mehrfach laufen / gar nicht laufen.

**Betroffene Bereiche**:
- `backend/src/server.ts`
- `backend/src/db/sqlite.ts`, `backend/src/db/migrate.ts`

**Remediation (konkret)**:
- **[ ]** Deployment-Topologie final festlegen:
  - **Option 1**: Backend **extern** hosten (Railway/Fly/Render/K8s), Vercel nur Frontend; `/api` via Rewrite/Proxy.
  - **Option 2**: Backend zu **Vercel Functions** umbauen (jede Route als Function; kein `listen()`, keine `setInterval` Jobs).
- **[ ]** Migrations als eigener Schritt (Runbook) definieren (vor Deploy oder per kontrolliertem Job), nicht “on boot”.

### Error Handling Konsistenz
**Befund**:
- Standardisierte Error-Responses existieren (`AppError`, `sendError`, `handleError`).
- `handleError` loggt unerwartete Fehler via `console.error('Unexpected error:', error)`.

**Risiko**:
- `handleError` gibt bei unknown errors `error.message` zurück → kann interne Details leaken, wenn Exceptions sensitive Inhalte tragen.

**Remediation**:
- **[ ]** In Production: unknown errors immer als generische Message ausgeben (z.B. `"Internal server error"`) und Details nur serverseitig loggen.

### Logging / PII Safety
**Befund**:
- Logger ist “structured-ish” und schreibt auf stdout/stderr.
- Request-IDs werden als globaler Zustand gehalten.

**Risiko**:
- **Request-ID ist global** (`currentRequestId`), nicht async-kontext-sicher → kann bei parallelen Requests falsche IDs loggen.

**Remediation**:
- **[ ]** AsyncLocalStorage (oder gleichwertig) für Request Context nutzen.
- **[ ]** Log-Richtlinie schriftlich festlegen: keine Tokens/PII in Logs (inkl. Error objects).

### Rate Limits
**Befund**:
- Rate limiter existiert, ist aber nur in `POST /api/chart/ta` aktiv.

**Impact**:
- Alle anderen Endpoints sind ohne Rate-Limit → DoS-/Kosten-/Spam-Risiko (z.B. `/api/alerts/events`, `/api/journal`).

**Betroffene Bereiche**:
- `backend/src/http/rateLimit.ts`
- `backend/src/routes/*` (hauptsächlich `alerts.ts`, `journal.ts`, `oracle.ts`)

**Remediation**:
- **[ ]** Rate limits pro Route konsistent enforce (entsprechend `docs/backend/API_SPEC.md`).
- **[ ]** Für Production: “in-memory Map” ist pro Instance → für verteilte Deployments ineffektiv. Redis/Upstash/… als shared store einplanen (fail-safe).

### Idempotency
**Befund**:
- Journal Create liest `idempotency-key` als **Query Parameter** (nicht Header), und verwendet es direkt als `id`.

**Impact**:
- Spec erwähnt `Idempotency-Key` Header; aktuelle Umsetzung ist inkonsistent.
- Wenn Clients denselben idempotency key wiederverwenden, erzeugt `INSERT` ohne `OR IGNORE`/Upsert bei Duplicate-ID vermutlich 500 (je nach Schema).

**Betroffene Bereiche**:
- `backend/src/routes/journal.ts`
- `backend/src/domain/journal/repo.ts`

**Remediation**:
- **[ ]** Eindeutig festlegen: Header vs Query; Production: **Header** bevorzugen.
- **[ ]** Idempotency-Strategie dokumentieren (Key-Scope, TTL, conflict behavior).

### Auth / Identity / Multi-Tenancy
**Befund**:
- `userId` wird aus `Authorization: Bearer ...` extrahiert, ohne Token-Verifikation; Token wird direkt als `userId` genutzt.

**Impact**:
- Jeder kann `Authorization: Bearer <beliebig>` senden und Daten in “anderen user scopes” beeinflussen → **kritisches Security-Problem** für Production.

**Betroffene Bereiche**:
- `backend/src/http/router.ts`
- Oracle Read State: `oracle_read_state_v1` keyed by `user_id` (wird so manipulierbar)

**Remediation**:
- **[ ]** Auth-Mechanismus definieren (JWT/OAuth/session) + Verifikation serverseitig.
- **[ ]** Threat model: “unauthenticated” darf nur nicht-sensitive Demo-Daten sehen; Writes müssen Auth erzwingen.

### “Runaway” / Double-Emit Risiken (Alerts)
**Befund**:
- Alert Evaluator existiert, ist aber **nicht** an irgendeinen Scheduler/Endpoint gebunden.
- Alert Events werden persistiert, ohne globales dedupe (eventId ist randomUUID).

**Impact**:
- In Production fehlt derzeit ein kontrollierter Job/Trigger, um Alerts überhaupt auszulösen.
- Falls später ein Scheduler hinzugefügt wird, kann er bei falscher Implementierung Events spam-emittieren (insb. “progress” Events).

**Remediation**:
- **[ ]** Explizite Trigger-Architektur: Vercel Cron → API route → evaluator (mit dedupe) ODER externes Worker-System.
- **[ ]** Dedupe serverseitig definieren (z.B. stable keys, stage transitions einmalig).

---

## E) Service Worker & Background Tasks

### Polling Frequenz & Ressourcen
**Befund**:
- UI sendet `SW_TICK` alle **30s** solange Tab offen ist (`src/main.tsx`).
- SW pollt Alerts/Oracle mit Backoff/Jitter (Interval-Defaults aus `sw-contracts`).

**Impact**:
- **Kein echtes Background-Polling** wenn Tab geschlossen ist. Notifications kommen nur, wenn Nutzer die App offen hat (oder später Push implementiert wird).

### Explizite Antworten
- **Was passiert beim Tab schließen?**  
  - `setInterval` in UI stoppt → SW erhält keine `SW_TICK` mehr → Polling stoppt faktisch.
- **Was passiert beim Browser-Neustart?**  
  - SW wird erst nach Seiten-Load registriert; ohne UI offen keine Polls.
- **Was passiert bei Network-Flaps?**  
  - SW Scheduler erhöht Backoff; bei 429 wird `Retry-After` respektiert; bei 401/403 wird `authRequired` gesetzt.

### Production-Risiken
- SW nutzt `API_BASE = '/api'` (hardcoded) → bricht, wenn Backend nicht same-origin geroutet ist.
- SW Logs via `console.log` (ok für Debug, aber Produktion kann noisy sein).

### Remediation
- **[ ]** Erwartung dokumentieren: “SW Alerts sind foreground-only (v1)”.
- **[ ]** Vercel Headers für `sw.js` setzen (no-cache).
- **[ ]** Wenn Backend external: SW-API-Origin-Konzept festlegen (inkl. CORS + Auth).

---

## F) Security & Privacy

### Token Storage (Frontend)
**Befund**:
- Frontend Auth-Service speichert `accessToken` und `refreshToken` in `localStorage`.

**Impact**:
- Bei XSS können Tokens exfiltriert werden → Session Hijack.

**Remediation**:
- **[ ]** Für Production: HttpOnly Secure Cookies (oder gleichwertig) bevorzugen; wenn localStorage unvermeidlich, CSP + XSS-hardening + kurze TTL + Rotation.

### XSS / Dangerous HTML
**Befund**:
- Kein explizites Rendering von untrusted HTML in den gelesenen Files sichtbar; vollständiger Audit erfordert gezielte Suche nach `dangerouslySetInnerHTML`/Markdown Renderer.

**Remediation**:
- **[ ]** Repo-scan: `dangerouslySetInnerHTML`, Markdown renderer, `innerHTML` usage → sanitize.

### CORS / Same-Origin
**Befund**:
- Backend setzt permissive CORS nur in Dev (`Access-Control-Allow-Origin: *`), in Prod gar nicht.

**Impact**:
- Wenn Backend nicht same-origin, werden Browser-Requests geblockt (CORS), SW ebenfalls.

**Remediation**:
- **[ ]** Production CORS-Policy definieren: allowlist konkreter Origins, keine Wildcards mit Credentials.

### Security Headers (Vercel)
**Befund**:
- Keine zentrale Konfiguration (kein `vercel.json`).

**Remediation (Minimum v1)**:
- **[ ]** CSP (mindestens default-src 'self', script-src 'self' + Vite needs prüfen)
- **[ ]** HSTS (nur wenn HTTPS garantiert)
- **[ ]** X-Content-Type-Options: nosniff
- **[ ]** Referrer-Policy
- **[ ]** Permissions-Policy

---

## G) Observability & Ops

### Vercel Log Visibility
- Console logs erscheinen in Vercel Runtime Logs (für Functions) bzw. Build Logs (für Build).

### Minimum Logging v1 (empfohlen)
- **[ ]** Request-id pro Request korrekt (async-safe)
- **[ ]** Structured logs (JSON) für Errors
- **[ ]** Error rate + latency Monitoring (Sentry/OTel optional, aber mindestens ein Error Tracker)

### Post-launch (nicht blocking, aber dringend)
- **[ ]** Dashboards: p95 latency, 4xx/5xx, rate-limit hits, SW polling failures
- **[ ]** Alert “spam” Monitor: event throughput pro userId/symbol

---

## H) Release & Rollback Strategy

### Staging vs Production
**Befund**:
- `deploy.yml` ist placeholder; es gibt keine echte Vercel staging/prod Pipeline.

**Remediation (konkret)**
- **[ ]** Zwei Vercel Environments:
  - Preview Deployments (PRs) = staging-like
  - Production Deployments (main/tag) = prod
- **[ ]** Env Vars strikt trennen (Preview vs Production).
- **[ ]** Smoke Tests nach Deploy (mindestens: `/`, `/settings`, `/api/health` wenn API vorhanden).

### Rollback
- **Vercel**: Rollback ist i.d.R. “Promote previous deployment”.
- **Daten-Persistenz**:
  - Wenn Backend/DB Schema migriert wurde, braucht es **forward-only migrations** oder einen “down migration” Plan.

**Checklist**:
- **[ ]** Rollback-Runbook dokumentieren (wer, wie, wann; inkl. DB-Migrations).
- **[ ]** “Data compatibility” Policy: App-Versionen müssen mit DB-Schema N und N-1 funktionieren (mindestens).

---

## GO / NO-GO Entscheidung

**Entscheidung: NO-GO**.

**Begründung (konkret):**
- Ohne `vercel.json` sind SPA-Routing und `sw.js` Cache-Semantik nicht abgesichert.
- Ohne klares Backend-Deployment (same-origin `/api` oder extern + rewrites) wird die App funktional brechen (API 404/CORS).
- Backend ist aktuell nicht sicher multi-tenant und nicht production-authenticated (Bearer token == userId).
- Datenpersistenz ist auf lokale SQLite-Datei ausgelegt (nicht production-tauglich auf Vercel).

---

## Final Question — Was würde bei Deploy “heute” am ehesten zuerst brechen, und warum?

**Am wahrscheinlichsten bricht zuerst jede API-Nutzung**: Frontend und Service Worker rufen per Default `"/api"` auf, aber auf Vercel gibt es aktuell **keine** `/api` Functions und **kein** Rewrite/Proxy (`vercel.json` fehlt). Ergebnis: **404/Network errors**, dadurch leere Daten, fehlende CRUD-Funktionen und keine SW-Notifications.

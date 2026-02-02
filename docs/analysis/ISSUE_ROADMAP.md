# Issue Roadmap: TradeApp Repository Gap-Closing

**Erstellt von**: Claude 4.5  
**Datum**: 2. Februar 2026  
**Branch**: `cursor/claude-4-5-prompt-optimierung-a56a`  
**Basis**: REPOSITORY_ANALYSIS.md

---

## Übersicht

Diese Roadmap enthält **27 priorisierte Tasks** zur Schließung der Gaps zwischen Ist-Zustand und Soll-Zustand. Jeder Task ist vollständig spezifiziert mit:

- **Issue-Titel** (GitHub-ready)
- **Beschreibung** (Problem, Kontext, Zielzustand)
- **Akzeptanzkriterien** / Definition of Done
- **Betroffene Dateien/Module**
- **Labels** (Kategorie, Priorität, Bereich)
- **PR-Strategie** (Neuer PR vs. Redesign)

---

## Prioritäten-Legende

- **P0**: Production-Blocker (KRITISCH)
- **P1**: Kritisch für Stabilität/Security
- **P2**: Wichtig für Production Quality
- **P3**: Technical Debt / Nice-to-have

## Kategorien

- **Bug**: Fehlfunktion im bestehenden Code
- **Tech-Debt**: Code-Qualität, Refactoring
- **Feature**: Neue Funktionalität
- **Docs**: Dokumentation
- **Refactor**: Code-Umstrukturierung
- **CI/CD**: Build/Deploy/Tests
- **Security**: Sicherheits-Lücken

---

## Meta-Übersicht

| Kategorie | Anzahl | P0 | P1 | P2 | P3 |
|-----------|--------|----|----|----|----|
| Bug | 5 | 2 | 2 | 1 | 0 |
| Tech-Debt | 7 | 1 | 3 | 2 | 1 |
| Feature | 6 | 1 | 2 | 3 | 0 |
| Security | 4 | 3 | 1 | 0 | 0 |
| Refactor | 3 | 1 | 1 | 1 | 0 |
| CI/CD | 1 | 0 | 1 | 0 | 0 |
| Docs | 1 | 0 | 0 | 0 | 1 |
| **GESAMT** | **27** | **8** | **10** | **7** | **2** |

---

# P0 - Production Blocker (8 Issues)

## Issue #1: Backend-Architektur finalisieren und dokumentieren

**Kategorie**: Refactor  
**Priorität**: P0 (Kritisch)  
**Bereich**: Backend, Architecture  
**PR-Strategie**: Neuer PR

### Problem

Aktuell existieren **drei parallele Backend-Implementierungen** im Repository:
1. `backend/` - Always-on Node Server (SQLite, Intervals)
2. `api/` - Vercel Serverless Functions (KV Store)
3. `apps/backend-alerts/` - Separater Alerts Service (Express + Postgres)

Diese haben **unterschiedliche Response-Envelopes**, Auth-Mechanismen und Deployment-Targets. Die Production-Ownership ist unklar, was zu **Contract Drift** führt.

### Kontext

Gemäß `BACKEND_ARCHITECTURE_CURRENT.md` und `vercel.json` soll:
- `backend/` das **kanonische Backend** sein (Railway-Deployment)
- `/api/*` wird per Rewrite auf `<YOUR_RAILWAY_DOMAIN>` geroutet
- `api/` ist eine alternative Implementierung (Tests + Vercel Functions Option)

Jedoch fehlt eine **klare, schriftliche Entscheidung** im Code/Docs.

### Zielzustand

- **Ein kanonisches Backend** für Production definiert
- Deployment-Target dokumentiert (Railway für `backend/`)
- Alternative Backends (wenn behalten) als solche markiert
- `vercel.json` mit **finaler Railway-URL** (kein Placeholder)

### Akzeptanzkriterien

- [ ] `docs/backend/BACKEND_OWNERSHIP.md` erstellt mit finaler Entscheidung
- [ ] `vercel.json`: `<YOUR_RAILWAY_DOMAIN>` ersetzt durch echte Railway-URL
- [ ] README.md aktualisiert: Production Backend = `backend/` (Railway)
- [ ] CI/CD: Deploy-Workflow für Railway (falls noch nicht vorhanden)
- [ ] Env Var Mapping dokumentiert (Frontend → Vercel, Backend → Railway)

### Betroffene Dateien

- `/workspace/vercel.json`
- `/workspace/README.md`
- `/workspace/docs/backend/BACKEND_OWNERSHIP.md` (NEU)
- `/workspace/.github/workflows/deploy.yml` (optional, falls Railway Deploy automatisiert werden soll)

### Labels

- `refactor`, `P0`, `backend`, `architecture`, `documentation`

---

## Issue #2: Response Envelope Unifikation (Backend ↔ Frontend)

**Kategorie**: Bug  
**Priorität**: P0 (Kritisch)  
**Bereich**: Backend, Frontend, API  
**PR-Strategie**: Neuer PR

### Problem

**Contract Drift** bei Success-Responses:
- `backend/` nutzt: `{ status: "ok", data: T }`
- `api/` nutzt: `{ data: T, status: number, message?: string }`
- Frontend `ApiClient` erwartet: `{ data: T, status?: number, message?: string }` ODER Rohdaten (Raw Mode)

Dies führt zu **Inkompatibilität** zwischen Backend und Frontend, insbesondere wenn Frontend zwischen Backends wechselt.

### Kontext

Gemäß `shared/docs/API_CONTRACTS.md` wurde entschieden:
```typescript
// Kanonisches Envelope
Success: { status: "ok", data: T }
Error:   { error: { code, message, details?, requestId } }
```

### Zielzustand

- **Alle Backends** nutzen das kanonische Envelope
- **Frontend `ApiClient`** parst `{ status: "ok", data: T }` konsistent
- **Keine Raw Mode** Exceptions (oder klar dokumentiert)

### Akzeptanzkriterien

- [ ] `backend/`: Alle Responses nutzen `{ status: "ok", data: T }` ✅ (bereits implementiert)
- [ ] `api/`: Response-Envelope auf `{ status: "ok", data: T }` umstellen (wenn `api/` behalten wird)
- [ ] `src/services/api/client.ts`: Envelope-Parsing auf `status: "ok"` umstellen
- [ ] Alle API-Services im Frontend testen (Journal, Alerts, Oracle, TA)
- [ ] Unit Tests für `ApiClient` mit neuem Envelope
- [ ] Error-Envelope bleibt unverändert: `{ error: {...} }`

### Betroffene Dateien

- `/workspace/src/services/api/client.ts`
- `/workspace/api/_lib/response.ts` (falls `api/` behalten wird)
- `/workspace/src/services/journal/index.ts`
- `/workspace/src/services/alerts/index.ts`
- `/workspace/src/services/oracle/index.ts`
- Tests in `/workspace/src/services/**/*.test.ts` (falls vorhanden)

### Labels

- `bug`, `P0`, `backend`, `frontend`, `api`, `breaking-change`

---

## Issue #3: Database Migration: SQLite → Postgres (Production)

**Kategorie**: Feature  
**Priorität**: P0 (Kritisch)  
**Bereich**: Backend, Infrastructure  
**PR-Strategie**: Neuer PR

### Problem

`backend/` nutzt **SQLite** als Default-Datenbank (`DATABASE_URL=sqlite:./.data/tradeapp.sqlite`). SQLite ist:
- **Nicht persistent** auf Container-Restarts (Railway: OK mit Volume, Vercel: NICHT möglich)
- **Nicht skalierbar** (keine Multi-Instance)
- **Production-Risiko**: Single Point of Failure

### Kontext

Gemäß `PRODUCTION_READINESS_REVIEW.md` ist SQLite ein **NO-GO für Production**. Railway unterstützt Postgres als Managed Service.

### Zielzustand

- **Postgres** als Production-Datenbank (Railway Postgres oder Neon/PlanetScale)
- Migrations laufen **idempotent** und **sicher** (forward-only)
- SQLite bleibt für **Local Dev** (optional)
- `DATABASE_URL` Env Var bestimmt DB-Typ

### Akzeptanzkriterien

- [ ] `backend/src/db/postgres.ts` erstellt (analog zu `sqlite.ts`)
- [ ] Migrations-Runner unterstützt Postgres (`better-sqlite3` → `pg`)
- [ ] `backend/src/db/index.ts` wählt DB-Adapter basierend auf `DATABASE_URL` Schema
- [ ] Railway Postgres Service konfiguriert (oder Neon/Supabase)
- [ ] Migrations in CI/CD Pipeline integriert (vor Deploy)
- [ ] Rollback-Strategie dokumentiert
- [ ] `README.md` + `docs/production/ENVIRONMENT_VARIABLES.md` aktualisiert

### Betroffene Dateien

- `/workspace/backend/src/db/postgres.ts` (NEU)
- `/workspace/backend/src/db/index.ts`
- `/workspace/backend/src/db/migrate.ts`
- `/workspace/backend/package.json` (Dependencies: `pg`, `@types/pg`)
- `/workspace/docs/production/DATABASE_MIGRATION.md` (NEU - Runbook)
- `/workspace/.github/workflows/deploy.yml` (Migration Step)

### Labels

- `feature`, `P0`, `backend`, `database`, `infrastructure`

---

## Issue #4: Auth-Verifikation implementieren (JWT Signature Check)

**Kategorie**: Security  
**Priorität**: P0 (Kritisch)  
**Bereich**: Backend, Security  
**PR-Strategie**: Neuer PR

### Problem

`backend/src/http/auth.ts` extrahiert Bearer-Token und nutzt es **direkt als `userId`** ohne Verifikation:

```typescript
// backend/src/http/auth.ts
const token = authHeader.replace('Bearer ', '');
userId = token; // ❌ KEINE SIGNATUR-PRÜFUNG
```

**Impact**: Jeder kann `Authorization: Bearer <beliebig>` senden und sich als beliebiger User ausgeben → **Kritische Security-Lücke**.

### Kontext

`api/_lib/auth/jwt.ts` implementiert JWT-Verifikation korrekt. `backend/` muss dasselbe Level erreichen.

### Zielzustand

- **JWT Signature Verification** in `backend/`
- `userId` wird aus **verifiziertem** Token extrahiert (`sub` Claim)
- Ungültige/abgelaufene Tokens führen zu `401 UNAUTHORIZED`
- Anon-Modus (ohne Token) bleibt möglich für Dev (`userId = "anon"`)

### Akzeptanzkriterien

- [ ] `backend/src/lib/auth/jwt.ts` implementiert `verifyToken(token: string): { sub: string, ... }`
- [ ] `backend/src/http/auth.ts` nutzt `verifyToken()` und extrahiert `userId = payload.sub`
- [ ] Ungültige Tokens → `401` mit Error Code `UNAUTHORIZED`
- [ ] `JWT_SECRET` Env Var erforderlich in Production
- [ ] Unit Tests für JWT Verify (valid, invalid, expired)
- [ ] Integration Tests für Auth-protected Endpoints

### Betroffene Dateien

- `/workspace/backend/src/lib/auth/jwt.ts` (erweitern oder neu erstellen basierend auf `api/_lib/auth/jwt.ts`)
- `/workspace/backend/src/http/auth.ts`
- `/workspace/backend/src/config/env.ts` (JWT_SECRET)
- `/workspace/backend/tests/unit/auth.spec.ts` (NEU)
- `/workspace/backend/tests/integration/auth-protected.spec.ts` (NEU)

### Labels

- `security`, `P0`, `backend`, `authentication`

---

## Issue #5: Token Storage Security (localStorage → HttpOnly Cookies)

**Kategorie**: Security  
**Priorität**: P0 (Kritisch)  
**Bereich**: Frontend, Security  
**PR-Strategie**: Neuer PR

### Problem

Frontend speichert `accessToken` und `refreshToken` in **localStorage** (`src/services/auth/auth.service.ts`):

```typescript
localStorage.setItem('access_token', tokens.accessToken);
localStorage.setItem('refresh_token', tokens.refreshToken);
```

**Impact**: Bei XSS können Tokens exfiltriert werden → **Session Hijack**.

### Kontext

Gemäß `PRODUCTION_READINESS_REVIEW.md` ist localStorage für Tokens ein **Security-Risiko**. Best Practice: HttpOnly Secure Cookies (oder alternative sichere Lösung wie SessionStorage + kurze TTL).

### Zielzustand

- **HttpOnly Secure Cookies** für Tokens (empfohlen)
- ODER: Alternative Lösung mit kurzer TTL + CSP + XSS-Hardening
- Frontend liest Token nicht mehr aus localStorage
- Backend setzt Cookie bei Login/Refresh

### Akzeptanzkriterien

- [ ] Backend: Login-Endpoint setzt `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict`
- [ ] Backend: Refresh-Endpoint setzt neues Cookie
- [ ] Frontend: `auth.service.ts` entfernt localStorage-Zugriffe
- [ ] Frontend: API-Requests inkludieren Cookies automatisch
- [ ] CORS: `Access-Control-Allow-Credentials: true` (mit konkrete Origin, kein `*`)
- [ ] Docs: Security-Policy dokumentiert
- [ ] E2E Tests: Login → Cookie → API Call

### Betroffene Dateien

- `/workspace/backend/src/routes/auth.ts` (NEU oder vorhanden, Login/Refresh Endpoints)
- `/workspace/src/services/auth/auth.service.ts`
- `/workspace/src/services/api/client.ts` (Credentials: include)
- `/workspace/backend/src/server.ts` (CORS Config)
- `/workspace/docs/production/SECURITY_POLICY.md` (NEU)

### Labels

- `security`, `P0`, `frontend`, `backend`, `authentication`

---

## Issue #6: Vercel Rewrite URL konfigurieren (Railway Domain)

**Kategorie**: Bug  
**Priorität**: P0 (Kritisch)  
**Bereich**: Deployment, Config  
**PR-Strategie**: Neuer PR

### Problem

`vercel.json` enthält Placeholder-URL:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://<YOUR_RAILWAY_DOMAIN>/api/$1" }
  ]
}
```

**Impact**: Alle `/api/*` Requests führen ins Leere → **Funktionale Blocker**.

### Kontext

Railway-Backend muss deployed sein, bevor diese URL eingetragen werden kann. Für Dev/Staging kann eine separate Railway-Instance genutzt werden.

### Zielzustand

- **Production**: `vercel.json` enthält finale Railway-URL
- **Preview/Staging**: Separate Env Var für Staging-Backend (oder conditional Rewrite)
- CI/CD: Vercel-Deploy erst nach Backend-Deploy

### Akzeptanzkriterien

- [ ] Railway-Backend deployed (Issue #1)
- [ ] Railway-URL in `vercel.json` eingetragen (z.B. `https://tradeapp-backend-production.up.railway.app`)
- [ ] Env Var `VERCEL_BACKEND_URL` in Vercel konfiguriert (falls dynamisch)
- [ ] Vercel Preview Deploys nutzen Staging-Backend (optional)
- [ ] CI/CD: Deploy-Workflow aktualisiert (Backend → Frontend)
- [ ] Smoke Test nach Deploy: `/api/health` erreichbar

### Betroffene Dateien

- `/workspace/vercel.json`
- `/workspace/.github/workflows/deploy.yml`
- `/workspace/docs/production/DEPLOYMENT_RUNBOOK.md` (NEU - Deploy-Reihenfolge)

### Labels

- `bug`, `P0`, `deployment`, `config`, `vercel`, `railway`

---

## Issue #7: Alert Evaluator Scheduler implementieren

**Kategorie**: Feature  
**Priorität**: P0 (Kritisch)  
**Bereich**: Backend, Alerts  
**PR-Strategie**: Neuer PR

### Problem

Der Alert Evaluator existiert (`backend/src/domain/alerts/evaluator.ts`), hat aber **keinen Trigger/Scheduler**. Alerts werden daher **nie ausgelöst**.

```typescript
// backend/src/domain/alerts/evaluator.ts
export function evaluateAlerts() { ... }

// ❌ Nirgends aufgerufen!
```

### Kontext

Gemäß `BACKEND_MASTER_CHECKLIST.md` muss ein Cron Job oder Endpoint den Evaluator triggern (z.B. alle 1-5 Minuten).

### Zielzustand

- **Scheduled Job** (Cron) triggert Alert Evaluator
- Frequenz: 1-5 Minuten (konfigurierbar)
- Dedupe: Events werden nur einmal emittiert (via IDs)
- Monitoring: Log-Output bei Evaluation

### Akzeptanzkriterien

- [ ] `backend/src/jobs/alertEvaluator.job.ts` erstellt
- [ ] Job in `backend/src/jobs/scheduler.ts` registriert (Interval: 2 Minuten)
- [ ] Evaluator-Logik nutzt deterministische Zeit (Testbarkeit)
- [ ] Alert Events werden in DB persistiert (`alert_events` Tabelle)
- [ ] Unit Tests: Evaluator mit Fixtures
- [ ] Integration Tests: Evaluator → Events
- [ ] Monitoring: Log-Output "Evaluated X alerts, emitted Y events"

### Betroffene Dateien

- `/workspace/backend/src/jobs/alertEvaluator.job.ts` (NEU)
- `/workspace/backend/src/jobs/scheduler.ts`
- `/workspace/backend/src/domain/alerts/evaluator.ts`
- `/workspace/backend/migrations/005_alert_events.sql` (falls Tabelle fehlt)
- `/workspace/backend/tests/unit/alert-evaluator.spec.ts` (NEU)
- `/workspace/backend/tests/integration/alert-evaluation.spec.ts` (NEU)

### Labels

- `feature`, `P0`, `backend`, `alerts`, `scheduler`

---

## Issue #8: Response Envelope in `backend/` prüfen und absichern

**Kategorie**: Tech-Debt  
**Priorität**: P0 (Kritisch)  
**Bereich**: Backend  
**PR-Strategie**: Neuer PR

### Problem

`backend/src/http/response.ts` implementiert `{ status: "ok", data }`, aber nicht alle Routen nutzen die Helper-Funktion konsistent. Einige Endpoints könnten **raw JSON** zurückgeben.

### Kontext

Gemäß `API_SPEC.md` muss **jede Success-Response** das Envelope `{ status: "ok", data: T }` nutzen.

### Zielzustand

- **Alle Routen** nutzen `sendSuccess(res, data)`
- **Keine raw JSON Responses** in Production
- TypeScript-Types erzwingen Envelope (wo möglich)

### Akzeptanzkriterien

- [ ] Audit aller Routes in `backend/src/routes/*`: Nutzen alle `sendSuccess()`?
- [ ] Falls nicht: Refactor zu `sendSuccess()`
- [ ] Integration Tests: Assertieren Envelope-Shape für alle Endpoints
- [ ] TypeScript: Rückgabetyp `ApiResponse<T>` erzwingen (wo möglich)
- [ ] CI: Lint-Regel oder Test-Guardrail gegen raw Responses

### Betroffene Dateien

- `/workspace/backend/src/routes/**/*.ts` (alle Route-Handler)
- `/workspace/backend/tests/integration/**/*.spec.ts` (Envelope-Assertions)
- `/workspace/backend/src/http/response.ts` (ggf. erweitern)

### Labels

- `tech-debt`, `P0`, `backend`, `api`, `testing`

---

# P1 - Kritisch für Stabilität (10 Issues)

## Issue #9: Frontend → Backend Migration (Stubs durch API ersetzen)

**Kategorie**: Feature  
**Priorität**: P1 (Hoch)  
**Bereich**: Frontend, Backend  
**PR-Strategie**: Mehrere PRs (pro Feature: Journal, Alerts, Oracle)

### Problem

Frontend nutzt **Stubs** statt Backend-API:
- Journal: `useJournalStub()` → localStorage
- Alerts: `useAlertsStore()` → localStorage
- Oracle: `useOracleStub()` → Mock-Daten

**Impact**: Backend-API ist funktionslos, Daten nicht persistent über Devices.

### Kontext

Gemäß `BACKEND_MASTER_CHECKLIST.md` Sektion 8.1: UI muss Backend-API konsumieren, keine Stub-Hooks.

### Zielzustand

- **Journal**: `src/pages/Journal.tsx` nutzt API (`/api/journal`)
- **Alerts**: `src/components/alerts/` nutzt API (`/api/alerts`)
- **Oracle**: `src/pages/Oracle.tsx` nutzt API (`/api/oracle/daily`)
- **Read-State**: Backend-persistiert statt localStorage
- **Error-Handling**: UI zeigt Backend-Errors korrekt

### Akzeptanzkriterien

- [ ] **Journal**:
  - [ ] `src/services/journal/index.ts` erstellt (API-Calls)
  - [ ] `useJournalStub()` durch `useJournal()` ersetzt
  - [ ] CRUD-Operationen via API (Create, Confirm, Archive, Delete)
  - [ ] Deep Link `?entry=...` via API-Fetch
- [ ] **Alerts**:
  - [ ] `src/services/alerts/index.ts` erweitert (API-Calls)
  - [ ] `useAlertsStore()` nutzt API statt localStorage
  - [ ] Alert Events konsumiert (`/api/alerts/events`)
- [ ] **Oracle**:
  - [ ] `src/services/oracle/index.ts` erstellt
  - [ ] Daily Feed via API (`/api/oracle/daily`)
  - [ ] Read-State via API (`PUT /api/oracle/read-state`)
- [ ] **Error-Handling**: Error-Banner zeigen Backend-Errors
- [ ] **E2E Tests**: Playwright-Tests gegen echtes Backend

### Betroffene Dateien

- `/workspace/src/pages/Journal.tsx`
- `/workspace/src/components/alerts/useAlertsStore.ts`
- `/workspace/src/pages/Oracle.tsx`
- `/workspace/src/services/journal/index.ts` (NEU)
- `/workspace/src/services/alerts/index.ts`
- `/workspace/src/services/oracle/index.ts` (NEU)
- `/workspace/playwright/tests/backend-*.spec.ts` (NEU - Backend-connected E2E)

### Labels

- `feature`, `P1`, `frontend`, `backend`, `integration`

---

## Issue #10: Rate Limiting auf allen Endpoints implementieren

**Kategorie**: Security  
**Priorität**: P1 (Hoch)  
**Bereich**: Backend, Security  
**PR-Strategie**: Neuer PR

### Problem

Aktuell hat nur `/api/chart/ta` ein Rate Limit (10 req/min). Alle anderen Endpoints sind **ungeschützt** gegen:
- DoS/Spam
- Abuse (z.B. Alert-Spam)
- Kosten-Explosion (bei externen API-Calls)

### Kontext

Gemäß `API_SPEC.md` haben alle Endpoints Rate-Limits definiert:
- Journal: 60 req/min
- Alerts: 60 req/min
- Oracle: 30 req/min
- TA: 10 req/min

### Zielzustand

- **Alle Endpoints** haben Rate Limits
- Limits sind **konfigurierbar** (Env Var oder Config)
- `429 TOO_MANY_REQUESTS` mit `Retry-After` Header
- Monitoring: Log-Output bei Rate Limit Hit

### Akzeptanzkriterien

- [ ] `backend/src/http/rateLimit.ts` erweitert: Middleware `rateLimit(limit: number, window: number)`
- [ ] Rate Limits in `backend/src/app.ts` auf alle Routes angewendet:
  - [ ] Journal: 60/min
  - [ ] Alerts: 60/min
  - [ ] Oracle: 30/min
  - [ ] TA: 10/min (bereits vorhanden)
  - [ ] Reasoning/LLM: 10/min
- [ ] `429` Response mit `Retry-After` Header (Sekunden)
- [ ] Unit Tests: Rate Limit Hit → 429
- [ ] Integration Tests: Rate Limit per Endpoint

### Betroffene Dateien

- `/workspace/backend/src/http/rateLimit.ts`
- `/workspace/backend/src/app.ts`
- `/workspace/backend/tests/unit/rate-limit.spec.ts` (NEU)
- `/workspace/backend/tests/integration/rate-limit.spec.ts` (NEU)

### Labels

- `security`, `P1`, `backend`, `rate-limiting`

---

## Issue #11: CORS Policy Hardening (Allowlist statt Wildcard)

**Kategorie**: Security  
**Priorität**: P1 (Hoch)  
**Bereich**: Backend, Security  
**PR-Strategie**: Neuer PR

### Problem

`backend/src/server.ts` setzt in Dev-Modus:

```typescript
res.setHeader('Access-Control-Allow-Origin', '*');
```

In Production ist CORS **nicht gesetzt** → Requests von Frontend werden geblockt (falls nicht same-origin).

### Kontext

Gemäß `PRODUCTION_READINESS_REVIEW.md` ist permissive CORS ein **Security-Risiko**. Empfohlen: Allowlist mit konkreten Origins.

### Zielzustand

- **Production**: CORS Allowlist mit konkreten Origins (z.B. `https://tradeapp.vercel.app`)
- **Dev**: `http://localhost:8080` (Vite Dev Server)
- **Credentials**: `Access-Control-Allow-Credentials: true` (für Cookies)
- **Keine Wildcards** (`*`) mit Credentials

### Akzeptanzkriterien

- [ ] `backend/src/config/env.ts`: `CORS_ALLOWED_ORIGINS` Env Var (komma-separiert)
- [ ] `backend/src/server.ts`: CORS-Middleware nutzt Allowlist
- [ ] Origin-Check: Request Origin in Allowlist → `Access-Control-Allow-Origin: <origin>`
- [ ] Nicht erlaubte Origin → `403 FORBIDDEN`
- [ ] `Access-Control-Allow-Credentials: true` (für Cookie-Auth)
- [ ] Unit Tests: CORS mit allowed/disallowed Origins
- [ ] Docs: `ENVIRONMENT_VARIABLES.md` aktualisiert

### Betroffene Dateien

- `/workspace/backend/src/server.ts`
- `/workspace/backend/src/config/env.ts`
- `/workspace/backend/tests/unit/cors.spec.ts` (NEU)
- `/workspace/docs/production/ENVIRONMENT_VARIABLES.md`

### Labels

- `security`, `P1`, `backend`, `cors`

---

## Issue #12: Service Worker Polling aktivieren und testen

**Kategorie**: Feature  
**Priorität**: P1 (Hoch)  
**Bereich**: Frontend, Service Worker  
**PR-Strategie**: Neuer PR

### Problem

Service Worker Polling ist **implementiert**, aber **deaktiviert**:
- `VITE_ENABLE_SW_POLLING` Env Var fehlt oder ist `false`
- `SW_TICK` wird nur gesendet, wenn Tab offen ist

**Impact**: Background-Tasks (Alerts/Oracle Polling) funktionieren nicht.

### Kontext

Gemäß `SW_SPEC.md` soll SW im Hintergrund Alerts/Oracle pollen und Notifications anzeigen.

### Zielzustand

- **SW Polling aktiviert** (Feature Flag `VITE_ENABLE_SW_POLLING=true`)
- **Backend-Integration getestet** (SW → Backend API)
- **Dedupe funktioniert** (IDB Storage)
- **Notifications** werden angezeigt (Browser Permission erforderlich)

### Akzeptanzkriterien

- [ ] `.env.production`: `VITE_ENABLE_SW_POLLING=true`
- [ ] `src/main.tsx`: `SW_TICK` wird gesendet (alle 30s)
- [ ] `src/sw/service-worker.ts`: Polling läuft (Backoff/Jitter)
- [ ] Backend-Endpoints (`/api/alerts/events`, `/api/oracle/daily`) erreichbar
- [ ] IDB Storage: Dedupe funktioniert (keine Duplicate Notifications)
- [ ] Browser Notifications: Permissions-Request + Anzeige
- [ ] E2E Test: SW registriert → Poll → Notification (manuell testbar)
- [ ] Docs: `docs/frontend/SW_USAGE.md` (User Guide)

### Betroffene Dateien

- `/workspace/.env.production` (VITE_ENABLE_SW_POLLING)
- `/workspace/src/main.tsx`
- `/workspace/src/sw/service-worker.ts`
- `/workspace/src/sw/sw-scheduler.ts`
- `/workspace/docs/frontend/SW_USAGE.md` (NEU)

### Labels

- `feature`, `P1`, `frontend`, `service-worker`, `notifications`

---

## Issue #13: Backend Unit Tests ergänzen (Validation, State Machines)

**Kategorie**: CI/CD  
**Priorität**: P1 (Hoch)  
**Bereich**: Backend, Tests  
**PR-Strategie**: Mehrere PRs (pro Modul)

### Problem

`backend/tests/unit/` hat nur **2 Test-Files** (`budgetGate.test.ts`, `grokPulse.test.ts`). Im Vergleich: `api/tests/unit/` hat **umfangreiche Tests**.

**Impact**: Niedrige Test-Coverage → Regressions-Risiko.

### Kontext

Gemäß `TEST_PLAN.md` Sektion 2 müssen folgende Unit Tests existieren:
- Validation Schemas (Zod)
- Error Mapping + Request IDs
- State Machines (Alerts)
- TA Generator (Determinism)

### Zielzustand

- **Validation Tests**: Zod-Schemas für alle Request Bodies
- **Error Mapping Tests**: AppError → ErrorResponse
- **State Machine Tests**: TWO_STAGE, DEAD_TOKEN
- **TA Tests**: Determinismus + Golden Fixtures

### Akzeptanzkriterien

- [ ] **Validation**:
  - [ ] `backend/tests/unit/validation.spec.ts` (NEU)
  - [ ] Tests für Journal, Alerts, Oracle Request-Schemas
- [ ] **Error Handling**:
  - [ ] `backend/tests/unit/errors.spec.ts` (NEU)
  - [ ] Tests für `handleError()`, Request ID Propagation
- [ ] **State Machines**:
  - [ ] `backend/tests/unit/alert-state-machines.spec.ts` (NEU)
  - [ ] TWO_STAGE: 2-of-3, Expiry, Cooldown
  - [ ] DEAD_TOKEN: Stages, Session Max 12h
- [ ] **TA Generator**:
  - [ ] `backend/tests/unit/ta-determinism.spec.ts` (NEU)
  - [ ] Golden Fixtures: Gleiche Inputs → Gleicher Output
- [ ] **Coverage**: `npm run test:coverage` zeigt > 80% für getestete Module

### Betroffene Dateien

- `/workspace/backend/tests/unit/validation.spec.ts` (NEU)
- `/workspace/backend/tests/unit/errors.spec.ts` (NEU)
- `/workspace/backend/tests/unit/alert-state-machines.spec.ts` (NEU)
- `/workspace/backend/tests/unit/ta-determinism.spec.ts` (NEU)
- `/workspace/backend/src/validation/schemas.ts`
- `/workspace/backend/src/http/error.ts`
- `/workspace/backend/src/domain/alerts/*Machine.ts`
- `/workspace/backend/src/domain/ta/taGenerator.ts`

### Labels

- `tech-debt`, `P1`, `backend`, `tests`, `unit-tests`

---

## Issue #14: E2E Tests mit Backend (Playwright + API Integration)

**Kategorie**: CI/CD  
**Priorität**: P1 (Hoch)  
**Bereich**: Frontend, Backend, Tests  
**PR-Strategie**: Neuer PR

### Problem

Aktuelle E2E Tests (`playwright/tests/`) nutzen **Stubs** statt echtes Backend. Nach Issue #9 (Frontend-Backend-Migration) müssen E2E Tests **gegen echtes Backend** laufen.

### Kontext

Gemäß `TEST_PLAN.md` Sektion 4: E2E muss UI + Backend zusammen testen.

### Zielzustand

- **Playwright** startet Backend + Frontend (oder nutzt Staging-Backend)
- **Tests** erstellen Daten via API, prüfen UI-Anzeige
- **Teardown** räumt Test-Daten auf

### Akzeptanzkriterien

- [ ] `playwright.config.ts`: `webServer` startet Backend (`backend/`) + Frontend (Vite)
- [ ] Oder: Tests nutzen Staging-Backend (Env Var `API_URL`)
- [ ] **Journal E2E**:
  - [ ] Test: Create Entry via UI → API POST → UI zeigt Entry
  - [ ] Test: Deep Link `?entry=...` → UI scrollt + highlightet
- [ ] **Alerts E2E**:
  - [ ] Test: Create Alert → API POST → UI zeigt Alert Card
  - [ ] Test: Toggle Pause → API PATCH → Status ändert sich
- [ ] **Oracle E2E**:
  - [ ] Test: Load Daily Feed → API GET → UI zeigt Takeaway + Insights
  - [ ] Test: Toggle Read → API PUT → Read-State persistiert
- [ ] **Teardown**: Tests räumen Daten auf (DELETE API Calls)
- [ ] CI: E2E Tests laufen gegen Test-DB (nicht Production)

### Betroffene Dateien

- `/workspace/playwright.config.ts`
- `/workspace/playwright/tests/backend-journal.spec.ts` (NEU)
- `/workspace/playwright/tests/backend-alerts.spec.ts` (NEU)
- `/workspace/playwright/tests/backend-oracle.spec.ts` (NEU)
- `/workspace/.github/workflows/ci.yml` (E2E Job mit Backend)

### Labels

- `tech-debt`, `P1`, `frontend`, `backend`, `tests`, `e2e`

---

## Issue #15: Idempotency-Key Standardisierung (Query → Header)

**Kategorie**: Bug  
**Priorität**: P1 (Mittel)  
**Bereich**: Backend  
**PR-Strategie**: Neuer PR

### Problem

`backend/src/routes/journal.ts` liest Idempotency-Key als **Query Parameter** (`req.url`), nicht als **Header**:

```typescript
const url = new URL(req.url!, `http://${req.headers.host}`);
const idempotencyKey = url.searchParams.get('idempotency-key');
```

Gemäß `API_SPEC.md` soll `Idempotency-Key` als **HTTP Header** gesendet werden.

### Kontext

Best Practice: Idempotency-Key als Header (wie `api/_lib/handler.ts`).

### Zielzustand

- **Idempotency-Key** als HTTP Header (`req.headers['idempotency-key']`)
- Backward-Compatibility: Query Param optional akzeptieren (Deprecation Warning)
- TTL: 24h (gemäß Spec)

### Akzeptanzkriterien

- [ ] `backend/src/routes/journal.ts`: Liest `req.headers['idempotency-key']`
- [ ] Falls Query Param vorhanden: Log-Warning "Deprecated: Use Header instead"
- [ ] Idempotency-Store: Key → Entry-ID Mapping (TTL 24h)
- [ ] Replay (gleicher Key + gleicher Body) → 200 mit bestehender Entry
- [ ] Conflict (gleicher Key + anderer Body) → 409 mit Error Code `IDEMPOTENCY_CONFLICT`
- [ ] Unit Tests: Idempotency mit Header
- [ ] Integration Tests: Replay + Conflict

### Betroffene Dateien

- `/workspace/backend/src/routes/journal.ts`
- `/workspace/backend/src/domain/journal/repo.ts` (Idempotency-Store)
- `/workspace/backend/tests/integration/journal-idempotency.spec.ts` (NEU)

### Labels

- `bug`, `P1`, `backend`, `api`, `idempotency`

---

## Issue #16: Error Message Sanitization (Production Mode)

**Kategorie**: Security  
**Priorität**: P1 (Mittel)  
**Bereich**: Backend  
**PR-Strategie**: Neuer PR

### Problem

`backend/src/http/error.ts` `handleError()` gibt bei unknown Errors `error.message` zurück:

```typescript
sendError(res, 500, 'INTERNAL_ERROR', error.message);
```

**Impact**: Bei Exceptions mit sensitiven Infos (DB-Pfade, API-Keys, etc.) werden diese **geleakt**.

### Kontext

Gemäß `PRODUCTION_READINESS_REVIEW.md`: Unknown Errors müssen **generisch** sein in Production.

### Zielzustand

- **Production**: Unknown Errors → `"Internal server error"` (keine Details)
- **Dev**: Details für Debugging
- **Server Logs**: Volle Error-Details (inkl. Stack Trace)

### Akzeptanzkriterien

- [ ] `backend/src/http/error.ts`: `handleError()` prüft `NODE_ENV`
- [ ] Production (`NODE_ENV=production`): `message = "Internal server error"`
- [ ] Dev/Test: `message = error.message` (wie bisher)
- [ ] Server Logs: `logger.error()` mit Full Error (Stack Trace)
- [ ] Unit Tests: handleError in Production Mode
- [ ] Integration Tests: Unknown Error → Generische Message

### Betroffene Dateien

- `/workspace/backend/src/http/error.ts`
- `/workspace/backend/tests/unit/errors.spec.ts`

### Labels

- `security`, `P1`, `backend`, `error-handling`

---

## Issue #17: Request ID Async-Safety (AsyncLocalStorage)

**Kategorie**: Tech-Debt  
**Priorität**: P1 (Niedrig)  
**Bereich**: Backend  
**PR-Strategie**: Neuer PR

### Problem

`backend/src/http/requestId.ts` nutzt **globale Variable** `currentRequestId`:

```typescript
let currentRequestId: string | null = null;

export function setRequestId(id: string) {
  currentRequestId = id;
}

export function getRequestId(): string | null {
  return currentRequestId;
}
```

**Impact**: Bei parallelen Requests kann Request-ID **verwechselt** werden → Log-Confusion.

### Kontext

Best Practice: Node.js `AsyncLocalStorage` für Request-Context.

### Zielzustand

- **AsyncLocalStorage** für Request-ID Storage
- **Async-safe**: Jeder Request hat eigene Request-ID in Logs
- **Backward-Compatible**: `getRequestId()` API bleibt gleich

### Akzeptanzkriterien

- [ ] `backend/src/http/requestId.ts`: `AsyncLocalStorage<RequestContext>` implementiert
- [ ] `requestId` in Context gespeichert statt global
- [ ] Logger nutzt `getRequestId()` aus Context
- [ ] Unit Tests: Parallele Requests → Korrekte Request-IDs
- [ ] Integration Tests: Request-ID in Logs

### Betroffene Dateien

- `/workspace/backend/src/http/requestId.ts`
- `/workspace/backend/src/observability/logger.ts`
- `/workspace/backend/tests/unit/request-context.spec.ts` (NEU)

### Labels

- `tech-debt`, `P1`, `backend`, `logging`, `async`

---

## Issue #18: Caching Headers konsistent setzen (gemäß Spec)

**Kategorie**: Bug  
**Priorität**: P1 (Niedrig)  
**Bereich**: Backend  
**PR-Strategie**: Neuer PR

### Problem

Cache-Control Headers sind **inkonsistent** oder fehlen:
- `API_SPEC.md` definiert Caching-Regeln (z.B. Oracle: `max-age=300`)
- `backend/` setzt teils keine Headers, teils falsche

### Kontext

Caching verbessert Performance und reduziert Backend-Load.

### Zielzustand

- **Alle Endpoints** setzen Cache-Control gemäß `API_SPEC.md`
- Oracle Daily: `Cache-Control: public, max-age=300` (5 min)
- TA: `Cache-Control: private, max-age=300`
- Journal: `Cache-Control: no-store`

### Akzeptanzkriterien

- [ ] `backend/src/http/response.ts`: `sendSuccess()` akzeptiert `cacheControl` Option
- [ ] Alle Routen setzen korrekten Cache-Control Header:
  - [ ] `/api/oracle/daily`: `public, max-age=300`
  - [ ] `/api/chart/ta`: `private, max-age=300`
  - [ ] `/api/journal`: `no-store`
  - [ ] `/api/alerts`: `no-store`
- [ ] Integration Tests: Assert Cache-Control Headers
- [ ] Docs: Caching-Policy dokumentiert

### Betroffene Dateien

- `/workspace/backend/src/http/response.ts`
- `/workspace/backend/src/routes/oracle.ts`
- `/workspace/backend/src/routes/ta.ts`
- `/workspace/backend/src/routes/journal.ts`
- `/workspace/backend/tests/integration/caching.spec.ts` (NEU)
- `/workspace/docs/backend/CACHING_POLICY.md` (NEU)

### Labels

- `bug`, `P1`, `backend`, `performance`, `caching`

---

# P2 - Wichtig für Production Quality (7 Issues)

## Issue #19: Golden Fixtures für deterministische Tests (TA, Alerts)

**Kategorie**: Tech-Debt  
**Priorität**: P2 (Mittel)  
**Bereich**: Backend, Tests  
**PR-Strategie**: Neuer PR

### Problem

Gemäß `TEST_PLAN.md` Sektion 1 sollen **Golden Fixtures** existieren für:
- TA Reports (gleiche Inputs → gleiche Outputs)
- Alert Scenarios (SIMPLE, TWO_STAGE, DEAD_TOKEN)

Aktuell fehlen diese.

### Kontext

Golden Fixtures sichern **Determinismus** und **Regression-Detection**.

### Zielzustand

- **TA Fixtures**: JSON-Files mit Input + Expected Output
- **Alert Fixtures**: Szenarien mit deterministischer Zeit + Market Data
- Tests laufen gegen Fixtures (keine Live-Daten)

### Akzeptanzkriterien

- [ ] `/workspace/backend/tests/fixtures/ta/` (NEU)
  - [ ] `sol-1h-replay-true.json` (Input + Output)
  - [ ] `btc-15m-replay-false.json`
- [ ] `/workspace/backend/tests/fixtures/alerts/` (NEU)
  - [ ] `simple-above-triggered.json`
  - [ ] `two-stage-confirmed-2of3.json`
  - [ ] `dead-token-awakening-3-stages.json`
- [ ] Unit Tests: TA Generator mit Fixtures
- [ ] Unit Tests: Alert State Machines mit Fixtures
- [ ] Fixtures in Git committed (Source of Truth)

### Betroffene Dateien

- `/workspace/backend/tests/fixtures/ta/*.json` (NEU)
- `/workspace/backend/tests/fixtures/alerts/*.json` (NEU)
- `/workspace/backend/tests/unit/ta-fixtures.spec.ts` (NEU)
- `/workspace/backend/tests/unit/alert-fixtures.spec.ts` (NEU)

### Labels

- `tech-debt`, `P2`, `backend`, `tests`, `fixtures`

---

## Issue #20: Watchlist Sync API implementieren

**Kategorie**: Feature  
**Priorität**: P2 (Mittel)  
**Bereich**: Backend, Frontend  
**PR-Strategie**: Neuer PR

### Problem

Watchlist existiert nur in **localStorage** (`sparkfined_watchlist_v1`). Kein Backend-Sync → **Keine Cross-Device-Synchronisation**.

### Kontext

Gemäß `API_SPEC.md` Sektion 5: Watchlist Sync API ist "BACKEND_TODO" (empfohlen, aber nicht v1).

### Zielzustand

- **Backend-Endpoints**: `GET/PUT/POST/DELETE /api/watchlist`
- **Frontend**: Nutzt API statt nur localStorage
- **Fallback**: localStorage als Offline-Cache

### Akzeptanzkriterien

- [ ] **Backend**:
  - [ ] `GET /api/watchlist` → `{ items: WatchlistItem[] }`
  - [ ] `PUT /api/watchlist` → Full Replace
  - [ ] `POST /api/watchlist/items` → Add Item
  - [ ] `DELETE /api/watchlist/items/:symbol` → Remove Item
- [ ] **Frontend**:
  - [ ] `src/services/watchlist/index.ts` (API-Client)
  - [ ] Watchlist-Page nutzt API + localStorage als Cache
- [ ] **Offline**: Sync-Queue bei Network Failure
- [ ] Integration Tests: CRUD Watchlist via API
- [ ] E2E Test: Add Item → Reload → Item vorhanden

### Betroffene Dateien

- `/workspace/backend/src/routes/watchlist.ts` (NEU)
- `/workspace/backend/src/domain/watchlist/repo.ts` (NEU)
- `/workspace/backend/migrations/006_watchlist.sql` (NEU)
- `/workspace/src/services/watchlist/index.ts` (NEU)
- `/workspace/src/pages/Watchlist.tsx`
- `/workspace/backend/tests/integration/watchlist.spec.ts` (NEU)

### Labels

- `feature`, `P2`, `backend`, `frontend`, `watchlist`

---

## Issue #21: Push Notifications Backend (VAPID + Push in `backend/`)

**Kategorie**: Feature  
**Priorität**: P2 (Mittel)  
**Bereich**: Backend, Service Worker  
**PR-Strategie**: Neuer PR ODER Microservice

### Problem

Push Notifications sind nur in `api/alerts/push/` implementiert (Vercel Functions). Wenn `backend/` (Railway) das kanonische Backend ist, fehlt Push-Support.

### Kontext

SW ist bereit für Push Notifications, aber Backend muss VAPID-Keys + Push API implementieren.

### Zielzustand

- **Option A**: `backend/` implementiert Push (analog zu `api/alerts/push/`)
- **Option B**: `api/alerts/push/` bleibt als **Microservice** (separate Vercel Function)

### Akzeptanzkriterien

- [ ] **Option A (in `backend/`)**:
  - [ ] `POST /api/alerts/push/subscribe` → VAPID Subscription
  - [ ] `POST /api/alerts/push/unsubscribe` → Remove Subscription
  - [ ] `GET /api/alerts/vapidPublicKey` → Public Key
  - [ ] Alert Evaluator triggert Push bei Events
  - [ ] VAPID-Keys in Env Vars (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
- [ ] **Option B (Microservice)**:
  - [ ] `api/alerts/push/` bleibt, Railway-Backend ruft es via Webhook
  - [ ] Dokumentation: Push als Microservice
- [ ] **Frontend**: SW nutzt Push Subscription API
- [ ] E2E Test: Subscribe → Alert Trigger → Push Notification (manuell)

### Betroffene Dateien

- **Option A**:
  - `/workspace/backend/src/routes/push.ts` (NEU)
  - `/workspace/backend/src/domain/push/vapid.ts` (NEU)
  - `/workspace/backend/src/domain/alerts/evaluator.ts` (Push Trigger)
- **Option B**:
  - `/workspace/backend/src/domain/alerts/evaluator.ts` (Webhook zu Vercel Function)
  - `/workspace/docs/backend/PUSH_MICROSERVICE.md` (NEU)

### Labels

- `feature`, `P2`, `backend`, `push-notifications`, `service-worker`

---

## Issue #22: Error Tracking aktivieren (Sentry Integration)

**Kategorie**: Feature  
**Priorität**: P2 (Mittel)  
**Bereich**: Frontend, Backend, Observability  
**PR-Strategie**: Neuer PR

### Problem

`VITE_SENTRY_DSN` ist in `.env.example` dokumentiert, aber **nicht aktiv** im Code.

**Impact**: Production-Errors sind **unsichtbar** → Debugging schwierig.

### Kontext

Sentry ist Standard-Tool für Error Tracking in Web-Apps.

### Zielzustand

- **Frontend**: Sentry SDK initialisiert, Errors werden gesendet
- **Backend**: Sentry SDK initialisiert (optional), Server-Errors gesendet
- **Privacy**: PII-Scrubbing konfiguriert

### Akzeptanzkriterien

- [ ] **Frontend**:
  - [ ] `npm install @sentry/react`
  - [ ] `src/main.tsx`: `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })`
  - [ ] Error Boundary mit Sentry
  - [ ] Test: `throw new Error("Test")` → Sentry Dashboard zeigt Error
- [ ] **Backend** (optional):
  - [ ] `npm install @sentry/node`
  - [ ] `backend/src/server.ts`: `Sentry.init({ dsn: process.env.SENTRY_DSN })`
  - [ ] Error Handler sendet Errors an Sentry
- [ ] **Privacy**: Sentry-Config scrubbt PII (Tokens, Passwords, etc.)
- [ ] Docs: `SENTRY_DSN` in `ENVIRONMENT_VARIABLES.md`

### Betroffene Dateien

- `/workspace/package.json` (Dependency: @sentry/react)
- `/workspace/backend/package.json` (Dependency: @sentry/node)
- `/workspace/src/main.tsx`
- `/workspace/backend/src/server.ts`
- `/workspace/docs/production/ENVIRONMENT_VARIABLES.md`

### Labels

- `feature`, `P2`, `frontend`, `backend`, `observability`, `error-tracking`

---

## Issue #23: Performance Monitoring (Vercel Analytics oder Lightweight APM)

**Kategorie**: Feature  
**Priorität**: P2 (Niedrig)  
**Bereich**: Frontend, Observability  
**PR-Strategie**: Neuer PR

### Problem

Keine Performance-Metriken in Production → **Performance-Regressions** unbemerkt.

### Kontext

Vercel bietet eingebautes Analytics. Alternative: Lightweight APM wie Web Vitals.

### Zielzustand

- **Vercel Analytics** aktiviert (oder Web Vitals SDK)
- **Metriken**: LCP, FID, CLS, TTFB
- **Dashboards**: Vercel Dashboard zeigt Performance

### Akzeptanzkriterien

- [ ] **Option A (Vercel Analytics)**:
  - [ ] Vercel Project Settings: Analytics aktiviert
  - [ ] `npm install @vercel/analytics`
  - [ ] `src/main.tsx`: `import { Analytics } from '@vercel/analytics/react'`
- [ ] **Option B (Web Vitals)**:
  - [ ] `npm install web-vitals`
  - [ ] `src/utils/performance.ts`: Web Vitals Reporting
  - [ ] Send to custom Endpoint oder Logs
- [ ] Lighthouse Score: > 90 (CI-Gate)
- [ ] Docs: Performance-Policy dokumentiert

### Betroffene Dateien

- `/workspace/package.json`
- `/workspace/src/main.tsx`
- `/workspace/src/utils/performance.ts` (NEU, Option B)
- `/workspace/docs/production/PERFORMANCE_POLICY.md` (NEU)

### Labels

- `feature`, `P2`, `frontend`, `observability`, `performance`

---

## Issue #24: TypeScript Striktheit erhöhen (Frontend)

**Kategorie**: Tech-Debt  
**Priorität**: P2 (Niedrig)  
**Bereich**: Frontend  
**PR-Strategie**: Mehrere PRs (schrittweise)

### Problem

`tsconfig.app.json` hat `strict: false` und mehrere Checks deaktiviert:

```json
{
  "strict": false,
  "noUnusedLocals": false,
  "noUnusedParameters": false
}
```

**Impact**: Niedrigere Type-Safety → Runtime-Errors wahrscheinlicher.

### Kontext

Gemäß `PRODUCTION_READINESS_REVIEW.md` ist das ein **Risiko**. Empfohlen: Schrittweise Migration zu `strict: true`.

### Zielzustand

- **Phase 1**: `strictNullChecks: true` (kritisch für Null/Undefined-Safety)
- **Phase 2**: `noUnusedLocals: true`, `noUnusedParameters: true`
- **Phase 3**: `strict: true` (alle Strict-Checks)

### Akzeptanzkriterien

- [ ] **Phase 1**:
  - [ ] `tsconfig.app.json`: `strictNullChecks: true`
  - [ ] TypeScript-Errors fixen (null/undefined Checks)
  - [ ] CI: Build erfolgreich
- [ ] **Phase 2**:
  - [ ] `noUnusedLocals: true`, `noUnusedParameters: true`
  - [ ] Unused Vars entfernen oder mit `_` prefixen
- [ ] **Phase 3**:
  - [ ] `strict: true`
  - [ ] Alle Strict-Errors fixen
  - [ ] CI: Build erfolgreich

### Betroffene Dateien

- `/workspace/tsconfig.app.json`
- `/workspace/src/**/*.ts` (Fixes)
- `/workspace/src/**/*.tsx` (Fixes)

### Labels

- `tech-debt`, `P2`, `frontend`, `typescript`, `code-quality`

---

## Issue #25: Bundle Size Monitoring (Bundle Analyzer + CI)

**Kategorie**: CI/CD  
**Priorität**: P2 (Niedrig)  
**Bereich**: Frontend  
**PR-Strategie**: Neuer PR

### Problem

Kein Bundle-Size-Monitoring → **Bundle-Bloat** unbemerkt.

### Kontext

Bundle-Size beeinflusst Performance (Initial Load Time).

### Zielzustand

- **Bundle Analyzer**: `vite-plugin-visualizer` oder `rollup-plugin-visualizer`
- **CI-Check**: Bundle-Size nicht größer als Threshold (z.B. 500 KB)
- **Dashboard**: Bundle-Size über Zeit

### Akzeptanzkriterien

- [ ] `npm install --save-dev rollup-plugin-visualizer`
- [ ] `vite.config.ts`: Plugin konfiguriert (nur in `npm run build:analyze`)
- [ ] `package.json`: `"build:analyze": "vite build --mode analyze"`
- [ ] CI: Bundle-Size-Check (Threshold 500 KB für Initial Bundle)
- [ ] CI fails bei Überschreitung → PR muss Bundle optimieren
- [ ] Docs: Bundle-Optimization Guide

### Betroffene Dateien

- `/workspace/package.json`
- `/workspace/vite.config.ts`
- `/workspace/.github/workflows/ci.yml` (Bundle-Size-Check)
- `/workspace/docs/frontend/BUNDLE_OPTIMIZATION.md` (NEU)

### Labels

- `tech-debt`, `P2`, `frontend`, `performance`, `ci`

---

# P3 - Technical Debt / Nice-to-have (2 Issues)

## Issue #26: Lighthouse Score Enforcement (CI-Gate)

**Kategorie**: CI/CD  
**Priorität**: P3 (Niedrig)  
**Bereich**: Frontend  
**PR-Strategie**: Neuer PR

### Problem

Lighthouse läuft in CI (`ci.yml`), aber `continue-on-error: true` → **Kein Enforcement**.

### Kontext

Lighthouse Score < 90 indiziert Performance-/Accessibility-Probleme.

### Zielzustand

- **Lighthouse CI** enforced: Score < 90 → CI fails
- **Categories**: Performance, Accessibility, Best Practices, SEO
- **Threshold konfigurierbar**

### Akzeptanzkriterien

- [ ] `.github/workflows/ci.yml`: `continue-on-error: false` (Lighthouse Job)
- [ ] `lighthouserc.json` (NEU): Thresholds definiert
  ```json
  {
    "ci": {
      "assert": {
        "assertions": {
          "categories:performance": ["error", {"minScore": 0.9}],
          "categories:accessibility": ["error", {"minScore": 0.9}]
        }
      }
    }
  }
  ```
- [ ] CI: Lighthouse Score < 90 → Fail
- [ ] Docs: Performance-Budget dokumentiert

### Betroffene Dateien

- `/workspace/.github/workflows/ci.yml`
- `/workspace/lighthouserc.json` (NEU)
- `/workspace/docs/frontend/PERFORMANCE_BUDGET.md` (NEU)

### Labels

- `tech-debt`, `P3`, `frontend`, `ci`, `performance`

---

## Issue #27: Documentation: BACKEND_TODO auflösen

**Kategorie**: Docs  
**Priorität**: P3 (Niedrig)  
**Bereich**: Dokumentation  
**PR-Strategie**: Neuer PR (nach anderen Issues)

### Problem

Code/Docs enthalten viele `BACKEND_TODO` und `TODO` Marker (50+ Files). Diese sind **nicht priorisiert** oder in Roadmap integriert.

### Kontext

TODOs sollten entweder:
- Als Issue erfasst werden
- Gelöscht werden (nicht mehr relevant)
- Klar als "Future Work" markiert werden

### Zielzustand

- **Alle TODOs** auditiert
- **Issues erstellt** für wichtige TODOs (oder in diese Roadmap integriert)
- **Docs aktualisiert**: TODOs entfernt oder als "Future" markiert

### Akzeptanzkriterien

- [ ] `grep -r "BACKEND_TODO\|TODO\|FIXME"` ausgeführt
- [ ] Jedes TODO:
  - [ ] Issue erstellt (falls umsetzbar)
  - [ ] Oder gelöscht (falls nicht mehr relevant)
  - [ ] Oder als `// FUTURE:` umbenannt (mit Kontext)
- [ ] `docs/` ohne offene TODOs (oder alle in Roadmap/Issues)
- [ ] `src/` nur noch TODOs mit Issue-Referenz (z.B. `// TODO #42: ...`)

### Betroffene Dateien

- **Alle Files mit TODOs** (50+, siehe Grep-Output)
- `/workspace/docs/analysis/TODO_AUDIT.md` (NEU - Liste aller TODOs + Status)

### Labels

- `docs`, `P3`, `technical-debt`, `cleanup`

---

# Anhang: PR-Strategie

## Empfohlene PR-Reihenfolge (Abhängigkeiten)

### Phase 1: Foundation (P0 - Woche 1-2)

1. **Issue #1** → Backend-Architektur finalisieren
2. **Issue #3** → Database Migration (SQLite → Postgres)
3. **Issue #4** → Auth-Verifikation
4. **Issue #5** → Token Storage Security
5. **Issue #2** → Response Envelope Unifikation
6. **Issue #6** → Vercel Rewrite URL
7. **Issue #7** → Alert Evaluator Scheduler
8. **Issue #8** → Response Envelope absichern

**Abhängigkeiten**:
- Issue #6 benötigt Issue #1 (Railway-URL)
- Issue #5 benötigt Issue #4 (JWT Verify)
- Issue #2 benötigt Issue #8 (Envelope-Konsistenz)

### Phase 2: Integration (P1 - Woche 3-4)

9. **Issue #9** → Frontend → Backend Migration
10. **Issue #10** → Rate Limiting
11. **Issue #11** → CORS Hardening
12. **Issue #12** → SW Polling aktivieren
13. **Issue #13** → Backend Unit Tests
14. **Issue #14** → E2E Tests mit Backend

**Abhängigkeiten**:
- Issue #9 benötigt Issue #2 (Envelope-Kompatibilität)
- Issue #12 benötigt Issue #9 (Backend-Integration)
- Issue #14 benötigt Issue #9 (Backend-connected UI)

### Phase 3: Stability (P1/P2 - Woche 5)

15. **Issue #15** → Idempotency-Key Standardisierung
16. **Issue #16** → Error Message Sanitization
17. **Issue #17** → Request ID Async-Safety
18. **Issue #18** → Caching Headers

### Phase 4: Features (P2 - Woche 6-7)

19. **Issue #19** → Golden Fixtures
20. **Issue #20** → Watchlist Sync API
21. **Issue #21** → Push Notifications Backend
22. **Issue #22** → Error Tracking (Sentry)
23. **Issue #23** → Performance Monitoring

### Phase 5: Quality (P2/P3 - Optional)

24. **Issue #24** → TypeScript Striktheit
25. **Issue #25** → Bundle Size Monitoring
26. **Issue #26** → Lighthouse Score Enforcement
27. **Issue #27** → Documentation: TODO Cleanup

---

# Zusammenfassung

## Kritischer Pfad (Must-have für Production)

**P0 Issues (8)**: #1-#8  
**Geschätzte Dauer**: 2-3 Wochen (1 Entwickler) oder 1-1.5 Wochen (2 Entwickler)  
**Blocker**: Ohne diese kann nicht deployed werden

## Stabilität (Strongly Recommended)

**P1 Issues (10)**: #9-#18  
**Geschätzte Dauer**: 2-3 Wochen  
**Impact**: Stabilität, Security, Testbarkeit

## Production Quality (Recommended)

**P2 Issues (7)**: #19-#25  
**Geschätzte Dauer**: 1-2 Wochen  
**Impact**: Observability, Performance, Features

## Tech Debt (Optional)

**P3 Issues (2)**: #26-#27  
**Geschätzte Dauer**: 3-5 Tage  
**Impact**: Code-Qualität, Docs

---

**Roadmap erstellt von**: Claude 4.5  
**Basis**: REPOSITORY_ANALYSIS.md  
**Nächste Schritte**: Issues in GitHub anlegen, Labels setzen, Phase 1 starten

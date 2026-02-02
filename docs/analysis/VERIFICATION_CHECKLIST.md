# Verifikations-Checkliste: TradeApp Production Readiness

**Erstellt von**: Claude 4.5  
**Datum**: 2. Februar 2026  
**Basis**: REPOSITORY_ANALYSIS.md + ISSUE_ROADMAP.md

---

## Übersicht

Diese Checkliste dient zur **systematischen Verifikation** der Umsetzung aller Issues aus der Roadmap. Sie ist nach **Phasen** und **Kategorien** gruppiert.

**Legende**:
- ✅ **Abgeschlossen**: Feature implementiert, getestet, dokumentiert
- 🔄 **In Arbeit**: Implementation läuft
- ⏳ **Geplant**: Noch nicht begonnen
- ❌ **Blockiert**: Wartet auf Abhängigkeit

---

# Phase 1: Foundation (P0 - Production Blocker)

## Kategorie: Backend-Architektur

### ✅ Backend-Architektur & Deployment

- [ ] **Backend-Ownership dokumentiert**
  - [ ] `docs/backend/BACKEND_OWNERSHIP.md` existiert
  - [ ] Railway als Production-Target definiert
  - [ ] `api/` als Alternative/Tests markiert
  - [ ] `apps/backend-alerts/` als Microservice dokumentiert

- [ ] **Vercel Rewrite konfiguriert**
  - [ ] `vercel.json`: Railway-URL eingetragen (kein Placeholder)
  - [ ] Vercel Env Var `VERCEL_BACKEND_URL` gesetzt (falls dynamisch)
  - [ ] Smoke Test: `/api/health` erreichbar nach Deploy

- [ ] **Railway Deployment**
  - [ ] Backend auf Railway deployed
  - [ ] Health-Check erfolgreich
  - [ ] Env Vars in Railway konfiguriert
  - [ ] Logs accessible und strukturiert

---

## Kategorie: Database & Persistence

### ✅ Database Migration (SQLite → Postgres)

- [ ] **Postgres Integration**
  - [ ] `backend/src/db/postgres.ts` implementiert
  - [ ] Adapter wählt DB basierend auf `DATABASE_URL` Schema
  - [ ] Migrations laufen idempotent (forward-only)
  - [ ] Rollback-Strategie dokumentiert

- [ ] **Production Database**
  - [ ] Railway Postgres Service konfiguriert (oder Neon/Supabase)
  - [ ] `DATABASE_URL` in Railway Env Vars
  - [ ] Migrations in CI/CD Pipeline (vor Deploy)
  - [ ] Backup-Strategie dokumentiert

- [ ] **Local Dev Kompatibilität**
  - [ ] SQLite bleibt für Local Dev (optional)
  - [ ] `README.md` aktualisiert (Dev vs Production DB)

---

## Kategorie: Security - Authentication

### ✅ Auth-Verifikation (JWT)

- [ ] **Backend JWT Verify**
  - [ ] `backend/src/lib/auth/jwt.ts` implementiert `verifyToken()`
  - [ ] `userId` wird aus verifiziertem Token extrahiert (`sub` Claim)
  - [ ] Ungültige Tokens → `401 UNAUTHORIZED`
  - [ ] `JWT_SECRET` Env Var erforderlich

- [ ] **Tests**
  - [ ] Unit Tests: Valid, Invalid, Expired Tokens
  - [ ] Integration Tests: Auth-protected Endpoints

---

### ✅ Token Storage Security

- [ ] **HttpOnly Cookies**
  - [ ] Backend setzt `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict`
  - [ ] Login + Refresh Endpoints setzen Cookies
  - [ ] Frontend entfernt localStorage Token-Zugriffe

- [ ] **CORS für Credentials**
  - [ ] `Access-Control-Allow-Credentials: true`
  - [ ] `Access-Control-Allow-Origin`: Konkrete Origin (kein `*`)

- [ ] **Tests**
  - [ ] E2E: Login → Cookie → API Call erfolgreich
  - [ ] Security Audit: Keine Tokens in localStorage

---

## Kategorie: API Contracts

### ✅ Response Envelope Unifikation

- [ ] **Backend Envelope**
  - [ ] Alle Routes nutzen `{ status: "ok", data: T }`
  - [ ] Error-Envelope: `{ error: { code, message, requestId, details? } }`
  - [ ] Kein raw JSON (außer explizit dokumentiert)

- [ ] **Frontend Envelope Parsing**
  - [ ] `src/services/api/client.ts` parst `status: "ok"`
  - [ ] Alle API-Services getestet (Journal, Alerts, Oracle, TA)

- [ ] **Tests**
  - [ ] Integration Tests: Envelope-Shape für alle Endpoints
  - [ ] Unit Tests: `ApiClient` mit neuem Envelope

---

### ✅ Response Envelope Enforcement

- [ ] **Code Audit**
  - [ ] Alle Routes in `backend/src/routes/*` nutzen `sendSuccess()`
  - [ ] TypeScript-Types erzwingen Envelope (wo möglich)

- [ ] **CI Guardrail**
  - [ ] Lint-Regel oder Test-Guardrail gegen raw Responses
  - [ ] Integration Tests assertieren Envelope-Shape

---

## Kategorie: Alerts

### ✅ Alert Evaluator Scheduler

- [ ] **Scheduler Implementation**
  - [ ] `backend/src/jobs/alertEvaluator.job.ts` erstellt
  - [ ] Job registriert in `scheduler.ts` (Interval: 2-5 Minuten)
  - [ ] Evaluator nutzt deterministische Zeit (Testbarkeit)

- [ ] **Alert Events Persistence**
  - [ ] Alert Events in DB persistiert (`alert_events` Tabelle)
  - [ ] Dedupe via Event-IDs

- [ ] **Tests**
  - [ ] Unit Tests: Evaluator mit Fixtures
  - [ ] Integration Tests: Evaluator → Events
  - [ ] Monitoring: Log-Output bei Evaluation

---

# Phase 2: Integration (P1 - Stabilität)

## Kategorie: Frontend-Backend Integration

### ✅ Journal API Integration

- [ ] **Backend-API**
  - [ ] Alle Journal-Endpoints funktionsfähig (CRUD, Status-Flow)
  - [ ] Idempotency-Key implementiert

- [ ] **Frontend Integration**
  - [ ] `src/services/journal/index.ts` erstellt
  - [ ] `useJournalStub()` durch `useJournal()` ersetzt
  - [ ] Deep Link `?entry=...` via API

- [ ] **Tests**
  - [ ] E2E: Create → Confirm → Archive via API
  - [ ] E2E: Deep Link → UI zeigt Entry

---

### ✅ Alerts API Integration

- [ ] **Backend-API**
  - [ ] CRUD-Endpoints funktionsfähig
  - [ ] Alert Events Endpoint (`/api/alerts/events`)
  - [ ] Alert Evaluator läuft

- [ ] **Frontend Integration**
  - [ ] `src/services/alerts/index.ts` erweitert
  - [ ] `useAlertsStore()` nutzt API
  - [ ] Alert Events konsumiert

- [ ] **Tests**
  - [ ] E2E: Create Alert → API POST → UI zeigt Card
  - [ ] E2E: Toggle Pause → Status ändert sich

---

### ✅ Oracle API Integration

- [ ] **Backend-API**
  - [ ] Daily Feed Endpoint funktionsfähig
  - [ ] Read-State Endpoints (PUT/POST)

- [ ] **Frontend Integration**
  - [ ] `src/services/oracle/index.ts` erstellt
  - [ ] Daily Feed via API
  - [ ] Read-State via API (nicht localStorage)

- [ ] **Tests**
  - [ ] E2E: Load Feed → UI zeigt Takeaway + Insights
  - [ ] E2E: Toggle Read → Persistiert über Reload

---

## Kategorie: Security

### ✅ Rate Limiting

- [ ] **Implementation**
  - [ ] Middleware `rateLimit(limit, window)` implementiert
  - [ ] Alle Endpoints haben Limits (gemäß `API_SPEC.md`)
  - [ ] `429 TOO_MANY_REQUESTS` mit `Retry-After` Header

- [ ] **Tests**
  - [ ] Unit Tests: Rate Limit Hit → 429
  - [ ] Integration Tests: Limits pro Endpoint

---

### ✅ CORS Hardening

- [ ] **Allowlist**
  - [ ] `CORS_ALLOWED_ORIGINS` Env Var
  - [ ] Origin-Check: Allowed → Header gesetzt, Disallowed → 403

- [ ] **Credentials**
  - [ ] `Access-Control-Allow-Credentials: true`
  - [ ] Keine Wildcards mit Credentials

- [ ] **Tests**
  - [ ] Unit Tests: Allowed/Disallowed Origins

---

### ✅ Error Message Sanitization

- [ ] **Production Mode**
  - [ ] Unknown Errors → Generische Message ("Internal server error")
  - [ ] Dev/Test: Details für Debugging

- [ ] **Logging**
  - [ ] Server Logs: Full Error mit Stack Trace

- [ ] **Tests**
  - [ ] Unit Tests: handleError in Production Mode
  - [ ] Integration Tests: Unknown Error → Generische Message

---

## Kategorie: Service Worker

### ✅ SW Polling Aktivierung

- [ ] **Feature Flag**
  - [ ] `.env.production`: `VITE_ENABLE_SW_POLLING=true`
  - [ ] `SW_TICK` wird gesendet (alle 30s)

- [ ] **Backend Integration**
  - [ ] SW pollt `/api/alerts/events`, `/api/oracle/daily`
  - [ ] Dedupe funktioniert (IDB)

- [ ] **Notifications**
  - [ ] Browser Permissions-Request
  - [ ] Notifications angezeigt bei Events

- [ ] **Tests**
  - [ ] E2E: SW registriert → Poll → Notification (manuell)

---

## Kategorie: Testing

### ✅ Backend Unit Tests

- [ ] **Validation Tests**
  - [ ] `backend/tests/unit/validation.spec.ts`
  - [ ] Tests für Journal, Alerts, Oracle Schemas

- [ ] **Error Handling Tests**
  - [ ] `backend/tests/unit/errors.spec.ts`
  - [ ] Request ID Propagation

- [ ] **State Machine Tests**
  - [ ] `backend/tests/unit/alert-state-machines.spec.ts`
  - [ ] TWO_STAGE: 2-of-3, Expiry, Cooldown
  - [ ] DEAD_TOKEN: Stages, Session Max 12h

- [ ] **TA Tests**
  - [ ] `backend/tests/unit/ta-determinism.spec.ts`
  - [ ] Golden Fixtures

- [ ] **Coverage**
  - [ ] `npm run test:coverage`: > 80% für Backend-Module

---

### ✅ E2E Tests (Backend-connected)

- [ ] **Setup**
  - [ ] `playwright.config.ts`: Backend + Frontend starten
  - [ ] Oder: Staging-Backend nutzen

- [ ] **Journal E2E**
  - [ ] Create Entry → API → UI zeigt Entry
  - [ ] Deep Link → UI scrollt + highlightet

- [ ] **Alerts E2E**
  - [ ] Create Alert → UI zeigt Card
  - [ ] Toggle Pause → Status ändert sich

- [ ] **Oracle E2E**
  - [ ] Load Feed → UI zeigt Takeaway
  - [ ] Toggle Read → Persistiert

- [ ] **Teardown**
  - [ ] Tests räumen Daten auf (DELETE API)

---

## Kategorie: API Quality

### ✅ Idempotency-Key Standardisierung

- [ ] **Header-basiert**
  - [ ] `req.headers['idempotency-key']` (nicht Query Param)
  - [ ] Replay: Gleicher Key + Body → 200 mit bestehender Entry
  - [ ] Conflict: Gleicher Key + anderer Body → 409

- [ ] **Tests**
  - [ ] Unit Tests: Idempotency mit Header
  - [ ] Integration Tests: Replay + Conflict

---

### ✅ Request ID Async-Safety

- [ ] **AsyncLocalStorage**
  - [ ] `backend/src/http/requestId.ts`: AsyncLocalStorage implementiert
  - [ ] Logger nutzt Context

- [ ] **Tests**
  - [ ] Unit Tests: Parallele Requests → Korrekte IDs

---

### ✅ Caching Headers

- [ ] **Konsistent gemäß Spec**
  - [ ] Oracle: `public, max-age=300`
  - [ ] TA: `private, max-age=300`
  - [ ] Journal/Alerts: `no-store`

- [ ] **Tests**
  - [ ] Integration Tests: Assert Headers

---

# Phase 3: Production Quality (P2)

## Kategorie: Testing & Quality

### ✅ Golden Fixtures

- [ ] **TA Fixtures**
  - [ ] `backend/tests/fixtures/ta/*.json`
  - [ ] Unit Tests: TA Generator mit Fixtures

- [ ] **Alert Fixtures**
  - [ ] `backend/tests/fixtures/alerts/*.json`
  - [ ] Unit Tests: State Machines mit Fixtures

- [ ] **Committed**
  - [ ] Fixtures in Git (Source of Truth)

---

## Kategorie: Features

### ✅ Watchlist Sync API

- [ ] **Backend Endpoints**
  - [ ] GET/PUT/POST/DELETE `/api/watchlist`
  - [ ] Integration Tests

- [ ] **Frontend Integration**
  - [ ] `src/services/watchlist/index.ts`
  - [ ] API + localStorage als Cache

- [ ] **Tests**
  - [ ] E2E: Add Item → Reload → Item vorhanden

---

### ✅ Push Notifications Backend

- [ ] **Option gewählt**
  - [ ] Option A: `backend/` mit VAPID
  - [ ] Oder Option B: `api/` als Microservice

- [ ] **Implementation**
  - [ ] Subscribe/Unsubscribe Endpoints
  - [ ] Alert Evaluator triggert Push

- [ ] **Tests**
  - [ ] E2E: Subscribe → Alert → Push (manuell)

---

## Kategorie: Observability

### ✅ Error Tracking (Sentry)

- [ ] **Frontend**
  - [ ] Sentry SDK initialisiert
  - [ ] Error Boundary
  - [ ] Test: Error → Sentry Dashboard

- [ ] **Backend (optional)**
  - [ ] Sentry SDK initialisiert
  - [ ] Errors gesendet

- [ ] **Privacy**
  - [ ] PII-Scrubbing konfiguriert

---

### ✅ Performance Monitoring

- [ ] **Vercel Analytics oder Web Vitals**
  - [ ] Aktiviert
  - [ ] Metriken: LCP, FID, CLS

- [ ] **Lighthouse**
  - [ ] Score > 90 (CI-Gate)

---

## Kategorie: Code Quality

### ✅ TypeScript Striktheit (Phase 1)

- [ ] **strictNullChecks**
  - [ ] `tsconfig.app.json`: `strictNullChecks: true`
  - [ ] Errors gefixt
  - [ ] CI: Build erfolgreich

---

### ✅ Bundle Size Monitoring

- [ ] **Bundle Analyzer**
  - [ ] Plugin konfiguriert
  - [ ] `npm run build:analyze`

- [ ] **CI-Check**
  - [ ] Bundle-Size < 500 KB (Threshold)
  - [ ] CI fails bei Überschreitung

---

# Phase 4: Optional (P3)

## Kategorie: CI/CD

### ✅ Lighthouse Score Enforcement

- [ ] **CI-Gate**
  - [ ] `continue-on-error: false`
  - [ ] `lighthouserc.json`: Thresholds

- [ ] **CI**
  - [ ] Score < 90 → Fail

---

## Kategorie: Documentation

### ✅ TODO Cleanup

- [ ] **Audit**
  - [ ] Alle TODOs auditiert
  - [ ] Issues erstellt oder gelöscht

- [ ] **Docs**
  - [ ] Keine offenen TODOs (oder in Roadmap)

---

# Abnahme-Checkliste (Final Sign-off)

## Pre-Production Checklist

### ✅ Core Functionality

- [ ] **Backend deployed** (Railway)
- [ ] **Frontend deployed** (Vercel)
- [ ] **Vercel → Backend Routing** funktioniert
- [ ] **Database** (Postgres) konfiguriert
- [ ] **Migrations** gelaufen

### ✅ Security

- [ ] **Auth-Verifikation** aktiv (JWT)
- [ ] **Token Storage** sicher (HttpOnly Cookies)
- [ ] **CORS** konfiguriert (Allowlist)
- [ ] **Rate Limiting** auf allen Endpoints
- [ ] **Error Messages** sanitized (Production)

### ✅ Features

- [ ] **Journal** funktioniert (CRUD + Status-Flow)
- [ ] **Alerts** funktionieren (CRUD + Evaluator läuft)
- [ ] **Oracle** funktioniert (Daily Feed + Read-State)
- [ ] **TA** funktioniert (Deterministic)
- [ ] **SW Polling** aktiv (Notifications)

### ✅ Testing

- [ ] **Unit Tests** grün (Backend + Frontend)
- [ ] **Integration Tests** grün (Backend)
- [ ] **E2E Tests** grün (Playwright)
- [ ] **Coverage** > 80% (Backend)

### ✅ Observability

- [ ] **Error Tracking** aktiv (Sentry)
- [ ] **Performance Monitoring** aktiv (Vercel Analytics)
- [ ] **Logs** strukturiert (Railway + Vercel)

### ✅ Documentation

- [ ] **README.md** aktualisiert
- [ ] **ENVIRONMENT_VARIABLES.md** vollständig
- [ ] **DEPLOYMENT_RUNBOOK.md** existiert
- [ ] **SECURITY_POLICY.md** existiert
- [ ] **Backend-Ownership dokumentiert**

### ✅ Deployment

- [ ] **Railway Backend** läuft stabil
- [ ] **Vercel Frontend** deployed
- [ ] **Smoke Tests** erfolgreich (`/api/health`, `/`, `/journal`)
- [ ] **Rollback-Strategie** dokumentiert

---

# Definition of Done (Universal)

Für **jedes Issue** aus der Roadmap gilt:

## Code

- [ ] **Implementierung vollständig** gemäß Akzeptanzkriterien
- [ ] **Code Review** durchgeführt (mindestens 1 Approval)
- [ ] **TypeScript Errors** behoben (keine `any` ohne Begründung)
- [ ] **ESLint** grün (keine neuen Warnings)

## Tests

- [ ] **Unit Tests** geschrieben (wo anwendbar)
- [ ] **Integration Tests** geschrieben (für API-Endpoints)
- [ ] **E2E Tests** geschrieben (für User-Flows)
- [ ] **Alle Tests grün** (lokal + CI)

## Documentation

- [ ] **README.md** aktualisiert (falls API/Setup ändert)
- [ ] **API_SPEC.md** aktualisiert (für neue/geänderte Endpoints)
- [ ] **ENVIRONMENT_VARIABLES.md** aktualisiert (für neue Env Vars)
- [ ] **Code-Kommentare** für komplexe Logik

## Deployment

- [ ] **CI/CD** grün (Lint + Build + Tests)
- [ ] **Deployed** (Staging/Preview)
- [ ] **Smoke Tests** erfolgreich (Staging)
- [ ] **Production Deploy** freigegeben (nach Testing)

## Security & Performance

- [ ] **Security Review** (keine neuen Vulnerabilities)
- [ ] **Performance Impact** geprüft (Lighthouse/Bundle Size)
- [ ] **Accessibility** geprüft (keine neuen a11y Issues)

---

# Kategorisierte Checklisten

## Checkliste: Backend-Architektur

- [ ] Backend-Ownership dokumentiert
- [ ] Database Migration (SQLite → Postgres)
- [ ] Response Envelope unifikation
- [ ] Vercel Rewrite URL konfiguriert

## Checkliste: Security

- [ ] Auth-Verifikation (JWT Signature Check)
- [ ] Token Storage Security (HttpOnly Cookies)
- [ ] CORS Policy Hardening
- [ ] Rate Limiting auf allen Endpoints
- [ ] Error Message Sanitization

## Checkliste: Frontend-Backend Integration

- [ ] Journal API Integration
- [ ] Alerts API Integration
- [ ] Oracle API Integration
- [ ] Service Worker Polling aktiviert

## Checkliste: Testing

- [ ] Backend Unit Tests ergänzt
- [ ] E2E Tests mit Backend
- [ ] Golden Fixtures
- [ ] Test Coverage > 80%

## Checkliste: Features

- [ ] Alert Evaluator Scheduler
- [ ] Watchlist Sync API
- [ ] Push Notifications Backend

## Checkliste: Observability

- [ ] Error Tracking (Sentry)
- [ ] Performance Monitoring (Vercel Analytics)
- [ ] Structured Logs (Request IDs)

## Checkliste: Code Quality

- [ ] TypeScript Striktheit erhöhen
- [ ] Bundle Size Monitoring
- [ ] Lighthouse Score Enforcement
- [ ] API Quality (Idempotency, Caching)

## Checkliste: Documentation

- [ ] README aktualisiert
- [ ] API_SPEC aktualisiert
- [ ] ENVIRONMENT_VARIABLES vollständig
- [ ] TODO Cleanup

---

# Monitoring & Verification Tools

## Automatisierte Checks

### CI/CD Pipeline
```bash
npm run lint            # ESLint + Prettier
npx tsc --noEmit        # TypeScript Check
npm run build           # Production Build
npm run test            # Unit Tests
npm run test:e2e        # E2E Tests (Playwright)
npm run test:backend    # Backend Tests
```

### Deployment Verification
```bash
# Health Check
curl https://tradeapp.vercel.app/api/health

# Smoke Tests
npm run test:smoke      # Critical User Flows

# Performance
npm run lighthouse      # Lighthouse Audit
```

### Security Audit
```bash
npm audit --audit-level=moderate
npx snyk test           # Snyk Vulnerability Scan
```

## Manuelle Checks

### Funktionale Verifikation
1. **Journal**: Create → Confirm → Archive → Delete
2. **Alerts**: Create SIMPLE/TWO_STAGE/DEAD_TOKEN → Toggle Pause
3. **Oracle**: Load Feed → Toggle Read → Verify Persistence
4. **Service Worker**: Notifications anzeigen (manuell)

### Security Verifikation
1. **Auth**: Ungültiger Token → 401
2. **CORS**: Disallowed Origin → 403
3. **Rate Limit**: Viele Requests → 429

### Performance Verifikation
1. **Lighthouse**: Score > 90
2. **Bundle Size**: < 500 KB
3. **API Latency**: < 200ms (p95)

---

**Checkliste erstellt von**: Claude 4.5  
**Verwendung**: Fortlaufende Verifikation während Implementierung + Final Sign-off vor Production Deploy  
**Updates**: Bei Änderungen an Roadmap/Issues aktualisieren

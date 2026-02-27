---
Owner: Architecture Team
Status: draft
Version: 1.0
LastUpdated: 2026-02-27
Canonical: false
---

# Monorepo — Technisches Audit (Ist-Zustand) — 2026-02-19

**Scope (verifiziert im Code):** SPA (`src/`), canonical Backend (`backend/`), Vercel Functions (`api/`), Alerts-Service (`apps/backend-alerts/`), Shared (`shared/`), Docs (`docs/`, `shared/docs/`), Playwright (`playwright/`).

**Audit-Regeln:** Nur überprüfbare Aussagen; jede Task mit DoD; keine Roadmap-Spekulation.

---

## Executive Summary (≤ 20 Zeilen)

1. **Production Routing rewritet alle `/api/*` Requests auf das canonical Backend** (`vercel.json`), wodurch `api/`-Vercel-Functions (inkl. `/api/quote`, `/api/swap`) **in Production faktisch unerreichbar** sind.
2. **Trading Terminal ist in Production blockiert**: Frontend ruft `/api/quote` und `/api/swap` (via `apiClient`) auf, canonical Backend registriert diese Endpunkte nicht (`backend/src/app.ts`).
3. **Journal ist in der aktuellen Default-Konfiguration inkonsistent**: Frontend nutzt Journal API (mit Offline-Queue), canonical Backend verlangt Auth für Journal-Operationen, Frontend-Auth ist jedoch bewusst deaktiviert (`VITE_ENABLE_AUTH=false`).
4. **Alerts haben mehrere konkurrierende Implementierungen/Truth Sources**: UI ist lokal (IndexedDB + Seed-Stubs), canonical Backend hat Alerts CRUD + Evaluator + Events, zusätzlich existiert ein separater Alerts-Service (Postgres + SSE/Push) und `api/` enthält Proxy/duplizierte Endpoints.
5. **Discover Overlay hängt an einem Endpunkt, der im canonical Backend fehlt** (`/api/discover/tokens`); `discoverService` fällt dann auf leere Liste zurück → Feature wirkt „kaputt aber still“.
6. **Response-Envelope ist im canonical Backend und Frontend konsistent**, aber `shared/docs/API_CONTRACTS.md` beschreibt die `api/`-Envelope falsch; außerdem referenziert `README.md` eine nicht existierende Ownership-Datei.

---

## P0 — Blocker (Produkt-Funktionalität / Production)

### P0.1 — `/api/quote` & `/api/swap` in Production unerreichbar (Terminal bricht)
- **Evidenz**
  - Production Rewrite: `vercel.json` rewritet **alle** `/api/(.*)` → `https://$VERCEL_BACKEND_URL/api/$1`.
  - Frontend-Calls: `src/lib/trading/quote/quoteService.ts` → `apiClient.get(... '/quote?...')`; `src/lib/trading/swap/swapService.ts` → `apiClient.post('/swap', ...)`.
  - Canonical Backend Routen: `backend/src/app.ts` registriert **keine** `/quote` oder `/swap`.
  - Serverless Implementierung existiert, ist aber durch Rewrite nicht erreichbar: `api/quote.ts`, `api/swap.ts`.
- **Impact**: Terminal Quote/Swap kann in Production nicht funktionieren.
- **Task (Issue-ready)**
  - **Titel**: Implementiere `/api/quote` & `/api/swap` im canonical Backend (oder passe Vercel-Routing gezielt an)
  - **DoD**
    - [ ] `backend/src/app.ts` registriert `GET /quote` und `POST /swap` (unter BasePath `/api`).
    - [ ] Response-Envelope entspricht `{ status:"ok", data }` (`backend/src/http/response.ts`).
    - [ ] Frontend Terminal Flow (`/terminal` + Embedded Terminal) erhält funktionierende Quotes & SwapTx in Dev **und** Production-Routing (Vercel Rewrite).
    - [ ] E2E/Integration: mind. ein mechanischer Contract-Test (z.B. `curl`/Playwright) verifiziert `GET /api/quote` und `POST /api/swap` gegen canonical Backend.
  - **Mechanische Checks**
    - [ ] `rg -n "router\\.(get|post)\\('/(quote|swap)'" backend/src/app.ts` liefert Treffer.
    - [ ] `curl -sS "$BASE/api/quote?..."`
    - [ ] `curl -sS -X POST "$BASE/api/swap" -H "Content-Type: application/json" -d '{...}'`

### P0.2 — Journal: Frontend nutzt API + Offline-Queue, Backend fordert Auth, Auth ist standardmäßig disabled
- **Evidenz**
  - Frontend: `src/services/journal/useJournalApi.ts` ruft `listJournalEntries()`/Mutations auf.
  - Frontend Auth Flag: `src/config/features.ts` → `ENABLE_AUTH` default off.
  - Backend Journal Gate: `backend/src/routes/journal.ts` → `requireJournalAuth()` wirft 401 `UNAUTHENTICATED` für `req.userId === 'anon'`.
  - Router setzt ohne Token `userId='anon'`: `backend/src/http/router.ts`.
- **Impact**: Journal lädt/mutiert online nicht zuverlässig (401), obwohl UI/Queue „real“ wirken.
- **Task (Issue-ready)**
  - **Titel**: Entscheide und implementiere Journal-Auth-Policy (anon erlaubt vs. Auth end-to-end)
  - **DoD (Option A: anon erlaubt für Journal v1)**
    - [ ] `backend/src/routes/journal.ts` erlaubt definierte Journal-Calls für anon (z.B. `userId="anon"` als tenant) **oder** vergibt serverseitig ein anon-JWT/Cookie.
    - [ ] Frontend `useJournalApi` kann `GET/POST/confirm/archive/restore/delete` ohne Auth-UI erfolgreich ausführen (Dev/Prod-Routing).
    - [ ] Daten bleiben user-scoped (mindestens durch `userId`-Keying).
  - **DoD (Option B: Auth aktiviert end-to-end)**
    - [ ] `VITE_ENABLE_AUTH=true` aktiviert eine reale Login/Session-UX (nicht nur Stub).
    - [ ] Token/Cookie wird gesetzt und von Backend akzeptiert (`backend/src/routes/auth.ts` + Router Cookie/Authorization).
    - [ ] Journal funktioniert mit Auth; ohne Auth zeigt UI einen klaren Gate-State (kein stilles „leer“).
  - **Mechanische Checks**
    - [ ] `curl -i "$BASE/api/journal"` liefert nicht 401 im gewählten Modus.
    - [ ] E2E: Journal Create + Confirm + Archive über UI.

### P0.3 — Alerts Ownership/Truth Source Fragmentierung (UI vs SW vs Backend vs Alerts-Service)
- **Evidenz**
  - Alerts UI ist lokal: `src/components/alerts/useAlertsStore.ts` lädt aus IndexedDB (`dbService.getAllAlerts()`), seeding aus `generateStubAlerts()`, **keine API Calls**.
  - Service Worker pollt serverseitige Events: `src/sw/sw-alerts.ts` → `GET /api/alerts/events`.
  - Canonical Backend hat Alerts CRUD + Events: `backend/src/routes/alerts.ts` + SQLite Repo/Evaluator (`backend/src/domain/alerts/*`, `backend/src/jobs/alertEvaluator.job.ts`).
  - Separater Alerts-Service (Postgres + API-Key + SSE/Push): `apps/backend-alerts/src/*`.
  - `api/_lib/alertsProxy.ts` proxy’t an `RAILWAY_ALERTS_URL` (separater Service).
- **Impact**: Mehrere, inkompatible Datenmodelle & APIs; UI zeigt lokale Stubs, SW zeigt Notifications aus anderem System.
- **Task (Issue-ready)**
  - **Titel**: Konsolidiere Alerts auf **eine** canonical Implementierung inkl. UI-Integration
  - **DoD**
    - [ ] Definiere canonical Alerts-API (REST + Events) und implementiere sie in **genau einem** Backend (canonical `backend/` **oder** `apps/backend-alerts/` + Proxy).
    - [ ] Frontend `Alerts` Page nutzt canonical API (statt IndexedDB-Seed-Stubs) inkl. Loading/Error/Empty states.
    - [ ] Service Worker pollt denselben canonical Events-Stream und die Event-Shapes sind konsistent (UI ↔ SW ↔ Backend).
    - [ ] Entferne oder deaktiviere die nicht-canonical Alerts-Implementierungen (oder markiere sie explizit „archived“ + CI Guard).
  - **Mechanische Checks**
    - [ ] `rg -n "generateStubAlerts|getAllAlerts\\(\\)" src/components/alerts/useAlertsStore.ts` ist entfernt oder hinter Flag/Dev-only.
    - [ ] `rg -n "/alerts/events" src/sw/sw-alerts.ts` zeigt den canonical Endpoint; Response passt zu SW parsing.

### P0.4 — CI/Guardrail: Vercel `/api` Ownership Script ist (a) nicht in Scripts, (b) inkonsistent zur `vercel.json` Syntax
- **Evidenz**
  - Guard Script vorhanden: `scripts/verify-vercel-api-ownership.mjs`.
  - Root `package.json` enthält keinen Script-Eintrag, der es ausführt.
  - Script erwartet `destination` Prefix `https://{env:VERCEL_BACKEND_URL}/api/…`, `vercel.json` nutzt `https://$VERCEL_BACKEND_URL/api/$1`.
- **Impact**: Routing-Drift (z.B. Ausnahmen für `/api/quote`) kann unbemerkt Production brechen.
- **Task (Issue-ready)**
  - **Titel**: Aktiviere `/api` Ownership Guardrail in CI und gleiche Syntax an
  - **DoD**
    - [ ] `package.json` enthält z.B. `verify:vercel-api-ownership` und CI führt es aus.
    - [ ] Script akzeptiert die tatsächlich verwendete `vercel.json` Rewrite-Syntax **oder** `vercel.json` wird auf die Script-Syntax umgestellt.
    - [ ] Guard erlaubt/verbietet gezielte Ausnahmen explizit (Policy dokumentiert).

---

## SYSTEM ARCHITECTURE MAP (Ist-Zustand)

### 1) High-Level Komponenten
- **SPA (Vite/React)**: `src/` (Routing: `src/App.tsx`, Nav: `src/routes/routes.ts`, `src/config/navigation.ts`).
- **Service Worker (Workbox)**: `src/sw/service-worker.ts` + Poller (`src/sw/sw-alerts.ts`, `src/sw/sw-oracle.ts`).
- **Canonical Backend (Always-on Node HTTP)**: `backend/src/server.ts`, Router: `backend/src/app.ts`.
- **Vercel Functions Backend (nicht canonical bei aktivem Rewrite)**: `api/*` (duplizierte API + Quote/Swap).
- **Separater Alerts-Service (Express + Postgres)**: `apps/backend-alerts/src/index.ts` (Watcher + SSE/Push).
- **Shared Contracts**: `shared/contracts/*` (API Shapes / Domain).

### 2) Datenflüsse (Frontend → Backend → Services)
- **REST (Frontend → `/api/*`)**
  - `ApiClient` base: `VITE_API_URL || "/api"` (`src/services/api/client.ts`).
  - Canonical Envelope: `{ status:"ok", data }` enforced im Client.
- **SW Polling (SW → `/api/*`)**
  - Alerts Events: `GET /api/alerts/events?since=...` (`src/sw/sw-alerts.ts`).
  - Oracle Daily: `GET /api/oracle/daily` (`src/sw/sw-oracle.ts`).
- **Externe Provider (Backend)**
  - LLM Routing/Provider: `backend/src/routes/llm.ts`, `backend/src/routes/reasoning/*`.
  - Onchain/Market Provider: referenziert in `shared/docs/PROVIDERS.md`, Backend Domain-Pfade.
  - Trading (Jupiter) ist aktuell in `api/quote.ts`, `api/swap.ts` implementiert (serverless), nicht im canonical Backend.

### 3) State Sources (Local / Hybrid / Real)
- **Browser Local**
  - IndexedDB `tradeapp-db` (`src/services/db/db.ts`): `alerts`, `reasoning`, `journalCache`, `journalQueue`, `syncQueue` (legacy).
  - localStorage: Watchlist (`src/pages/Research.tsx`), Feed Cache (`src/lib/api/feed.ts`), Oracle Read Cache + Queue (`src/services/oracle/readStateCache.ts`, `readStateQueue.ts`).
- **Hybrid (Local + Server)**
  - Journal: Local Cache + Offline Queue + Server Sync (`src/services/journal/useJournalApi.ts`, `src/services/journal/queueStore.ts`).
  - Oracle Insights Read-State: local overlay queue + server write-through (`src/pages/Insights.tsx` + `src/services/oracle/api.ts`).
  - Reasoning: IndexedDB Cache + Server Revalidate (`src/services/reasoning/reasoningApi.ts` + `src/hooks/use*Insight.ts`).
- **Server (Real, canonical Backend)**
  - Feeds/Signals: `/api/feed/*`, `/api/signals/unified` (`backend/src/routes/feed.ts`, `signals.ts`).
  - Alerts Events: `/api/alerts/events` (`backend/src/routes/alerts.ts`).

### 4) Deployment Routing (vercel.json etc.)
- **Production (Vercel)**
  - `/api/(.*)` → `https://$VERCEL_BACKEND_URL/api/$1` (`vercel.json`).
  - Konsequenz: `api/` Vercel Functions werden **nicht** genutzt (auch nicht `/api/quote`/`/api/swap`).
- **Backend (Railway, Docker)**
  - `railway.toml` + `backend/Dockerfile`, Start `node dist/server.js`, Health `/api/health`.
- **Alerts-Service (Railway, nixpacks)**
  - `apps/backend-alerts/railway.toml`, Start `pnpm start`, Health `/health`.

### 5) Single Source of Truth (Ist-Definition, pro Feature)
- **Journal Entries**: *Soll* server (canonical backend) sein; *Ist* hybrid (IDB + Server) aber server write ist durch Auth-Gate blockiert, solange Auth disabled.
- **Oracle Feed**: server (`/api/oracle/daily`), Read-State hybrid (local overlay + server).
- **Alerts**: *Ist* fragmentiert (UI local IDB; SW server events; zusätzlich 2 server implementations).
- **Terminal Quote/Swap**: *Soll* server; *Ist* serverless (`api/`) aber Production rewrite routet zu canonical backend ohne Implementierung.
- **Discover Tokens**: *Soll* server (`/api/discover/tokens`); *Ist* „silent empty“ (endpoint fehlt im canonical backend).

---

## TAB-BY-TAB UI/UX AUDIT (Primary Routes + Terminal)

> Format: **Visuelle Elemente** · **Funktion** · **Datenfluss** · **UX-Gaps** · **Architektur-Gaps** · **Tasks**

### 1) Dashboard (`/dashboard`)
- **Visuelle Elemente**
  - Header, ActionStrip, StatusProgress, WorkQueue, Snapshots, FAB (`src/pages/Dashboard.tsx`, Komponenten unter `src/components/dashboard/*`).
  - Loading/Error/Empty: **Ja** (Skeleton + `ScreenState`).
- **Funktion**
  - Aggregiert Counts aus Journal/Insights/Alerts; WorkQueue Links in Journal/Insights/Alerts.
- **Datenfluss (Ist)**
  - Journal: `useJournalApi()` (hybrid) → `/api/journal` (`src/services/journal/api.ts`) + IDB cache/queue.
  - Insights: `useOracleStub()` → **Stub** (`src/stubs/hooks.ts`).
  - Alerts: `useAlertsStub()` → **Stub** (`src/stubs/hooks.ts`).
- **UX-Gaps**
  - Mixed Reality: echte Journal-Daten + Stub Insights/Alerts → Counts/WorkQueue inkonsistent.
- **Architektur-Gaps**
  - Dashboard besitzt keine canonical Server-Aggregation; Mix aus Stub/Real.
- **Tasks**
  - **P1**: Ersetze Dashboard/Oracle/Alerts Stubs durch API-basierte Provider (DoD: keine `use*Stub` mehr im Dashboard-Pfad; echte Error/Empty states).

### 2) Research (`/research?view=chart...`, `/research/:assetId`)
- **Visuelle Elemente**
  - ChartTopBar, ChartCanvas/Placeholder, Watchlist Panel/Sheet, Research Tools Panel/Sheet, Chart Feed Panel, Bottom Cards Carousel, GrokPulse Card (asset hub), AI TA Analyzer Dialog, Embedded Trading Terminal (flag), Alerts/Banners (`src/pages/Research.tsx`).
  - Loading/Error: **Ja** (`ChartSkeleton`, `ScreenState`).
- **Funktion**
  - Markt auswählen, Watchlist lokal verwalten, Replay-Mode UI, Tools, Feed/Signals, Trading Terminal (feature-flagged).
- **Datenfluss (Ist)**
  - Chart State: `useChartStub()` (Stub).
  - Watchlist: localStorage (`WATCHLIST_STORAGE_KEY`).
  - Feed: `ChartFeedPanel` → `fetchOracleFeed`/`fetchPulseFeed` → `/api/feed/oracle|pulse` (`src/lib/api/feed.ts`).
  - Oracle Insights (für BottomCards): `useOracleStub()` (Stub) + Journal entries real.
  - Embedded Trading Terminal: `EmbeddedTerminal` → TerminalStore → `/api/quote` & `/api/swap` (blockiert in Production, siehe P0.1).
  - AI TA Analyzer: **Stub** (`src/components/chart/AITAAnalyzerDialog.tsx`).
- **UX-Gaps**
  - Watchlist Persistenz nur lokal (kein Cross-Device).
- **Architektur-Gaps**
  - Chart/TA/Oracle teils stub, teils real; unklare Ownership.
- **Tasks**
  - **P0**: Terminal Quote/Swap Routing fixen (siehe P0.1).
  - **P1**: Chart/Markets von Stub auf canonical API umstellen oder Stub klar als Demo kennzeichnen.
  - **P1**: AI TA Analyzer an `/api/chart/ta` oder `/api/chart/analyze` anbinden (DoD: Stub entfernt, Error/Retry).

### 3) Journal (`/journal`, `/journal/:entryId`)
- **Visuelle Elemente**
  - Timeline/Inbox/Learn/Playbook, Create/Confirm/Archive/Delete Dialoge, Sync Badge, Review Overlay (`src/pages/Journal.tsx`, `src/components/journal/*`).
  - Loading/Error: **Ja** (`JournalSkeleton`, `ScreenState`).
- **Funktion**
  - CRUD + Status-Transitions + Offline-Queue UI (Sync badge, retry).
- **Datenfluss (Ist)**
  - `useJournalApi()` → IDB cache (`journalCache`) + queue (`journalQueue`) + API (`src/services/journal/api.ts`).
  - Runner: `startJournalQueueSync()` wird global gestartet (`src/App.tsx`).
  - Backend: canonical `/api/journal*` existiert, aber auth-required (`backend/src/routes/journal.ts`).
- **UX-Gaps**
  - Offline UI sagt „write actions disabled“ (`src/components/offline/OfflineContext.tsx`), Journal erlaubt dennoch enqueue.
- **Architektur-Gaps**
  - Auth-Policy mismatch (P0.2).
  - Zwei Queue-Systeme: `journalQueue` (aktiv) vs `syncQueue`/`syncService` (legacy, ungenutzt).
- **Tasks**
  - **P0**: Auth-Policy fix (siehe P0.2).
  - **P1**: OfflineContext mit realer Journal-Queue-Strategie harmonisieren (DoD: Offline-Banner/CTA passen zu tatsächlichem Verhalten).
  - **P2**: Entferne `src/services/sync/sync.service.ts` oder migriere konsistent (DoD: keine ungenutzten Offline-Sync Pfade).

### 4) Insights (`/insights`, `/insights/:insightId`)
- **Visuelle Elemente**
  - OracleHeader/Filters/Cards, TodayTakeaway, StreakBanner, UnifiedSignalsView, Status Mode placeholder (`src/pages/Insights.tsx`).
  - Loading/Error/Empty: **Ja**.
- **Funktion**
  - Feed anzeigen, read/unread togglen, bulk mark read, refresh.
- **Datenfluss (Ist)**
  - Initial: Stub `makeOracle(...)` (`src/pages/Insights.tsx`).
  - Refresh: `/api/oracle/daily` (`src/services/oracle/api.ts`).
  - Read-State: local cache + queue overlay; write-through via `/api/oracle/read-state` & bulk.
  - UnifiedSignals: `/api/signals/unified` (`src/components/signals/UnifiedSignalsView.tsx` → `src/lib/api/feed.ts`).
- **UX-Gaps**
  - Status Mode ist placeholder, aber URL/Navigation existiert.
  - Fehler beim Refresh werden „geschluckt“ (keine sichtbare Degradation außer still).
- **Architektur-Gaps**
  - Stub initial state statt server-first; SW pollt Oracle daily parallel.
- **Tasks**
  - **P1**: Server-first Laden (remove `makeOracle` default) + definierte Offline-Fallbacks.
  - **P1**: Read-State Ownership klarziehen (Server als SoT, local overlay nur pending).

### 5) Alerts (`/alerts`)
- **Visuelle Elemente**
  - Header, QuickCreate, FilterBar, AlertCard, Empty/FilterEmpty, Skeleton (`src/pages/Alerts.tsx`).
  - Loading/Error: **Ja**.
- **Funktion**
  - Create (simple/twoStage/deadToken), pause, delete, cancel watch (UI-state).
- **Datenfluss (Ist)**
  - Lokale Persistenz: IndexedDB `alerts` store (`src/services/db/db.ts`) + Seed-Stubs (`src/components/alerts/useAlertsStore.ts`).
  - Keine API Integration.
  - SW: Notifications aus `/api/alerts/events`.
- **UX-Gaps**
  - UI zeigt lokale Alerts, Notifications stammen aus anderem System → Nutzer erlebt „Phantom Alerts“.
- **Architektur-Gaps**
  - Multi-Backend Alerts (P0.3).
- **Tasks**
  - **P0**: Konsolidierung + UI-Integration (siehe P0.3).

### 6) Settings (`/settings`)
- **Visuelle Elemente**
  - Tier/Budgets, Usage Counters, Provider Params, Cache/Offline, Push/Alerts, Privacy/Diagnostics, Wallet Section (`src/pages/Settings.tsx`, `src/components/settings/*`).
  - Loading/Error: **Ja**.
- **Funktion**
  - Lokale Settings/Usage Verwaltung, Export/Import, Permission UI (stub).
- **Datenfluss (Ist)**
  - Lokale Stores (`useSettingsStore`, `useUsageStore`), kein Backend Call.
  - Backend hat `/api/settings` (auth-required), wird aber nicht genutzt.
- **UX-Gaps**
  - Wallet connect & push permission sind Demo-Only.
- **Architektur-Gaps**
  - Backend Settings existieren, FE nutzt lokale Kopie → keine Cross-Device Persistenz.
- **Tasks**
  - **P1**: Settings API anbinden oder Backend Settings entfernen/archivieren (Ownership klar).

### 7) Terminal (`/terminal`) (non-nav route)
- **Visuelle Elemente**
  - TerminalShell: Wallet button, PairSelector, Discover button, ChartPanel placeholder, ExecutionPanel, TxStatusToast (`src/pages/Terminal.tsx`, `src/components/terminal/*`).
- **Funktion**
  - Quote fetch, Swap execution über Solana Wallet.
- **Datenfluss (Ist)**
  - Quote: `GET /api/quote` (`src/lib/trading/quote/quoteService.ts`).
  - Swap: `POST /api/swap` (`src/lib/trading/swap/swapService.ts`).
  - Production: durch Vercel rewrite auf canonical backend geroutet → **Endpunkte fehlen** (P0.1).
- **Tasks**
  - **P0**: Quote/Swap canonicalisieren (P0.1).

---

## BACKEND AUDIT (canonical `backend/`)

### 1) Route Coverage (registriert in `backend/src/app.ts`)
- **Foundations**
  - `GET /api/health`, `GET /api/meta`, `GET /api/usage/summary`
- **Auth**
  - `POST /api/auth/register|login|refresh|logout`, `GET /api/auth/me`
- **Settings**
  - `GET /api/settings`, `PATCH /api/settings` (auth-required)
- **Journal**
  - `GET /api/journal`, `GET /api/journal/:id`, `POST /api/journal` (Idempotency-Key required),
  - `POST /api/journal/:id/insights`, `POST /api/journal/:id/confirm|archive|restore`, `DELETE /api/journal/:id` (auth-required)
- **Alerts**
  - `GET/POST /api/alerts`, `GET/PATCH/DELETE /api/alerts/:id`, `POST /api/alerts/:id/cancel-watch`, `GET /api/alerts/events`
- **Oracle**
  - `GET /api/oracle/daily`, `PUT /api/oracle/read-state`, `POST|PUT /api/oracle/read-state/bulk`
- **Chart/TA**
  - `POST /api/chart/ta`, `POST /api/chart/analyze`
- **Reasoning/LLM**
  - `POST /api/reasoning/trade-review|session-review|board-scenarios|insight-critic|route`
  - `POST /api/llm/execute`
- **Feed/Signals/Market**
  - `GET /api/feed/oracle`, `GET /api/feed/pulse`, `GET /api/signals/unified`, `GET /api/market/daily-bias`
### 2) Frontend-Konsum (Ist: konsumiert vs. ungenutzt)
- **Konsumiert (verifiziert in `src/` / `src/sw/`)**
  - `GET /api/oracle/daily` (UI + SW)
  - `PUT/POST /api/oracle/read-state*` (UI)
  - `GET /api/feed/oracle`, `GET /api/feed/pulse` (Research)
  - `GET /api/signals/unified` (Insights)
  - `POST /api/reasoning/*` (Hooks)
  - `GET /api/alerts/events` (SW)
- **Nicht konsumiert (aber implementiert)**
  - `GET /api/meta`, `GET /api/usage/summary` (kein FE Call gefunden)
  - `GET/PATCH /api/settings` (FE nutzt lokale Stores)
  - Alerts CRUD (FE UI nutzt IndexedDB; keine API Calls)
  - Chart/TA endpoints (`/chart/ta`, `/chart/analyze`) (UI nutzt Stub)
- **Fehlt im canonical Backend (aber Frontend nutzt)**
  - `GET /api/quote`, `POST /api/swap` (Terminal)
  - `GET /api/discover/tokens` (Discover)

### 3) Konsistenzanalyse (Envelope, Fehler, Statuscodes)
- **Success Envelope** ist kanonisch und zentralisiert: `backend/src/http/response.ts`.
- **Error Shape** ist kanonisch und zentralisiert: `backend/src/http/error.ts` (inkl. `details.requestId`).
- **Auth-Resolution**: Router setzt `userId='anon'` ohne gültiges JWT/Cookie; protected endpoints sollen 401 `UNAUTHENTICATED` liefern (`backend/src/http/auth.ts` / `backend/src/routes/journal.ts`).
- **204 mit Body**: `sendNoContent()` sendet 204 *mit* JSON-Envelope (`backend/src/http/response.ts`) → potentielles Proxyrisiko; Client erwartet dennoch JSON.

### 4) Dominance Layer Status
- **Implementiert**: `backend/src/lib/dominance/*`.
- **Runtime Aktivierung**: docs nennen `ENABLE_SPARKFINED_DOMINANCE=true`.
- **Integration in Request-Paths**: keine direkte Einbindung in `backend/src/server.ts`/`backend/src/app.ts` (Dominance ist Governance/Tooling, nicht Teil der API-Pipeline).

### 5) Jobs / Background Logic
- **Scheduler**: `backend/src/jobs/scheduler.ts`
  - Oracle daily: warm-up + 06:00 UTC
  - Journal enrich: alle 5 min (Kommentar: no-op placeholder)
  - Alert evaluator: alle 2 min (`backend/src/jobs/alertEvaluator.job.ts`) — nutzt deterministische Provider (`backend/src/domain/alerts/evaluator.ts`).
- **Cleanup (server.ts)**: alle 10 min KV cleanup + alert event retention + oracle cleanup + TA cache cleanup.
- **Risiko**: Mehrere Instanzen → doppelte Scheduler/cleanup runs (kein Leader-Election Lock ersichtlich).

### Backend-Tasks (priorisiert)
- **P0**: Quote/Swap implementieren (P0.1).
- **P0**: Journal Auth Policy fix (P0.2).
- **P0**: Alerts konsolidieren (P0.3).
- **P1**: Discover tokens endpoint im canonical Backend hinzufügen oder Feature flaggen/deaktivieren bis verfügbar.
- **P1**: Scheduler/Jopb-Locking (Single-run semantics) für multi-instance Deployments.

---

## DATENFLUSS-AUDIT (Local/Hybrid/Real, Konflikt, SoT)

| Feature | Ist: Local/Hybrid/Real | Konfliktpotenzial | Single Source of Truth (Ist) | Evidenz (Dateien) |
|---|---|---:|---|---|
| Dashboard Counts | Hybrid (Journal real + Insights/Alerts stub) | **hoch** | keiner (Mix) | `src/pages/Dashboard.tsx`, `src/stubs/hooks.ts`, `src/services/journal/useJournalApi.ts` |
| Research Watchlist | Local | mittel | localStorage | `src/pages/Research.tsx` |
| Research Feed (Oracle/Pulse) | Hybrid (localStorage cache + server) | niedrig | server | `src/lib/api/feed.ts`, `backend/src/routes/feed.ts` |
| AI TA Analyzer | Local (stub) | niedrig | stub | `src/components/chart/AITAAnalyzerDialog.tsx` |
| Journal Entries | Hybrid (IDB cache+queue + server) | **hoch** (Auth mismatch) | server geplant, derzeit blockiert | `src/services/journal/*`, `backend/src/routes/journal.ts` |
| Insights Feed | Hybrid (stub initial + server refresh) | mittel | server | `src/pages/Insights.tsx`, `src/services/oracle/api.ts`, `backend/src/routes/oracle.ts` |
| Insights Read-State | Hybrid (local overlay + server) | mittel | server, overlay pending | `src/services/oracle/readStateQueue.ts`, `backend/src/routes/oracle.ts` |
| Unified Signals | Hybrid (localStorage cache + server) | niedrig | server | `src/components/signals/UnifiedSignalsView.tsx`, `backend/src/routes/signals.ts` |
| Alerts UI List | Local (IDB + seed stubs) | **hoch** | local IDB (UI), aber SW/Server anders | `src/components/alerts/useAlertsStore.ts`, `src/sw/sw-alerts.ts`, `backend/src/routes/alerts.ts` |
| Alerts Events (SW) | Real (server) | **hoch** (UI nicht integriert) | server (variiert je Backend) | `src/sw/sw-alerts.ts`, `backend/src/routes/alerts.ts`, `apps/backend-alerts/src/routes/events.ts` |
| Discover Tokens | Real geplant, faktisch „empty“ | mittel | none | `src/lib/discover/discoverService.ts`, canonical backend ohne Route |
| Terminal Quote/Swap | Real geplant, faktisch broken | **kritisch** | none (prod) | `src/lib/trading/*`, `vercel.json`, `backend/src/app.ts`, `api/quote.ts`, `api/swap.ts` |
| Reasoning Insights | Hybrid (IDB cache + server) | mittel | server mit cache | `src/services/reasoning/*`, `backend/src/routes/reasoning/*` |
| Settings | Local | niedrig | local store | `src/pages/Settings.tsx` |

---

## DEPLOYMENT AUDIT (Routing, Reachability, Diagramm, Korrekturen)

### 1) `vercel.json` (verifiziert)
- Rewrite: `/api/(.*)` → `https://$VERCEL_BACKEND_URL/api/$1` → **alle** `/api` Requests gehen an canonical Backend.
- SPA fallback: `/(.*)` → `/index.html`.

### 2) Erreichbarkeit `/api/quote` & `/api/swap`
- **Ist (Production-Routing)**: Requests landen im canonical Backend → **404** (Endpunkte fehlen).
- **Ist (Repo-Implementierung)**: Endpunkte existieren als Vercel Functions (`api/quote.ts`, `api/swap.ts`), werden aber durch Rewrite nicht erreicht.

### 3) Effektive Nutzung `api/` (Vercel Functions)
- In dieser Repo-Konfiguration: **nicht genutzt** in Production (Rewrite besitzt keine Ausnahmen).
- `api/_lib/production-guard.ts` blockt core endpoints in prod bei direktem Function-Hit; Rewrite verhindert diese Hits ohnehin.

### 4) Routing-Diagramm (Ist)
```
Browser
  |
  | GET/POST /api/*
  v
Vercel (SPA Hosting)
  |
  | rewrite: /api/(.*) -> https://$VERCEL_BACKEND_URL/api/$1
  v
Railway: canonical backend (backend/src/server.ts)
  |
  +-- REST: /api/journal, /api/oracle, /api/feed, /api/signals, /api/reasoning, /api/alerts, ...
  |
  X-- fehlt: /api/quote, /api/swap, /api/discover/tokens
```

### 5) Korrekturvorschläge (Implementierungsoptionen)
- **Option A (Policy-konform, simplest ownership)**: Quote/Swap + Discover im canonical Backend implementieren; `api/` bleibt non-canonical.
- **Option B (gezielte Ausnahme)**: `vercel.json` bekommt Ausnahmen für `/api/quote` & `/api/swap` auf Vercel Functions; Guardrail-Script/Docs müssen dies explizit erlauben.
- **Option C (Backend split)**: `/api/alerts/*` auf Alerts-Service routen (Proxy), Rest canonical Backend; erfordert klare Contract-Harmonisierung + Guardrail Anpassung.

---

## DOCS AUDIT (Aktualität, Drift, fehlende Canonicals, Cleanup-Plan)

### 1) Drift / Fehler (verifiziert)
- **README referenziert nicht-existente Datei**
  - `README.md` verweist auf `docs/backend/BACKEND_OWNERSHIP.md` → Pfad existiert nicht (kein `docs/backend/`).
- **`shared/docs/API_CONTRACTS.md` beschreibt `api/`-Success-Envelope falsch**
  - Doc behauptet `api/` Success `{ data, status:<number>, message? }`, tatsächliche Implementierung ist `{ status:"ok", data }` (`api/_lib/response.ts`).
- **Deployment Doc Syntax drift**
  - `docs/DEPLOYMENT.md` dokumentiert `/api/:path*` + `{env:VERCEL_BACKEND_URL}`, tatsächliches `vercel.json` nutzt `/api/(.*)` + `$VERCEL_BACKEND_URL`.
- **Terminal Doc vs Deployment**
  - `docs/TERMINAL.md` beschreibt `/api/quote` & `/api/swap` als verfügbar; bei aktivem Rewrite fehlen diese Endpunkte im canonical Backend (P0.1).
- **Discover Doc vs canonical Backend**
  - `docs/DISCOVER.md` sagt endpoint „not yet implemented“; canonical backend hat tatsächlich keine Route → Overlay bleibt leer (silent fallback).

### 2) Fehlende Canonical Docs (für klare Ownership)
- **`docs/DATAFLOW.md`**: tabellarische SoT-Definition (Local/Hybrid/Real) + Konfliktmatrix (aktueller Audit-Table kann Basis sein).
- **`docs/API_SPEC.md`**: *laufende* API Spec pro canonical backend (inkl. quote/swap/discover) mit Beispielen + Statuscodes.
- **`docs/ALERTS_ARCHITECTURE.md`**: canonical Alerts Architektur + Entscheidung (backend vs alerts-service), Eventing (poll vs SSE vs push).
- **`docs/TERMINAL_ROUTING.md`**: Production Routing Entscheidung für Quote/Swap + Guardrail Policy.
- **`docs/FEATURE_MATRIX.md`**: pro Tab/Feature: Stub/Real, Offline, Auth Required, SoT, Test Coverage.

### 3) Doc Update Plan (konkret, mechanisch)
- **P0**: README-Fix (Ownership-Link entfernen/ersetzen), Terminal/Deployment auf tatsächliche Routing-Entscheidung ausrichten.
- **P1**: `shared/docs/API_CONTRACTS.md` korrigieren (api-envelope), plus Hinweis auf Production Guard Response Shape (`410` non-enveloped) dokumentieren.
- **P1**: Neue Canonicals hinzufügen (oben), in `docs/README.md` verlinken.

---

## ARCHITEKTUR-ZIELBILD (Target, minimal-delta, implementierbar)

**Ziel:** Ein einziges canonical `/api` Backend für Production (klarer SoT), keine stillen Dual-Implementierungen.

- **Routing**
  - `/api/*` → canonical Backend (Railway), *inkl.* `/api/quote`, `/api/swap`, `/api/discover/tokens`.
  - Alerts-Service (falls beibehalten) nur über explizite Proxy-Endpunkte oder separate Subdomain; UI/SW nutzen einheitlich die canonical Oberfläche.
- **SoT**
  - Journal: server SoT, Offline Queue ist write-behind (Idempotency + conflict policy).
  - Alerts: server SoT, UI zeigt server state; SW ist reine Notification-Schicht.
  - Terminal: server SoT für quote/swap; FE bleibt dünn.
- **Auth**
  - Entweder: konsequent anon-first (v1) oder konsequent auth-required mit UI; keine Mischzustände.

---

## ISSUE-READY TASKLISTE (Copy/Paste GitHub)

### P0
- [ ] **Terminal: `/api/quote` & `/api/swap` canonicalisieren** (backend oder routing-exception).  
  **DoD:** Production-Routing liefert funktionierende Quote/Swap Antworten; FE Terminal swap flow läuft durch.
- [ ] **Journal Auth-Policy entscheiden & implementieren** (anon erlaubt *oder* Auth UI + Session).  
  **DoD:** Journal list/create/confirm/archive/restore/delete funktionieren im Default-Setup; klare UI Gates bei 401.
- [ ] **Alerts Konsolidierung: eine canonical Alerts-API + UI/SW Integration**.  
  **DoD:** Alerts UI nutzt API; SW pollt denselben Event-Stream; keine parallelen SoT.
- [ ] **Vercel `/api` Ownership Guardrail aktivieren + Syntax anpassen**.  
  **DoD:** Script läuft in CI; vercel.json Änderungen, die API ownership brechen, failen.

### P1
- [ ] **Discover: `/api/discover/tokens` im canonical Backend implementieren** (oder Feature hard-disable + UX kommunizieren).  
  **DoD:** Overlay zeigt Tokens aus API; keine silent-empty Fallbacks ohne UI Banner.
- [ ] **Offline UX konsolidieren** (`OfflineContext` vs Journal Queue).  
  **DoD:** Offline-Badge/Toasts entsprechen tatsächlichem Verhalten; Writes entweder blockiert oder zuverlässig queued.
- [ ] **Docs Drift fixen** (`README` Ownership link, `API_CONTRACTS` envelope, `DEPLOYMENT` rewrite syntax, `TERMINAL` routing realities).  
  **DoD:** Keine Broken Links; Docs stimmen mit vercel.json/backend/src/app.ts überein.
- [ ] **Scheduler multi-instance safety** (Locking/Leader Election).  
  **DoD:** Jobs laufen höchstens einmal pro Tick in Production; dokumentierte Strategie.

### P2
- [ ] **Stubs abbauen** (Dashboard/Chart/Oracle initial state) oder als Demo klar isolieren.  
  **DoD:** Keine `use*Stub` auf Primary Routes im Production Build (oder hinter `VITE_DEMO_MODE`).
- [ ] **Legacy Sync Queue entfernen** (`syncQueue`, `sync.service.ts`) oder vereinheitlichen.  
  **DoD:** Nur ein Offline-Queue-System; DB Stores dokumentiert und genutzt.


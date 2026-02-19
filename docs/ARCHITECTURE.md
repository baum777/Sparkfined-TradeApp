# Sparkfined — System Architecture

Zweck: **Code schneller verstehen**, **Fehler schneller debuggen**, **Dominance-Layer korrekt anwenden**.  
Scope: **Ist-Zustand** (keine Roadmap).

## 1) High-Level System Overview

### Web-App (Vite/React SPA)
- **Code**: `src/`
- **Routing/Layout**: React Router unter einer AppShell (Navigation + `Outlet`).
- **API Access**: zentral über `src/services/api/client.ts` (kanonisches Response-Envelope enforced).
- **Service Worker**: `src/sw/*` (Polling für Alerts/Oracle, Dedupe in IndexedDB, Notifications).

### Backend (canonical)
- **Code**: `backend/`
- **Runtime-Modell**: Always-on Node HTTP Server (nicht serverless-funktional gedacht).
- **API Base Path**: `/api` (siehe `backend/src/app.ts`).
- **Persistence**: SQLite default (Dev/CI), Postgres optional via `DATABASE_URL`.
- **Jobs**: Scheduler + Cleanup (z.B. Events/Oracle/TA Cache).

> Parallel-Implementierungen (nicht canonical in Production, sofern Vercel-`/api` Rewrite aktiv ist):
> - `api/`: Vercel Functions Alternative
> - `apps/backend-alerts/`: separater Alerts-Service

### Shared Contracts
- **Cross-package Contracts**: `shared/contracts/*` (additive-only, versioniert).
- **Frontend Contracts**: `src/types/*` (UI-boundary).
- **Backend kann `shared/` nicht importieren** (tsconfig rootDir), daher werden Contracts bei Bedarf gespiegelt
  (z.B. Dominance: `shared/contracts/sparkfined-dominance.ts` ↔ `backend/src/lib/dominance/contracts.ts`).

### Dominance Layer (Governance + Quality Gates)
- **Code**: `backend/src/lib/dominance/*`
- **Aufgabe**: Risiko-Policy, Autonomy-Tiers, Golden-Tasks, Auto-Correct Loop, Trace/Cost Layer, Memory Artifacts.
- **Aktivierung**: runtime flag `ENABLE_SPARKFINED_DOMINANCE=true`.

## 2) Data Flow Diagram (text)

```
Browser
  |
  | 1) SPA navigation + data fetch
  v
Vercel (Static Frontend)
  |\
  | \ 2) /api/* rewrite
  |  \
  |   v
  |  External Backend Host (z.B. Railway)  <---- (VERCEL_BACKEND_URL)
  |        |
  |        | 3) /api/* handlers (envelope + requestId)
  |        v
  |     backend/ (Node)
  |      |  \
  |      |   \ 4) External providers (best-effort, budgeted)
  |      |    \- LLM Router/Providers (DeepSeek/OpenAI/Grok)
  |      |    \- Onchain (Helius)
  |      |    \- Market/Pulse data (z.B. DexPaprika/Moralis)
  |      |
  |      v
  |   DB/KV (SQLite default, Postgres optional)
  |
  | 5) SW polling (foreground-driven)
  v
Service Worker (src/sw/*)
  - GET /api/alerts/events?since=...
  - GET /api/oracle/daily
  - IndexedDB dedupe + notifications
```

## 3) Request Lifecycle (canonical)

1. **Client build-time config**:
   - `baseURL = VITE_API_URL || "/api"` (Frontend).
   - `credentials = same-origin` (default) oder `include` wenn `VITE_ENABLE_AUTH="true"`.
2. **HTTP call**: `fetch()` via `ApiClient`.
3. **Vercel routing**:
   - `/api/(.*)` → `https://$VERCEL_BACKEND_URL/api/$1` (siehe `vercel.json`).
4. **Backend router**:
   - Request Context + `x-request-id` Extraktion/Generierung.
   - Auth-Parsing (wenn aktiv) und `userId` Resolution.
   - Input validation (Zod).
5. **Domain execution**:
   - Repo/Service Layer (DB/KV/Cache).
   - Optional: Provider Calls (Onchain/LLM) mit Timeouts/Budget/Tier gating.
6. **Response**:
   - **Success**: `{ "status": "ok", "data": ... }`
   - **Error**: `{ "error": { "code": "...", "message": "...", "details": { "...", "requestId": "..." } } }`
   - Header: `x-request-id` immer gesetzt.

## 4) Golden Task System (Dominance)

Definition: **Deterministische Qualitäts-Gates** als Befehlsliste.

- **Global Suite** (Default):
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm run test:backend`
  - `npm run test:e2e`
- **Subset Planning** (diff-basiert):
  - `backend_only`: lint + tsc + test:backend
  - `frontend_only`: lint + tsc + build
  - `ci_deploy`: globale Suite
  - `llm_router_or_adapters`: lint + tsc + build + test:backend

Workstreams werden automatisch nach Pfadgruppen gesliced (z.B. `backend/`, `src/`, `.github/`, …), um parallel-by-default zu planen.

## 5) Risk Policy Flow (Dominance)

Input: `diffStats = { filesChanged, linesAdded, linesDeleted, largestFileDeltaLines?, touchedPaths[] }`

```
requiresApproval(diff) -> { required, reasons[] }
deriveRiskLevel(diff)  -> low|medium|high|critical
decidePolicy(enabled, diff) -> autonomyTier + guardrails + goldenTaskPlan + maxAutoFixIterations
```

Approval-Reasons (exakt): `core_engine`, `adapters`, `ci_deploy`, `large_diff`.

Autonomy-Tier (aktuell):
- **Tier 1**: Dominance disabled (keine Auto-Aktionen, keine Golden Tasks).
- **Tier 2**: Enabled + keine Approval-Pflicht (default).
- **Tier 4**: Enabled + Approval required (Escalation).
- **Tier 3**: reserviert (vertraglich vorhanden, aktuell nicht aktiv genutzt).

Max Auto-Fix Iterations:
- `critical`: 3
- `high`: 4
- sonst: 5

## 6) Feature Flag Behavior

| Flag | Ort | Default | Effekt |
|---|---|---:|---|
| `VITE_ENABLE_AUTH` | Frontend build-time | false | `credentials="include"` + SW/Client behandeln 401/403 als authRequired nur wenn Flag an + Token genutzt |
| `VITE_ENABLE_DEV_NAV` | Frontend build-time | false | Dev-Navigation sichtbar/unsichtbar |
| `ENABLE_SPARKFINED_DOMINANCE` | Backend runtime | false | Dominance Policy/Tracing/Memory/Golden Tasks aktiv |
| `LLM_TIER_DEFAULT` | Backend runtime | `free` | Default Tier für kosten-/fähigkeitsabhängige Endpoints |
| `ONCHAIN_TUNING_PROFILE` | Backend runtime | `default` | Onchain gating/confidence tuning (determinism + cost) |

## 7) Dependency Model

```
src/ (web)  --->  shared/contracts (optional consume)  --->  (no backend imports)
   \                 ^
    \                |
     ---> /api (HTTP boundary) <--- backend/ (Node)

backend/ cannot import shared/ => mirrors contracts when needed (dominance_v1).
```

Rules:
- API boundary is JSON + envelopes, not TS imports.
- Shared contracts are **additive-only** unless version-bumped.

## 8) Routing Architecture

### Canonical Routes

**Primary Routes:**
- `/research?view=chart&q=<ticker|solanaBase58>`
  - `view=chart` is required and normalized automatically
  - `q` carries the market query
  - `/research/:assetId` preserves path segment during normalization
  - Optional `replay=true` toggles replay mode
  - Optional `panel=watchlist` shows watchlist panel

- `/insights`
  - Consolidated workspace for Oracle area
  - Optional URL state: `?filter=unread`, `?mode=status`
  - Detail route: `/insights/:insightId`

- `/journal?view=pending|confirmed|archived`
  - List filters only; UI mode (`mode=inbox|learn|timeline`) stays on `/journal`
  - `/journal/:entryId` is the only detail route

- `/terminal`
  - Standalone Trading Terminal
  - Also available embedded in Research (feature-flagged)

**Legacy Redirects:**
- `/chart` → `/research?view=chart`
- `/replay` → `/research?view=chart&replay=true`
- `/watchlist` → `/research?view=chart&panel=watchlist`
- `/oracle` → `/insights`
- `/asset/:assetId` → `/research/:assetId`
- `/journal?entry=<id>` → `/journal/<id>`

**Notes:**
- Query parameter ordering is order-independent
- Legacy redirects preserve existing query params
- Canonical defaults are injected (e.g. `view=chart`)

---

## 9) Reasoning Layer

**Purpose:** LLM-powered reasoning for trade review, session review, board scenarios, and insight critic.

**Architecture:**
- **Code:** `backend/src/routes/reasoning/*`, `api/reasoning/*`
- **Offline-first:** Last valid insights cached in IndexedDB
- **Revalidate:** Online insights are revalidated and cache updated
- **Machine-parseable:** Strict JSON outputs validated against Zod schemas
- **Safety:** Insight Critic is separate final step (conflicts/missing data/overreach)

**Routes:**
- `POST /api/reasoning/trade-review`
- `POST /api/reasoning/session-review`
- `POST /api/reasoning/board-scenarios`
- `POST /api/reasoning/insight-critic`

**Data Contract:**
- `ReasoningResponse<T>` with `status`, `data`, `warnings`, `confidence`
- `ReasoningMeta` with `latency_ms`, `model`, `version`
- `ReasoningError` for error cases

**Offline Cache Key:**
```
{ type, referenceId, version, hash(context) }
```

---

## 10) Deployment Model

### Frontend (Vercel)
- Build: `npm run build` (Vite), output `dist/`.
- Routing: SPA fallback rewrite to `/index.html`.
- API: `/api/*` rewrite to external backend via `VERCEL_BACKEND_URL`.
- SW caching headers: `sw.js` / `service-worker.js` must be `max-age=0, must-revalidate`.

### Backend (external host, canonical)
- Start: `node dist/server.js` (after `pnpm -C backend build`).
- DB: `DATABASE_URL` steuert SQLite vs Postgres.
- Migrations: `pnpm -C backend migrate` (kontrolliert ausführen; nicht „best-effort“).


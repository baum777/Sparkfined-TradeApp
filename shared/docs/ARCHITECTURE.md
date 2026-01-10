# Architektur (Ist-Zustand)

Stand: Code- und Repo-Audit. Diese Datei beschreibt **nur** den aktuellen Ist‑Zustand und markiert Unsicherheiten als **TODO**.

## Systemüberblick

Dieses Repo enthält:

- **Frontend (Vite/React SPA + Service Worker)**: UI, lokale Persistenz (IndexedDB/LocalStorage), API-Calls.
- **Backend(s)**: Es existieren mehrere parallele Implementierungen für `/api/*` (Details unten).
- **Shared Contracts**: Typen/Contracts in `shared/contracts/*` für gemeinsame API-/Domänen‑Shapes.

## Repo-Struktur (relevant)

- `src/`: Frontend (React, Services Layer, Service Worker unter `src/sw/`)
- `backend/`: Always-on Node HTTP Server (eigener Router, SQLite default, Cleanup-Interval/JOBS)
- `api/`: Vercel‑Serverless Functions (Node Runtime; `api/*` + `api/_lib/*`)
- `apps/backend-alerts/`: Separater Alerts‑Service (Express + Postgres + Watcher/SSE/Push)
- `shared/contracts/`: Contract‑first Typen (Single Source of Truth für Shapes, nicht automatisch für Response-Envelopes)

## Kanonische Ownership-Regeln (aus Repo-Guardrails)

Das Repo enthält eine CI‑Guardrail `scripts/verify-vercel-api-ownership.mjs`, die erzwingt:

- **Production `/api/*` muss exklusiv vom externen Node‑Backend bedient werden** (keine Vercel‑Function Exceptions).
- In `vercel.json` muss ein Catch‑All Rewrite existieren: `/api/:path*` → `https://{env:VERCEL_BACKEND_URL}/api/:path*`.

Konsequenz:

- Das **Vercel-Frontend** behandelt `/api/*` als **Same-Origin** und leitet intern per Rewrite an ein **externes Backend** weiter.

## Komponenten & Datenfluss

### Lokale Entwicklung (typischer Flow)

- Browser → Vite Devserver (`vite.config.ts`): Proxy `/api` → `http://localhost:3000`
- Backend läuft lokal auf `localhost:3000` und registriert Routen unter dem Base-Prefix `/api` (siehe `backend/src/app.ts`).

### Production (aktuelles Routing laut `vercel.json`)

- Browser → Vercel (Frontend)
- Vercel Rewrite: `/api/*` → `https://{env:VERCEL_BACKEND_URL}/api/*`
- Externes Backend ist **nicht** Teil des Vercel-Deploys dieses Frontend-Projekts (Upstream/Hosting z.B. Railway; siehe `railway.toml`).

## Backends im Repo (parallel, mit unterschiedlichen Contracts)

### 1) `backend/` (Always-on Node Server)

- Einstieg: `backend/src/server.ts`
- Registrierte Routen: `backend/src/app.ts`
- Persistenz: SQLite default (`DATABASE_URL`), Migrations unter `backend/migrations/`
- Background/Intervals: Cleanup via `setInterval(...)` + Scheduler (`backend/src/jobs/scheduler.ts`)
- Response-Envelope: **`{ status: "ok", data: T }`** (siehe `backend/src/http/response.ts`)
- Error-Envelope: **`{ error: { code, message, details? } }`** (siehe `backend/src/http/error.ts`)
- Auth: Optional (wenn `Authorization: Bearer <jwt>` vorhanden, wird `userId=sub` extrahiert; sonst `userId="anon"`; siehe `backend/src/http/router.ts`)

### 2) `api/` (Vercel Serverless Functions)

- Layout: `api/<route>.ts` (Vercel Functions)
- Shared Code: `api/_lib/*`
- Response-Envelope: **`{ data: T, status: number, message?: string }`** (siehe `api/_lib/response.ts`)
- Error-Envelope: **`{ error: { code, message, details? } }`** (siehe `api/_lib/response.ts` + `api/_lib/errors.ts`)
- Auth: Default **required** (JWT) pro Handler, außer RouteConfig setzt `auth: "none"` (siehe `api/_lib/handler.ts`)

### 3) `apps/backend-alerts/` (separater Alerts-Service)

- Express Server + Watcher Loop
- API Paths ohne `/api` Prefix: z.B. `/alerts`, `/events`, `/stream`, `/push` (siehe `apps/backend-alerts/src/server.ts`)
- Auth: Simple API-Key via `Authorization: Bearer <API_KEY>` (siehe `apps/backend-alerts/src/auth/authMiddleware.ts`)

## Contracts (Single Source of Truth)

### Wo liegen die Contracts?

- `shared/contracts/*` (TypeScript)

Beispiele:

- `shared/contracts/grokPulse.ts`: Grok Pulse Snapshot/History Typen
- `shared/contracts/reasoning-router.ts`: Reasoning Router/Llm Execute Contracts
- `shared/contracts/sol-chart-ta-journal.ts`: SOL Chart/Onchain Feature Packs + Analyse Result
- `shared/contracts/journal.settings.ts`: Settings + Journal Insights Request Types

### Wie werden Contracts verwendet?

- Frontend importiert Contracts direkt (z.B. `src/services/api/grokPulse.ts` importiert `shared/contracts/grokPulse`).
- Backend nutzt teils eigene Domain-Typen; Contract-Alignment ist nicht überall erzwungen.

**Resolved:** Frontend-`ApiClient` und kanonisches `backend/` nutzen dasselbe Success-Envelope `{status:"ok",data}` (siehe `shared/docs/API_CONTRACTS.md`).


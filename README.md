# TradeApp — Repo-Dokumentation (Ist-Zustand)

## Mission (faktisch)

Dieses Repo implementiert ein Trading/Journal/Signals Frontend (SPA) plus mehrere Backend‑Implementierungen für `/api/*`. Ziel der Dokumentation ist, den **aktuellen Ist‑Zustand** ohne Spekulation zu beschreiben.

## Repo-Struktur (Frontend / Backend / Shared)

- **Frontend = Repo-Root**: `/` (Vite/React SPA) mit `src/` + `src/sw/` (Service Worker) und `vite.config.ts`
- **Kanonisches Node Backend (Always-on)**: `backend/` (HTTP Server, SQLite default, Jobs/Intervals)
- **Alternative Vercel Serverless Backend**: `api/` (Vercel Functions + `_lib`)
- **Separater Alerts-Service**: `apps/backend-alerts/` (Express + Postgres + Push/SSE)
- **Contracts (Single Source of Truth für Shapes)**: `shared/contracts/`

## Local Dev Quickstart

### Voraussetzungen

- Node.js (Repo nutzt Node 20 im `backend/Dockerfile`)
- Empfohlen: **pnpm** (Root `packageManager: pnpm@10.x`)

### Install

```bash
pnpm install
```

### Acceptance / Verifikation

```bash
npm run verify
```

### Backend starten (`backend/`)

```bash
pnpm -C backend dev
```

### Frontend starten

```bash
pnpm dev
```

## Ports & API Base Paths (Ist-Zustand)

- **Frontend Devserver**: `http://localhost:8080` (siehe `vite.config.ts`)
- **Backend (`backend/`)**: `http://localhost:3000`
- **API Base Path**: `/api`
  - Lokal: Vite proxyt `/api/*` → `http://localhost:3000` (siehe `vite.config.ts`)
  - Production: Vercel rewritet `/api/*` → `https://{env:VERCEL_BACKEND_URL}/api/*` (siehe `vercel.json`)

## Environment Variables (Kurzüberblick)

- Vollständige Liste: `shared/docs/ENVIRONMENT.md`
- Beispiel: `.env.example` (enthält nicht alle Vars; siehe **Status/Risiken**)

Wichtig:
- **Keine Secrets** als `VITE_*` setzen.

## Implementierte Features (nach Code, nicht nach Roadmap)

Backend-Routen sind u.a. unter `backend/src/app.ts` registriert:

- Journal: CRUD + Insights
- Alerts: CRUD + Events Stream Endpoint (HTTP)
- Oracle: Daily + Read-State
- Chart/TA: TA + `chart/analyze`
- Reasoning/LLM: `/reasoning/*` + `/llm/execute`
- Feed/Signals: `/feed/oracle`, `/feed/pulse`, `/signals/unified`

Zusätzlich existiert `api/` als Serverless‑Backend mit eigener Implementierung und Tests.

## Doku-Index (`shared/docs/*`)

- `shared/docs/ARCHITECTURE.md`
- `shared/docs/LOCAL_DEV.md`
- `shared/docs/ENVIRONMENT.md`
- `shared/docs/API_CONTRACTS.md`
- `shared/docs/PROVIDERS.md`
- `shared/docs/DEPLOYMENT.md`
- `shared/docs/SECURITY.md`
- `shared/docs/STATUS.md`

## Troubleshooting (häufig)

### 1) `/api` Routing stimmt nicht

- Lokal: Proxy ist nur für `/api` konfiguriert.
- Production: `/api/*` wird auf das externe Backend via `VERCEL_BACKEND_URL` geroutet.

### 2) Contract Drift: Response Envelope

Kanonisch (Production + Local Dev via `backend/`):
- Success: `{ status:"ok", data }`
- Error: `{ error: { code, message, details? } }`

Wenn API Calls fehlschlagen: siehe `shared/docs/API_CONTRACTS.md`.

### 3) Backend startet nicht (Env Validation)

`backend/` verlangt `HELIUS_API_KEY` im Env Schema (Zod). Ohne diese Variable startet der Prozess nicht.


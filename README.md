# TradeApp — Repo-Dokumentation (Ist-Zustand)

## Mission (faktisch)

Dieses Repo implementiert ein Trading/Journal/Signals Frontend (SPA) plus mehrere Backend‑Implementierungen für `/api/*`. Ziel der Dokumentation ist, den **aktuellen Ist‑Zustand** ohne Spekulation zu beschreiben.

## Repo-Struktur (Frontend / Backend / Shared)

- **Frontend = Repo-Root**: `/` (Vite/React SPA) mit `src/` + `src/sw/` (Service Worker) und `vite.config.ts`
- **Kanonisches Node Backend (Always-on)**: `backend/` (HTTP Server, SQLite default, Jobs/Intervals)
- **Alternative Vercel Serverless Backend**: `api/` (Vercel Functions + `_lib`)
- **Separater Alerts-Service**: `apps/backend-alerts/` (Express + Postgres + Push/SSE)
- **Contracts (Single Source of Truth für Shapes)**: `shared/contracts/`

**Backend-Ownership**: Siehe `docs/backend/BACKEND_OWNERSHIP.md` (Production-Entscheidung, Routing, Ownership).

## Local Development Quickstart

### Prerequisites

- Node.js 20+ (see `backend/Dockerfile`)
- **pnpm** (root `packageManager: pnpm@10.x`)

### Installation

```bash
pnpm install
```

### Verification

```bash
npm run verify
```

### Start Backend

```bash
pnpm -C backend dev
```

**Expected:** Server on `http://localhost:3000`, health check at `/api/health`

**Required Env:** `HELIUS_API_KEY` in `backend/.env` (backend validates env vars on start)

### Start Frontend

```bash
pnpm dev
```

**Expected:** Frontend on `http://localhost:8080`, API proxy `/api/*` → `http://localhost:3000`

**Note:** See [shared/docs/LOCAL_DEV.md](shared/docs/LOCAL_DEV.md) for detailed setup and troubleshooting.

## Ports & API Base Paths (Ist-Zustand)

- **Frontend Devserver**: `http://localhost:8080` (siehe `vite.config.ts`)
- **Backend (`backend/`)**: `http://localhost:3000`
- **API Base Path**: `/api`
  - Lokal: Vite proxyt `/api/*` → `http://localhost:3000` (siehe `vite.config.ts`)
  - Production: Vercel rewritet `/api/*` → Railway-Backend (siehe `vercel.json` und `docs/backend/BACKEND_OWNERSHIP.md`)

## Database (Backend)

- `backend/` nutzt `DATABASE_URL` für die DB-Auswahl:
  - **SQLite (local dev)**: `sqlite:./.data/tradeapp.sqlite`
  - **Postgres (production)**: `postgres://user:pass@host:5432/db`

## Environment Variables

**Complete Reference:** [shared/docs/ENVIRONMENT.md](shared/docs/ENVIRONMENT.md)

**Key Variables:**
- `VITE_RESEARCH_EMBED_TERMINAL` - Enable Trading Terminal in Research tab (default: false)
- `VITE_SENTRY_DSN` - Sentry DSN for error tracking (optional)
- `VITE_SOLANA_CLUSTER` - devnet | mainnet-beta
- `VITE_SOLANA_RPC_URL` - Custom RPC endpoint (optional)
- `VERCEL_BACKEND_URL` - Backend hostname for `/api/*` rewrite (production)

**Important:**
- **No secrets** in `VITE_*` variables (they are bundled into frontend)
- See [Environment](shared/docs/ENVIRONMENT.md) for complete list

## Implementierte Features (nach Code, nicht nach Roadmap)

Backend-Routen sind u.a. unter `backend/src/app.ts` registriert:

- Journal: CRUD + Insights
- Alerts: CRUD + Events Stream Endpoint (HTTP)
- Oracle: Daily + Read-State
- Chart/TA: TA + `chart/analyze`
- Reasoning/LLM: `/reasoning/*` + `/llm/execute`
- Feed/Signals: `/feed/oracle`, `/feed/pulse`, `/signals/unified`

Zusätzlich existiert `api/` als Serverless‑Backend mit eigener Implementierung und Tests.

## Documentation

**Core Documentation:** See [docs/README.md](docs/README.md) for complete index.

**Quick Links:**
- [Architecture](docs/ARCHITECTURE.md) - System architecture
- [Terminal](docs/TERMINAL.md) - Trading Terminal
- [Discover](docs/DISCOVER.md) - Discover Overlay
- [Deployment](docs/DEPLOYMENT.md) - Deployment & feature flags
- [Security](docs/SECURITY.md) - Security constraints
- [QA](docs/QA.md) - Testing procedures

**Shared Documentation:**
- [Environment](shared/docs/ENVIRONMENT.md) - Complete env var reference
- [API Contracts](shared/docs/API_CONTRACTS.md) - API specifications
- [Providers](shared/docs/PROVIDERS.md) - Provider documentation

## Troubleshooting (häufig)

### 1) `/api` Routing stimmt nicht

- Lokal: Proxy ist nur für `/api` konfiguriert.
- Production: `/api/*` wird auf das externe Backend via Vercel-`vercel.json` Rewrite geroutet (Railway-Domain einsetzen).

### 2) Contract Drift: Response Envelope

Kanonisch (Production + Local Dev via `backend/`):
- Success: `{ status:"ok", data }`
- Error: `{ error: { code, message, details? } }`

Wenn API Calls fehlschlagen: siehe `shared/docs/API_CONTRACTS.md`.

### 3) Backend startet nicht (Env Validation)

`backend/` verlangt `HELIUS_API_KEY` im Env Schema (Zod). Ohne diese Variable startet der Prozess nicht.

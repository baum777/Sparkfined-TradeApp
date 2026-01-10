# Deployment (Ist-Zustand)

## Production Routing (Frontend)

Quelle: `vercel.json`

- Frontend wird als Vite SPA gebaut (`buildCommand: "npm run build"`, Output `dist/`).
- **Rewrite-Regel**:
  - `source: /api/:path*`
  - `destination: https://{env:VERCEL_BACKEND_URL}/api/:path*`
- Alle übrigen Paths rewriten auf `/index.html` (SPA routing).

Konsequenz:

- Production API Calls im Browser gehen an `/api/*` (same-origin) und werden serverseitig von Vercel an ein externes Backend weitergeleitet.

## Kanonisches Backend Hosting (Railway)

Quelle: `railway.toml` (Repo Root)

- Deployt `backend/` als Docker Service:
  - Dockerfile: `backend/Dockerfile`
  - Start: `node dist/server.js`
  - Healthcheck: `/api/health`

**Wichtig:** Das ist ein Always-on Prozess (nicht Vercel Functions kompatibel).

## Weitere Deployables im Repo

### `apps/backend-alerts/`

- Separater Service (Express + Postgres + Watcher/SSE/Push).
- Enthält eigene Railway Konfiguration (siehe `apps/backend-alerts/railway.toml`, falls vorhanden) und eigene Start-Skripte.

### `api/` (Vercel Functions Backend)

- Im Repo implementiert, aber durch die Vercel Rewrite‑Policy des Frontend-Projekts in Production **nicht automatisch** als `/api/*` aktiv.
- Kann als eigenes Vercel-Projekt deployt werden, ist aber **nicht kanonisch** für dieses Frontend-Projekt solange `vercel.json` `/api/*` auf `VERCEL_BACKEND_URL` rewritet.

## Guardrails gegen API Drift

Quelle: `scripts/verify-vercel-api-ownership.mjs`

Policy:

- In Production darf **kein** `/api/*` Subpath auf relative `/api/*` destinations zeigen (würde Vercel Functions im selben Projekt aktivieren).
- Es darf **keine** `/api` Rewrite Exceptions geben (Allowlist ist leer).

Ziel:

- API Ownership bleibt eindeutig und verhindert „halb Vercel Functions, halb externes Backend“.

## Local vs Production Unterschiede

| Thema | Lokal | Production |
|---|---|---|
| API Routing | Vite Proxy `/api` → `http://localhost:3000` | Vercel Rewrite `/api/*` → `https://{VERCEL_BACKEND_URL}/api/*` |
| Backend Runtime | `backend/` Node Server (listen) | Extern gehosteter Node Server (Railway) |
| Service Worker | Dev: nicht registriert | Production Build: registriert optional (siehe `VITE_ENABLE_SW_POLLING`) |

## TODOs (bewusst offen)

- **TODO:** Ziel-Topologie dokumentieren, falls `api/` jemals als eigenes Backend-Projekt produktiv genutzt wird (separates Deployment/Domain; nicht über dieses Frontend `/api/*`).


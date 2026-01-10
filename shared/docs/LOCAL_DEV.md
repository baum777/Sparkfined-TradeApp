# Lokale Entwicklung (Ist-Zustand)

## Voraussetzungen

- Node.js (Repo nutzt Node 20 in `backend/Dockerfile`)
- Paketmanager: **pnpm** ist im Root als `packageManager` gesetzt (`pnpm@10.x`).

## Quickstart: Frontend + kanonisches Backend (`backend/`)

**Frontend = Repo-Root** (dieser Ordner): `vite.config.ts`, `src/`, `playwright.config.ts`, Root-`package.json`.

### 1) Env-Dateien anlegen

- Frontend: `.env.local` (Vite) mit mindestens:
  - `VITE_API_URL=/api` (oder weglassen; Fallback ist `"/api"`)
- Backend: `backend/.env` (oder Root `.env` – wird via `dotenv` geladen), mit mindestens:
  - `HELIUS_API_KEY=...` (**required** in `backend/src/config/env.ts`)

**Hinweis:** Das Backend validiert Env Vars strikt beim Start (Zod). Ohne `HELIUS_API_KEY` startet es nicht.

### 2) Dependencies installieren

```bash
pnpm install
```

### Acceptance / Verifikation (schnell)

```bash
npm run verify
```

### 3) Backend starten (Port 3000)

```bash
pnpm -C backend dev
```

Erwartet:
- Server auf `http://localhost:3000`
- Health: `GET http://localhost:3000/api/health`

### 4) Frontend starten (Port 8080)

```bash
pnpm dev
```

Erwartet:
- Frontend auf `http://localhost:8080`
- Dev-Proxy: `/api/*` → `http://localhost:3000` (siehe `vite.config.ts`)

## Alternative Services (optional)

### `apps/backend-alerts/` (separater Alerts-Service)

Start:

```bash
pnpm -C apps/backend-alerts dev
```

Standard-Port: `PORT=3000` (siehe `apps/backend-alerts/src/env.ts`).

**Wichtig:** Dieser Service kollidiert standardmäßig mit dem `backend/` Port. Wenn beide parallel laufen sollen, setze `PORT` für `apps/backend-alerts` auf einen anderen Wert (z.B. `3001`).

### `api/` (Vercel Functions) lokal

Im Repo gibt es `api/` als Vercel‑Functions Implementierung. Für lokale Entwicklung ist hier **kein** „dev server“ Script im Root definiert; aktuell sind vor allem `typecheck`/`test` vorhanden.

**TODO:** Dokumentieren, wie `api/` lokal ausgeführt wird (z.B. via Vercel CLI), falls gewünscht.

## Häufige Probleme / Troubleshooting

### 1) API-Response Envelope passt nicht zum Frontend

- Frontend `ApiClient` erwartet kanonisch **`{ status:"ok", data }`**.
- `backend/` liefert standardmäßig **`{ status:"ok", data }`** (Success) und **`{ error:{...} }`** (Error).

Wenn Frontend `ApiContractError` wirft: prüfe, ob du wirklich das kanonische Backend triffst (Local: Vite Proxy; Prod: Vercel Rewrite) und siehe `shared/docs/API_CONTRACTS.md`.

### 2) Port / Proxy passt nicht

- Vite läuft auf **8080** (nicht 5173).
- Proxy ist nur für `/api` gesetzt.

Wenn dein Backend nicht auf `localhost:3000` läuft:
- Passe `vite.config.ts` Proxy target an **oder**
- Setze `VITE_API_URL` auf die richtige Base (Achtung: CORS in Dev/Prod).

### 3) Backend startet nicht wegen Env Validation

Das `backend/` validiert Env Vars beim Start. Typische Ursache:
- `HELIUS_API_KEY` fehlt.

### 4) Service Worker Verhalten

- Service Worker wird in Dev standardmäßig **nicht** registriert (`src/main.tsx` registriert nur in Production Builds).
- SW Polling kann über `VITE_ENABLE_SW_POLLING="true"` aktiviert werden (Production Build).


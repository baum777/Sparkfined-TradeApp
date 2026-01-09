# Backend-Architektur (Ist-Zustand)

Stand: Repo-Analyse (Konfig + Code) — **Ist-Zustand**, nicht Zielbild.

## TL;DR

- **Vercel hostet das Frontend** (Vite SPA).
- **`/api/*` wird in `vercel.json` per Rewrite auf ein externes Backend geroutet** (über `VERCEL_BACKEND_URL`).
- Im Repo existieren **mehrere parallele Backend-Implementierungen**:
  - `backend/`: Node Server (Always-on Prozess, SQLite default, Interval-Cleanup) → **für externes Hosting geeignet**, nicht Vercel Functions.
  - `api/`: Vercel Serverless Functions (KV/Memory Store, Tests) → **im Repo vorhanden**, aber durch den Rewrite in `vercel.json` in Production **nicht der Default-Pfad**.
  - `apps/backend-alerts/`: separater Alerts-Service (Express + Postgres + Watcher/SSE/Push) → **Railway-ready**.

---

## 1) Vercel Einbindung von Backend / API

### 1.1 Aktives Routing in `vercel.json`

`/api/:path*` wird an eine externe Base weitergeleitet:

- Source: `/api/:path*`
- Destination: `https://{env:VERCEL_BACKEND_URL}/api/:path*`

Implikation:
- **Das Vercel-Projekt betreibt in Production nicht primär eigene `/api/*`-Functions**, sondern leitet an ein externes Backend weiter.
- Die Variable `VERCEL_BACKEND_URL` wird **von Vercel zur Laufzeit fürs Routing** verwendet (nicht `VITE_*`).

### 1.2 Guardrail gegen `/api`-Ownership Drift

`scripts/verify-vercel-api-ownership.mjs` erzwingt, dass `/api/*` in Production **ausschließlich** auf das externe Backend zeigt (keine Exceptions, keine relative `/api`-Destinations).

---

## 2) Backend-Implementierungen im Repo (parallel)

### 2.1 `backend/` — Node Backend (Server-Prozess)

Charakteristika:
- Startet einen HTTP Server (`createServer(...).listen(...)`).
- Führt periodische Cleanup-Jobs per `setInterval(...)` aus.
- Default-Persistenz: SQLite (via `DATABASE_URL`/`DATABASE_PATH` Defaults).
- Hat eigene Routes unter `/api/*` (Health, Journal, Alerts, Oracle, TA, Reasoning, Usage usw.).

Bedeutung:
- Passt zu **externem Hosting** (Railway/Fly/Render).
- Passt **nicht** zu Vercel Functions (Always-on Prozess + Intervals + lokaler FS/SQLite-Annahme).

### 2.2 `api/` — Vercel Serverless Functions (Node runtime)

Charakteristika:
- Enthält `api/*` Route-Dateien (Vercel Functions Layout) + `_lib` Shared Code.
- Nutzt KV-Abstraktion mit Vercel Store + Memory Fallback.
- Enthält Cron-Endpoints unter `api/cron/*`.
- Umfangreiche Tests.

Bedeutung:
- Ist eine **alternative/parallel** Backend-Implementierung, die zu Vercel Functions passt.
- **Wichtig:** Durch `vercel.json` Rewrite wird `/api/*` in Production aktuell aber auf ein externes Backend umgeleitet, wodurch diese Functions **nicht automatisch** benutzt werden.

### 2.3 `apps/backend-alerts/` — separater Alerts-Service

Charakteristika:
- Express-Service mit Postgres (`DATABASE_URL`).
- Watcher/Evaluator Loop, Push (VAPID), SSE Stream.
- Eigener Deploy-Config `apps/backend-alerts/railway.toml` + eigene README mit Railway-Schritten.

Bedeutung:
- Das ist ein **dedizierter Subservice** (nicht identisch mit `backend/`).
- Kann als Upstream für Alerts/Push/Stream dienen.

---

## 3) Railway Hinweise (stark)

### 3.1 Root Railway Deployment (für `backend/`)

`/workspace/railway.toml` ist auf Docker-Deploy aus `backend/` konfiguriert:
- builder: docker
- startCommand: `node dist/server.js`
- healthcheck: `/api/health`

=> **Railway ist als Hosting-Plattform für das externe Backend vorgesehen.**

### 3.2 Railway Deployment (für `apps/backend-alerts/`)

`apps/backend-alerts/railway.toml` + `apps/backend-alerts/README.md` beschreiben Railway explizit.

### 3.3 Railway als Upstream in `api/` (Proxy Layer)

In `api/_lib/alertsProxy.ts` existiert ein Proxy auf einen Railway-Upstream:
- `RAILWAY_ALERTS_URL` (Base URL, z.B. `https://<service>.up.railway.app`)
- `ALERTS_API_KEY` (server-to-server Secret)

**Wichtig:** Das passt zu einem Modell „Vercel Functions proxien zu Railway“ – steht aber im Konflikt mit dem aktuellen globalen `/api/*` Rewrite in `vercel.json` (weil der Rewrite den Proxy-Pfad in Production grundsätzlich umleitet).

---

## 4) Relevante Environment Variables (Ist-Stand)

### 4.1 Vercel (Routing)

- `VERCEL_BACKEND_URL`
  - Wird in `vercel.json` im Rewrite verwendet.
  - Erwartetes Format (aufgrund Destination-Template): **Hostname ohne `https://` und ohne `/api`**.

### 4.2 Frontend (Vite Build-Time)

- `VITE_API_URL`
  - Default-Fallback im Frontend (und Service Worker): `"/api"`
  - Sinnvoller Wert bei Rewrite-Topologie: `"/api"` (same-origin über Vercel Rewrite).

### 4.3 `backend/` (Runtime)

- `DATABASE_URL` (default `sqlite:./.data/tradeapp.sqlite`)
- `PORT` / `BACKEND_PORT` (Ports)
- AI Provider Keys (optional): `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GROK_API_KEY`, etc.

### 4.4 `api/` (Runtime, falls genutzt)

- KV: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, ...
- Alerts Proxy (falls genutzt): `RAILWAY_ALERTS_URL`, `ALERTS_API_KEY`

---

## 5) Offene Punkte / Annahmen (klar markiert)

- **A1 (wahrscheinlich, aber nicht beweisbar ohne Vercel-Project-Settings):**
  Ob `VERCEL_BACKEND_URL` in der aktuellen Vercel-Umgebung wirklich gesetzt ist, kann man aus dem Repo allein nicht sicher sehen.
- **A2 (konfigurationsbedingt):**
  Wenn `vercel.json` in Production aktiv ist (typisch), dann ist `/api/*` **extern**. Falls jemand `vercel.json` ignoriert/überschreibt, kann das abweichen.
- **A3 (parallel backends):**
  Das Repo enthält mehrere Backends; der „kanonische“ Production-Pfad ist aktuell primär durch `vercel.json` determiniert, nicht durch Existenz von `api/`.


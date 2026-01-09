# Status (Ist-Zustand)

Diese Datei ist eine nüchterne Bestandsaufnahme.

## ✅ Implementiert

- **Frontend SPA (Vite/React)** inkl. Navigation/AppShell (`src/`)
- **API Client Layer** inkl. Envelope-Validierung + Raw-Mode (`src/services/api/client.ts`)
- **Service Worker Build/Bundle** (Output `sw.js`) + Message Handling (Registration nur in Production Builds) (`src/sw/*`, `vite.config.ts`, `src/main.tsx`)
- **Backend `backend/`** (Always-on Node HTTP Server)
  - Routen unter `/api/*` (Health/Meta/Journal/Alerts/Oracle/TA/Reasoning/LLM/Feed/Signals)
  - SQLite/Migrations (`backend/migrations/*`)
  - In-memory Rate Limiting (`backend/src/http/rateLimit.ts`)
- **Backend `api/`** (Vercel Functions)
  - Umfangreiche Route-Struktur + `_lib` Layer (KV, Rate Limit, Auth, Domain)
  - Tests vorhanden (`api/tests/*`)
- **Service `apps/backend-alerts/`**
  - Express API + Watcher Loop + SSE + Push (VAPID) + Postgres

## 🚧 In Arbeit / bewusst unvollständig

- **Auth im Frontend**: Feature Flag vorhanden, aber standardmäßig deaktiviert (AuthService blockiert Calls).
- **SW Polling**: Flag `VITE_ENABLE_SW_POLLING` vorhanden; Kommentar `BACKEND_TODO` im Code.
- **Watchlist Sync**: `backend/src/routes/health.ts` signalisiert `watchlistSync: false` mit `BACKEND_TODO`.
- **Offline Sync Queue**: `src/services/sync/sync.service.ts` referenziert `dbService.addToSyncQueue(...)` (Anbindung/Implementierung prüfen).

## ❌ Nicht implementiert / unklar

- **Einheitlicher API Response Envelope** über alle Deployments:
  - `backend/`: `{ status:"ok", data }`
  - `api/` + Frontend: `{ data, status:number, message? }`
  - Das ist aktuell ein harter Drift-Risiko.
- **Analytics/Sentry**: Env Vars sind dokumentiert, aber tatsächliche Verwendung im Code ist aktuell nicht eindeutig nachweisbar.

## ⚠️ Bekannte Risiken / Technical Debt

- **Mehrere Backends parallel** (`backend/`, `api/`, `apps/backend-alerts/`) mit teils überlappenden Features → Drift-Risiko.
- **Production Ownership Policy vs Frontend Envelope**: Guardrail erzwingt externes Node Backend für `/api/*`, Frontend `ApiClient` erwartet derzeit das `api/` Envelope.
- **`.env.example` Drift**: Beispiel deckt nicht alle required/runtime Vars ab (z.B. `HELIUS_API_KEY` ist im `backend/` required).

## TODOs (konkret)

- **TODO:** Kanonisches Backend und kanonisches Response Envelope festlegen; Frontend/Backend angleichen.
- **TODO:** Auth-Policy konsolidieren (anon vs JWT required) inkl. Dev/Prod Verhalten.
- **TODO:** Dokumentieren, ob `api/` als separates Vercel-Projekt aktiv genutzt wird oder nur als Alternative/Tests.


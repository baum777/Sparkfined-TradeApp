## Vercel Deployment Checklist (Production) — TradeApp

Ziel: Ein **fail-safe** Deployment auf Vercel, ohne “unknown unknowns”.

---

## 0) Vorentscheidung: Deployment-Topologie (blockierend)

**Ihr müsst eine der beiden Optionen verbindlich wählen**, weil sie die komplette Vercel-Konfiguration bestimmt.

### Option A — Vercel = Frontend, Backend = extern (empfohlen als schnellster “safer path”)
- **[ ]** Backend-Hosting wählen (z.B. Railway/Fly/Render) mit **persistenter DB**.
- **[ ]** Eine feste Production-API-Base definieren (z.B. `https://api.example.com/api`).
- **[ ]** Entscheiden, ob Frontend `/api` via Rewrite/Proxy auf diese Base routet **oder** `VITE_API_URL` direkt auf externe API zeigt.

### Option B — Vercel = Frontend + Backend als Vercel Functions (nur nach Umbau)
- **[ ]** Backend darf **nicht** als eigener Server `listen()` laufen.
- **[ ]** DB darf **nicht** lokale SQLite-Datei sein (Vercel FS ist nicht persistent).
- **[ ]** Background Jobs (`setInterval`) müssen durch Vercel Cron / externe Worker ersetzt werden.

> Wenn diese Vorentscheidung nicht getroffen ist: **NO-GO**.

---

## 1) Vercel Projekt-Setup (Repository/Build)

### Versions/Build Defaults
- **[ ]** Node Version auf Vercel auf **20.x** setzen (gleich CI).
- **[ ]** Package Manager: **npm** (Lockfile: `package-lock.json`).
- **[ ]** Install Command: `npm ci`
- **[ ]** Build Command: `npm run build`
- **[ ]** Output Directory: `dist`

### Monorepo-Fallen
- **[ ]** Sicherstellen, dass Vercel im Root des Repos baut (Frontend).  
  - Backend liegt unter `backend/` und ist aktuell **nicht** Vercel-ready (Serverprozess).

---

## 2) `vercel.json` (Routing + Headers) — Pflicht

### SPA Routing (React Router)
- **[ ]** Rewrite/Route-Regel setzen: **alle App-Routen** (ohne Dateiendung) müssen auf `/index.html` fallen.
- **[ ]** Verifizieren: Direktaufruf von `/settings`, `/journal`, `/oracle` darf **nicht** 404 liefern.

### API Routing (`/api`)
Wählt passend zur Topologie:

**Option A (Backend extern):**
- **[ ]** `/api/(.*)` → Rewrite zu externer Backend-Base (z.B. `https://api.example.com/api/$1`), **oder**
- **[ ]** `VITE_API_URL` direkt auf externe Base setzen und zusätzlich sicherstellen, dass der Service Worker ebenfalls korrekt zur API kommt (siehe SW-Punkt).

**Production Safety Rule (P0):**
- **`/api/*` ist in Production ausschließlich über das Node-Backend zu bedienen** (same-origin via Rewrite).
- Das Repo-Directory `api/*` (Vercel Functions) ist **nicht-kanonisch** und darf **keine** Produkt-Endpunkte in Production bedienen.
- CI erzwingt diese Regel (Build schlägt fehl, wenn `vercel.json` `/api/*`-Rewrite-Exceptions einführt).

**Option B (Vercel Functions):**
- **[ ]** API-Routes als Vercel Functions implementieren (nicht im Scope dieses Audits).

### Service Worker Cache-Control (kritisch)
- **[ ]** Header für `sw.js` setzen: `Cache-Control: no-cache, no-store, must-revalidate`
- **[ ]** Verifizieren: Nach Deploy nimmt der Client zuverlässig den neuen SW (kein “stuck on old SW”).

### Minimum Security Headers (v1)
- **[ ]** `X-Content-Type-Options: nosniff`
- **[ ]** `Referrer-Policy: strict-origin-when-cross-origin` (oder strenger)
- **[ ]** `Permissions-Policy` (minimal, alles was nicht gebraucht wird deaktivieren)
- **[ ]** CSP definieren (mindestens `default-src 'self'`; dann iterativ erweitern)
- **[ ]** HSTS nur aktivieren, wenn HTTPS garantiert und Subdomains geplant (`includeSubDomains`) sauber verstanden sind

---

## 3) Environment Variables (Vercel Environments)

### Production (pflicht)
- **[ ]** `VITE_API_URL` setzen:
  - **Same-origin**: `"/api"` (nur wenn `/api` wirklich geroutet ist)
  - **External API**: `https://api.example.com/api`
- **[ ]** `VITE_ENABLE_DEV_NAV="false"` (fail-safe: Dev UI nicht exponieren)

### Production (optional, aber kontrolliert)
- **[ ]** `VITE_ENABLE_ANALYTICS` nur aktivieren, wenn Privacy/Consent geklärt ist
- **[ ]** `VITE_SENTRY_DSN` (falls Sentry genutzt wird)
- **[ ]** `VITE_ANALYTICS_ID` (falls Analytics genutzt wird)

### Preview/Staging
- **[ ]** Separate Werte für Preview (andere API, andere DSNs)
- **[ ]** Sicherstellen, dass Preview niemals Production-Daten schreibt (DB/Keys strikt trennen)

---

## 4) Backend Readiness Checks (vor “GO” zwingend)

Diese Checks gelten unabhängig von Hosting (extern oder Functions).

### Datenbank & Persistenz
- **[ ]** Kein lokales SQLite auf ephemeral FS in Production
- **[ ]** Migrations-Runbook existiert:
  - **[ ]** Wer führt Migration aus?
  - **[ ]** Wann (vor Deploy)?
  - **[ ]** Rollback-/Forward-only Strategie dokumentiert

### Auth & Identity (blockierend für echte User-Daten)
- **[ ]** Bearer token darf **nicht** als `userId` genutzt werden
- **[ ]** Token-Verifikation serverseitig vorhanden (JWT validation / session)
- **[ ]** Token Storage Strategie (HttpOnly cookies bevorzugt; localStorage nur mit starkem XSS-hardening)

### Rate limits / Abuse
- **[ ]** Rate limits werden in **allen** API-Routen enforced (nicht nur TA)
- **[ ]** Distributed store (Redis/Upstash) für Production geplant, falls horizontal skaliert wird

### Idempotency
- **[ ]** `Idempotency-Key` Standard final (Header vs Query) + dokumentiertes Verhalten

---

## 5) Service Worker Checks (Prod)

- **[ ]** Erwartung bestätigen: SW polling läuft nur, solange App offen ist (v1).
- **[ ]** Wenn Backend external ist:
  - **[ ]** SW muss API korrekt erreichen (aktuell hardcoded `/api`)
  - **[ ]** CORS/Authorization Verhalten ist definiert
- **[ ]** `sw.js` Update-Flow testen:
  - **[ ]** Neuer Deploy → Client holt neue SW-Version
  - **[ ]** Keine “stale notifications”/Dedupe-Fehler nach Update

---

## 6) Smoke Test Plan (nach Production Deploy)

### Frontend
- **[ ]** `GET /` lädt ohne JS errors
- **[ ]** Deep link refresh: `/settings`, `/journal`, `/oracle` (keine 404)
- **[ ]** `sw.js` lädt (Status 200) und wird nicht aggressiv gecacht

### API (falls angebunden)
- **[ ]** `GET /api/health` → 200 + `ok: true`
- **[ ]** Critical flows:
  - **[ ]** Journal list/create/confirm/archive/restore/delete
  - **[ ]** Alerts list/create/update/events
  - **[ ]** Oracle daily + read-state

### Observability
- **[ ]** Logs sind sichtbar (Vercel/Provider)
- **[ ]** Fehler lassen sich per Request-ID korrelieren (wenn implementiert)

---

## 7) Rollback Plan (Production)

- **[ ]** Rollback-Schrittfolge dokumentiert (Vercel “Promote previous deployment”)
- **[ ]** Datenkompatibilität geprüft:
  - **[ ]** App N und N-1 funktionieren gegen DB Schema N (oder klarer Migrations-Plan)
- **[ ]** “Kill switch” vorhanden (z.B. Feature-Flag, um teure Pfade wie TA zu deaktivieren)


## Known Risks / Unknowns / Tradeoffs — TradeApp (Vercel Production)

Diese Liste ist bewusst konservativ: Alles Unklare wird als Production-Risiko behandelt.

---

## Blocker-Risiken (GO-Live verhindern)

### 1) Kein definiertes Vercel-Routing (`vercel.json` fehlt)
- **Impact**: 404 auf Deep Links/Refresh (React Router), keine kontrollierten Header (u.a. `sw.js` caching), `/api` nicht geroutet.
- **Betroffene Bereiche**: fehlendes `vercel.json`, React Router Pages.
- **Remediation**:
  - **[ ]** `vercel.json` mit SPA fallback + `/api` rewrite + `sw.js` headers hinzufügen.

### 2) Backend nicht Vercel-kompatibel (Serverprozess + lokale SQLite + Intervals)
- **Impact**: Backend läuft nicht (oder nicht zuverlässig) auf Vercel; Datenverlust; unkontrollierte Job-Ausführung.
- **Betroffene Bereiche**: `backend/src/server.ts`, `backend/src/db/sqlite.ts`, `backend/src/db/migrate.ts`.
- **Remediation**:
  - **[ ]** Deployment-Strategie festlegen: Backend extern hosten oder zu Vercel Functions umbauen.
  - **[ ]** Persistente DB wählen; keine lokale SQLite-Datei in Production.
  - **[ ]** Migrations/Jobs als kontrollierten Prozess planen (kein “on boot”).

### 3) Auth/Identity ist unsicher (Bearer token == userId)
- **Impact**: Kritische Security-Lücke (Impersonation, Daten-Manipulation).
- **Betroffene Bereiche**: `backend/src/http/router.ts`, Oracle read states, alle user-scoped Daten.
- **Remediation**:
  - **[ ]** Auth-Design + Token-Verifikation implementieren (nicht im Scope dieser Review, aber blockierend für Production mit echten Userdaten).

---

## Hohe Risiken (nicht zwingend Blocker, aber sehr wahrscheinlich problematisch)

### 4) Datenpersistenz / Konsistenz
- **Impact**: Datenverlust bei Deploy/Restart, Inkonsistenzen zwischen Instances, nicht reproduzierbare Bugs.
- **Betroffene Bereiche**: `DATABASE_URL=sqlite:./.data/...`, SQLite WAL.
- **Remediation**:
  - **[ ]** Externe persistente DB mit klarer Backup- und Migrations-Strategie.

### 5) Rate Limiting ist unvollständig
- **Impact**: Abuse/DoS, Kostenrisiko (z.B. teure Endpoints), unkontrollierte Last.
- **Betroffene Bereiche**: Rate limit wird nur in `backend/src/routes/ta.ts` genutzt.
- **Remediation**:
  - **[ ]** Rate limits pro Endpoint enforce, wie in `docs/backend/API_SPEC.md` beschrieben.
  - **[ ]** Für Production: shared rate-limit store (Redis) statt In-Memory.

### 6) Idempotency-Key Implementierung inkonsistent
- **Impact**: Double-writes oder 500s bei retries; Client/Spec drift.
- **Betroffene Bereiche**: `backend/src/routes/journal.ts` (Query Param statt Header), `backend/src/domain/journal/repo.ts` (Key als ID).
- **Remediation**:
  - **[ ]** Standard (Header) festlegen; idempotency semantics dokumentieren; DB-level upsert/handling.

### 7) Request-ID / Logging Kontext ist nicht async-sicher
- **Impact**: Logs sind schwer zu korrelieren; falsche requestId in Logs.
- **Betroffene Bereiche**: `backend/src/http/requestId.ts`, `backend/src/observability/logger.ts`.
- **Remediation**:
  - **[ ]** AsyncLocalStorage (oder gleichwertig) für request context.

---

## Produkt-/Funktionsrisiken (Tradeoffs, Erwartungen klären)

### 8) Alerts “laufen” aktuell nicht autonom
- **Befund**: Evaluator existiert, aber ist an keinen Cron/Worker gebunden.
- **Impact**: Nutzer erwarten Alerts, aber es werden keine Events produziert → SW Polling findet nichts.
- **Remediation**:
  - **[ ]** Worker/Cron Architektur festlegen (Vercel Cron → API route → evaluator, oder extern).

### 9) Service Worker ist “foreground-only”
- **Befund**: UI sendet `SW_TICK` alle 30s; bei Tab-close stoppt Polling.
- **Impact**: Keine Notifications, wenn App nicht offen ist (bis Push implementiert ist).
- **Remediation**:
  - **[ ]** Erwartung explizit kommunizieren; spätere Push-Roadmap.

### 10) Service Worker nutzt hardcoded `"/api"`
- **Impact**: Wenn Backend external ist und `VITE_API_URL`/Routing nicht korrekt gesetzt sind, brechen SW Requests (Routing/CORS).
- **Betroffene Bereiche**: `src/sw/sw-alerts.ts`, `src/sw/sw-oracle.ts`.
- **Remediation**:
  - **[ ]** Same-origin `/api` sicherstellen (Rewrite; empfohlen) und `VITE_API_URL="/api"` setzen, **oder**
  - **[ ]** `VITE_API_URL` direkt auf externe API setzen und CORS/Auth sauber lösen.

---

## Security & Privacy Risiken

### 11) Token Storage in `localStorage`
- **Impact**: XSS → Token-Diebstahl → Account takeover.
- **Betroffene Bereiche**: `src/services/auth/auth.service.ts`.
- **Remediation**:
  - **[ ]** HttpOnly Cookies bevorzugen; CSP/XSS-hardening falls JS-access tokens.

### 12) Security Headers (CSP/HSTS/…)
- **Impact**: Erhöhte Angriffsfläche (XSS/Clickjacking/…).
- **Remediation**:
  - **[ ]** `vercel.json` headers definieren und iterativ härten (CSP als zentrales Element).

---

## Unknowns (müssen vor Go-Live geklärt werden)

- **[ ]** Wo läuft das Backend final (Vercel Functions vs extern)?
- **[ ]** Welche persistente DB wird genutzt (Provider/Region/Backups/Migrations)?
- **[ ]** Auth-Story: Welche Identity Provider? Welche Token-Semantik? Logout/refresh/rotation?
- **[ ]** Observability: Sentry/OTel? Mindestmetriken? Alerting?
- **[ ]** Recht/Privacy: Analytics/Tracking aktiv? Consent nötig? Datenklassifikation (PII)?


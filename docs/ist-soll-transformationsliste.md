## Ist→Soll Transformationsliste (issue-basiert, PR-fähig)

### Ziel & Regeln (Traceability)

Diese Liste liefert eine **umsetzbare Transformations-Roadmap** vom aktuellen **Ist-Zustand** zum **Soll-Zustand** als **priorisierte Issues (P0–P3)**, inkl. **Abnahme-Checklisten** und **Meta-Übersicht**.

**Regel (ohne Annahmen):** Jede Issue ist **direkt aus Repo & Doku ableitbar** und enthält mindestens eine **Quelle** (Dateipfad + Kontext). Wo Spezifikationen miteinander kollidieren, wird das als **Entscheidungs-Issue** formuliert.

**Soll-Baseline (Produkt/Tech):**
- `product_spec.md` (Features + Akzeptanzkriterien + NFRs)
- `tech_spec.md` (Architektur/Stack/Testing/CI-Strategie)

**Ist-Baseline (Repo-Dokus / Guardrails):**
- `README.md` (Ist-Beschreibung + Start/Verify)
- `shared/docs/STATUS.md` (Implementiert/Unvollständig/Risiken)
- `shared/docs/ARCHITECTURE.md` (Topologie + Ownership Regeln)
- `shared/docs/API_CONTRACTS.md` (kanonische Endpoints + Envelope)
- `shared/docs/ENVIRONMENT.md` (Env Vars inkl. TODO/Drift)
- `shared/docs/SECURITY.md` (Auth/Secrets/Rate Limiting Risiken)
- `shared/docs/DEPLOYMENT.md` + `scripts/verify-vercel-api-ownership.mjs` (Production Routing Guardrail)
- `shared/docs/CONTRACT_DRIFT_REPORT.md` (Drift/TODOs pro Endpoint; teils widersprüchlich zu `src/services/api/client.ts`)
- `ROUTING_NOTES.md` (kanonische Routes + Legacy Redirects)

---

### Meta-Übersicht (Counts)

| Kategorie | P0 | P1 | P2 | P3 | Summe |
|---|---:|---:|---:|---:|---:|
| A) Produkt-Scope & Feature-Gaps | 2 | 4 | 6 | 0 | 12 |
| B) Plattform/Backend/Contracts | 2 | 4 | 3 | 0 | 9 |
| C) UX/A11y/Performance | 0 | 0 | 2 | 0 | 2 |
| D) Observability/Analytics | 0 | 0 | 1 | 1 | 2 |
| E) Testing/QA | 0 | 1 | 1 | 0 | 2 |
| **Summe** | **4** | **9** | **13** | **1** | **27** |

---

## A) Produkt-Scope & Feature-Gaps (User-visible)

### IST-SOLL-001 (P0) — Dashboard-KPIs vs Journal-Datenmodell (Spec-Kollision auflösen)

- **Ist (Beobachtung)**:
  - `product_spec.md` verlangt Trading-KPIs (Gesamtprofit, Win-Rate, Ø Trade, #Trades).
  - Im Code existiert ein **Diary/Reflection Journal** ohne Trading-Felder; Dashboard berechnet primär Counts (Entries/Alerts/Insights), nicht P&L/Winrate.
- **Soll (Outcome)**:
  - Eindeutige Produktentscheidung + daraus abgeleitete Implementierung: entweder
    - (A) Journal wird zum Trading-Journal erweitert (Entry/Exit/P&L/…) **oder**
    - (B) `product_spec.md` wird an den tatsächlich intendierten Diary/Reflection-Scope angepasst (inkl. KPI-Definition).
- **Quellen**:
  - `product_spec.md` (Dashboard KPI-Akzeptanzkriterien; Journal Eingabefelder inkl. Entry/Exit/P&L)
  - `tech_spec.md` (Kommentar „Journal v1: Diary/Reflection (no trading fields)“)
  - `src/pages/Dashboard.tsx` (Counts statt Trading-KPIs)
  - `src/components/journal/JournalCreateDialog.tsx` (Diary-Payload)
- **PR-fähiger Scope**:
  - PR1: „Decision + Spec Alignment“ (ADR/Notiz in `product_spec.md`/`tech_spec.md` + ggf. `shared/docs/STATUS.md`).
  - PR2+: Folge-PRs je nach Entscheidung (Data Model, UI, API, Migration).
- **Abnahmekriterien**:
  - [ ] Entscheidung dokumentiert (inkl. Konsequenzen für KPIs & Datenmodell).
  - [ ] `product_spec.md` und implementierter Scope sind konsistent (keine widersprüchlichen Akzeptanzkriterien).

### IST-SOLL-002 (P0) — Push Notifications End-to-End (UI + SW + Backend)

- **Ist (Beobachtung)**:
  - Frontend: SW pollt Alerts und zeigt Notifications (`src/sw/sw-alerts.ts`), Push-Event-Handler ist als „future“ markiert (`src/sw/service-worker.ts`).
  - Settings: Permission/Push sind **UI-only** bzw. „BACKEND_TODO“ (`src/pages/Settings.tsx`, `src/components/settings/AdvancedSections.tsx`).
  - Backend: Push-Implementierung existiert im separaten Service `apps/backend-alerts/` (Routes + VAPID), aber nicht im kanonischen `backend/` (Production `/api/*`).
- **Soll (Outcome)**:
  - Push-Benachrichtigungen gemäß `product_spec.md` (Browser/Mobile Push) sind **konfigurierbar**, **subscribable** und **zustellbar** im kanonischen Deployment-Pfad.
- **Quellen**:
  - `product_spec.md` (Alerts & Notifications Akzeptanzkriterien)
  - `shared/docs/DEPLOYMENT.md` + `scripts/verify-vercel-api-ownership.mjs` (Production `/api/*` Ownership)
  - `apps/backend-alerts/src/routes/push.ts` + `apps/backend-alerts/src/services/push.ts` (Push/VAPID)
  - `src/sw/sw-alerts.ts`, `src/sw/service-worker.ts` (SW Polling + Push TODO)
  - `src/pages/Settings.tsx` (Permission „BACKEND_TODO“)
- **PR-fähiger Scope** (empfohlen als Kette):
  - PR1: Ziel-Topologie festlegen (kanonischer Push-Owner: `backend/` vs separater Service) + Doku.
  - PR2: API für VAPID/PublicKey + Subscription CRUD (kanonisch) + Security (Auth/Rate limit).
  - PR3: Frontend: Permission + Subscribe/Unsubscribe + Statusanzeige (Settings) + SW Push handling.
  - PR4: Alert-Events → Push Dispatch (Server) + Log/Audit Trail.
- **Redesign-Hinweise**:
  - In Settings klare Zustände: „Permission“, „Subscribed“, „Last delivered“, „Fehlerdiagnose“ (Design-Prinzip „Feedback“ aus `product_spec.md`).
- **Abnahmekriterien**:
  - [ ] Permission wird real via `Notification.requestPermission()` abgefragt (keine Stub-Setzung).
  - [ ] VAPID/PublicKey kommt aus kanonischem Backend (nicht nur `localStorage`).
  - [ ] Subscribe/Unsubscribe funktioniert; Subscription wird serverseitig persistiert.
  - [ ] Mindestens ein serverseitig ausgelöstes Push-Event wird im Browser angezeigt.

### IST-SOLL-003 (P1) — Theme Switcher (Light/Dark/System) statt „Dark-only“

- **Ist**: UI zeigt „Theme: Dark mode only (v1)“ (`src/pages/Settings.tsx`), Settings-Store fixiert `theme: 'dark'` (`src/components/settings/useSettingsStore.ts`). Tech-Spec listet `next-themes` als Stack-Bestandteil (`tech_spec.md`).
- **Soll**: Theme Switcher (Light/Dark/System) gemäß `product_spec.md`.
- **Quellen**: `product_spec.md` (Settings Akzeptanzkriterien), `tech_spec.md` (next-themes), `src/pages/Settings.tsx`.
- **PR-Scope**:
  - UI: Theme Toggle/Selector + Persistenz.
  - AppShell: ThemeProvider wiring (falls noch nicht vorhanden) + System-Mode.
- **Abnahmekriterien**:
  - [ ] Light/Dark/System auswählbar und persistent.
  - [ ] UI reagiert ohne Reload; Fokus/ARIA bleibt korrekt.

### IST-SOLL-004 (P1) — Journal: Screenshot Upload statt deaktiviertem Upload-Button

- **Ist**: Journal „Chart Snapshot“ bietet URL + Upload-Icon, aber Upload ist deaktiviert (`disabled`) (`src/components/journal/JournalCreateDialog.tsx`).
- **Soll**: „Screenshots hochladen“ gemäß `product_spec.md`.
- **Quellen**: `product_spec.md` (Journal Akzeptanzkriterien), `src/components/journal/JournalCreateDialog.tsx`.
- **PR-Scope**:
  - Minimales MVP: Upload in Client (File→ObjectURL/IndexedDB) + Anzeige im Entry.
  - Erweiterung: API/Storage für Upload (Contract + Backend Persistenz).
- **Abnahmekriterien**:
  - [ ] Nutzer kann Bilddatei auswählen; Vorschau wird angezeigt.
  - [ ] Screenshot ist nach Reload verfügbar (persistiert: IndexedDB oder Backend).

### IST-SOLL-005 (P1) — Learn Hub: echte Lesson-Inhalte + Progress Persistenz

- **Ist**: Lessons/Viewer sind „UI-only“; Progress Update ist `BACKEND_TODO` (`src/pages/LessonViewer.tsx`), LessonCard navigiert in Journal Learn Mode (`src/components/learn/LessonCard.tsx`).
- **Soll**: „strukturierte Lernmodule“ inkl. Fortschritt gemäß `product_spec.md`.
- **Quellen**: `product_spec.md` (Learning Hub Akzeptanzkriterien), `src/pages/LessonViewer.tsx`, `src/components/learn/LessonCard.tsx`.
- **PR-Scope**:
  - Content Source definieren (Repo-Content vs Backend).
  - Progress Persistenz (local + optional server sync).
  - Viewer: echte Inhalte (Text/Video/Interaktiv) statt Platzhalter.
- **Abnahmekriterien**:
  - [ ] Lessons zeigen echte Inhalte (mind. Text) pro Lesson-ID.
  - [ ] Fortschritt wird gespeichert und nach Reload korrekt angezeigt.

### IST-SOLL-006 (P1) — Watchlist: Persistenz/Sync über Backend (statt lokal-only)

- **Ist**:
  - Watchlist ist localStorage-basiert (`src/pages/Watchlist.tsx`) mit `BACKEND_TODO`.
  - Backend signalisiert `watchlistSync: false` und markiert `BACKEND_TODO` (`backend/src/routes/health.ts`).
- **Soll**: Watchlist „pflegen“ und „Detail-Panel“ (Produkt-Spec) mit serverseitiger Persistenz (mind. optional) und klarer Feature-Flagging.
- **Quellen**: `product_spec.md` (Watchlist Akzeptanzkriterien), `src/pages/Watchlist.tsx`, `backend/src/routes/health.ts`, `shared/docs/STATUS.md`.
- **PR-Scope**:
  - API Contract + Endpoints (list/add/remove/update notes).
  - Frontend: Sync-Strategie (offline-first möglich, aber mindestens konsistent).
  - `meta.features.watchlistSync` korrekt setzen.
- **Abnahmekriterien**:
  - [ ] Watchlist Items sind nach Gerätewechsel/Logout-Login (falls Auth) wiederherstellbar **oder** Verhalten ist explizit als lokal-only dokumentiert.
  - [ ] `GET /api/meta` Feature-Flag entspricht realem Verhalten.

### IST-SOLL-007 (P2) — Journal: Tagging-System (Strategien/Fehlertypen) + Filter

- **Ist**: Tags sind freie comma-separated Strings (`src/components/journal/JournalCreateDialog.tsx`); Journal Search filtert nur summary/id (`src/pages/Journal.tsx`).
- **Soll**: „Tagging-System für Strategien und Fehlertypen“ + Such/Filter (`product_spec.md`).
- **Quellen**: `product_spec.md` (Journal Akzeptanzkriterien), `src/pages/Journal.tsx`, `src/components/journal/JournalCreateDialog.tsx`.
- **PR-Scope**:
  - Datenmodell: Strategy/ErrorType Felder.
  - UI: Multi-select + Filter Chips; Suche erweitert (tags, notes).
- **Abnahmekriterien**:
  - [ ] Strategien/Fehlertypen können gesetzt und gefiltert werden.

### IST-SOLL-008 (P2) — Journal: „Prompts coming soon“ implementieren

- **Ist**: Prompts Section ist Platzhaltertext (`src/components/journal/JournalCreateDialog.tsx`).
- **Soll**: Prompts/Reflexionsfragen gemäß Design-Prinzip „Progressive Disclosure“ (`product_spec.md`).
- **Quellen**: `src/components/journal/JournalCreateDialog.tsx`, `product_spec.md` (Design-Prinzipien).
- **PR-Scope**: Prompt-Bibliothek + optionales Speichern pro Entry.
- **Abnahmekriterien**:
  - [ ] Prompts sind auswählbar und persistiert im Entry.

### IST-SOLL-009 (P2) — Oracle/Insights: Kategorien + Zeitraumfilter

- **Ist**: Insights filtert nach read/unread und sucht in title/summary (`src/pages/Insights.tsx`); Kategorien/Zeitraumfilter sind nicht nachweisbar.
- **Soll**: Kategorien (Market/Personal/Educational) + Filter nach Kategorie/Zeitraum (`product_spec.md`).
- **Quellen**: `product_spec.md` (Oracle Akzeptanzkriterien), `src/pages/Insights.tsx`.
- **PR-Scope**:
  - Contract/Backend: category + createdAt + query params.
  - UI: Filter Controls + Persistenz via URL.
- **Abnahmekriterien**:
  - [ ] Kategoriefilter und Zeitraumfilter funktionieren und sind testbar.

### IST-SOLL-010 (P2) — Oracle/Insights: Pin-Funktion für beliebige Insights

- **Ist**: „Pinned“ ist v.a. TodayTakeaway (`src/components/oracle/OraclePinnedCards.tsx` zeigt statischen Content).
- **Soll**: Pin-Funktion für wichtige Insights (`product_spec.md`).
- **Quellen**: `product_spec.md`, `src/components/oracle/OraclePinnedCards.tsx`.
- **PR-Scope**:
  - Datenmodell: `pinned` pro Insight.
  - UI: Pin/Unpin Action + Pinned Section.
- **Abnahmekriterien**:
  - [ ] Insights können gepinnt und wieder entpinnt werden; Persistenz klar definiert.

### IST-SOLL-011 (P2) — Watchlist: Notizen pro Item speichern

- **Ist**: WatchItemStub enthält id/symbol/name (`src/pages/Watchlist.tsx`); Notes-UI ist nicht belegt.
- **Soll**: „Notizen zu jedem Watchlist-Item“ (`product_spec.md`).
- **Quellen**: `product_spec.md`, `src/pages/Watchlist.tsx`.
- **PR-Scope**: Notes Feld + Edit UI + Persistenz (lokal und/oder API).
- **Abnahmekriterien**:
  - [ ] Notes lassen sich editieren und bleiben erhalten.

### IST-SOLL-012 (P2) — Alerts: Historische Alert-Logs

- **Ist**: Alerts UI existiert; „historische Alert-Logs“ sind nicht als UI/Endpoint belegt.
- **Soll**: Alert Logs gemäß `product_spec.md`.
- **Quellen**: `product_spec.md` (Alerts Akzeptanzkriterien), `backend/src/app.ts` (keine `/alerts/logs` Route), `src/pages/Alerts.tsx`.
- **PR-Scope**:
  - Backend: Log-Persistenz + Endpoint.
  - UI: Logs View + Filter.
- **Abnahmekriterien**:
  - [ ] Trigger/Events sind historisch einsehbar (mind. 30 Tage oder konfigurierbar).

---

## B) Plattform/Backend/Contracts (Stabilität, Drift, Ops)

### IST-SOLL-013 (P0) — Backend-Topologie konsolidieren (mehrere Backends, Drift-Risiko)

- **Ist**: Parallel existieren `backend/` (kanonisch via Vercel rewrite), `api/` (Vercel Functions) und `apps/backend-alerts/` (separat) mit unterschiedlichen Auth/Envelopes/Features.
- **Soll**: Eindeutige Ownership je Capability (z.B. „Push = X“, „Alerts CRUD = Y“), dokumentiert + drift-sicher.
- **Quellen**: `shared/docs/ARCHITECTURE.md`, `shared/docs/STATUS.md`, `shared/docs/DEPLOYMENT.md`, `scripts/verify-vercel-api-ownership.mjs`.
- **PR-Scope**:
  - Doku: „kanonisch vs optional“ explizit (inkl. wie `api/` betrieben wird oder nicht).
  - Optional: Deprecation/Isolation von nicht-kanonischen Paths/Deploys.
- **Abnahmekriterien**:
  - [ ] Für Production ist klar: welche Runtime bedient welche Endpoints.
  - [ ] Repo-Doku ist widerspruchsfrei (keine impliziten Deployments).

### IST-SOLL-014 (P0) — Contract Drift Report korrigieren (ApiClient Envelope vs Report)

- **Ist**: `src/services/api/client.ts` enforced `{ status:"ok", data }`, aber `shared/docs/CONTRACT_DRIFT_REPORT.md` behauptet stellenweise, der Frontend-Client erwarte `{ data, status:number }`.
- **Soll**: Drift-Report stimmt mit tatsächlichem Client/Backend überein (und listet echte Drifts/TODOs).
- **Quellen**: `src/services/api/client.ts`, `shared/docs/CONTRACT_DRIFT_REPORT.md`, `shared/docs/API_CONTRACTS.md`.
- **PR-Scope**:
  - Report aktualisieren, „Traceability Map“ bereinigen, alle „TODO: Frontend expectation“ neu auditieren.
- **Abnahmekriterien**:
  - [ ] Report beschreibt das aktuell erzwingende Envelope korrekt.
  - [ ] Jede Drift-Aussage hat Quellpfade und ist reproduzierbar.

### IST-SOLL-015 (P1) — `API_BASE_PATH` Konfiguration wirksam machen (kein Hardcode)

- **Ist**: Env dokumentiert `API_BASE_PATH`, aber Router wird mit `new Router('/api')` hardcodiert (`backend/src/app.ts`); `shared/docs/ENVIRONMENT.md` markiert das als TODO.
- **Soll**: Backend liest Base Path aus Config/Env (oder entfernt Env-Var, wenn nicht unterstützt).
- **Quellen**: `backend/src/app.ts`, `shared/docs/ENVIRONMENT.md`.
- **PR-Scope**:
  - `createApp()` nutzt `config.env.API_BASE_PATH` (oder zentrale Konstante) + Tests.
- **Abnahmekriterien**:
  - [ ] Dokumentierte Env-Var hat reale Wirkung **oder** ist entfernt/als deprecated markiert.

### IST-SOLL-016 (P1) — Local Dev: Port-Konflikt backend vs backend-alerts entschärfen

- **Ist**: `apps/backend-alerts/` nutzt standardmäßig `PORT=3000` (kollidiert mit `backend/`) (`shared/docs/LOCAL_DEV.md`).
- **Soll**: Quickstart ohne Port-Kollision (Default ändern oder Script/Docs).
- **Quellen**: `shared/docs/LOCAL_DEV.md`, `apps/backend-alerts/src/env.ts`.
- **PR-Scope**:
  - Default-Port im Alerts-Service anpassen (z.B. 3001) **oder** klarer dev script/Docs.
- **Abnahmekriterien**:
  - [ ] Beide Services können lokal parallel gestartet werden (dokumentierter Default).

### IST-SOLL-017 (P1) — Env-Drift reduzieren: `.env.example`/Docs vs required Runtime Vars

- **Ist**: `.env.example` deckt nicht alle erforderlichen Vars ab; `backend/` startet ohne `HELIUS_API_KEY` nicht (`shared/docs/STATUS.md`, `shared/docs/LOCAL_DEV.md`, `shared/docs/ENVIRONMENT.md`).
- **Soll**: Env-Beispiele sind vollständig und entsprechen dem Zod-Schema.
- **Quellen**: `shared/docs/STATUS.md`, `shared/docs/ENVIRONMENT.md`, `shared/docs/LOCAL_DEV.md`.
- **PR-Scope**:
  - `.env.example`/`backend/.env.example` aktualisieren + Doku-Index.
- **Abnahmekriterien**:
  - [ ] „Quickstart“ funktioniert mit Example-Files (ohne Rätselraten).

### IST-SOLL-018 (P1) — Auth-Policy konsolidieren (anon vs JWT required; Settings/Queues)

- **Ist**:
  - Frontend Auth ist bewusst disabled (`VITE_ENABLE_AUTH`) (`src/services/api/client.ts`, `src/services/auth/auth.service.ts`, `shared/docs/SECURITY.md`).
  - `backend/` läuft standardmäßig als `userId="anon"`; bestimmte Endpoints blocken anon (z.B. Settings laut Drift-Report).
  - `api/` verlangt JWT standardmäßig (wenn deployed).
- **Soll**: Einheitliche, dokumentierte Auth-Policy pro Deployment (mind. für Settings, Oracle ReadState, Push Subscriptions).
- **Quellen**: `shared/docs/SECURITY.md`, `shared/docs/STATUS.md`, `src/services/api/client.ts`, `backend/src/http/router.ts`, `shared/docs/CONTRACT_DRIFT_REPORT.md`.
- **PR-Scope**:
  - Policy + Flagging (z.B. anon-only MVP vs auth-required).
  - Frontend Verhalten anpassen (wenn auth required: Login Flow; wenn anon: Backend-401 entfernen/entschärfen).
- **Abnahmekriterien**:
  - [ ] Kein Feature hängt „heimlich“ von Auth ab, wenn Auth disabled ist.
  - [ ] Doku beschreibt klar: welche Endpoints Auth benötigen.

### IST-SOLL-019 (P2) — Shared Contracts ergänzen (fehlende Endpoint-Response Shapes)

- **Ist**: Drift-Report markiert fehlende Contracts, z.B. vollständiger `/api/feed/pulse` Response Payload und `/api/journal/:id/insights` Response Type sind nicht in `shared/contracts/*` definiert.
- **Soll**: Contract-first Shapes für relevante Endpoints in `shared/contracts/*`.
- **Quellen**: `shared/docs/CONTRACT_DRIFT_REPORT.md`, `shared/contracts/*`, `src/services/api/grokPulse.ts`.
- **PR-Scope**:
  - Neue Contract-Typen + Backend/Frontend Alignment.
- **Abnahmekriterien**:
  - [ ] Frontend nutzt ausschließlich `shared/contracts/*` für diese Payloads (kein ad-hoc typing).

### IST-SOLL-020 (P2) — Backend Rate Limiting: cluster-safe statt in-memory

- **Ist**: `backend/` nutzt in-memory rate limiting; `shared/docs/SECURITY.md` weist auf Cluster-Unsicherheit hin.
- **Soll**: Shared Store (Redis/KV) oder dokumentierter Single-Instance Betrieb.
- **Quellen**: `shared/docs/SECURITY.md`, `backend/src/http/rateLimit.ts`.
- **PR-Scope**: Adapter für Redis/KV + Konfig + Tests.
- **Abnahmekriterien**:
  - [ ] Rate limit funktioniert in Multi-Instance Deployments deterministisch.

### IST-SOLL-021 (P2) — JWT_SECRET Production Härtung (kein Default)

- **Ist**: `backend/` hat Default `JWT_SECRET=dev-secret` (production-unsafe) laut `shared/docs/SECURITY.md`/`shared/docs/ENVIRONMENT.md`.
- **Soll**: In Production muss Secret gesetzt sein (Start fail) + Rotation-Strategie dokumentiert.
- **Quellen**: `shared/docs/SECURITY.md`, `shared/docs/ENVIRONMENT.md`.
- **PR-Scope**: Env validation tighten in prod + docs.
- **Abnahmekriterien**:
  - [ ] Production Start ohne Secret schlägt fehl; dev bleibt ergonomisch.

---

## C) UX / Accessibility / Performance (NFRs)

### IST-SOLL-022 (P2) — Accessibility (WCAG 2.1 AA) systematisch prüfen + Gate

- **Ist**: Einzelne ARIA/Keyboard-Shortcuts existieren (z.B. `ReplayControls`), aber kein systematischer a11y Gate nachweisbar.
- **Soll**: WCAG AA Konformität + a11y Testing (Tech-Spec nennt axe/Lighthouse als Option).
- **Quellen**: `product_spec.md` (Accessibility Anforderungen), `tech_spec.md` (a11y Testing), exemplarisch `src/components/chart/ReplayControls.tsx`.
- **PR-Scope**:
  - axe/lighthouse checks (CI) + Fixes für Top-Offender (focus mgmt, contrast, labels).
- **Abnahmekriterien**:
  - [ ] a11y Check läuft im CI (oder dokumentiert als manueller Gate) und ist „grün“ für Kernflows.

### IST-SOLL-023 (P2) — Performance Targets messbar machen (Lighthouse/Web Vitals + Code Splitting)

- **Ist**: Targets sind in `product_spec.md`/`tech_spec.md` definiert, aber kein nachweisbarer Mess-/Gate-Mechanismus.
- **Soll**: Messung + Regression-Gate (mind. P95 Load <2s, Transitions <200ms als Zielwerte).
- **Quellen**: `product_spec.md` (Performance), `tech_spec.md` (Performance Monitoring/CI Gates).
- **PR-Scope**:
  - Lighthouse CI (oder vergleichbar) + Bundle-Analyse.
  - Route-based Lazy Loading wo sinnvoll.
- **Abnahmekriterien**:
  - [ ] Messwerte werden im CI erzeugt und regressionssicher verglichen.

---

## D) Observability / Analytics

### IST-SOLL-024 (P2) — Sentry Integration verifizieren oder entfernen

- **Ist**: `VITE_SENTRY_DSN` ist dokumentiert, Nutzung im Code ist laut Doku „unklar“.
- **Soll**: Entweder Sentry ist integriert (Error + Performance) oder Env/Docs werden bereinigt.
- **Quellen**: `shared/docs/ENVIRONMENT.md`, `shared/docs/STATUS.md`.
- **PR-Scope**: Sentry wiring + DSN handling + privacy, oder Cleanup.
- **Abnahmekriterien**:
  - [ ] Doku entspricht der Realität (integriert oder bewusst nicht).

### IST-SOLL-025 (P3) — Privacy-first Analytics (Plausible/Fathom) hinter Flag

- **Ist**: `VITE_ENABLE_ANALYTICS` ist dokumentiert; tatsächliche Verwendung ist „unklar“.
- **Soll**: Analytics nur wenn enabled, ohne PII.
- **Quellen**: `tech_spec.md` (Analytics), `shared/docs/ENVIRONMENT.md`.
- **PR-Scope**: Provider integration + opt-in.
- **Abnahmekriterien**:
  - [ ] Analytics ist optional und privacy-safe.

---

## E) Testing / QA / Routing-Verifikation

### IST-SOLL-026 (P1) — Routing Notes als automatisierte Regressionstests (Playwright)

- **Ist**: `ROUTING_NOTES.md` definiert kanonische Routes + Legacy Redirect Layer; Playwright-Tests existieren, aber Abdeckung der Notes ist nicht nachweisbar.
- **Soll**: E2E Tests decken kanonische Normalisierung + Legacy Redirects ab (order-independent query params).
- **Quellen**: `ROUTING_NOTES.md`, `playwright/tests/*`.
- **PR-Scope**:
  - Tests für:
    - `/research` Normalisierung (view=chart, replay=true, assetId path preserve)
    - `/oracle*` → `/insights*` Redirects
    - `/learn` → `/journal?mode=learn` etc.
- **Abnahmekriterien**:
  - [ ] Tests bilden die Notes 1:1 ab und verhindern Regressionen.

### IST-SOLL-027 (P2) — Teststrategie (Unit/Integration/E2E) gegen Tech-Spec „>80%“ ausrichten

- **Ist**: Tech-Spec definiert Targets/Struktur; Repo hat Unit/Integration/E2E Tests, aber Zielerreichung ist nicht als Gate beschrieben.
- **Soll**: Klare Quality Gates (Coverage/Flake handling) und konsistente Tooling-Doku.
- **Quellen**: `tech_spec.md` (Testing Strategy), vorhandene Tests unter `tests/`, `backend/tests/`, `playwright/`.
- **PR-Scope**:
  - Dokumentation „wie prüfen“ + CI gate alignment (falls nicht bereits).
- **Abnahmekriterien**:
  - [ ] „verify“/CI stellt sicher, dass Kern-Suites laufen und Regressionen sichtbar sind.

---

## Abnahme-Checklisten (je Themenbereich)

### Dashboard (gemäß Produkt-Spec)
- [ ] KPI-Leiste entspricht definierter KPI-Quelle (Trading vs Diary; siehe IST-SOLL-001).
- [ ] „Letzte 5 Journal-Einträge“ sichtbar.
- [ ] „Empfohlene nächste Aktionen“ nachvollziehbar (Regeln dokumentiert oder aus Daten ableitbar).
- [ ] Responsive: Mobile/Tablet/Desktop (Breakpoints aus `tech_spec.md`).

### Journal
- [ ] Create/Confirm/Archive/Restore/Delete funktionieren mit Bestätigung (UI + API).
- [ ] Suche/Filter decken Spec-Features ab (Tags/Strategien/Fehlertypen, Status, Text).
- [ ] Screenshot-Handling ist nutzbar (Upload oder klar definierter Ersatz).
- [ ] Offline-Verhalten definiert: Erstellen/Mutationen queuebar + Sync sichtbar (Badge/Queue count).

### Research/Chart & TA
- [ ] Standard-Indikatoren und Drawing Tools sind verfügbar (siehe `src/components/chart/research-tools/*`).
- [ ] Replay-Modus: Steuerung + Shortcut-Hinweise + kein Overlay-Interferenz.
- [ ] `/research` Routing ist kanonisch und getestet (siehe IST-SOLL-026).

### Watchlist
- [ ] Add/Remove funktioniert; Persistenz ist klar (lokal-only oder server-sync).
- [ ] Notizen je Item vorhanden (wenn im Scope).
- [ ] Preis-/Statusanzeige ist entweder live oder als „simuliert“ klar gekennzeichnet.

### Insights / Oracle / Signals
- [ ] KI-Inhalte sind klar als KI gekennzeichnet (Spec).
- [ ] Pin/Filter (Kategorie/Zeitraum) funktionieren, sofern im Scope.
- [ ] Read/unread State ist robust (offline queue + server sync).

### Learn Hub
- [ ] Lessons haben echte Inhalte (mind. Text), Viewer lädt per ID.
- [ ] Fortschritt wird persistent gespeichert und in UI angezeigt.
- [ ] Progressive Unlocking ist nachvollziehbar (Regeln sichtbar/erklärbar).

### Alerts & Notifications
- [ ] Alerts CRUD + Verwaltung aktiver Alerts.
- [ ] Historische Logs vorhanden (wenn im Scope).
- [ ] Push Notifications E2E funktionieren (Permission/Subscribe/Delivery).

### Settings & Preferences
- [ ] Theme Switcher (Light/Dark/System) vorhanden.
- [ ] Notification Einstellungen sind real wirksam (nicht nur UI-state).
- [ ] Datenexport/-löschung sind klar definiert (lokal vs server) und implementiert.

### Security / Privacy
- [ ] Keine Secrets in `VITE_*`.
- [ ] Production Secrets erzwingen sichere Defaults (z.B. `JWT_SECRET` ohne dev-default).
- [ ] Rate limiting ist production-tauglich (cluster-safe oder dokumentiert).

### Offline/PWA
- [ ] SW registriert in Production; Update UX funktioniert.
- [ ] Polling/Jobs verhalten sich erwartbar und sind über Flags steuerbar.
- [ ] Offline queue verarbeitet Mutationen deterministisch und zeigt Status in UI.

# Ist→Soll Transformationsliste (Issue-basiert, PR-fähig)

## Ausgangslage & Ableitungsregeln

Diese Liste ist **ausschließlich** aus Repo-Code und Repo-Dokumentation abgeleitet (keine stillschweigenden Annahmen).

- **Soll-Baseline (Produkt)**: `product_spec.md`
- **Soll-Baseline (Technik/Architektur)**: `tech_spec.md`, `shared/docs/ARCHITECTURE.md`, `shared/docs/API_CONTRACTS.md`, `shared/docs/SECURITY.md`, `shared/docs/ENVIRONMENT.md`, `shared/docs/DEPLOYMENT.md`, `ROUTING_NOTES.md`, `reasoning-layer_v0.1.md`
- **Ist-Baseline (Bestandsaufnahme/Drift)**: `shared/docs/STATUS.md`, `shared/docs/CONTRACT_DRIFT_REPORT.md`
- **Code-Belege**: exemplarisch `src/pages/*`, `src/services/*`, `src/sw/*`, `backend/src/*`, `apps/backend-alerts/src/*`

**Prioritäten**
- **P0**: Blocker für verlässlichen Betrieb / zentrale Soll-Kriterien / harte Drift-Risiken
- **P1**: Kernfunktionalität vervollständigen (MVP-Soll), End-to-End Verdrahtung
- **P2**: Qualitäts-/Skalierungs-/Kontrakt-Vervollständigung, UX-Polish, Ausbau
- **P3**: Nice-to-have / optional (nur wenn klar im Repo dokumentiert)

---

## Meta-Übersicht (Issues pro Kategorie & Priorität)

| Kategorie | P0 | P1 | P2 | P3 | Summe |
|---|---:|---:|---:|---:|---:|
| Produkt: Spec-Alignment & KPIs | 1 | 1 | 0 | 0 | 2 |
| Produkt: Journal | 0 | 2 | 2 | 0 | 4 |
| Produkt: Research/Chart | 0 | 0 | 1 | 0 | 1 |
| Produkt: Watchlist | 1 | 0 | 2 | 0 | 3 |
| Produkt: Insights/Oracle/Signals | 0 | 1 | 2 | 0 | 3 |
| Produkt: Learn | 0 | 1 | 1 | 0 | 2 |
| Produkt: Alerts & Notifications | 1 | 1 | 1 | 0 | 3 |
| Produkt: Settings & Preferences | 0 | 1 | 1 | 0 | 2 |
| Plattform: Backend-Topologie & Routing | 1 | 2 | 0 | 0 | 3 |
| Plattform: API Contracts & Drift | 0 | 1 | 2 | 0 | 3 |
| Security & Auth | 1 | 0 | 2 | 0 | 3 |
| Offline/PWA & Sync | 0 | 2 | 1 | 0 | 3 |
| Observability & Analytics | 0 | 0 | 2 | 1 | 3 |
| Qualität (Tests/CI) | 0 | 1 | 1 | 0 | 2 |
| **Summe** | **7** | **15** | **18** | **1** | **41** |

---

## Priorisierte Issue-Liste (P0–P3), kategorisiert & PR-fähig

### P0 (Blocker)

#### IST-SOLL-001 — P0 — Produkt: Spec-Alignment & KPIs
**Titel:** Trading-Journal (Soll) vs Diary/Reflection-Journal (Ist) konsolidieren (inkl. Dashboard-KPIs)

- **Ist**:
  - Produkt-Spec fordert Trade-Felder + Trading-KPIs (Profit/Win-Rate/etc.).
  - Frontend/Tech-Spec beschreibt Journal v1 explizit als „Diary/Reflection (no trading fields)“.
  - Dashboard berechnet aktuell Aktivitäts-/Workflow-Kennzahlen (z.B. pending Journal, unread insights), nicht Trading-KPIs.
- **Soll**: Ein konsistenter, repoweit dokumentierter Zielzustand:
  - Entweder **(A)** Produkt-Spec anpassen (Diary/Reflection-first) **oder**
  - **(B)** Journal um Trade-Datenmodell erweitern und Dashboard-KPI-Leiste gemäß Produkt-Spec implementieren.
- **Belege/Quellen**:
  - `product_spec.md` (Dashboard/KPIs; Journal Eingabefelder)
  - `tech_spec.md` (Kommentar „Journal v1: Diary/Reflection (no trading fields)“)
  - `src/pages/Dashboard.tsx` (Counts/WorkQueue statt Profit/WinRate)
  - `src/pages/Journal.tsx`, `src/components/journal/JournalCreateDialog.tsx` (Diary Entry Payload, kein Trade-Schema)
- **PR-Scope (empfohlen, klein schneiden)**:
  - PR1: „Decision & Doc“-PR: ADR/Entscheidungsnotiz + Update von `product_spec.md`/`tech_spec.md`/`shared/docs/STATUS.md` (einheitliche Definition).
  - PR2+: Umsetzung je nach Entscheidung (Trade-Felder + KPIs oder Spez-Alignment).
- **Redesign-Hinweise (aus Design-Prinzipien)**:
  - „Clarity over Cleverness“: KPIs klar benennen + Tooltip-Definitionen (Pattern existiert in `KpiStrip`).
- **Abnahmekriterien**:
  - [ ] Eine eindeutige Zieldefinition ist schriftlich im Repo verankert (Spec/Doku).
  - [ ] Dashboard-KPIs sind konsistent mit der Zieldefinition (und nicht „halb/halb“).

#### IST-SOLL-002 — P0 — Produkt: Watchlist
**Titel:** Watchlist Persistenz/Sync: BACKEND_TODO im UI + `watchlistSync:false` im Backend-Meta auflösen

- **Ist**:
  - Watchlist speichert lokal (`localStorage`), Backing-API ist als TODO markiert.
  - Backend meldet in `/api/meta`: `features.watchlistSync: false // BACKEND_TODO`.
- **Soll**: Ein klarer, implementierter Zustand:
  - Entweder (A) Watchlist bleibt bewusst lokal (und `meta.features.watchlistSync` wird entsprechend korrigiert/dokumentiert) oder
  - (B) Backend-gestützte Persistenz/Sync inkl. Contract + UI-Verdrahtung.
- **Belege/Quellen**:
  - `src/pages/Watchlist.tsx` (LocalStorage + `BACKEND_TODO: persist watchlist items`)
  - `backend/src/routes/health.ts` (`watchlistSync: false // BACKEND_TODO`)
  - `product_spec.md` (Watchlist Akzeptanzkriterien)
- **PR-Scope (empfohlen)**:
  - PR1: Contract/Endpoint-Definition (falls Backend-Sync) + Doku-Update (ENV/Local Dev).
  - PR2: Frontend-Integration (Read/Write, Offline-Fallback).
- **Abnahmekriterien**:
  - [ ] `meta.features.watchlistSync` spiegelt die Realität korrekt wider.
  - [ ] Watchlist-Daten bleiben nach Reload erhalten (lokal oder via Backend, je nach Zieldefinition).

#### IST-SOLL-003 — P0 — Produkt: Alerts & Notifications
**Titel:** Push Notifications End-to-End konsolidieren (UI+SW vorhanden, Backend-Ownership uneindeutig)

- **Ist**:
  - Service Worker pollt `/api/alerts/events` und kann Notifications anzeigen.
  - Push (VAPID/subscription) existiert als Implementierung im separaten Service `apps/backend-alerts/` (eigene Routen).
  - In der Settings-UI sind „Permission/Push“ teils **UI-only** bzw. mit `BACKEND_TODO` markiert.
- **Soll**: Ein Ende-zu-Ende Fluss, der zur **Production-Topologie** passt:
  - (A) Push in das kanonische Backend `backend/` integrieren **oder**
  - (B) `apps/backend-alerts/` als separaten produktiven Service dokumentieren (inkl. Domain/Env) und Frontend so verdrahten, dass es damit funktioniert.
- **Belege/Quellen**:
  - `product_spec.md` (Alerts & Notifications Akzeptanzkriterien)
  - `shared/docs/ARCHITECTURE.md` (mehrere Backends; Ownership)
  - `shared/docs/DEPLOYMENT.md`, `scripts/verify-vercel-api-ownership.mjs` (Production `/api/*` → externes Node Backend)
  - `src/sw/sw-alerts.ts`, `src/sw/service-worker.ts` (Notifications/Polling; Push TODO)
  - `apps/backend-alerts/src/routes/push.ts` (Push-Endpunkte vorhanden)
  - `src/pages/Settings.tsx`, `src/components/settings/AdvancedSections.tsx` (Push UI/Flags/„VAPID configured“ via localStorage)
- **PR-Scope (empfohlen)**:
  - PR1: Architekturentscheidung + Doku (welcher Backend-Service ist „Source of Truth“ für Push).
  - PR2: VAPID-Key-Exposure (read-only) + Subscribe/Unsubscribe Contract.
  - PR3: UI-Flows (Permission, Subscribe) + SW Push Handler (derzeit TODO).
- **Abnahmekriterien**:
  - [ ] Es gibt genau einen dokumentierten produktiven Push-Backend-Pfad.
  - [ ] Push-Abo kann erstellt/gelöscht werden; Benachrichtigungen kommen an (mind. in Staging).

#### IST-SOLL-004 — P0 — Security & Auth
**Titel:** Auth-Policy Drift konsolidieren (Frontend Auth disabled vs Backend-Endpunkte mit 401-Gate)

- **Ist**:
  - Frontend blockiert Auth-Network-Usage standardmäßig (`VITE_ENABLE_AUTH`/`ENABLE_AUTH` = false).
  - `backend/` erlaubt oft `userId="anon"`, blockiert aber bestimmte Endpunkte (z.B. Settings) mit 401 bei `anon`.
  - `api/` (Vercel Functions) ist standardmäßig JWT-required (nicht kanonisch für dieses Frontend-Projekt in Production).
- **Soll**: Dokumentierte, konsistente Policy:
  - Welche Endpoints sind in MVP **anon erlaubt** vs **Auth required**?
  - Wie verhält sich das in Local Dev vs Production?
- **Belege/Quellen**:
  - `shared/docs/SECURITY.md` (Auth Verhalten je Backend)
  - `shared/docs/STATUS.md` (Auth im Frontend bewusst deaktiviert)
  - `src/services/api/client.ts` (`setAuthToken` nur wenn `VITE_ENABLE_AUTH === "true"`)
  - `src/services/auth/auth.service.ts` (assertEnabled blockiert)
  - `backend/src/routes/settings.ts` (laut Drift Report: 401 bei anon)
- **PR-Scope (empfohlen)**:
  - PR1: Policy-Dokument + Konfig-Flags (z.B. „anon mode“ vs „auth mode“) explizit machen.
  - PR2: Endpoint-by-endpoint Anpassungen (nur wenn nötig).
- **Abnahmekriterien**:
  - [ ] Policy ist in `shared/docs/SECURITY.md` + `shared/docs/API_CONTRACTS.md` nachvollziehbar.
  - [ ] UI-Flows funktionieren im Default-Setup ohne „unerwartete“ 401/403.

#### IST-SOLL-005 — P0 — Plattform: Backend-Topologie & Routing
**Titel:** Mehrere Backends parallel: Ziel-Topologie & Ownership verbindlich dokumentieren (Drift reduzieren)

- **Ist**:
  - Parallel existieren `backend/` (kanonisch), `api/` (Vercel Functions, nicht-kanonisch im Frontend-Projekt), `apps/backend-alerts/` (separater Service).
  - Repo hat Guardrail, die `/api/*` Ownership für Production an `backend/` bindet.
- **Soll**: Eine eindeutige, leicht prüfbare Ziel-Topologie:
  - Was ist produktiv/kanonisch? Was ist optional/experimentell? Welche Domains/Ports?
- **Belege/Quellen**:
  - `shared/docs/ARCHITECTURE.md`, `shared/docs/DEPLOYMENT.md`
  - `scripts/verify-vercel-api-ownership.mjs`
  - `shared/docs/STATUS.md` (Risiko „mehrere Backends parallel“)
- **PR-Scope (empfohlen)**:
  - Doku-PR: „Topologie“ (Diagramm/Text) + „Wenn du X deployen willst, dann…“.
- **Abnahmekriterien**:
  - [ ] Ein neuer Contributor kann anhand der Doku eindeutig starten/deployen (ohne Backend-Verwechslung).

#### IST-SOLL-006 — P0 — Plattform: Local Dev
**Titel:** Port-Konflikt `backend/` vs `apps/backend-alerts/` standardmäßig entschärfen

- **Ist**: `apps/backend-alerts/` nutzt standardmäßig `PORT=3000`, kollidiert mit `backend/` (Doku weist darauf hin).
- **Soll**: Standardmäßig konfliktfreier Start (z.B. `backend-alerts` default 3001) oder automatisierte Warnung/Script.
- **Belege/Quellen**: `shared/docs/LOCAL_DEV.md` (Hinweis Port-Kollision), `apps/backend-alerts/src/env.ts`
- **PR-Scope**: Entweder Default-Port ändern oder `pnpm -C apps/backend-alerts dev` Script so anpassen, dass es einen freien Port nutzt.
- **Abnahmekriterien**:
  - [ ] Beide Services können ohne manuelle Port-Edits parallel gestartet werden.

#### IST-SOLL-007 — P0 — Plattform: Environment Drift
**Titel:** `.env.example`/Env-Doku an required runtime vars angleichen (Backend startet sonst nicht)

- **Ist**: `backend/` validiert Env strikt; `HELIUS_API_KEY` ist required; `.env.example` deckt nicht alle required Vars ab (Doku markiert Drift).
- **Soll**: Beispiele + Doku sind „copy/paste startbar“ (mind. für Dev) und markieren harte Requirements klar.
- **Belege/Quellen**:
  - `shared/docs/ENVIRONMENT.md`, `shared/docs/STATUS.md`, `shared/docs/LOCAL_DEV.md`
  - `backend/src/config/env.ts` (Zod Schema, required)
- **PR-Scope**: `.env.example`/`backend/.env.example` harmonisieren + README/ENVIRONMENT aktualisieren.
- **Abnahmekriterien**:
  - [ ] „Quickstart“ funktioniert ohne Trial-and-Error bezüglich fehlender Env-Variablen.

---

### P1 (Kernfunktionalität vervollständigen)

#### IST-SOLL-008 — P1 — Produkt: Dashboard
**Titel:** KPI-Leiste gemäß Produkt-Spec (sofern IST-SOLL-001 Trade-KPIs als Ziel bestätigt)

- **Ist**: Dashboard zeigt Aktivitäts-/Workflow-KPIs, keine Profit/WinRate/AvgTrade.
- **Soll**: KPI-Leiste: Gesamtprofit, Win-Rate, durchschnittlicher Trade, Anzahl Trades.
- **Belege/Quellen**: `product_spec.md` (Dashboard Akzeptanzkriterien), `src/pages/Dashboard.tsx`
- **PR-Scope**: KPI-Berechnung + UI (z.B. via `KpiStrip` Pattern), inklusive leere/unknown States.
- **Abnahmekriterien**:
  - [ ] KPIs erscheinen und entsprechen den Definitionen in der Spec.

#### IST-SOLL-009 — P1 — Produkt: Journal
**Titel:** Screenshot/Chart Snapshot Upload fertigstellen (Button ist aktuell disabled)

- **Ist**: „Chart Snapshot“ unterstützt URL; Upload-Button ist disabled.
- **Soll**: Screenshots hochladen können (oder klar dokumentierter Alternativpfad).
- **Belege/Quellen**: `product_spec.md` (Screenshots), `src/components/journal/JournalCreateDialog.tsx` (Upload disabled)
- **PR-Scope (ohne Annahmen)**:
  - PR1: Contract/Storage-Entscheidung (Backend Upload Endpoint vs Local-Only).
  - PR2: UI-Upload + Persistenz.
- **Abnahmekriterien**:
  - [ ] Ein Screenshot kann hinzugefügt werden und bleibt am Entry referenzierbar.

#### IST-SOLL-010 — P1 — Produkt: Journal
**Titel:** „Generate AI Note“ in JournalCreateDialog implementieren oder entfernen/labeln

- **Ist**: Button existiert, ist aber nicht implementiert (nur Enabled-Logic; keine Aktion).
- **Soll**: Entweder funktionierende AI-Note-Generierung oder UI-Entfernung/„Coming soon“ konsistent.
- **Belege/Quellen**: `src/components/journal/JournalCreateDialog.tsx` (Button + `canGenerateAINote`)
- **PR-Scope**: Integration über vorhandene Reasoning/LLM Endpoints (z.B. `/api/llm/execute`) **nur wenn** im Repo als vorgesehen dokumentiert; andernfalls Entfernen.
- **Abnahmekriterien**:
  - [ ] Button löst eine nachvollziehbare Aktion aus (oder ist nicht mehr präsent).

#### IST-SOLL-011 — P1 — Produkt: Learn
**Titel:** Lesson Content + Progress Persistenz implementieren (aktuell UI-only)

- **Ist**: `LessonViewer` hat `BACKEND_TODO` für Content & Persistenz; `LessonCard` leitet teilweise in Journal-Learn-Mode weiter.
- **Soll**: Lerninhalte (Text/Video/Interaktiv) + Fortschritt tracking.
- **Belege/Quellen**:
  - `product_spec.md` (Learning Hub Akzeptanzkriterien)
  - `src/pages/LessonViewer.tsx` (`BACKEND_TODO: load lesson content`, `persist progress update`)
  - `src/components/learn/LessonCard.tsx` („Lesson viewer integrated into Journal Learn mode“)
- **PR-Scope**: Klare „Source of Truth“ (LessonViewer vs Journal-Learn) + Persistenz (localStorage/IndexedDB/Backend – entsprechend dokumentieren).
- **Abnahmekriterien**:
  - [ ] Progress bleibt nach Reload erhalten.
  - [ ] Lesson Content ist nicht mehr Platzhalter.

#### IST-SOLL-012 — P1 — Produkt: Insights/Oracle/Signals
**Titel:** Oracle/Insights: Stubs beim Initial-Load durch Server-Feed ersetzen (Fallback bleibt)

- **Ist**: Insights initial aus Stub (`makeOracle(10)`), dann optional Refresh via `/api/oracle/daily`.
- **Soll**: Primär Server-Feed (wenn online), Stub nur als expliziter Fallback.
- **Belege/Quellen**: `src/pages/Insights.tsx` (Stub initial + `fetchOracleDaily`), `shared/docs/API_CONTRACTS.md` (Endpoint existiert)
- **PR-Scope**: Initialer Load mit Loading/Error States + Offline-Fallback.
- **Abnahmekriterien**:
  - [ ] Online wird Server-Feed geladen.
  - [ ] Offline bleibt eine sinnvolle Offline-Ansicht verfügbar.

#### IST-SOLL-013 — P1 — Produkt: Settings & Preferences
**Titel:** Theme Switcher (Light/Dark/System) gemäß Produkt-Spec freischalten (Tech-Stack ist vorhanden)

- **Ist**: Settings zeigt „Theme: Dark mode only (v1)“; kein Switcher.
- **Soll**: Theme Switcher (Light/Dark/System).
- **Belege/Quellen**:
  - `product_spec.md` (Theme-Switcher Akzeptanzkriterium)
  - `tech_spec.md` (next-themes im Stack)
  - `src/pages/Settings.tsx` (Dark-only)
- **PR-Scope**: next-themes Provider + Settings UI + Persistenz (Settings Store).
- **Abnahmekriterien**:
  - [ ] Theme kann zwischen Light/Dark/System gewechselt werden und persistiert.

#### IST-SOLL-014 — P1 — Plattform: API Contracts & Drift
**Titel:** `shared/docs/CONTRACT_DRIFT_REPORT.md` mit tatsächlichem `ApiClient` Verhalten konsistent machen

- **Ist**: Drift Report enthält Abschnitte, die vom falschen Frontend-Envelope ausgehen (Widerspruch zu `src/services/api/client.ts` und `shared/docs/API_CONTRACTS.md`).
- **Soll**: Drift Report ist eine zuverlässige Quelle (keine veralteten Annahmen).
- **Belege/Quellen**:
  - `shared/docs/CONTRACT_DRIFT_REPORT.md` (mehrere „Frontend expects {data,status}“ Stellen)
  - `src/services/api/client.ts` (Default: `{status:"ok", data}`)
  - `shared/docs/API_CONTRACTS.md` (kanonisches Envelope)
- **PR-Scope**: Nur Doku-Korrektur + ggf. kleine Traceability-Tabelle aktualisieren.
- **Abnahmekriterien**:
  - [ ] Drift Report widerspricht nicht dem Code/Contracts.

#### IST-SOLL-015 — P1 — Offline/PWA
**Titel:** Service-Worker Polling Taktung & UI-Steuerung vervollständigen (Flag existiert)

- **Ist**:
  - SW reagiert auf `SW_TICK`, aber es ist nicht in Dev registriert; Polling ist Feature-flagged.
  - Doku nennt `VITE_ENABLE_SW_POLLING`; Status markiert „SW Polling TODO“.
- **Soll**: Dokumentierte, getestete Polling-Strategie (Production Build) inkl. RateLimit Handling.
- **Belege/Quellen**:
  - `shared/docs/LOCAL_DEV.md` (SW in Dev nicht registriert; Polling Flag)
  - `shared/docs/STATUS.md` (SW Polling in Arbeit)
  - `src/sw/service-worker.ts`, `src/sw/sw-alerts.ts`
- **PR-Scope**: UI → SW Tick-Scheduling (falls vorhanden) konsolidieren, Status-Events sichtbar machen.
- **Abnahmekriterien**:
  - [ ] Polling läuft im Production Build, ohne Spam/RateLimit-Loop.

#### IST-SOLL-016 — P1 — Offline/PWA
**Titel:** Offline-Queues konsolidieren (legacy `syncQueue` vs `journalQueue` vs Oracle ReadState Queue)

- **Ist**:
  - IndexedDB enthält `syncQueue` (legacy) und `journalQueue` (v3+).
  - Zusätzlich existiert eine Oracle ReadState Queue in localStorage.
- **Soll**: Ein konsistentes Queue-Modell (klar dokumentiert, keine Doppelpfade).
- **Belege/Quellen**:
  - `src/services/db/db.ts` (Stores `syncQueue`, `journalQueue`)
  - `src/services/sync/sync.service.ts` (verwendet `syncQueue`)
  - `src/services/journal/journalQueue.ts`, `src/services/oracle/readStateQueue.ts` (separate Mechanismen)
- **PR-Scope**: Migrationspfad definieren + einen Queue-Pfad als „kanonisch“ markieren und nutzen.
- **Abnahmekriterien**:
  - [ ] Offline-Aktionen werden zuverlässig 1x gesynct (keine Duplikate).

#### IST-SOLL-017 — P1 — Plattform: Backend Config
**Titel:** `API_BASE_PATH` im `backend/` tatsächlich wirksam machen (Router ist hard-coded)

- **Ist**: `backend/src/app.ts` konstruiert `new Router('/api')` fix; Env-Doku markiert das als Drift.
- **Soll**: `API_BASE_PATH` ist die tatsächliche Source of Truth (oder Option entfernen).
- **Belege/Quellen**: `shared/docs/ENVIRONMENT.md` (TODO), `backend/src/app.ts`
- **PR-Scope**: Router-Init auf Config umstellen + Tests/Docs aktualisieren.
- **Abnahmekriterien**:
  - [ ] `API_BASE_PATH` beeinflusst den Router (oder ist nicht mehr dokumentiert).

---

### P2 (Qualität, Kontrakte, Ausbau)

#### IST-SOLL-018 — P2 — Produkt: Research/Chart
**Titel:** Replay-Modus mit „echtem“ historischen Playback (aktuell UI-Simulation)

- **Ist**: Replay-Controls simulieren Position/Time lokal.
- **Soll**: Replay-Modus mit historischen Preisbewegungen und Geschwindigkeitssteuerung.
- **Belege/Quellen**: `product_spec.md` (Replay Akzeptanzkriterium), `src/components/chart/ReplayControls.tsx` (fake time/position)
- **PR-Scope**: Datenquelle/Contract definieren; UI an echte Daten koppeln.
- **Abnahmekriterien**:
  - [ ] Replay beeinflusst tatsächlich die dargestellten Daten (nicht nur UI-Progress).

#### IST-SOLL-019 — P2 — Produkt: Journal
**Titel:** Tagging-System ausbauen (Strategien + Fehlertypen) inkl. Filter

- **Ist**: Freitext-Tags (comma separated), kein strukturiertes System nach Spec.
- **Soll**: Tagging für Strategien/Fehlertypen + Such/Filter.
- **Belege/Quellen**: `product_spec.md` (Tagging, Search/Filter), `src/components/journal/JournalCreateDialog.tsx` (Tags Input), `src/pages/Journal.tsx` (Search)
- **PR-Scope**: UI-Komponenten (Select/Autocomplete) + Persistenz im Entry-Model.
- **Abnahmekriterien**:
  - [ ] Tags sind filterbar; Strategien/Fehlertypen sind konsistent erfasst.

#### IST-SOLL-020 — P2 — Produkt: Journal
**Titel:** „Prompts coming soon“ implementieren (Reflexions-Prompts)

- **Ist**: Prompts-Sektion ist Platzhalter.
- **Soll**: Prompts entsprechend Journal-User-Story (Gedanken/Emotionen/Reflexion strukturieren).
- **Belege/Quellen**: `product_spec.md` (Journal User Stories), `src/components/journal/JournalCreateDialog.tsx` („Optional prompts coming soon“)
- **Abnahmekriterien**:
  - [ ] Prompts sind nutzbar und werden gespeichert.

#### IST-SOLL-021 — P2 — Produkt: Watchlist
**Titel:** Notizen pro Watchlist-Item speichern

- **Ist**: Watchlist-Items enthalten `symbol/name` (Stub); Notizen fehlen.
- **Soll**: Notizen je Watchlist-Item.
- **Belege/Quellen**: `product_spec.md` (Watchlist Notes), `src/pages/Watchlist.tsx` (Stub Model)
- **Abnahmekriterien**:
  - [ ] Notes werden gespeichert und im Detail-Panel angezeigt.

#### IST-SOLL-022 — P2 — Produkt: Watchlist
**Titel:** Live-Preisanzeige (oder simulierte Daten) + Sortierung

- **Ist**: Keine Preise/Sortierkriterien sichtbar im Page-Code.
- **Soll**: Live- oder Sim-Preise + Sortierung nach Kriterien.
- **Belege/Quellen**: `product_spec.md` (Watchlist Akzeptanzkriterien), `src/pages/Watchlist.tsx`
- **Abnahmekriterien**:
  - [ ] Preise erscheinen; Sortieroptionen funktionieren.

#### IST-SOLL-023 — P2 — Produkt: Insights/Oracle
**Titel:** Insight-Kategorien + Filter nach Zeitraum implementieren

- **Ist**: Filter vorhanden (all/unread/read), aber keine Kategorien (Market/Personal/Educational) oder Zeitraumfilter.
- **Soll**: Kategorien + Zeitfilter.
- **Belege/Quellen**: `product_spec.md` (Oracle Akzeptanzkriterien), `src/pages/Insights.tsx`
- **Abnahmekriterien**:
  - [ ] Kategorie-Filter und Zeitraum-Filter funktionieren.

#### IST-SOLL-024 — P2 — Produkt: Insights/Oracle
**Titel:** Pin-Funktion für Insights (über „Today Takeaway“ hinaus)

- **Ist**: „Pinned“ ist faktisch nur `TodayTakeawayCard`; generisches Pinning fehlt.
- **Soll**: Pin-Funktion für wichtige Insights.
- **Belege/Quellen**: `product_spec.md`, `src/pages/Insights.tsx` (Pinned Bereich)
- **Abnahmekriterien**:
  - [ ] Nutzer kann Insights pinnen/unpinnen; Pinned-Bereich zeigt diese.

#### IST-SOLL-025 — P2 — Produkt: Alerts
**Titel:** Historische Alert-Logs (UI + Backend) implementieren

- **Ist**: UI verwaltet Alerts/Status, aber „historische Logs“ sind nicht ersichtlich.
- **Soll**: Alert-Logs einsehbar.
- **Belege/Quellen**: `product_spec.md` (Alert-Logs), `src/pages/Alerts.tsx`, `src/sw/sw-alerts.ts` (Events)
- **Abnahmekriterien**:
  - [ ] Logs sind abrufbar und zeitlich sortiert.

#### IST-SOLL-026 — P2 — Settings & Preferences
**Titel:** Daten-Export/-Löschung für Benutzer (GDPR) implementieren oder dokumentiert ausklammern

- **Ist**: Export/Import für Settings & lokale Metrics existiert; kein „User Data Export/Delete“ Fluss.
- **Soll**: Daten exportieren/löschen können (Produkt-Spec) oder explizit als „zukünftig“ dokumentieren.
- **Belege/Quellen**: `product_spec.md` (Settings Akzeptanzkriterien: Export/Löschen), `src/pages/Settings.tsx`, `src/components/settings/AdvancedSections.tsx`
- **Abnahmekriterien**:
  - [ ] Export/Löschung ist verfügbar oder eindeutig als out-of-scope markiert.

#### IST-SOLL-027 — P2 — Plattform: API Contracts
**Titel:** Fehlende Endpoint-Contracts in `shared/contracts/*` ergänzen (Contract Drift Report TODOs)

- **Ist**: Drift Report markiert fehlende vollständige Response Types (z.B. `/feed/pulse`, `/journal/:id/insights`).
- **Soll**: Contract-First auch für vollständige Endpoint-Payloads (inkl. Envelopes, Errors).
- **Belege/Quellen**: `shared/docs/CONTRACT_DRIFT_REPORT.md` (TODOs), `shared/contracts/*`, `src/services/api/grokPulse.ts`
- **Abnahmekriterien**:
  - [ ] Endpoints haben explizite Request/Response Types im `shared/contracts/`.

#### IST-SOLL-028 — P2 — Security
**Titel:** `backend/` Rate Limiting production-tauglich machen (in-memory → KV/Redis)

- **Ist**: In-memory Rate Limiting (nicht cluster-safe) ist dokumentiert.
- **Soll**: Cluster-sicherer Rate Limiter.
- **Belege/Quellen**: `shared/docs/SECURITY.md` (Hinweis), `backend/src/http/rateLimit.ts`
- **Abnahmekriterien**:
  - [ ] Rate Limits funktionieren korrekt in mehreren Instanzen.

#### IST-SOLL-029 — P2 — Security
**Titel:** Production-Härtung: `JWT_SECRET` Default entfernen / Prod-Requirement erzwingen

- **Ist**: Default `dev-secret` ist production-unsafe (dokumentiert).
- **Soll**: In Production muss ein starkes Secret gesetzt sein.
- **Belege/Quellen**: `shared/docs/SECURITY.md`, `shared/docs/ENVIRONMENT.md`
- **Abnahmekriterien**:
  - [ ] Backend startet in Production nicht mit Default-Secret.

#### IST-SOLL-030 — P2 — Accessibility
**Titel:** WCAG 2.1 AA Audit + automatisierte Checks ergänzen (axe/lighthouse)

- **Ist**: A11y ist als Requirement dokumentiert; einzelne Komponenten nutzen ARIA, aber kein systematischer Gate.
- **Soll**: A11y-Checks in CI + definierte Checkliste.
- **Belege/Quellen**: `product_spec.md` (WCAG AA), `tech_spec.md` (A11y Abschnitt)
- **Abnahmekriterien**:
  - [ ] Automatisierter a11y-check läuft im CI (mind. smoke).

#### IST-SOLL-031 — P2 — Performance
**Titel:** Performance-Ziele operationalisieren (Lighthouse/Budget + Code Splitting)

- **Ist**: Performance-Ziele sind in `product_spec.md`/`tech_spec.md` genannt; Umsetzung als Gate ist nicht belegt.
- **Soll**: Messung + Budget (z.B. LCP/CLS, Bundle) und konkrete Maßnahmen (route-based splitting).
- **Belege/Quellen**: `product_spec.md` (Performance), `tech_spec.md` (Performance-Optimierung)
- **Abnahmekriterien**:
  - [ ] Performance-Metriken werden gemessen und regressionssicher gemacht.

#### IST-SOLL-032 — P2 — Observability
**Titel:** Sentry (oder „ähnlich“) integrieren oder Env-Variablen/Doku bereinigen

- **Ist**: `VITE_SENTRY_DSN` ist dokumentiert; Nutzung im Code ist laut Doku unklar.
- **Soll**: Entweder echte Integration oder Entfernen/Umdeklarieren.
- **Belege/Quellen**: `shared/docs/ENVIRONMENT.md`, `shared/docs/STATUS.md`
- **Abnahmekriterien**:
  - [ ] Doku und Code stimmen überein (keine „toten“ Integrationen).

#### IST-SOLL-033 — P2 — Qualität
**Titel:** Coverage-Target & Teststrategie aus `tech_spec.md` gegen tatsächliches Setup abgleichen

- **Ist**: Teststrategie/Tools sind dokumentiert; Repo enthält Unit/Integration/E2E Tests, aber Ziele/Gates sind nicht als „Definition of Done“ in Issues operationalisiert.
- **Soll**: Konkrete Gates (z.B. kritische Flows in Playwright; Unit/Integration Mindestabdeckung).
- **Belege/Quellen**: `tech_spec.md` (Testing Strategy), `playwright/tests/*`, `tests/unit/*`, `backend/tests/*`
- **Abnahmekriterien**:
  - [ ] Für kritische Flows gibt es stabile E2E Tests (data-testid).

---

### P3 (Optional / Nice-to-have – nur wenn gewünscht)

#### IST-SOLL-034 — P3 — Observability/Analytics
**Titel:** Privacy-first Analytics (Plausible/Fathom) hinter Feature-Flag integrieren

- **Ist**: Analytics ist in `tech_spec.md` erwähnt und `VITE_ENABLE_ANALYTICS` ist dokumentiert, tatsächliche Nutzung ist als TODO markiert.
- **Soll**: Sauber implementiertes, optionales Analytics (ohne PII), nur wenn Flag aktiv.
- **Belege/Quellen**: `tech_spec.md` (Analytics), `shared/docs/ENVIRONMENT.md` (`VITE_ENABLE_ANALYTICS` TODO)
- **Abnahmekriterien**:
  - [ ] Analytics läuft nur mit Opt-in Flag und ohne personenbezogene Daten.

---

## Abnahme-Checklisten je Themenbereich

### Dashboard
- [ ] KPI-Leiste entspricht der **aktuellen** Zieldefinition (siehe IST-SOLL-001).
- [ ] „Letzte Journal-Einträge“ und „Next Actions“ sind korrekt und responsiv (Produkt-Spec: responsive).
- [ ] Keine Stub-Daten werden als „real“ dargestellt (falls Stubs, klar labeln).

### Journal
- [ ] CRUD-Flows: Create, Confirm, Archive, Restore, Delete inkl. Bestätigung (Produkt-Spec).
- [ ] Suche/Filter funktionieren und sind performant (Produkt-Spec).
- [ ] Tags/Strategien/Fehlertypen sind konsistent erfassbar und filterbar (wenn implementiert).
- [ ] Screenshot/Chart Snapshot ist nutzbar (Upload oder definierter Alternativpfad) und bleibt referenzierbar.

### Research/Chart & Technical Analysis
- [ ] Standard-Indikatoren sind verfügbar (Produkt-Spec) und UI bleibt bei 60fps „smooth“ (Produkt-Spec).
- [ ] Drawing Tools funktionieren inkl. Undo/Redo/Clear (UI vorhanden; funktional prüfen).
- [ ] Replay: Wenn als Feature beworben, muss es echte Daten steuern (nicht nur UI-Slider).

### Watchlist
- [ ] Add/Remove funktioniert, Persistenz ist definiert (lokal oder Backend) und dokumentiert.
- [ ] Notizen je Item (wenn im Scope).
- [ ] Preis-/Sortieranzeige gemäß Spec (live oder simuliert).

### Insights/Oracle/Signals
- [ ] KI-Inhalte sind klar gekennzeichnet (Produkt-Spec).
- [ ] Pin/Filter (Kategorie, Zeitraum) funktionieren (wenn im Scope).
- [ ] Read-State Sync funktioniert online/offline (Queue + Retry).

### Learn
- [ ] Progressive Unlocking ist nachvollziehbar (wenn im Scope).
- [ ] Progress persistiert (Reload-sicher).
- [ ] Inhalte (Text/Video/Interaktiv) sind nicht nur Platzhalter.

### Alerts & Notifications
- [ ] Alerts erstellen/verwalten; aktive Alerts sind sichtbar.
- [ ] Event-Stream/Notifications: Polling funktioniert ohne RateLimit-Probleme.
- [ ] Push: Subscribe/Unsubscribe & Empfang in Production-Topologie validiert.
- [ ] Historische Logs sind einsehbar (wenn im Scope).

### Settings & Preferences
- [ ] Theme (Light/Dark/System) funktioniert und persistiert (Produkt-Spec).
- [ ] Notification Settings sind nicht nur UI, sondern haben definierten Effekt (oder sind als Stub klar markiert).
- [ ] Export/Delete: Status (implementiert vs out-of-scope) ist eindeutig.

### Security & Compliance
- [ ] Keine Secrets im Frontend (`VITE_*`) (Repo-Regel).
- [ ] JWT Secrets in Production sind gehärtet (kein Default).
- [ ] Rate Limiting ist production-tauglich (wenn skaliert wird).

### Deployment & Ops
- [ ] Production `/api/*` Ownership entspricht Guardrails (`vercel.json` + verify-script).
- [ ] Env-Doku + Beispiele sind startbar (Local Dev).

## Ist→Soll-Transformationsliste (issue-basiert, PR-fähig)

### Regeln / Traceability

- **Soll-Quelle**: `product_spec.md`, `tech_spec.md`, `reasoning-layer_v0.1.md`
- **Ist-Quelle**: `README.md`, `shared/docs/STATUS.md`, `shared/docs/ARCHITECTURE.md`, `shared/docs/API_CONTRACTS.md`, `shared/docs/CONTRACT_DRIFT_REPORT.md`, `shared/docs/ENVIRONMENT.md`, `shared/docs/SECURITY.md`, `shared/docs/DEPLOYMENT.md`, `ROUTING_NOTES.md` + belegte Code-Stellen (siehe je Issue „Quellen“).
- **Keine stillschweigenden Annahmen**: Wenn Specs/Code widersprechen oder ein Contract fehlt, ist das **explizit** als Issue formuliert („Entscheidung/Definition erforderlich“).

---

### Meta-Übersicht (Issues pro Kategorie & Priorität)

| Kategorie | P0 | P1 | P2 | P3 | Summe |
|---|---:|---:|---:|---:|---:|
| Produkt & Feature-Gaps | 1 | 7 | 3 | 4 | 15 |
| Plattform/Backends/Contracts | 2 | 4 | 3 | 1 | 10 |
| Security & Auth | 2 | 1 | 1 | 0 | 4 |
| Offline/PWA | 0 | 1 | 1 | 0 | 2 |
| Qualität (Tests/CI/Doku) | 0 | 1 | 2 | 0 | 3 |
| Observability/Analytics | 0 | 1 | 0 | 0 | 1 |
| **Summe** | **5** | **15** | **10** | **5** | **35** |

---

## Priorisierte Issue-Liste (P0–P3)

> Format je Issue: **Titel**, **Ist**, **Soll**, **PR-Scope**, **Redesign-Hinweise**, **Abnahme (DoD)**, **Quellen**.

### Produkt & Feature-Gaps

#### IST-SOLL-001 (P0) — „Trading Journal“ vs „Diary Journal“: Spec-Alignment + Datenmodell-Entscheid

- **Ist**:
  - `product_spec.md` beschreibt ein **Trading Journal** (Symbol, Entry/Exit, P&L, Screenshots, Tagging, Search/Filter) und Dashboard-KPIs (Gesamtprofit, Win-Rate, avg Trade, Anzahl Trades).
  - `tech_spec.md` und Code verweisen jedoch auf **Journal v1: Diary/Reflection (no trading fields)**.
  - Dashboard berechnet aktuell **Counts/Work Queue** statt Trading-KPIs.
- **Soll**: Eindeutige Definition (und danach Umsetzung) ob Phase-1 Journal „Trade-Journal“ oder „Reflection/Diary“ ist; Dashboard-KPIs müssen dazu passen.
- **PR-Scope (minimal, PR-fähig)**:
  - PR1: „Decision Record“ als Doku (z.B. `docs/decisions/journal-scope.md`): Welche Felder sind MVP, welche sind Phase 2; Abgleich `product_spec.md`/`tech_spec.md`.
  - PR2 (folgt aus Decision): Entweder (A) Trade-Felder + KPIs implementieren **oder** (B) Specs aktualisieren (Dashboard-KPIs & Journal-Akzeptanzkriterien).
- **Redesign-Hinweise**: Progressive Disclosure (nur MVP-Felder sichtbar), Konsistenz zwischen Dashboard-KPIs und Journal-Eingabe.
- **Abnahme (DoD)**:
  - Spezifikationen sind widerspruchsfrei (Produkt/Tech) **oder** Decision Record dokumentiert Abweichung + Roadmap.
- **Quellen**: `product_spec.md` (Dashboard + Trading Journal), `tech_spec.md` (Kommentar „Journal v1“), `src/pages/Dashboard.tsx`, `src/pages/Journal.tsx`, `src/components/journal/JournalCreateDialog.tsx`.

#### IST-SOLL-002 (P1) — Dashboard-KPI-Leiste gemäß Produkt-Spec (Trading-KPIs)

- **Ist**: Dashboard zeigt heute Status/Counts (Entries/Alerts/Insights), keine Profit/Win-Rate/Avg-Trade KPIs.
- **Soll**: KPI-Leiste gemäß `product_spec.md` (Gesamtprofit, Win-Rate, durchschnittlicher Trade, Anzahl Trades).
- **PR-Scope**: KPIs aus Journal/Trades ableiten (nur nach IST-SOLL-001 Decision). UI: `src/components/dashboard/KpiStrip.tsx` nutzen/erweitern.
- **Redesign-Hinweise**: KPI Tiles mit klaren Tooltips, mobile-first, keine „Metrik-Fassade“ (nur anzeigen, wenn Datenmodell vorhanden).
- **Abnahme (DoD)**:
  - KPI-Leiste vorhanden, korrekt berechnet, responsive, Tooltips erklären Quelle/Berechnung.
- **Quellen**: `product_spec.md` (Dashboard AK), `src/components/dashboard/KpiStrip.tsx`, `src/pages/Dashboard.tsx`.

#### IST-SOLL-003 (P1) — Journal: Screenshot/Chart Snapshot Upload ist UI-disabled

- **Ist**: `JournalCreateDialog` hat „Image URL or Upload“, Upload-Button ist `disabled`.
- **Soll**: Screenshots/Setups können **hochgeladen** werden (oder alternativ klar definierter MVP: nur URL, falls Upload nicht vorgesehen).
- **PR-Scope**:
  - PR1: Contract/Storage-Entscheid (lokal-only vs Backend Upload).
  - PR2: UI Upload aktivieren + Persistenz (und ggf. Backend Endpoint + CORS/Size Limits).
- **Redesign-Hinweise**: Upload als eigener Step (Progressive Disclosure), klare Error States (Dateityp/Größe).
- **Abnahme (DoD)**:
  - Nutzer kann ein Bild hinzufügen (Upload oder definierter Ersatz), es wird im Entry persistiert und beim Anzeigen korrekt gerendert.
- **Quellen**: `product_spec.md` (Trading Journal AK), `src/components/journal/JournalCreateDialog.tsx`.

#### IST-SOLL-004 (P2) — Journal: Tagging-System „Strategien & Fehlertypen“ (strukturierte Taxonomie)

- **Ist**: Tagging ist aktuell Freitext (comma-separated `tagsInput`).
- **Soll**: Tagging-System für Strategien und Fehlertypen + Filter.
- **PR-Scope**: Definiere „Strategy“/„ErrorType“ als Settings-/Enum-Quelle; UI Auswahlchips + Filter in Liste.
- **Redesign-Hinweise**: Konsistente Chip-Komponente, schnelle Mehrfachauswahl, Filterzustand in URL (nur wenn in `ROUTING_NOTES.md` vorgesehen).
- **Abnahme (DoD)**:
  - Strategien/Fehlertypen auswählbar; Liste filterbar; Persistenz im Entry.
- **Quellen**: `product_spec.md` (Journal AK), `src/components/journal/JournalCreateDialog.tsx`, `src/pages/Journal.tsx`.

#### IST-SOLL-005 (P2) — Journal: „Prompts coming soon“ in Create Dialog

- **Ist**: Collapsible „Prompts“ ist Placeholder.
- **Soll**: Prompts als echte Felder/Guidance (z.B. Lernfragen) gemäß Produkt-Intent (Learning/Reflection).
- **PR-Scope**: Definiere Prompt-Set (static v1) + Persistenz im Entry; optional: in Learn-Mode wiederverwenden.
- **Redesign-Hinweise**: Progressive Disclosure + kurze Beispiele; keine überlangen Forms.
- **Abnahme (DoD)**: Prompts sind nutzbar, gespeichert, in Detailansicht sichtbar.
- **Quellen**: `src/components/journal/JournalCreateDialog.tsx`, `product_spec.md` (Learning Hub, Journal Stories).

#### IST-SOLL-006 (P1) — Learning Hub: echte Inhalte + Persistenz des Fortschritts

- **Ist**:
  - Lesson Viewer ist „UI-only“ mit `useLearnStub`, Progress-Update hat `BACKEND_TODO`.
  - LessonCard navigiert derzeit in `journal?mode=learn` (integrierter Learn-Mode), nicht zwingend `/learn/:id`.
- **Soll**: Strukturierte Lernmodule mit Fortschritt (Progressive Unlocking) und echten Inhalten.
- **PR-Scope**:
  - PR1: Festlegen canonical Learn-Routing (siehe `ROUTING_NOTES.md`: `/learn` → `/journal?mode=learn` ist Legacy).
  - PR2: Lesson Content Source + Persistenz (IndexedDB/localStorage oder Backend).
- **Redesign-Hinweise**: „LessonCard“ als Einstieg, Viewer mit klaren Sektionen, Fortschritt transparent.
- **Abnahme (DoD)**:
  - Lessons haben echte Inhalte; Fortschritt bleibt nach Reload; Unlocking funktioniert nachvollziehbar.
- **Quellen**: `product_spec.md` (Learning Hub AK), `src/pages/LessonViewer.tsx`, `src/components/learn/LessonCard.tsx`, `ROUTING_NOTES.md`.

#### IST-SOLL-007 (P2) — Learning Hub: Progressive Unlocking (Regeln/Quelle definieren)

- **Ist**: UI zeigt „Locked“, aber Unlock-Regeln sind stub-/implizit.
- **Soll**: Gestaffelte Freischaltung (Progressive Unlocking) mit nachvollziehbaren Regeln.
- **PR-Scope**: Define unlock rules (z.B. abhängig von Fortschritt/Journal) + zentrale Policy + Tests.
- **Abnahme (DoD)**: Unlocking ist deterministisch, getestet, UX erklärt „warum gesperrt“.
- **Quellen**: `product_spec.md` (Learning Hub AK), `src/components/learn/*`.

#### IST-SOLL-008 (P2) — Insights/Oracle: Kategorien + Zeitraum-Filter (Market/Personal/Educational)

- **Ist**: `Insights` filtert nach `unread/read/all`; Kategorie/Zeitraum ist nicht implementiert (Provider Status View ist Placeholder).
- **Soll**: Kategorien (Market/Personal/Educational), Filter nach Zeitraum, klare KI-Kennzeichnung.
- **PR-Scope**: Contract-Erweiterung für Oracle Insight (category, timeRange) + UI filter bar.
- **Abnahme (DoD)**: Filter nach Kategorie/Zeitraum vorhanden, zählt korrekt, URL-State konsistent.
- **Quellen**: `product_spec.md` (Oracle AK), `src/pages/Insights.tsx`.

#### IST-SOLL-009 (P2) — Insights/Oracle: Pin-Funktion für Insights (über „Today Takeaway“ hinaus)

- **Ist**: Es gibt „Pinned“ Takeaway; generisches Pinning für beliebige Insights ist nicht ersichtlich.
- **Soll**: Pin-Funktion für wichtige Insights.
- **PR-Scope**: UI Pin-Action + Persistenz (local cache + backend endpoint später).
- **Abnahme (DoD)**: Insights können gepinnt werden; Pinned-Sektion zeigt diese zuverlässig.
- **Quellen**: `product_spec.md` (Oracle AK), `src/pages/Insights.tsx`, `src/components/oracle/*`.

#### IST-SOLL-010 (P2) — Watchlist: Notizen pro Item (Produkt-Spec)

- **Ist**: Watchlist Items sind minimal (symbol/name), keine Notizen.
- **Soll**: Notizen pro Watchlist-Item.
- **PR-Scope**: `WatchItemStub`/real model erweitern, DetailPanel-Editor, Persistenz.
- **Abnahme (DoD)**: Notizen editierbar, gespeichert, in Liste/Detail sichtbar.
- **Quellen**: `product_spec.md` (Watchlist AK), `src/pages/Watchlist.tsx`.

#### IST-SOLL-011 (P0) — Watchlist Sync: UI local-only + Backend signalisiert „watchlistSync: false“

- **Ist**:
  - Watchlist persistiert lokal via `localStorage` und markiert `BACKEND_TODO: persist watchlist items`.
  - Backend Meta setzt `features.watchlistSync = false` mit `BACKEND_TODO`.
- **Soll**: Entweder (A) definierte MVP-Entscheidung „Watchlist ist lokal-only“ inkl. Meta/Docs-Anpassung, **oder** (B) echte Backend-Sync-Implementierung.
- **PR-Scope**:
  - PR1: Entscheidung + Doku + Meta-Flag konsistent.
  - PR2 (optional): Backend Endpoints + Frontend Sync.
- **Abnahme (DoD)**:
  - Verhalten ist dokumentiert und technisch konsistent (UI/Backend/Meta).
- **Quellen**: `product_spec.md` (Watchlist AK), `src/pages/Watchlist.tsx`, `backend/src/routes/health.ts`, `shared/docs/STATUS.md`.

#### IST-SOLL-012 (P1) — Watchlist: Live-Preisanzeige / simulierte Daten

- **Ist**: Watchlist zeigt keine Preisänderungen (im Page-Code nicht sichtbar); Daten sind statisch/local.
- **Soll**: Live-Preise oder simulierte Daten.
- **PR-Scope**: Minimal: „simulierte Daten“ (MVP) mit Refresh/Trend; später: echte Market Data Quelle.
- **Abnahme (DoD)**: Watchlist zeigt Preis/Change; sortierbar; Detail-Panel zeigt mehr Infos.
- **Quellen**: `product_spec.md` (Watchlist AK), `src/pages/Watchlist.tsx`.

#### IST-SOLL-013 (P1) — Alerts: Historische Alert-Logs (Produkt-Spec)

- **Ist**: Alerts UI kann erstellen/filtern; „historische Logs“ sind nicht ersichtlich.
- **Soll**: Historische Alert-Logs.
- **PR-Scope**: Backend: persistierte Event-Log Abfrage; UI: Tab/Section „History“ + Filter.
- **Abnahme (DoD)**: Logs sind einsehbar und nachvollziehbar; Pagination/Retention dokumentiert.
- **Quellen**: `product_spec.md` (Alerts AK), `src/pages/Alerts.tsx`, `backend/src/app.ts` (`/alerts/events`).

#### IST-SOLL-014 (P0) — Push Notifications Ende-zu-Ende (VAPID, Subscribe, Delivery)

- **Ist**:
  - Settings „Request permission“ ist UI-only (`BACKEND_TODO`).
  - Service Worker hat Polling für Alerts/Oracle + `push` event handler ist als „future“ markiert.
  - Push-Endpunkte existieren im **separaten** Service `apps/backend-alerts/` (`routes/push.ts`), nicht im kanonischen `backend/`.
- **Soll**: Push-Benachrichtigungen (Browser/Mobile) für Alerts/Notifications (Produkt-Spec).
- **PR-Scope**:
  - PR1: Ownership-Entscheid: Push läuft über `backend/` oder über `apps/backend-alerts/` (dann Domain/Deployment/Config dokumentieren).
  - PR2: VAPID public key fetch, subscribe/unsubscribe, server delivery, UI toggles + SW integration.
- **Redesign-Hinweise**: Permission Flow als Schrittfolge, klare States (denied/default/granted).
- **Abnahme (DoD)**:
  - Nutzer kann Push aktivieren; Subscription wird gespeichert; bei Alert-Event wird Notification ausgelöst (inkl. Click-Navigation).
- **Quellen**: `product_spec.md` (Alerts AK), `src/pages/Settings.tsx` (Permission TODO), `src/sw/service-worker.ts` (push TODO), `src/sw/sw-alerts.ts` (polling), `apps/backend-alerts/src/routes/push.ts`, `shared/docs/DEPLOYMENT.md`, `shared/docs/ARCHITECTURE.md`.

#### IST-SOLL-015 (P1) — Settings: Theme (Light/Dark/System) vs „Dark mode only (v1)“

- **Ist**: Settings zeigt „Theme: Dark mode only (v1)“, Store setzt `ui.theme: 'dark'`.
- **Soll**: Theme Switcher Light/Dark/System gemäß Produkt-Spec.
- **PR-Scope**: `next-themes` in UI exponieren, Persistenz über Settings Store; optional „System“.
- **Abnahme (DoD)**: Theme Switcher vorhanden; UI reagiert; Preference persistiert.
- **Quellen**: `product_spec.md` (Settings AK), `tech_spec.md` (`next-themes`), `src/pages/Settings.tsx`, `src/components/settings/useSettingsStore.ts`.

#### IST-SOLL-016 (P1) — Settings: Daten exportieren/löschen (GDPR) vs derzeit nur Settings/Metrics Export

- **Ist**: Export/Import Settings JSON + Export Metrics JSON vorhanden; keine „Daten löschen“/„Datenexport“ für User-Daten (Journal/Alerts/etc) ersichtlich.
- **Soll**: Daten exportieren/löschen gemäß Produkt-Spec (Settings & Preferences).
- **PR-Scope**:
  - PR1: Definiere Umfang „User Data“ (Journal/Alerts/Cache/Queues) + UI Flows.
  - PR2: Implementiere Export (Bundle JSON) + Delete (Clear local + optional backend delete) inkl. Confirm Dialog.
- **Abnahme (DoD)**: Export erzeugt nachvollziehbares Paket; Delete entfernt Daten (lokal und ggf. serverseitig) mit Bestätigung.
- **Quellen**: `product_spec.md` (Settings AK), `src/pages/Settings.tsx`, `src/components/settings/AdvancedSections.tsx`.

#### IST-SOLL-017 (P3) — Phase-2 Feature: PDF Export Reports

- **Ist**: Keine PDF Reports Implementierung auffindbar.
- **Soll**: Export-Funktionen (PDF Reports) laut Roadmap.
- **PR-Scope**: Contract + Renderer (server oder client) + UI Export Button(s).
- **Abnahme (DoD)**: PDF Export generiert Report mit definierter Struktur.
- **Quellen**: `product_spec.md` (Roadmap Phase 2).

#### IST-SOLL-018 (P3) — Phase-2 Feature: Erweiterte Statistiken/Analytics

- **Ist**: Dashboard ist counts/queues; „Trade Analytics“ nicht nachweisbar.
- **Soll**: Erweiterte Statistiken und Analytics (Roadmap Phase 2).
- **PR-Scope**: Metrik-Definition + Storage + UI Views.
- **Abnahme (DoD)**: Analytics View zeigt definierte KPIs, performant.
- **Quellen**: `product_spec.md` (Roadmap Phase 2).

#### IST-SOLL-019 (P3) — Phase-3 Feature: Community/Sharing/Mentor-Matching

- **Ist**: Keine Social/Sharing Features in Code/Doku als implementiert markiert.
- **Soll**: Community Features (Roadmap Phase 3).
- **PR-Scope**: Placeholder-Backlog: Contract/Privacy/Moderation/Anonymisierung.
- **Abnahme (DoD)**: Feature-Design + Contracts + Security Review (ohne Implementationszwang in Phase 1).
- **Quellen**: `product_spec.md` (Roadmap Phase 3; Out-of-scope Phase 1).

#### IST-SOLL-020 (P3) — Phase-4 Feature: Broker-Integration + Auto-Import

- **Ist**: Out-of-scope Phase 1; keine Broker-Integration vorhanden.
- **Soll**: Broker-API Integration, Auto-Import (Roadmap Phase 4).
- **PR-Scope**: Backlog: Provider Adapter Interface + Security Constraints („keine echten Trading Credentials speichern“).
- **Abnahme (DoD)**: Architektur/Contract-Design dokumentiert; keine Secrets im Frontend.
- **Quellen**: `product_spec.md` (Roadmap Phase 4, Security).

---

### Plattform/Backends/Contracts

#### IST-SOLL-021 (P0) — Backend-Topologie/Ownership konsolidieren (3 Backends im Repo)

- **Ist**: Parallel existieren `backend/` (kanonisch für Production `/api/*`), `api/` (Vercel Functions, nicht kanonisch im Frontend-Projekt) und `apps/backend-alerts/` (separater Service, andere Paths/Auth).
- **Soll**: Klare Ownership + minimierter Drift: Welche Services sind produktiv, wie sind sie erreichbar/konfiguriert, welche werden nur für Tests/Alternative genutzt.
- **PR-Scope**:
  - PR1: Doku-Update (Readme/Deployment/Local Dev) mit eindeutiger Matrix.
  - PR2: Drift-Risiken schließen (z.B. Push/Alerts) oder explizit entkoppeln.
- **Abnahme (DoD)**: „Single Source of Truth“ für Production API Ownership ist dokumentiert, inkl. Konsequenzen für `api/` und `apps/backend-alerts/`.
- **Quellen**: `shared/docs/ARCHITECTURE.md`, `shared/docs/STATUS.md`, `shared/docs/DEPLOYMENT.md`, `scripts/verify-vercel-api-ownership.mjs`.

#### IST-SOLL-022 (P1) — `API_BASE_PATH` Drift: Env ist konfigurierbar, Router hardcoded `/api`

- **Ist**: `shared/docs/ENVIRONMENT.md` markiert TODO: `API_BASE_PATH` existiert, aber `backend/src/app.ts` nutzt `new Router('/api')`.
- **Soll**: Backend respektiert Konfiguration oder entfernt tote Env-Option.
- **PR-Scope**: `createApp()` nutzt `config.env.API_BASE_PATH` (oder konsolidiert Konvention) + Tests.
- **Abnahme (DoD)**: `API_BASE_PATH` wirkt oder ist entfernt; Doku konsistent.
- **Quellen**: `shared/docs/ENVIRONMENT.md`, `backend/src/app.ts`.

#### IST-SOLL-023 (P1) — Local Dev: Port-Konflikt `apps/backend-alerts` vs `backend/`

- **Ist**: `apps/backend-alerts` default `PORT=3000`, kollidiert mit kanonischem Backend (ebenfalls 3000). Doku warnt, aber Default bleibt konfliktträchtig.
- **Soll**: Konfliktarme Defaults (oder klarer Start-Flow).
- **PR-Scope**: Setze Default Port für `apps/backend-alerts` (z.B. 3001) und aktualisiere Doku/Skripte.
- **Abnahme (DoD)**: Beide Services können nach Doku parallel gestartet werden.
- **Quellen**: `shared/docs/LOCAL_DEV.md`, `apps/backend-alerts/src/env.ts`.

#### IST-SOLL-024 (P1) — Contract Drift Report aktualisieren (widersprüchliche Envelope-Annahmen)

- **Ist**: `shared/docs/CONTRACT_DRIFT_REPORT.md` enthält Stellen, die von einem Legacy-Envelope im Frontend ausgehen; der aktuelle `ApiClient` enforced `{ status:"ok", data }`.
- **Soll**: Report spiegelt realen Ist-Zustand wider (oder referenziert explizit „historisch“).
- **PR-Scope**: Report korrigieren + TODOs priorisieren (fehlende Response Types, Snapshot shape enums).
- **Abnahme (DoD)**: Report ist konsistent zu `src/services/api/client.ts` und `backend/src/http/*`.
- **Quellen**: `shared/docs/CONTRACT_DRIFT_REPORT.md`, `shared/docs/API_CONTRACTS.md`, `src/services/api/client.ts`.

#### IST-SOLL-025 (P2) — Contracts ergänzen: Endpoint-Level Response Types fehlen

- **Ist**: Drift Report listet fehlende Contracts, z.B. vollständiger `/api/feed/pulse` Response Wrapper; `journal/:id/insights` Response Type fehlt in `shared/contracts`.
- **Soll**: `shared/contracts/*` enthält endpoint-level Typen (inkl. Envelopes), sodass Frontend/Backend typisiert alignen können.
- **PR-Scope**: Neue Contract Files + Adoption in Frontend/Backend (min. compile-time).
- **Abnahme (DoD)**: Neue Types existieren, werden genutzt; keine `unknown` Payloads an UI-Kanten.
- **Quellen**: `shared/docs/CONTRACT_DRIFT_REPORT.md`, `shared/contracts/*`, `src/services/api/grokPulse.ts`.

#### IST-SOLL-026 (P2) — Rate Limiting `backend/`: in-memory ist nicht cluster-safe

- **Ist**: `shared/docs/SECURITY.md` beschreibt in-memory rate limiting im `backend/` hintet auf Redis/KV TODO.
- **Soll**: Cluster-sicheres Rate Limiting (KV/Redis) oder dokumentierter Single-Instance Betrieb.
- **PR-Scope**: KV-backed limiter optional aktivieren via Env; klare Defaults.
- **Abnahme (DoD)**: Rate limiting verhält sich deterministisch in Production Topologie; Doku aktualisiert.
- **Quellen**: `shared/docs/SECURITY.md`, `backend/src/http/rateLimit.ts`.

#### IST-SOLL-027 (P2) — `api/` lokal ausführen / dokumentieren oder als reines Test-Artefakt markieren

- **Ist**: `api/` hat Implementierung + Tests, aber Local Dev Doku sagt „kein dev server script“ und TODO „Vercel CLI dokumentieren“.
- **Soll**: Klarer Zweck: entweder unterstützter Local Dev oder klar „nicht Teil des Standard-Stacks“.
- **PR-Scope**: Doku + optional Scripts (vercel dev) + Guardrails.
- **Abnahme (DoD)**: Neue Contributor können `api/` reproduzierbar nutzen oder wissen, dass sie es nicht müssen.
- **Quellen**: `shared/docs/LOCAL_DEV.md`, `shared/docs/DEPLOYMENT.md`.

---

### Security & Auth

#### IST-SOLL-028 (P0) — Auth-Policy Drift: Frontend Auth disabled vs Backend Endpoints mit 401/403 Gates

- **Ist**:
  - Frontend `VITE_ENABLE_AUTH` ist standardmäßig aus; `apiClient.setAuthToken` attacht nur wenn enabled.
  - Backend `backend/` läuft default „anon“, aber einige Endpoints blockieren `anon` (z.B. `/api/settings`, `/api/journal/:id/insights` laut Drift Report).
  - `api/` (Vercel Functions) verlangt JWT standardmäßig.
- **Soll**: Einheitliche Policy pro Deployment: Welche Endpoints sind anon-fähig in MVP? Welche erfordern Auth? Wie werden Tiers bestimmt?
- **PR-Scope**:
  - PR1: Policy + FeatureFlag Verhalten dokumentieren.
  - PR2: Backend gates/Frontend behavior angleichen (z.B. Settings lokal-only oder Auth-enable).
- **Abnahme (DoD)**: Kein „stilles Scheitern“ durch 401 in Standard-Flows; Policy ist in Docs und Code konsistent.
- **Quellen**: `shared/docs/SECURITY.md`, `shared/docs/STATUS.md`, `src/services/api/client.ts`, `backend/src/routes/settings.ts` (indirekt via `backend/src/app.ts`), `shared/docs/CONTRACT_DRIFT_REPORT.md`.

#### IST-SOLL-029 (P0) — Production-Härtung: `JWT_SECRET` Default `dev-secret` ist production-unsafe

- **Ist**: `shared/docs/SECURITY.md` markiert `JWT_SECRET` default `dev-secret` (production-unsafe).
- **Soll**: In Production muss Secret gesetzt und rotierbar sein; Defaults nur für Dev/Test.
- **PR-Scope**: Enforce: in `NODE_ENV=production` muss `JWT_SECRET` gesetzt sein; ggf. Fail-fast; Doku Update.
- **Abnahme (DoD)**: Production Start ohne Secret ist unmöglich; Secrets werden nicht ins Frontend geleakt.
- **Quellen**: `shared/docs/SECURITY.md`, `shared/docs/ENVIRONMENT.md`.

#### IST-SOLL-030 (P1) — API-Key Auth (`API_KEY`) Nutzung im `backend/` klären (Docs sagen „TODO“)

- **Ist**: Env listet `API_KEY` als optional; konkrete Nutzung ist als TODO markiert.
- **Soll**: Entweder API-Key Auth entfernen oder klar implementieren (z.B. für cron/admin routes).
- **PR-Scope**: Implement/Remove + dokumentierte Schutzbereiche.
- **Abnahme (DoD)**: Kein „scheinbares“ Security Feature ohne Wirkung.
- **Quellen**: `shared/docs/ENVIRONMENT.md`, `shared/docs/SECURITY.md`.

---

### Offline/PWA

#### IST-SOLL-031 (P1) — Service Worker Polling (`SW_TICK`) und Scheduling-End-to-End

- **Ist**:
  - SW implementiert Polling Handler (`SW_TICK`), aber UI registriert SW nur in Production; `VITE_ENABLE_SW_POLLING` ist dokumentiert (Status), konkrete Tick-Sendung ist nicht in `main.tsx` sichtbar.
- **Soll**: Definierte Polling-Strategie (Interval, Backoff) und UI Status/Settings.
- **PR-Scope**: Sender (UI) implementieren/aktivieren; Settings Toggle; `backend/src/routes/health.ts` `serviceWorkerJobs` nutzen oder dokumentieren.
- **Abnahme (DoD)**: In Production Build pollt SW gemäß Policy; Status ist nachvollziehbar (ready/error/authRequired).
- **Quellen**: `shared/docs/STATUS.md`, `src/sw/service-worker.ts`, `src/main.tsx`.

#### IST-SOLL-032 (P2) — Offline Queue Konsolidierung: `syncQueue` (legacy) vs `journalQueue` (v3)

- **Ist**:
  - `dbService` enthält `syncQueue` (legacy) und `journalQueue` (v3).
  - `syncService` nutzt `syncQueue` und enthält MVP-Kommentare zu Retries/Dead-letter.
- **Soll**: Eine konsolidierte Offline-Sync-Strategie (welche Queue ist kanonisch?).
- **PR-Scope**: Entscheidung + Migration + Retry Policy (siehe `VITE_OFFLINE_QUEUE_*` in Env Doku).
- **Abnahme (DoD)**: Offline Mutations sind zuverlässig; Queue-Format ist klar; Tests decken Retry/Backoff.
- **Quellen**: `shared/docs/STATUS.md`, `shared/docs/ENVIRONMENT.md`, `src/services/sync/sync.service.ts`, `src/services/db/db.ts`.

---

### Observability/Analytics

#### IST-SOLL-033 (P1) — Sentry/Analytics Flags: Doku „unklar“ → entweder integrieren oder entfernen

- **Ist**: `shared/docs/STATUS.md` und `ENVIRONMENT.md` markieren Sentry/Analytics Nutzung als „unklar“.
- **Soll**: Entweder echte Integration (Sentry DSN, privacy-first analytics) oder Doku/Env aufräumen.
- **PR-Scope**: Verifikation im Code + Entscheidung + Implementation/Removal.
- **Abnahme (DoD)**: Keine toten Env Vars; wenn aktiv, dann privacy-safe und dokumentiert.
- **Quellen**: `shared/docs/STATUS.md`, `shared/docs/ENVIRONMENT.md`.

---

### Qualität (Tests/CI/Doku)

#### IST-SOLL-034 (P2) — Routing-Abnahme: Canonical/Legacy Redirect Layer ist spezifiziert → Tests absichern

- **Ist**: `ROUTING_NOTES.md` definiert Canonical Routes + Legacy Redirects (z.B. `/chart` → `/research`, `/oracle` → `/insights`, `/learn` → `/journal?mode=learn`).
- **Soll**: Diese Regeln sind dauerhaft regressions-sicher (E2E/Unit).
- **PR-Scope**: Playwright Tests erweitern/harte Assertions (order-independent query param semantics) und ggf. Router Normalizer Tests.
- **Abnahme (DoD)**: Tests decken alle Canonical/Legacy Regeln aus `ROUTING_NOTES.md` ab.
- **Quellen**: `ROUTING_NOTES.md`, `playwright/tests/*`, `src/routes/routes.ts`.

#### IST-SOLL-035 (P2) — Accessibility (WCAG 2.1 AA): Automatisierte Checks + „Definition of Done“

- **Ist**: Specs fordern WCAG AA; Code hat viele ARIA/labels, aber kein nachweisbarer a11y Gate in CI.
- **Soll**: a11y checks (axe/lighthouse) + manuelle Checklist pro Release.
- **PR-Scope**: CI Schritt + Baseline Reports; UI: Fokus-Management in Modals prüfen.
- **Abnahme (DoD)**: Keine WCAG AA Blocker; CI signalisiert regressions.
- **Quellen**: `product_spec.md` (Accessibility), `tech_spec.md` (a11y testing).

---

## Abnahme-Checklisten je Themenbereich

### Dashboard

- [ ] KPI-Leiste erfüllt die in `product_spec.md` definierten KPIs **oder** Specs sind über IST-SOLL-001 konsistent angepasst.
- [ ] Letzte Journal-Einträge (mind. 5) sichtbar.
- [ ] „Next Actions“/empfohlene nächste Schritte sind nachvollziehbar (Quelle der Empfehlung dokumentiert oder stub klar gekennzeichnet).
- [ ] Responsive (mobile/tablet/desktop) ohne Layout-Brüche.

### Journal

- [ ] Create/Edit/Confirm/Archive/Restore/Delete Flows vorhanden, inkl. Bestätigungsdialogen (wo destruktiv).
- [ ] Search & Filter funktionieren (mind. nach Text; plus Tags/Strategien/Fehlertypen falls implementiert).
- [ ] Screenshot/Chart Snapshot: definierter MVP (Upload oder URL) ist umgesetzt und persistent.
- [ ] Offline-Verhalten klar: Queue/Retry/Sync Status sichtbar.

### Research/Chart

- [ ] Standard-Indikatoren und Drawing Tools nutzbar (UI/UX konsistent, Undo/Redo/Clear).
- [ ] Replay-Modus vorhanden und bedienbar (Tastatur + Mobile).
- [ ] Canonical Route `/research?view=chart&q=...` + Legacy Redirects verifiziert.

### Watchlist

- [ ] Add/Remove/SORT (falls umgesetzt) funktioniert.
- [ ] Preise/Changes sind sichtbar (live oder simuliert, aber klar gekennzeichnet).
- [ ] Notizen pro Item persistent.
- [ ] Sync-Entscheid (lokal-only vs backend) ist dokumentiert und technisch konsistent (Meta-Flag, Doku).

### Insights/Oracle/Signals

- [ ] Insight-Karten klar als KI-Inhalt gekennzeichnet.
- [ ] Filter (unread/read + Kategorie/Zeitraum falls implementiert) korrekt.
- [ ] Pin-Funktion vorhanden (über Takeaway hinaus, falls umgesetzt).
- [ ] Read-State Sync (online/offline) funktioniert ohne Datenverlust.

### Alerts & Notifications

- [ ] Alerts erstellen/verwalten; aktive/triggered States nachvollziehbar.
- [ ] Event Logs verfügbar (History).
- [ ] Push Notifications E2E (Permission → Subscribe → Delivery → Click Navigation) funktioniert gemäß IST-SOLL-014.

### Settings & Preferences

- [ ] Theme Switcher (Light/Dark/System) oder dokumentierte Abweichung.
- [ ] Granulare Notification Settings (mind. lokal) vorhanden; Backend-Sync klar definiert.
- [ ] Datenexport/Datenlöschung (lokal + optional serverseitig) vorhanden.

### Security & Betrieb

- [ ] Secrets nie als `VITE_*` gesetzt; Env Doku ist vollständig.
- [ ] Production verlangt sichere Secrets (kein `dev-secret`).
- [ ] Rate limiting Strategie ist zur Deployment-Topologie passend (single instance vs cluster).

---

## Hinweise für PR-Zuschnitt (Redesign/UX)

- **Clarity over Cleverness**: Stub/Placeholder muss sichtbar als Stub markiert sein (oder entfernt).
- **Progressive Disclosure**: Große Flows (Push Permission, Upload, Trade Details) in Stufen.
- **Consistency**: Canonical Routing & Settings Patterns zentral halten (`ROUTING_NOTES.md`, `src/config/navigation.ts`).
- **Feedback**: Jede Aktion (Sync, Push subscribe, Upload) braucht klare Success/Error/Retry States.
- **Accessibility First**: Fokus-Management, Tastaturnavigation, Kontraste; CI Gate für Regressionen.


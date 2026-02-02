# Projektstatus & Roadmap (Gap-Analyse → Issue-fähiges Backlog)

Stand: 2026-02-02 • Branch: `cursor/projektstatus-und-roadmap-add2`  
Scope: Ist-Zustand (Code/Tests/CI/CD/Docs) → Soll-Zustand (Ziele/Architektur/Qualitätsstandards) → Roadmap als Issues.

---

## Gap-Summary (kurz)

- **Dokumentation ist reichhaltig, aber fragmentiert und teils widersprüchlich** (parallel existieren `README.md`, `shared/docs/*` und `docs/*` mit unterschiedlichen Aussagen).
- **Architektur-/Ownership-Entscheidungen sind nicht konsolidiert**: Es existieren drei Backend-Flavours (`backend/`, `api/`, `apps/backend-alerts/`) und mindestens zwei gegensätzliche Zielbilder (externer Node-Server vs. Vercel-Functions-only).
- **Qualitätsstandards sind teils beschrieben, aber nicht als „Gates“ operationalisiert** (Definition-of-Done/Checklisten sind verteilt; einige CI/Deploy-Dokumente sind Platzhalter).

---

## Ist-Zustand (Beobachtungen mit Evidenz)

### System-/Repo-Topologie (faktisch)

- **Frontend**: Vite/React SPA im Repo-Root (`src/`, `vite.config.ts`), PWA/SW via `vite-plugin-pwa` (`src/sw/*`).
- **Backend (kanonisch im Code + Doku)**: Always-on Node Server in `backend/` mit SQLite/Migrations (`backend/migrations/*`) und kanonischem Response-Envelope `{ status: "ok", data }`.
- **Backend (alternativ/legacy/parallel)**: Vercel Serverless Functions in `api/` mit eigenem Envelope und eigener Auth-Policy.
- **Zusätzlicher Service**: `apps/backend-alerts/` (Express + Postgres, SSE/Push).
- **Contracts**: `shared/contracts/*` ist Single Source of Truth für Shapes, aber nicht automatisch für Envelope/Deployment-Policy.

### CI/CD & Quality Gates (faktisch)

- **CI**: `.github/workflows/ci.yml` enthält Lint/Typecheck, `npm run verify`, Build, E2E (Playwright), Security-Audit (non-blocking) und Lighthouse (non-blocking).
- **PR Checks**: `.github/workflows/pr-checks.yml` erzwingt u.a. Semantic PR Title, File-Size, Bundle-Size Vergleich, Dependency Review.
- **Deploy**: `.github/workflows/deploy.yml` ist ein **Platzhalter** (kein realer Provider-Deploy).

### Dokumentationslage (faktisch)

Es existieren mehrere Dokumentations-„Cluster“:

- **Root / Product / Tech**: `README.md`, `product_spec.md`, `tech_spec.md`
- **Konsolidierte Ist-Doku**: `shared/docs/*` (ARCHITECTURE/STATUS/ENVIRONMENT/API_CONTRACTS/DEPLOYMENT/SECURITY/…)
- **Audit/Checklisten**: `docs/*` (production readiness, backend master checklist, test plan, u.a.) – teilweise **nicht synchron** zum aktuellen Setup (z.B. Aussagen zu fehlendem `vercel.json`).

---

## Soll-Zustand (Dokumentationsziele)

### Ziele

- Eine **kanonische Ziel-/Scope-Definition**: Was ist MVP/Phase 1 tatsächlich (nicht nur Vision), welche Backends sind „supported“ (dev/prod), welche sind legacy.

### Architektur

- Ein **einziges, widerspruchsfreies** Architektur-/Ownership-Dokument, das festlegt:
  - Production-Topologie (Vercel Frontend + externes Backend vs Vercel Functions)
  - „Source of truth“ für `/api/*` und deren Contracts (Envelope, Auth, Error Model)
  - Rolle von `api/` und `apps/backend-alerts/` (kanonisch vs optional vs deprecated)

### Qualitätsstandards

- Ein **operationalisierter** Qualitätsstandard:
  - klare DoD je Kategorie (Docs/Frontend/Backend/Infra/Security)
  - CI-Gates, die zu den Standards passen (und nicht nur „best effort“)
  - klare Migrationsregeln (Breaking changes, Contract drift, deprecation policy)

---

## Strukturierte Gap-Analyse (Ist → Soll)

| Bereich | Ist-Zustand (kurz) | Soll-Zustand | Gap | Impact |
|---|---|---|---|---|
| **Architektur/Ownership** | Mehrere Backends mit Overlap (`backend/`, `api/`, `apps/backend-alerts/`) | Eindeutige „Production Ownership“ + klare Rolle der Alternativen | Widerspruch im Zielbild | Drift-Risiko, Integrationskosten, Security-Inkonsistenzen |
| **Docs-Source-of-Truth** | `shared/docs/*` vs `docs/*` teils widersprüchlich | Eine kanonische Doku-Landkarte + klare „deprecated“ Markierungen | Fragmentierung | Fehlentscheidungen, Onboarding/CI-Fehlkonfiguration |
| **Deployment** | Deploy-Workflow placeholder, Vercel/Railway Regeln teils inkonsistent dokumentiert | Realer Deploy-Pfad + Runbooks (DB, Rollback, Secrets) | „Falsche Sicherheit“ | Produktionsreife schwer messbar |
| **Qualitätsgates** | Viele Checks existieren, aber DoD/Standards sind verteilt | DoD ↔ CI-Gates ↔ PR-Template konsistent | Nicht operationalisiert | Qualitätsdrift, „works on my machine“ |
| **Security/Auth** | Unterschiedliche Auth-Policies zwischen Backends | Einheitliche Policy (oder explizit getrennte) | Unklarheit/Drift | Security- und Datenintegritätsrisiko |
| **API Contracts** | Shapes in `shared/contracts/*`, Envelopes unterscheiden sich historisch | Ein Envelope + klare Versionierung/Deprecation | Restdrift möglich | Client/Backend Inkompatibilitäten |
| **DevEx/Package Manager** | pnpm als Root-Manager, CI nutzt teilweise npm | Eindeutige Standardisierung oder bewusstes Split | Uneinheitlich | Repro-Probleme, Cache-ineffizient |

---

## Roadmap als Issues (Issue-fähig)

**Label-Vorschlag (Repo-weit):**
- Kategorie: `category/docs`, `category/architecture`, `category/infra`, `category/backend`, `category/frontend`, `category/security`, `category/testing`
- Priorität: `prio/P0`, `prio/P1`, `prio/P2`, `prio/P3`
- Typ: `type/bug`, `type/feat`, `type/refactor`, `type/chore`, `type/docs`

### Issue 1 — Kanonische Production-Topologie festlegen (Backend Ownership)

- **Titel**: Entscheide und dokumentiere die kanonische Production-Topologie (Vercel Frontend + externes Backend vs Vercel Functions)
- **Beschreibung**: Konsolidiere das Zielbild: Wo laufen `/api/*` Endpoints in Production, welche Deployments sind supported (dev/prod), und welche Repo-Teile sind legacy/optional.
- **Akzeptanzkriterien**:
  - Ein Dokument benennt **explizit**: kanonisches Backend, Hosting, `/api` Routing, Rolle von `api/` und `apps/backend-alerts/`.
  - Alle widersprechenden Dokumente sind angepasst oder klar als „deprecated/outdated“ markiert.
- **Labels**: `category/architecture`, `category/docs`, `prio/P0`, `type/docs`
- **Priorität**: P0
- **Kategorie**: Architektur/Dokumentation
- **PR-Bezug**: **PR-Redesign** (Docs-Konsolidierung + evtl. Repo-Policy Anpassung)

### Issue 2 — Dokumentations-Landkarte + Deprecation-Policy etablieren

- **Titel**: Erstelle eine Doku-Landkarte (Source of Truth) und Deprecation-Policy für widersprüchliche Docs
- **Beschreibung**: Definiere, welche Dokumente normativ sind (z.B. `shared/docs/*`) und welche nur Audit/Notes sind (`docs/*`). Ergänze Regeln: wie/wo neue Doku entsteht, wann sie aktualisiert werden muss, wie „deprecated“ markiert wird.
- **Akzeptanzkriterien**:
  - `docs/` und `shared/docs/` haben eine klare Rollenbeschreibung.
  - Widersprüchliche Dokumente erhalten einen Header „OUTDATED“ mit Verweis auf die kanonische Stelle.
- **Labels**: `category/docs`, `prio/P0`, `type/docs`
- **Priorität**: P0
- **Kategorie**: Dokumentation
- **PR-Bezug**: **PR-Redesign** (Umbau/Umzug/Markierungen)

### Issue 3 — „Quality Standards“ als operationalisierte Gates (DoD ↔ CI ↔ PR Template)

- **Titel**: Definiere und verankere Qualitätsstandards (DoD) pro Kategorie und mappe sie auf CI/PR Checks
- **Beschreibung**: Konsolidiere Standards (Tests, Lint, Typecheck, Contracts, Docs-Update) und verknüpfe sie mit bestehenden Workflows/PR-Template.
- **Akzeptanzkriterien**:
  - Eine zentrale DoD-Checkliste existiert pro Kategorie (Docs/Frontend/Backend/Infra/Security).
  - PR-Template referenziert die DoD und die CI-Gates.
  - CI ist konsistent zu „must pass“ vs „advisory“ (z.B. Lighthouse/Security Audit).
- **Labels**: `category/infra`, `category/docs`, `prio/P1`, `type/docs`
- **Priorität**: P1
- **Kategorie**: Qualität/Prozess
- **PR-Bezug**: PR-Update (keine Code-Redesigns nötig, eher Prozess)

### Issue 4 — `vercel.json` ↔ Guardrail konsistent machen (Routing Policy)

- **Titel**: Harmonisiere `vercel.json` mit `/api` Ownership-Guardrail (env-basierter Rewrite, keine Exceptions)
- **Beschreibung**: Es existiert eine CI-Guardrail, die ein kanonisches Rewrite-Format erwartet. Stelle sicher, dass `vercel.json` und Guardrail dieselbe Source-of-Truth sind und Doku das korrekt beschreibt.
- **Akzeptanzkriterien**:
  - `vercel.json` nutzt das kanonische Rewrite-Pattern (env var) oder Guardrail wird bewusst angepasst.
  - Doku nennt klare Setup-Schritte für `VERCEL_BACKEND_URL`.
- **Labels**: `category/infra`, `category/docs`, `prio/P0`, `type/chore`
- **Priorität**: P0
- **Kategorie**: Infrastructure/Deployment
- **PR-Bezug**: PR-Redesign (klein, aber wirkt auf CI/Deploy)

### Issue 5 — Contribution/Tech Spec Drift bereinigen (pnpm/Vitest/CI Realität)

- **Titel**: Aktualisiere `CONTRIBUTING.md` und `tech_spec.md` auf reale Toolchain (pnpm, Vitest, CI)
- **Beschreibung**: Entferne/markiere aspirational Aussagen (z.B. Jest/Husky/Deploy) und aligniere Quickstart/Commands mit Root Scripts (`pnpm`, `npm run verify`, Workspaces).
- **Akzeptanzkriterien**:
  - `CONTRIBUTING.md` beschreibt den tatsächlichen Install-/Test-Flow.
  - `tech_spec.md` nennt den realen Test-Stack (Vitest/Playwright) und referenziert die echten Workflows.
- **Labels**: `category/docs`, `prio/P1`, `type/docs`
- **Priorität**: P1
- **Kategorie**: Dokumentation/DevEx
- **PR-Bezug**: PR-Update

### Issue 6 — Auth-Policy konsolidieren und dokumentieren (Backend vs API vs Alerts-Service)

- **Titel**: Konsolidiere Auth-Policy über `backend/`, `api/` und `apps/backend-alerts/` (oder grenze sauber ab)
- **Beschreibung**: Lege fest, welche Endpoints anon sind, welche JWT/API-Key erfordern und wie das in Dev/Prod gilt. Dokumentiere Threat Model und Token-Handling.
- **Akzeptanzkriterien**:
  - Ein Auth-Abschnitt definiert Policy je Deployment + Endpoints.
  - Security-Doku enthält minimale Hardening-Standards (Secrets, Token Storage, Rotation).
- **Labels**: `category/security`, `category/docs`, `prio/P1`, `type/docs`
- **Priorität**: P1
- **Kategorie**: Security/Architektur
- **PR-Bezug**: PR-Redesign möglich (wenn Code-Policy geändert wird)

### Issue 7 — Contract Governance: Envelope-Versionierung + Deprecation

- **Titel**: Definiere Contract-Governance (Envelope, Versionierung, Deprecation, Drift Detection)
- **Beschreibung**: Lege fest, ob und wie Envelope/Errors versioniert werden und wie Drift zwischen `shared/contracts/*` und Implementierungen verhindert wird (z.B. contract tests).
- **Akzeptanzkriterien**:
  - Ein Governance-Dokument beschreibt Versionierung/Deprecation.
  - Mindestens ein automatisierter Drift-Check existiert oder ist als Folge-Issue spezifiziert.
- **Labels**: `category/architecture`, `category/testing`, `prio/P2`, `type/docs`
- **Priorität**: P2
- **Kategorie**: Contracts/Qualität
- **PR-Bezug**: PR-Redesign (falls neue Checks/Tests)

### Issue 8 — Deployment/Runbooks: DB Migration, Rollback, Secrets

- **Titel**: Ergänze Runbooks für Production: DB Migration, Rollback, Secrets, Smoke Tests
- **Beschreibung**: Stelle sicher, dass `DEPLOYMENT.md` nicht nur beschreibt, sondern „step-by-step“ runbooks liefert (inkl. Verantwortlichkeiten).
- **Akzeptanzkriterien**:
  - Migration/Rollback/Sekret-Management sind konkret beschrieben.
  - Smoke-Test Plan ist dokumentiert und referenziert CI.
- **Labels**: `category/infra`, `category/docs`, `prio/P2`, `type/docs`
- **Priorität**: P2
- **Kategorie**: Ops/Deployment
- **PR-Bezug**: PR-Update

---

## Definition of Done (DoD) — Checklisten pro Kategorie

### Docs

- [ ] Inhalte sind **konsistent** (keine widersprüchlichen Aussagen ohne „OUTDATED“ Marker).
- [ ] Source-of-truth ist genannt (und alle Links funktionieren).
- [ ] Wenn Verhalten/Interfaces beschrieben werden: Verweis auf konkrete Dateien (Pfad) oder Contracts.
- [ ] Änderungen referenzieren die passenden Issues/PRs.

### Backend

- [ ] API Contracts (Shapes + Envelope + Errors) sind eingehalten oder versioniert.
- [ ] Tests: Unit + Integration laufen deterministisch; neue Logik ist abgedeckt.
- [ ] Env/Secrets: Required Vars sind dokumentiert und validiert; keine Defaults für Production-Secrets.
- [ ] Security: Auth/Rate limiting/Idempotency sind für neue Write-Paths geklärt.

### Frontend

- [ ] Keine Secrets in `VITE_*`; API Base ist konsistent mit Routing-Policy.
- [ ] Feature Flags sind dokumentiert; Default-Werte sind sicher (fail-safe).
- [ ] E2E (Playwright) deckt kritische Flows ab, wenn UI/Flow geändert wurde.

### Infra/CI/CD

- [ ] CI-Gates entsprechen dem DoD (must-pass vs advisory ist klar).
- [ ] Deploy-Pipeline ist entweder real implementiert oder explizit als placeholder markiert.
- [ ] Ownership-Guardrails sind konsistent mit Config (`vercel.json`, Routing).

### Security

- [ ] Threat Model / Policy ist dokumentiert (Auth, Token, Datenklassifikation).
- [ ] Logging/Observability leak’t keine Secrets/PII.
- [ ] Security Headers / CORS / Rate limits sind definiert (mindestens als Policy + TODOs).

---

## Open Questions / Risiken (bei unklarer Doku)

- **Welche Topologie ist „kanonisch“?**  
  `shared/docs/*` beschreibt Vercel Frontend + externes Backend, während Teile von `docs/*` ein Vercel-Functions-only Zielbild propagieren. Das ist der zentrale Richtungsentscheid.

- **Welche Rolle hat `api/` in 2026?**  
  Ist es nur Tests/Legacy/Alternative oder ein produktiver separater Deploy? Ohne klare Antwort bleibt Contract drift wahrscheinlich.

- **Wie ist `apps/backend-alerts/` integriert?**  
  Ist es produktiv (eigene Domain/API-Key), oder wird Alerts komplett vom kanonischen Backend abgedeckt?

- **Package Manager Policy**  
  Repo nutzt pnpm (Workspace), CI nutzt teils npm. Entscheidung nötig: bewusstes Split vs Standardisierung.

- **Was ist „Production-ready“ Definition?**  
  Ohne konsolidierte DoD+Gates bleibt Production Readiness subjektiv; Risiko: “Green CI” ohne echte Deploy-Sicherheit.


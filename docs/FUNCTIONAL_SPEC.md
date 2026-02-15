# Sparkfined — Functional Specification

Zweck: **stabile Modul-Grenzen**, **API Surface**, **Fehlermodi**, **NFRs**.  
Scope: v1 im aktuellen Repo-Stand.

## 0) Contract Boundaries (verbindlich)

### HTTP Boundary (canonical envelopes)
- **Success**: `{ "status": "ok", "data": <T> }`
- **Error**: `{ "error": { "code": string, "message": string, "details"?: object } }`
  - Backend echo’t `requestId` in `details.requestId` und im Header `x-request-id`.

### Versioning / Backwards Compatibility
- **Shared Contracts**: additive-only (neue optionale Felder) oder Version bump.
- **Storage Keys**:
  - Browser: `sparkfined_*_v1` (nicht brechen).
  - Backend: `kv:v1:*` (nicht brechen; neue Version = neuer Prefix).

### Auth Boundary
- Frontend hat `VITE_ENABLE_AUTH` default **aus**.
- Backend hat Auth-Endpunkte (`/api/auth/*`) und auth-required Endpunkte (z.B. Journal/Settings).
- Regel: 401/403 dürfen **nur** als „auth required“ interpretiert werden, wenn Auth im Client/SW aktiviert ist.

### Tier Boundary (Cost/Capability Control)
- Tiers: `free | standard | pro | high` (Default: `LLM_TIER_DEFAULT`).
- Tier beeinflusst:
  - erlaubte LLM/Provider Pfade,
  - Onchain Enhanced Calls,
  - harte Gates (z.B. Liquidity drop),
  - Budget/Rate Limits.

## 1) System Modules

### 1.1 Journal

- **Zweck**: Persistente Journal-Entries mit Status-Transitions (pending → confirmed → archived) + Insights-Erzeugung (optional, tier-gated).
- **Inputs**:
  - `GET /api/journal?view|status&limit&cursor`
  - `GET /api/journal/:id`
  - `POST /api/journal` mit `Idempotency-Key` Header + Body `{ summary, timestamp? }`
  - `POST /api/journal/:id/confirm|archive|restore`
  - `DELETE /api/journal/:id`
  - `POST /api/journal/:id/insights` (kind + optional Grok gating; siehe Settings)
- **Outputs**:
  - `JournalEntryV1`, `JournalListResponse { items, nextCursor? }`
- **Side Effects**:
  - DB writes (Entry + Transition-Timestamps).
  - Optional: Insights/LLM Calls (kostenbehaftet).
  - Optional: Auto-Archive bei Capture-Ingest (SELL matcht best-passenden PENDING BUY; deterministisch).
- **Persistence**:
  - SQLite/Postgres Tabellen `journal_entries_*`, `journal_confirmations_*`, `journal_archives_*` (user-scoped).
  - Idempotency: server-side mapping `(userId, key) -> entryId` (TTL/Policy implementation-specific).
- **Failure Modes**:
  - `401 UNAUTHENTICATED`: user fehlt/anon.
  - `400 VALIDATION_ERROR|VALIDATION_FAILED`: invalid body/query, fehlender `Idempotency-Key`.
  - `404 JOURNAL_NOT_FOUND`.
  - `409 INVALID_TRANSITION`: z.B. confirm archived, archive pending.
  - Provider/LLM Timeout → `500` oder `429/503` (je nach Adapter).

### 1.2 Market

- **Zweck**: „Market“-Alias/Convenience Layer + Aggregations für UI-Feeds/Signals.
- **Inputs**:
  - `GET /api/market/daily-bias` (Alias auf Oracle daily)
  - `GET /api/feed/oracle?asset=<id>`
  - `GET /api/feed/pulse?asset=<id>`
  - `GET /api/signals/unified?asset=<id>&filter=&sort=`
- **Outputs**:
  - Oracle/Pulse basierte Feed-Items bzw. `UnifiedSignalsResponse { items }`
- **Side Effects**:
  - Best-effort Provider Calls (Pulse Snapshot, optional Context Pack).
- **Persistence**:
  - Pulse Snapshots (KV/DB je nach Implementation), Oracle Daily (siehe Oracle Modul).
- **Failure Modes**:
  - `400 VALIDATION_ERROR`: invalid asset input.
  - `404`: asset symbol nicht auflösbar (Pulse).
  - Provider errors/timeouts.

### 1.3 Oracle

- **Zweck**: Daily Feed (pinned takeaway + insights) + user-scoped read-state.
- **Inputs**:
  - `GET /api/oracle/daily?date=YYYY-MM-DD&asset=<mint?>`
  - `PUT /api/oracle/read-state` Body `{ id, isRead }`
  - `POST|PUT /api/oracle/read-state/bulk` Body `{ ids[], isRead }`
- **Outputs**:
  - `OracleDailyFeed` (mit `pinned` + `insights[]`, `isRead` pro item)
  - `OracleReadStateResponse`, `OracleBulkReadStateResponse`
- **Side Effects**:
  - Writes: read-state updates.
  - Optional: Context Pack Anreicherung bei `asset` Query (tier-dependent).
- **Persistence**:
  - Daily snapshot keyed by date.
  - Read state keyed by `(userId, insightId)` inkl. Literal `today-takeaway`.
- **Failure Modes**:
  - `400 VALIDATION_ERROR`: invalid date/id.
  - Provider/adapter errors (wenn Context Pack aktiv ist).

### 1.4 Alerts

- **Zweck**: Alert CRUD + Events-Log (für SW/UI Dedupe + Notifications).
- **Inputs**:
  - `GET /api/alerts?filter=&symbolOrAddress=`
  - `POST /api/alerts` (Union Create)
  - `GET /api/alerts/:id`
  - `PATCH /api/alerts/:id` (enable/note/condition/target)
  - `POST /api/alerts/:id/cancel-watch`
  - `DELETE /api/alerts/:id`
  - `GET /api/alerts/events?since=&limit=`
- **Outputs**:
  - `Alert` Union, `AlertsListResponse`, `AlertEventsResponse { items: AlertEmitted[] }`
- **Side Effects**:
  - Writes: alerts + emitted events.
  - Optional: Evaluator/Scheduler produziert `AlertEmitted` (engine/worker abhängig).
  - SW zeigt Notifications und dedupliziert client-side.
- **Persistence**:
  - Alerts table + events retention store.
  - Session state für DEAD_TOKEN (TTL/Retention policy).
- **Failure Modes**:
  - `404 ALERT_NOT_FOUND`.
  - `400 VALIDATION_ERROR`.
  - `429 RATE_LIMITED` (falls enforced).

### 1.5 TA (Technical Analysis)

- **Zweck**: deterministische Chart-Analyse; optional Onchain Gating; tier- und kostenbewusst.
- **Inputs**:
  - `POST /api/chart/ta` (TAReport; rate-limited)
  - `POST /api/chart/analyze` (JSON + gerenderter Text; Onchain gating möglich)
  - Body enthält u.a. `{ mint, symbol?, timeframe, candles, tier?, taskKind?, chartContext? }`
- **Outputs**:
  - Analyse-Result (enveloped) inkl. `requestId` (für Trace) und tier/taskKind Echo.
- **Side Effects**:
  - External Calls: LLM Router/Provider; Onchain Provider (Helius) ggf. enhanced calls.
  - Caching: TA cache bucketed (TTL/Keying deterministisch).
- **Persistence**:
  - TA cache (24h TTL), Onchain caches/fingerprints (tier/limits beeinflussen Key).
- **Failure Modes**:
  - `408 TIMEOUT`, `429`, `503` (Provider).
  - `403 FORBIDDEN_TIER` (tier gating).
  - `400 VALIDATION_ERROR` (invalid request).
  - `402/429`-like Budget signals via `BUDGET_EXCEEDED` (implementation-specific).

### 1.6 Dominance

- **Zweck**: Governance-Schicht für autonome Änderungen/Operationen: Risiko-Policy, Golden Tasks, Auto-Correct Loop, Trace/Cost, Memory Artifacts.
- **Inputs**:
  - `ENABLE_SPARKFINED_DOMINANCE` (flag)
  - `SparkfinedRequest { objective, constraints?, targetAreas?, timeBudgetMs? }`
  - Optional `diffStats` (touchedPaths + deltas)
  - Optional cost env: `SPARKFINED_PRICING_TABLE_JSON`, `SPARKFINED_COST_*`
- **Outputs**:
  - `SparkfinedContext` (dominance_v1) + `SparkfinedPolicyDecision` + Trace Events.
- **Side Effects**:
  - `team_plan.md`, `team_progress.md`, `team_findings.md`, `team_decisions.md` (append-only single-line records).
  - Golden task runner spawnt bounded `bash -lc <cmd>` executions.
- **Persistence**:
  - Files + logs (keine Secrets im Context).
- **Failure Modes**:
  - Dominance off → „disabled“ (no-op).
  - Golden suite red/flaky → escalation.
  - Max iterations exceeded → escalation.
  - Cost regression `block` → escalation.

## 2) API Surface Definition (Backend `/api`)

### Foundations
- `GET /health`
- `GET /meta`
- `GET /usage/summary`

### Auth
- `POST /auth/register|login|refresh|logout`
- `GET /auth/me`

### Settings
- `GET /settings`
- `PATCH /settings`

### Journal
- `GET /journal`
- `GET /journal/:id`
- `POST /journal`
- `POST /journal/:id/insights`
- `POST /journal/:id/confirm|archive|restore`
- `DELETE /journal/:id`

### Alerts
- `GET /alerts`
- `POST /alerts`
- `GET /alerts/:id`
- `PATCH /alerts/:id`
- `POST /alerts/:id/cancel-watch`
- `DELETE /alerts/:id`
- `GET /alerts/events`

### Oracle / Market / Feeds / Signals
- `GET /oracle/daily`
- `PUT /oracle/read-state`
- `POST|PUT /oracle/read-state/bulk`
- `GET /market/daily-bias`
- `GET /feed/oracle`
- `GET /feed/pulse`
- `GET /signals/unified`

### TA / Chart Analysis
- `POST /chart/ta`
- `POST /chart/analyze`

### Reasoning / LLM
- `POST /reasoning/*` (trade-review, session-review, board-scenarios, insight-critic, route)
- `POST /llm/execute`

## 3) Non-Functional Requirements (NFR)

### Performance
- Caching ist explizit (private/public/no-store); SW und UI müssen `no-store` respektieren, wenn user-scoped.
- Rate limits für teure Endpoints (insb. TA) sind Pflicht.

### Determinism
- Bucketed Caches/Keys (TA/Onchain) müssen deterministisch sein (tier + caps → fingerprint).
- Tests/Fixtures sollen feste Zeit/Seeds nutzen (kein unkontrolliertes `Date.now()` in Kernlogik).

### Cost-awareness
- Tier gating begrenzt Provider/Onchain Enhanced Calls.
- Dominance Cost Layer nutzt Pricing Table + Regression Thresholds (warn/block).

### Backwards compatibility
- Additive-only Contracts, versionierte Storage Keys, keine stillen Shape-Drifts an der HTTP-Grenze.


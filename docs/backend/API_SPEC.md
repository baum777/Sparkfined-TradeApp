# API_SPEC (v1)

Alle Endpoints sind unter **`/api`** gemountet, passend zur Frontend-Default-BaseURL (`VITE_API_URL || "/api"`).

**Response-Envelope (Standard)**:

```ts
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}
```

**Error-Response (Standard)**:

```ts
export interface ErrorResponse {
  status: number;
  message: string;
  code: string;
  requestId: string;
  details?: Record<string, string[]>;
}
```

**Headers (global)**:
- **Request**: `Authorization: Bearer <token>` (optional in v1; siehe Guards)
- **Response**: `x-request-id: <uuid>` (immer)
- **Idempotency**: `Idempotency-Key: <string>` (für Create-Operationen, wenn angegeben)

> **Auth (Status im aktuellen Milestone)**: Auth ist **absichtlich deaktiviert** (Frontend-Default `VITE_ENABLE_AUTH` ist nicht gesetzt → `false`).
> Alle Produkt-Flows laufen anonym/dev-single-tenant. `/api/auth/*` Endpoints sind aktuell **nicht** Teil des Backends.

---

## 0) Foundations

### `GET /api/health`
- **Auth/Guards**: none
- **Request**: none
- **Response 200**:

```ts
export interface HealthResponse {
  ok: true;
  now: string; // ISO
  version: string; // from env/build
}
```

- **Caching**: `Cache-Control: no-store`
- **Rate limit**: none (oder sehr hoch)

### `GET /api/meta`
- **Auth/Guards**: none
- **Response 200**:

```ts
export interface MetaResponse {
  apiBasePath: "/api";
  environment: "development" | "test" | "production";
  features: {
    watchlistSync: boolean; // default false (future)
    serviceWorkerJobs: boolean; // true when SW integrated
  };
}
```

---

## 1) Journal (v1 UI-minimal)

### Data Types

```ts
export type JournalEntryStatus = "pending" | "confirmed" | "archived";

/**
 * JournalEntryV1 (API Boundary)
 *
 * Notes:
 * - `status` ist IMMER lowercase an der API-Grenze.
 * - `timestamp` ist der Entry-Zeitpunkt (wann die Notiz/Reflexion erfasst wurde).
 * - `createdAt/updatedAt` sind Lifecycle-Zeitstempel der Journal-Entry.
 * - `confirmedAt/archivedAt` sind State-Transition-Zeitstempel.
 */
export interface JournalEntryV1 {
  id: string;
  status: JournalEntryStatus;
  timestamp: string; // ISO 8601 (Entry-Zeitpunkt)
  summary: string;

  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  confirmedAt?: string; // ISO 8601 (nur wenn status="confirmed")
  archivedAt?: string;  // ISO 8601 (nur wenn status="archived")
}

export interface JournalCreateRequest {
  summary: string;
  timestamp?: string; // optional; server sets now if missing (ISO 8601)
}
```

### Idempotency (Write Operations)

- **Header**: `Idempotency-Key: <string>`
- **Scope**: `(userId, operation = POST /api/journal, key)`
- **Semantik**:
  - Server generiert die Entry-ID.
  - Key wird auf die generierte Entry-ID gemappt (TTL **24h**).
  - Replay (gleicher Key + gleicher Body) liefert **dieselbe Entry** zurück.
  - Conflict (gleicher Key + anderer Body) liefert einen **Error** (siehe ErrorResponse).
- **Purpose**: sichere Retries (Offline-Queue, Netzwerk-Flakiness)

### `GET /api/journal`
- **Auth/Guards**: optional bearer (v1); in Test/Dev darf anon, aber `userId = "anon"` dann.
- **Query**:

```ts
export interface JournalListQuery {
  // UI uses view=; backend must accept BOTH:
  view?: JournalEntryStatus;   // alias for status
  status?: JournalEntryStatus; // canonical

  // Optional pagination for future UI:
  limit?: number;   // default 50, max 200
  cursor?: string;  // opaque
}
```

- **Response 200**:

```ts
export interface JournalListResponse {
  items: JournalEntryV1[];
  nextCursor?: string;
}
```

- **Errors**:
  - 400 `INVALID_QUERY` (unknown view/status)
- **Caching**: `Cache-Control: no-store`
- **Rate limit**: 60 req/min per userId

- **Example**:
  - `GET /api/journal?view=pending`

### `GET /api/journal/:id`
- **Auth/Guards**: optional bearer (v1)
- **Params**:
  - `id: string`
- **Response 200**: `JournalEntryV1`
- **Errors**:
  - 404 `JOURNAL_NOT_FOUND`
- **Caching**: `Cache-Control: no-store`

### `POST /api/journal`
- **Auth/Guards**: optional bearer (v1)
- **Idempotency**: supported
- **Request body**: `JournalCreateRequest`
- **Response 201**: `JournalEntryV1`
- **Errors**:
  - 400 `VALIDATION_FAILED` (missing summary)
- **Caching**: `Cache-Control: no-store`

### `POST /api/journal/:id/confirm`
- **Auth/Guards**: optional bearer (v1)
- **Request body**: none
- **Response 200**: `JournalEntryV1` (mit `status="confirmed"`, `confirmedAt` gesetzt)
- **Edge cases**:
  - Confirm auf `archived` → 409 `JOURNAL_INVALID_STATE`
  - Confirm auf `confirmed` → 200 idempotent (keine Änderung)
- **Errors**: 404 `JOURNAL_NOT_FOUND`

### `POST /api/journal/:id/archive`
- **Auth/Guards**: optional bearer (v1)
- **Request body**: none
- **Response 200**: `JournalEntryV1` (mit `status="archived"`, `archivedAt` gesetzt)
- **Edge cases**:
  - Archive auf `pending` → 409 `JOURNAL_INVALID_STATE` (erst confirm)
  - Archive auf `archived` → 200 idempotent
- **Errors**: 404 `JOURNAL_NOT_FOUND`

### `POST /api/journal/:id/restore`
- **Auth/Guards**: optional bearer (v1)
- **Request body**: none
- **Response 200**: `JournalEntryV1` (mit `status="pending"`)
- **Edge cases**:
  - Restore auf `pending` → 200 idempotent

### `DELETE /api/journal/:id`
- **Auth/Guards**: optional bearer (v1)
- **Response 204**: no body
- **Errors**: 404 `JOURNAL_NOT_FOUND`

### Status & Timestamp Semantik (Journal)

- **Status casing**:
  - Interne Domain-Modelle/KV-Keys können uppercase (`PENDING/CONFIRMED/ARCHIVED`) nutzen.
  - API Responses nutzen **immer lowercase**: `"pending" | "confirmed" | "archived"`.
- **Timestamps**:
  - `timestamp`: Entry-Zeitpunkt (wann die Notiz/Reflexion erfasst wurde)
  - `createdAt` / `updatedAt`: Lifecycle der Journal-Entry
  - `confirmedAt` / `archivedAt`: State-Transitions

### Compatibility Notes

- Der frühere generische Zeitstempel-Use von `timestamp` ist **deprecated** für Lifecycle/Transitions.
- Clients sollen für Lifecycle/Transitions auf `createdAt`, `updatedAt`, `confirmedAt`, `archivedAt` setzen.

> // NOTE: Trading-Journal Endpoints (stats/export/prices) sind **out of scope** für Journal v1.

---

## 2) Alerts (v1)

### Data Types
Siehe `docs/backend/CONTRACTS.md` Abschnitt “Alerts”.

### `GET /api/alerts`
- **Auth/Guards**: optional bearer (v1)
- **Query**:

```ts
export type AlertStatusFilter = "all" | "active" | "paused" | "triggered";
export interface AlertsListQuery {
  filter?: AlertStatusFilter; // default "all"
  // optional: symbol filter
  symbolOrAddress?: string;
}
```

- **Response 200**:

```ts
export interface AlertsListResponse {
  items: Alert[];
}
```

- **Caching**: `Cache-Control: no-store`
- **Rate limit**: 60 req/min per userId

### `POST /api/alerts`
- **Auth/Guards**: optional bearer (v1)
- **Idempotency**: required in production, optional in dev
- **Request body (discriminated union)**:

```ts
export type CreateAlertRequest =
  | {
      type: "SIMPLE";
      symbolOrAddress: string;
      timeframe: string;
      condition: SimpleCondition;
      targetPrice: number;
      note?: string;
    }
  | {
      type: "TWO_STAGE_CONFIRMED";
      symbolOrAddress: string;
      timeframe: string;
      template: TwoStageTemplate;
      windowCandles?: number;
      windowMinutes?: number;
      expiryMinutes: number;
      cooldownMinutes: number;
      note?: string;
    }
  | {
      type: "DEAD_TOKEN_AWAKENING_V2";
      symbolOrAddress: string;
      timeframe: string;
      params: DeadTokenParams;
      note?: string;
    };
```

- **Response 201**: `Alert`
- **Errors**:
  - 400 `VALIDATION_FAILED`

### `PATCH /api/alerts/:id`
- **Auth/Guards**: optional bearer (v1)
- **Request body**:

```ts
export interface UpdateAlertRequest {
  enabled?: boolean;
  note?: string;
  // For SIMPLE: allow update target/condition
  condition?: SimpleCondition;
  targetPrice?: number;
}
```

- **Response 200**: `Alert`
- **Edge cases**:
  - toggling enabled must also update `status`:
    - enabled=false → `status="paused"`
    - enabled=true → `status="active"` (wenn stage nicht CONFIRMED/EXPIRED/CANCELLED)
- **Errors**:
  - 404 `ALERT_NOT_FOUND`

### `POST /api/alerts/:id/cancel-watch`
- **Auth/Guards**: optional bearer (v1)
- **Request body**: none
- **Response 200**: `Alert` (mit `stage="CANCELLED"`, `enabled=false`, `status="paused"`)
- **Errors**: 404 `ALERT_NOT_FOUND`

### `DELETE /api/alerts/:id`
- **Auth/Guards**: optional bearer (v1)
- **Response 204**
- **Errors**: 404 `ALERT_NOT_FOUND`

### `GET /api/alerts/events`
Für SW/UI Dedupe + History.
- **Auth/Guards**: optional bearer (v1)
- **Query**:

```ts
export interface AlertEventsQuery {
  since?: string; // ISO; default now-24h
  limit?: number; // default 100, max 500
}
```

- **Response 200**:

```ts
export interface AlertEventsResponse {
  items: AlertEmitted[];
}
```

- **Caching**: `Cache-Control: no-store`

---

## 3) Oracle (Daily Feed + Read State)

### `GET /api/oracle/daily`
- **Auth/Guards**: optional bearer (v1)
- **Query**:

```ts
export interface OracleDailyQuery {
  date?: string; // "YYYY-MM-DD"; default today (server timezone UTC)
}
```

- **Response 200**: `OracleDailyFeed`
- **Caching**:
  - `Cache-Control: public, max-age=300` (5 min) **für** die generische daily payload
  - User-spezifische Read-States dürfen server-seitig gemerged werden; dann `private, max-age=60`.
- **Rate limit**: 30 req/min per userId

### `PUT /api/oracle/read-state`
- **Auth/Guards**: optional bearer (v1)
- **Request body**:

```ts
export interface OracleReadStateRequest {
  id: string;      // insightId oder "today-takeaway"
  isRead: boolean; // true/false
}
```

- **Response 200**:

```ts
export interface OracleReadStateResponse {
  id: string;
  isRead: boolean;
  updatedAt: string;
}
```

### `POST /api/oracle/read-state/bulk`
- **Auth/Guards**: optional bearer (v1)
- **Request body**:

```ts
export interface OracleBulkReadStateRequest {
  ids: string[];
  isRead: boolean; // typically true for “Mark all read”
}
```

- **Response 200**:

```ts
export interface OracleBulkReadStateResponse {
  updated: Array<{ id: string; isRead: boolean; updatedAt: string }>;
}
```

---

## 4) Chart TA (Stub jetzt, deterministic)

### `POST /api/chart/ta`
- **Auth/Guards**: optional bearer (v1)
- **Request body**:

```ts
export interface TARequest {
  market: string;     // e.g. "SOL" or "BTC"
  timeframe: string;  // e.g. "1h"
  replay: boolean;

  // Optional: capture/upload context (future)
  // BACKEND_TODO: chartImageBase64?: string;
}
```

- **Response 200**: `TAReport`
- **Caching**:
  - `Cache-Control: private, max-age=300` (5 min) + server-side 24h cache bucketed by day
- **Rate limit**: 10 req/min per userId (expensive endpoint)
- **Idempotency**: not required (same inputs → same output by design)

---

## 5) Watchlist (optional backend sync)

> UI arbeitet aktuell rein lokal (localStorage `sparkfined_watchlist_v1`) und nutzt Query `selected`.

```ts
// BACKEND_TODO: Add watchlist sync API when UI adopts it.
```

Empfohlene v1 Endpoints (future):
- `GET /api/watchlist`
- `PUT /api/watchlist` (full replace)
- `POST /api/watchlist/items` (add)
- `DELETE /api/watchlist/items/:symbol`


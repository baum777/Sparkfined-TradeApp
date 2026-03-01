---
Owner: Architecture Team
Status: active
Version: 1.0
LastUpdated: 2026-02-27
Canonical: true
---

# API Contracts (Ist-Zustand)

## Single Source of Truth (Shapes)

Die **kanonischen** TypeScript-Contracts für Request/Response‑Shapes liegen unter:

- `shared/contracts/*`

Wichtige Contracts:

- `shared/contracts/sol-chart-ta-journal.ts`: SOL Chart + Onchain Feature Packs + Analyse Result
- `shared/contracts/reasoning-router.ts`: Reasoning Router + `/llm/execute` Request/Response
- `shared/contracts/grokPulse.ts`: Grok Pulse Snapshot/History
- `shared/contracts/journal.settings.ts`: `/settings` + Journal Insights Request Types

## Frontend-Verbrauch (Contract-First)

Frontend soll Shapes **aus `shared/contracts/*` importieren** und nicht Backend-Verhalten erraten.

Beispiel: `src/services/api/grokPulse.ts` importiert `shared/contracts/grokPulse.ts`.

## API Base Path

- Base Path ist im Betrieb **`/api`**.
- Lokal wird `/api` per Vite Proxy auf das lokale Backend geroutet (siehe `vite.config.ts`).
- In Production wird `/api/*` durch Vercel auf ein externes Backend weitergeleitet (siehe `vercel.json`).

## Implementierte Endpoints (nach `backend/src/app.ts`)

Diese Endpoints sind im `backend/` Router registriert:

- **Health/Meta**
  - `GET /api/health`
  - `GET /api/meta`
  - `GET /api/usage/summary`
- **Settings**
  - `GET /api/settings`
  - `PATCH /api/settings`
- **Journal**
  - `GET /api/journal`
  - `GET /api/journal/:id`
  - `POST /api/journal` (**Idempotency-Key required**, siehe `backend/src/routes/journal.ts`)
  - `POST /api/journal/:id/insights`
  - `POST /api/journal/:id/confirm`
  - `POST /api/journal/:id/archive`
  - `POST /api/journal/:id/restore`
  - `DELETE /api/journal/:id`
- **Alerts**
  - `GET /api/alerts`
  - `POST /api/alerts`
  - `GET /api/alerts/:id`
  - `PATCH /api/alerts/:id`
  - `POST /api/alerts/:id/cancel-watch`
  - `DELETE /api/alerts/:id`
  - `GET /api/alerts/events`
- **Oracle**
  - `GET /api/oracle/daily`
  - `PUT /api/oracle/read-state`
  - `POST /api/oracle/read-state/bulk` (Alias: `PUT` ist ebenfalls registriert)
- **Chart/TA**
  - `POST /api/chart/ta`
  - `POST /api/chart/analyze`
- **Reasoning / LLM**
  - `POST /api/reasoning/trade-review`
  - `POST /api/reasoning/session-review`
  - `POST /api/reasoning/board-scenarios`
  - `POST /api/reasoning/insight-critic`
  - `POST /api/reasoning/route`
  - `POST /api/llm/execute`
- **Feed/Signals/Market**
  - `GET /api/feed/oracle`
  - `GET /api/feed/pulse`
  - `GET /api/signals/unified`
  - `GET /api/market/daily-bias`

Zusätzlich existieren weitere Endpoints in `api/` (Vercel Functions), u.a. Cron/Wallet/Profile. Diese sind im Repo implementiert, aber **nicht** automatisch Production‑kanonisch, solange `/api/*` per Vercel Rewrite auf das externe Backend zeigt (siehe `shared/docs/DEPLOYMENT.md`).

## Response Envelope & Error Model (kanonisch)

### Canonical Envelope Schema

**Code Source of Truth:** `shared/contracts/http/envelope.ts`

**Implementation Source of Truth:** `backend/src/http/response.ts` and `backend/src/http/error.ts`

**Rule:** All `/api/*` responses must conform to this envelope. Legacy/non-canonical surfaces must document deviations explicitly.

#### Success Envelope
```typescript
interface ApiSuccess<T> {
  status: "ok";
  data: T;
}
```

#### Error Envelope
```typescript
interface ApiError {
  error: {
    code: string;           // machine-readable error code
    message: string;        // human-readable description
    details?: {
      requestId: string;    // tracing id (also in header)
      [key: string]: any;   // additional context
    };
  };
}
```

#### Required Headers
| Header | Value | Purpose |
|--------|-------|---------|
| `x-request-id` | UUID or trace string | Request tracing across services |

### A) `backend/` Envelope (Node Server)

Quelle: `backend/src/http/response.ts` und `backend/src/http/error.ts`.

- **Success**: `{ "status": "ok", "data": <T> }`
- **Error**: `{ "error": { "code": string, "message": string, "details"?: any } }`
- Response Header: `x-request-id`

### B) `api/` Envelope (Vercel Functions) — Legacy / non‑canonical

Quelle: `api/_lib/response.ts`.

- **Success**: `{ "data": <T>, "status": <number>, "message"?: string }`
- **Error**: `{ "error": { "code": string, "message": string, "details"?: Record<string,string[]> } }`
- Response Header: `x-request-id`

### Frontend Erwartung (ApiClient)

Quelle: `src/services/api/client.ts`.

- Standard-Mode (`apiClient.get/post/...`) erwartet das **kanonische** `backend/` Envelope (`{ status:"ok", data }`).
- Raw-Mode (`apiClient.raw.*`) akzeptiert beliebige JSON Shapes (für Migration/Legacy).

### Type-Level Contract Tests

**Location:** `shared/tests/type-contracts/`

Compile-time type validation using `satisfies` and `@ts-expect-error`:
- `trading-quote.contract.test.ts` - Validates quote response shapes against `ApiOk<TerminalQuoteData>`
- Run: `pnpm contract:typecheck`

These tests fail at build time if API response shapes drift from TypeScript contracts.

## Contract Drift Risiken (explizit)

- **R1: Envelope-Mismatch zwischen Production-Backend und Frontend**
  - Repo-Guardrails behaupten: Production `/api/*` kommt vom Node Backend.
  - Node Backend liefert Envelope **A**.
  - Frontend erwartet Envelope **A**.
  - Ergebnis: **resolved** (kein `ApiContractError` mehr durch Envelope-Mismatch).

- **R2: Auth-Policy drift**
  - `api/` verlangt JWT standardmäßig.
  - `backend/` ist standardmäßig „anon“, JWT nur optional.
  - Frontend Auth ist bewusst deaktiviert (`VITE_ENABLE_AUTH=false`).
  - **TODO:** Einheitliches Auth‑Verhalten pro Deployment definieren.

- **R3: Error-Shape drift**
  - `backend/` Errors haben `{error:{...}}`
  - `api/` Errors haben `{error:{...}}`
  - Frontend Error Parsing ist konsistent auf `{ error: {...} }`.

## Idempotency / Header Contracts

- **`Idempotency-Key`**: `POST /api/journal` verlangt diesen Header (siehe `backend/src/routes/journal.ts` und CORS Allow-Headers).
- **`x-request-id`**: Server setzt Response Header. Client kann optional einen Request ID Header senden (**TODO:** ist Request-ID als Request Header bereits genutzt?).


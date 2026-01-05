# CONTRACTS (Source of Truth)

Diese Datei ist **die** Source-of-Truth für alle Backend-/SW-/Storage-Verträge, die mit dem bestehenden Frontend kompatibel sein müssen. Keine UI/UX-Änderungen erfinden.

> Basis-Beobachtung aus dem Repo (Frontend, Stand heute):
> - API BaseURL (Frontend): `import.meta.env.VITE_API_URL || '/api'` (`src/services/api/client.ts`)
> - UI Deep-Links / Query-Params existieren für: `/journal`, `/watchlist`, `/chart`, `/alerts` (Prefill)
> - Lokale Persistenz (UI) nutzt versionierte Keys: `sparkfined_*_v1` (z.B. Alerts/Watchlist/Oracle Read States)

---

## 1) Query-Param Contracts (UI Deep Links)

### 1.1 `/journal?view=...`
- **Route**: `/journal`
- **Query Param**: `view`
- **Typ**:

```ts
export type JournalView = "pending" | "confirmed" | "archived";

export interface JournalRouteQuery {
  view?: JournalView; // default: "pending"
  entry?: string;     // optional deep-link selection
}
```

- **Semantik (UI)**:
  - Wenn `view` fehlt/invalid → UI defaultet auf `"pending"`.
  - UI schreibt `view` beim Segmentwechsel zurück in die URL.
- **Beispiel**: `/journal?view=pending`

### 1.2 `/journal?entry=<id>` (Resolution + Highlight/Scroll)
- **Route**: `/journal`
- **Query Param**: `entry`
- **Typ**:

```ts
export interface JournalEntryDeepLinkQuery {
  entry: string; // JournalEntry id
}
```

- **Semantik (UI)**:
  - UI sucht Entry in lokalem `entries[]`. Wenn gefunden:
    - wechselt ggf. Segment (`view`) auf `entry.status`
    - scrollt und highlightet Entry
  - Wenn nicht gefunden: UI zeigt "Entry ... not found" und bietet "Clear" an.
- **Backend-Implikation**:
  - Backend muss `GET /api/journal/:id` liefern, damit UI (nach Migration weg vom Stub) `entry` zuverlässig auflösen kann.
- **Beispiel**: `/journal?entry=entry-1735689600000`

### 1.3 `/watchlist?selected=...`
- **Route**: `/watchlist`
- **Query Param**: `selected`
- **Typ**:

```ts
export interface WatchlistRouteQuery {
  selected?: string; // symbol; case-insensitive match gegen Watchlist items[].symbol
}
```

- **Semantik (UI)**:
  - Wenn `selected` gesetzt:
    - UI öffnet Detail Panel/Sheet und selektiert Item (case-insensitive)
    - wenn nicht gefunden: Not-found-State mit Option "Add" (UI-only)
- **Beispiel**: `/watchlist?selected=SOL`

### 1.4 `/chart?replay=true` und `/chart?query=...`
- **Route**: `/chart`
- **Query Params**: `replay`, `query`
- **Typ**:

```ts
export interface ChartRouteQuery {
  replay?: "true"; // UI interpretiert replay === "true" als true, sonst false
  query?: string;  // symbol oder freie Eingabe (UI encoded via encodeURIComponent)
}
```

- **Semantik (UI)**:
  - `replay=true` toggelt Replay-UI.
  - `query` wird als Navigations-Parameter benutzt (z.B. von Watchlist/Oracle/Alerts).
- **Beispiele**:
  - `/chart?replay=true`
  - `/chart?query=BTC`
  - `/chart?replay=true&query=SOL`

### 1.5 `/alerts` Prefill Params (Quick Create)
- **Route**: `/alerts`
- **Query Params**: werden **einmalig** beim Mount gelesen; danach URL gecleant (`setSearchParams({}, { replace: true })`).
- **Typ**:

```ts
export type AlertsPrefillType = "simple" | "twoStage" | "deadToken";
export type AlertsPrefillTemplate =
  | "trendMomentumStructure"
  | "macdRsiVolume"
  | "breakoutRetestVolume";

export interface AlertsRoutePrefillQuery {
  symbol?: string;
  timeframe?: string;
  condition?: string;      // wird UI-seitig nach SimpleCondition uppercased
  target?: string;         // float parse
  type?: AlertsPrefillType;
  template?: AlertsPrefillTemplate;
  windowCandles?: string;  // int parse
  expiryMinutes?: string;  // int parse
  cooldownMinutes?: string;// int parse
}
```

- **Semantik (UI)**:
  - `type` mappt auf AlertType:
    - `"simple"` → `SIMPLE`
    - `"twoStage"` → `TWO_STAGE_CONFIRMED`
    - `"deadToken"` → `DEAD_TOKEN_AWAKENING_V2`
  - `template` wird auf `TwoStageTemplate` gemappt.
- **Beispiel**:
  - `/alerts?type=twoStage&symbol=BONK&timeframe=15m&template=trendMomentumStructure&windowCandles=20&expiryMinutes=60&cooldownMinutes=15`

---

## 2) API Contracts (Request/Response Shapes)

### 2.1 Gemeinsame Response Envelope & Errors

Frontend erwartet im `ApiClient` aktuell:

```ts
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}
```

**Backend-Regel (verbindlich)**:
- **Erfolgsresponses** dürfen entweder:
  - **A)** Rohdaten `T` (wie aktuell in `ApiClient.request()` zurückgegeben), oder
  - **B)** das oben definierte Envelope liefern.
- Um **Contract Drift** zu vermeiden, wird im Backend **B)** standardisiert:
  - HTTP JSON: `{ data, status, message? }`
  - `status` muss der HTTP-Statuscode sein.

**Fehler-Response Schema (HTTP JSON)**:

```ts
export interface ErrorResponse {
  status: number;          // HTTP status
  message: string;         // user-safe message
  code: string;            // stable machine code (kein optional im Backend!)
  requestId: string;       // x-request-id echo
  details?: Record<string, string[]>; // z.B. zod validation: field -> errors
}
```

### 2.2 Journal (API Contract v1)

> Legacy-Hinweis: Ältere Docs/UI-Stubs nutzten nur `{ id, side, status, timestamp, summary }`.  
> Der implementierte v1 API-Contract ist additiv und enthält explizite Lifecycle-/Transition-Timestamps sowie optionalen Frozen Onchain Snapshot.

```ts
export type JournalEntryStatus = "pending" | "confirmed" | "archived"; // API boundary: lowercase
export type JournalEntrySide = "BUY" | "SELL";

export interface JournalEntryV1 {
  id: string;
  side: JournalEntrySide;
  status: JournalEntryStatus;

  timestamp: string; // ISO 8601 (Trade-Zeitpunkt)
  summary: string;

  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  confirmedAt?: string; // ISO 8601 (nur wenn status="confirmed")
  archivedAt?: string;  // ISO 8601 (nur wenn status="archived")

  // Frozen Onchain Snapshot (P1.2, best-effort)
  onchainContext?: OnchainContextV1;
  onchainContextMeta?: OnchainContextMetaV1;
}

export interface JournalCreateRequest {
  side: JournalEntrySide;
  summary: string;
  timestamp?: string; // ISO 8601; defaults to now if missing
  // Optional: Solana mint address (Base58, 32–44 chars). Aktuell strikt als Adresse validiert.
  symbolOrAddress?: string;
}

export interface JournalConfirmPayload {
  mood: string;
  note: string;
  tags: string[];
}

export interface JournalArchiveRequest {
  reason: string;
}

export interface OnchainContextV1 {
  capturedAt: string; // ISO 8601
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  marketCap: number;
  ageMinutes: number;
  holders: number;
  transfers24h: number;
  dexId?: string;
}

export type OnchainContextProvider = "dexpaprika" | "moralis" | "internal";
export type OnchainContextErrorCode =
  | "MISSING_MARKET_KEY"
  | "MISSING_API_KEY"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "PARSE_ERROR"
  | "MISSING_FIELD"
  | "APPROXIMATE_COUNT"
  | "UNKNOWN_ERROR";

export interface OnchainContextErrorV1 {
  provider: OnchainContextProvider;
  code: OnchainContextErrorCode;
  message: string;
  at: string; // ISO 8601
  requestId: string;
  httpStatus?: number;
}

export interface OnchainContextMetaV1 {
  capturedAt: string; // ISO 8601
  errors: OnchainContextErrorV1[]; // leer wenn alles ok
}
```

**Frozen Onchain Snapshot Semantik**:
- `onchainContext` ist ein **frozen** Snapshot, erfasst beim Create (best-effort) und danach nicht mutiert.
- Fehler/Diagnose **dürfen nicht** in `onchainContext` eingebettet werden, sondern gehören in `onchainContextMeta.errors`.
- “Partial” kann client-seitig über `onchainContextMeta.errors.length > 0` abgeleitet werden.

**Idempotency (POST /api/journal)**:
- **Header**: `Idempotency-Key: <string>`
- **Scope**: `(userId, operation = POST /api/journal, key)`
- **TTL**: 24h
- **Replay**: gleicher Key + gleicher Body → gleiche Entry wird zurückgegeben.
- **Conflict**: gleicher Key + anderer Body → Error.

**Status & Timestamp Semantik**:
- Interne Domain/KV-Modelle können uppercase Status führen; API Responses sind **immer lowercase**.
- `createdAt/updatedAt` sind Lifecycle, `confirmedAt/archivedAt` sind Transition-Timestamps.
- `timestamp` ist der Trade-Zeitpunkt und nicht als generischer Lifecycle-Timestamp zu interpretieren.

**Compatibility**:
- Clients sollen für Lifecycle/Transitions die expliziten Felder (`createdAt/updatedAt/confirmedAt/archivedAt`) nutzen.

### 2.3 Alerts (UI-Contract aus `src/components/alerts/types.ts`)

```ts
export type AlertType = "SIMPLE" | "TWO_STAGE_CONFIRMED" | "DEAD_TOKEN_AWAKENING_V2";
export type AlertStage = "INITIAL" | "WATCHING" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
export type AlertStatus = "active" | "paused" | "triggered";

export type SimpleCondition = "ABOVE" | "BELOW" | "CROSS";

export type TwoStageTemplate =
  | "TREND_MOMENTUM_STRUCTURE"
  | "MACD_RSI_VOLUME"
  | "BREAKOUT_RETEST_VOLUME";

export interface IndicatorState {
  id: string;
  label: string;
  category: "Trend" | "Momentum" | "Structure" | "Volume";
  params: string;
  triggered: boolean;
  lastValue?: string;
}

export interface DeadTokenParams {
  DEAD_VOL: number;
  DEAD_TRADES: number;
  DEAD_HOLDER_DELTA_6H: number;
  AWAKE_VOL_MULT: number;
  AWAKE_TRADES_MULT: number;
  AWAKE_HOLDER_DELTA_30M: number;
  STAGE2_WINDOW_MIN: number;
  COOLDOWN_MIN: number;
  STAGE3_WINDOW_H: number;
  STAGE3_VOL_MULT: number;
  STAGE3_TRADES_MULT: number;
  STAGE3_HOLDER_DELTA: number;
}

export interface BaseAlert {
  id: string;
  type: AlertType;
  symbolOrAddress: string;
  timeframe: string;
  enabled: boolean;
  status: AlertStatus;
  stage: AlertStage;
  createdAt: string;
  note?: string;
}

export interface SimpleAlert extends BaseAlert {
  type: "SIMPLE";
  condition: SimpleCondition;
  targetPrice: number;
  triggeredAt?: string;
}

export interface TwoStageAlert extends BaseAlert {
  type: "TWO_STAGE_CONFIRMED";
  template: TwoStageTemplate;
  windowCandles?: number;
  windowMinutes?: number;
  expiryMinutes: number;
  cooldownMinutes: number;
  indicators: IndicatorState[];
  triggeredCount: number;
  lastTriggeredAt?: string;
  expiresAt?: string;
}

export type DeadTokenStage = "INITIAL" | "AWAKENING" | "SUSTAINED" | "SECOND_SURGE" | "SESSION_ENDED";

export interface DeadTokenAlert extends BaseAlert {
  type: "DEAD_TOKEN_AWAKENING_V2";
  params: DeadTokenParams;
  deadTokenStage: DeadTokenStage;
  sessionStart?: string;
  sessionEndsAt?: string;
  windowEndsAt?: string;
  cooldownEndsAt?: string;
}

export type Alert = SimpleAlert | TwoStageAlert | DeadTokenAlert;
```

### 2.4 Oracle (UI-Contract aus `src/stubs/contracts.ts` + `src/pages/Oracle.tsx`)

```ts
export interface OracleInsight {
  id: string;
  title: string;
  summary: string;
  theme: string;
  isRead: boolean;
  createdAt: string; // ISO
}

export interface OracleDailyFeed {
  pinned: {
    id: "today-takeaway";
    title: string;
    summary: string;
    isRead: boolean;
    createdAt: string;
  };
  insights: OracleInsight[];
}
```

**Read-State Keying (UI)**:
- `today-takeaway` ist ein festes ID-Literal.
- `isRead` wird lokal persistiert (Key: `sparkfined_oracle_read_v1`) und muss backend-seitig pro User abbildbar sein.

### 2.5 Chart TA (Stub jetzt, deterministic)

UI-internes Shape (aus `src/components/chart/AITAAnalyzerDialog.tsx`) wird als Backend-Response festgeschrieben:

```ts
export type TrendDirection = "Bullish" | "Bearish" | "Range";
export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface SupportResistanceLevel {
  label: string;
  level: number;
  note?: string;
}

export interface TPLevel {
  label: string;
  level: number;
  rationale: string;
}

export interface StopLoss {
  soft: { level: number; rule: string };
  hard: { level: number; rule: string };
}

export interface TAReport {
  assumptions: {
    market: string;
    timeframe: string;
    replay: boolean;
    dataSource: string;
    timestamp: string; // ISO preferred
  };
  trend: {
    direction: TrendDirection;
    confidence: ConfidenceLevel;
    summary: string;
  };
  support: SupportResistanceLevel[];
  resistance: SupportResistanceLevel[];
  takeProfitLevels: TPLevel[];
  stopLoss: StopLoss;
  reversalCriteria: string[];
}
```

**Determinismus-Anforderung**:
- Für gleiche Eingaben `(market, timeframe, replay, seedDateBucket)` muss das Ergebnis stabil sein (siehe `TEST_PLAN.md` “golden fixtures”).

---

## 3) Event Contracts (Backend → SW/UI)

### 3.1 `AlertEmitted`

```ts
export type AlertEmittedType =
  | "SIMPLE_TRIGGERED"
  | "TWO_STAGE_PROGRESS"     // optional: indicator update
  | "TWO_STAGE_CONFIRMED"
  | "TWO_STAGE_EXPIRED"
  | "DEAD_TOKEN_STAGE"       // AWAKENING/SUSTAINED/SECOND_SURGE
  | "DEAD_TOKEN_SESSION_ENDED";

export interface AlertEmitted {
  eventId: string;          // uuid
  type: AlertEmittedType;
  occurredAt: string;       // ISO
  alertId: string;
  alertType: AlertType;
  symbolOrAddress: string;
  timeframe: string;

  stage: AlertStage;
  status: AlertStatus;

  // Optional detail (type-specific)
  detail?:
    | {
        kind: "simple";
        condition: SimpleCondition;
        targetPrice: number;
        lastPrice: number;
      }
    | {
        kind: "twoStage";
        template: TwoStageTemplate;
        triggeredCount: number;          // 0..3
        indicators: IndicatorState[];    // updated flags + lastValue
        windowEndsAt?: string;
        expiresAt?: string;
      }
    | {
        kind: "deadToken";
        deadTokenStage: DeadTokenStage;
        sessionStart?: string;
        sessionEndsAt?: string;
        windowEndsAt?: string;
      };
}
```

### 3.2 `OracleInsight` Event

```ts
export interface OracleInsightEvent {
  eventId: string;
  occurredAt: string;
  insight: OracleInsight;
}
```

### 3.3 `JournalEntry` Event (CRUD + status transitions)

```ts
export type JournalEventType =
  | "JOURNAL_CREATED"
  | "JOURNAL_CONFIRMED"
  | "JOURNAL_ARCHIVED"
  | "JOURNAL_DELETED"
  | "JOURNAL_RESTORED";

export interface JournalEntryEvent {
  eventId: string;
  occurredAt: string;
  type: JournalEventType;
  entry: JournalEntry;
}
```

---

## 4) Storage Key Map + Versioning

### 4.1 Browser LocalStorage (bestehend, nicht brechen)

| Key | Owner | Shape | Notes |
|---|---|---|---|
| `sparkfined_alerts_v1` | UI | `Alert[]` | Alerts-Liste (UI store) |
| `sparkfined_watchlist_v1` | UI | `WatchItemStub[]` | Watchlist Items |
| `sparkfined_oracle_read_v1` | UI | `Record<string, boolean>` | Read state inkl. `today-takeaway` |
| `sparkfined_recent_searches_v1` | UI | `string[]` | Global Search recents |
| `sparkfined_recent_markets_v1` | UI | `string[]` | Chart/Markets recents |
| `sparkfined_theme_v1` | UI | `"system" \| "light" \| "dark"` | Theme |
| `sparkfined_reduce_motion_v1` | UI | `"true" \| "false"` | bool-as-string |
| `sparkfined_compact_mode_v1` | UI | `"true" \| "false"` | bool-as-string |

### 4.2 Backend KV/DB Keys (verbindlich, v1)

**Key Prefix Konvention**: `kv:v1:<domain>:...`

| Domain | Key Pattern | Value Shape | TTL |
|---|---|---|---|
| Alerts | `kv:v1:alerts:byId:<alertId>` | `Alert` | none |
| Alerts index | `kv:v1:alerts:ids` | `string[]` | none |
| Watch candidates | `kv:v1:watchCandidates:ids` | `string[]` | 24h |
| Dead-token sessions | `kv:v1:sessions:deadToken:<alertId>` | `{ alertId: string; deadTokenStage: DeadTokenStage; sessionStart: string; sessionEndsAt: string; windowEndsAt?: string; cooldownEndsAt?: string }` | 13h |
| Alert events | `kv:v1:events:alert:<eventId>` | `AlertEmitted` | 30d |
| Journal | `kv:v1:journal:byId:<entryId>` | `JournalEntry` | none |
| Journal index | `kv:v1:journal:ids` | `string[]` | none |
| Oracle daily | `kv:v1:oracle:daily:<yyyy-mm-dd>` | `OracleDailyFeed` (ohne user read flags) | 36h |
| Oracle read | `kv:v1:oracle:read:<userId>:<insightId>` | `{ isRead: true, at: string }` | none |
| TA cache | `kv:v1:ta:<market>:<timeframe>:<replay>:<bucket>` | `TAReport` | 24h |

> Hinweis: Wenn kein echtes KV (Redis) existiert, muss das Backend diese Key-Patterns **in SQLite** oder einem kompatiblen KV-Adapter abbilden (siehe `DATA_STORES.md`).

---

## 5) Stage / State Machines

### 5.1 Alerts (Shared Stage)

```ts
export type AlertStage = "INITIAL" | "WATCHING" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
```

- `enabled=false` entspricht UI-seitig meist `paused`.
- `status` ist UI-Filter-Input:
  - `active`: aktiv/watching
  - `paused`: disabled
  - `triggered`: confirmed/triggered

### 5.2 TWO_STAGE_CONFIRMED State Machine

**Zusatzregel**: 2-of-3 innerhalb eines Windows, dann **one-shot** `CONFIRMED`, danach Cooldown/Expiry Handling.

**Zustände**:
- `INITIAL` → `WATCHING` (nach Create, wenn enabled)
- `WATCHING`:
  - sammelt Trigger pro Indicator (3 Stück)
  - wenn `triggeredCount >= 2` innerhalb Window → `CONFIRMED` + `status="triggered"`
  - wenn `expiresAt` erreicht → `EXPIRED` + `enabled=false` + `status="paused"`
  - `cancelWatch` → `CANCELLED` + `enabled=false` + `status="paused"`
- `CONFIRMED`: one-shot; **keine** weitere Bestätigung in derselben Alert-Instanz.

**Beispiel Transition**:
- t0 create: `stage=WATCHING, triggeredCount=0`
- t1 indicator A true → `triggeredCount=1`
- t2 indicator B true → `triggeredCount=2` → emit `TWO_STAGE_CONFIRMED`, set `stage=CONFIRMED`, `status=triggered`

### 5.3 DEAD_TOKEN_AWAKENING_V2 State Machine

**Stages**:
- Shared `stage` bleibt für UI-Listenlogik relevant, zusätzlich `deadTokenStage`.

```ts
export type DeadTokenStage = "INITIAL" | "AWAKENING" | "SUSTAINED" | "SECOND_SURGE" | "SESSION_ENDED";
```

**Regeln (verbindlich)**:
- Precondition “Deadness”: Token gilt als “dead”, wenn in einer Deadness-Window:
  - `volume <= DEAD_VOL` und `trades <= DEAD_TRADES` und `holderDelta6h <= DEAD_HOLDER_DELTA_6H`
- Session max: **12h** (UI copy), d.h. `sessionEndsAt = sessionStart + 12h`
- One-shot emits pro Stage:
  - beim Eintritt in `AWAKENING`, `SUSTAINED`, `SECOND_SURGE` genau ein `AlertEmitted`-Event.
- Cooldown: nach `SESSION_ENDED` oder nach `SECOND_SURGE` setze `cooldownEndsAt = now + COOLDOWN_MIN`.

---

## 6) Contract Gaps (bereits identifiziert)

Diese Punkte müssen im Backend-Checklist als “Gap” geführt und UI-sicher migriert werden:

1. **Journal Shape Drift**
   - UI nutzt `JournalEntryStub` (minimal), Services-Layer enthält `services/trading/journal.service.ts` mit großem `JournalEntry`.
   - Entscheidung: Backend liefert **minimal** für UI v1; optional “full” via `GET /api/journal?format=full` (siehe `API_SPEC.md`).
2. **Oracle Shape Drift**
   - UI nutzt `OracleStub` (title/summary/theme/isRead), Playwright fixtures zeigen ein anderes Oracle-Modell (category/content/confidence/isPinned).
   - Entscheidung: Backend v1 folgt UI `OracleStub` exakt; erweiterte Felder als `// BACKEND_TODO`.
3. **Alerts Drift**
   - Es existiert ein altes `AlertStub` (stubs) und ein echtes Alerts-Modul mit v2/v3 Stages.
   - Entscheidung: Backend v1 folgt `src/components/alerts/types.ts` exakt.


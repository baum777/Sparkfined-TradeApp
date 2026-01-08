# SW_SPEC (Service Worker)

Diese Spezifikation beschreibt die Service-Worker-Verantwortlichkeiten für Alerts + Oracle in einer Weise, die **restart-sicher** und **deterministisch testbar** ist. Es existiert aktuell **kein** SW im Repo; daher enthält diese Datei **exakte** Pfade, Contracts und Zustandsmodelle für die Implementierung.

---

## 0) Dateien (müssen erstellt/angepasst werden)

### Neu anzulegen
- `src/sw/service-worker.ts` — SW Entry (build-time emitted)
- `src/sw/sw-contracts.ts` — TS Interfaces (Notification payload, persisted state)
- `src/sw/sw-storage.ts` — IndexedDB Wrapper (kein `any`)
- `src/sw/sw-scheduler.ts` — Polling/Retry/Backoff Logik
- `src/sw/sw-alerts.ts` — Alerts Poll + Dedupe + Notifications
- `src/sw/sw-oracle.ts` — Oracle Poll + Daily Takeaway Notification

### Anzupassen
- `src/main.tsx` — SW registration + messaging channel
- `vite.config.ts` — SW build/asset output (z.B. via `vite-plugin-pwa` oder custom build step)

> Hinweis: Die tatsächliche Tooling-Entscheidung (PWA plugin vs. custom) ist Implementation; diese Spezifikation fixiert **nur** Pfade/Contracts/Verhalten.

---

## 1) Persistenzmodell (restart-sicher)

Der SW muss seinen Zustand in **IndexedDB** persistieren (nicht localStorage).

### DB Name + Version

```ts
export const SW_IDB_NAME = "sparkfined_sw_v1";
export const SW_IDB_VERSION = 1;
```

### Object Stores (Indexes verpflichtend)

```ts
export interface SwKeyValueRow {
  key: string;
  value: unknown; // Implementation: in storage layer strikt typisieren per generic map
  updatedAt: string; // ISO
}

export interface SwDedupeRow {
  dedupeKey: string;  // unique
  eventId: string;
  createdAt: string;  // ISO
  expiresAt: string;  // ISO
}
```

**Stores**:
- `kv` (keyPath: `key`)
  - Index: `updatedAt`
- `dedupe` (keyPath: `dedupeKey`)
  - Index: `expiresAt` (für Cleanup)

### Dedupe Keys (stabil)

```ts
export type SwDedupeNamespace = "alert" | "oracle";

export interface SwDedupeKeySpec {
  namespace: SwDedupeNamespace;
  key: string; // e.g. "alert:<alertId>:<type>:<occurredAtBucket>"
}
```

**Regel**:
- Dedupe TTL:
  - Alerts: **24h**
  - Oracle: **36h** (daily)

---

## 2) Polling Schedules (deterministisch)

### 2.1 Baseline (ohne Background Sync APIs)
- SW pollt nur, wenn er aktiv ist (typisch nach Push/Message/periodic sync).
- Für lokale Dev/E2E muss ein “foreground driver” existieren:
  - UI sendet `postMessage` an SW: `"SW_TICK"` alle 30s, solange App offen ist.

### 2.2 Poll Intervals (v1)

| Domain | Endpoint | Interval | Jitter | Backoff |
|---|---|---:|---:|---|
| Alerts | `GET /api/alerts/events?since=` | 30s | ±10% | exp. backoff bis 10min |
| Oracle | `GET /api/oracle/daily` | 10min | ±10% | exp. backoff bis 60min |

**Backoff Regeln (verbindlich)**:
- Bei HTTP 5xx/Network:
  - next = min(max, base * 2^n) + jitter
- Bei HTTP 401/403:
  - **nur wenn Auth aktiviert ist** (`VITE_ENABLE_AUTH="true"` *und* ein Token verwendet wurde):
    - stoppe Polling, setze SW-Status `authRequired=true` und sende Message an UI.
  - **wenn Auth deaktiviert ist** (default):
    - behandle 401/403 als normalen Fehlerzustand (kein UI-Block/keine Redirect-Loops).
- Bei HTTP 429:
  - respektiere `Retry-After` (falls gesetzt), sonst `backoffStep++`.

---

## 3) Alerts: Confirmation Loop + Notifications

### 3.1 Input Contracts

Der SW konsumiert Events über:
- `GET /api/alerts/events?since=<ISO>`

Event Schema (verbindlich): `AlertEmitted` aus `docs/backend/CONTRACTS.md`.

### 3.2 Processing Pipeline (verbindlich)

1. **Fetch**
   - since-Wasserstand aus `kv["alerts:lastSince"]` (default: now-15min).
2. **Sort**
   - sortiere `items` nach `occurredAt` asc, dann `eventId`.
3. **Dedupe**
   - `dedupeKey = "alert:" + eventId` (primär)  
     Optional zusätzlich: `alert:<alertId>:<type>:<occurredAtMinuteBucket>`
4. **Notify**
   - für nicht-dedupte Events → `self.registration.showNotification(...)`
5. **Persist**
   - schreibe `dedupe` row
   - update since-Wasserstand auf max(occurredAt)

### 3.3 Notification Payload Contract

```ts
export type SwNotificationType = "ALERT" | "ORACLE";

export interface SwNotificationData {
  type: SwNotificationType;
  url: string;        // deep-link to open
  eventId: string;    // for tracing/dedupe
  alertId?: string;
  oracleId?: string;
}
```

**Alerts Deep-Link Regeln (UI-safe)**:
- SIMPLE/TRIGGERED → `url = "/alerts"`
- TWO_STAGE_CONFIRMED → `url = "/alerts"`
- DEAD_TOKEN_STAGE / SESSION_ENDED → `url = "/alerts"`
- Optional (future): `url="/chart?query=<symbolOrAddress>"` wenn UI das wünscht (`// BACKEND_TODO`).

### 3.4 Notification Title/Body Regeln (v1)

**Title**:
- `SIMPLE_TRIGGERED`: `Price Alert: <SYMBOL>`
- `TWO_STAGE_CONFIRMED`: `Confirmed Signal: <SYMBOL>`
- `DEAD_TOKEN_STAGE`: `Dead Token: <SYMBOL> — <STAGE>`

**Body**:
- Muss mindestens enthalten:
  - timeframe
  - short summary (z.B. `condition + targetPrice` oder `triggeredCount/2` etc.)

### 3.5 Click Handling
- `notificationclick`:
  - close notification
  - `clients.openWindow(data.url)` (oder focus existing)

---

## 4) Oracle: Daily Takeaway + “New insights” Dedupe

### 4.1 Input
- `GET /api/oracle/daily`

### 4.2 Decision Logic (v1)

- Wenn `feed.pinned.isRead === false`:
  - sende **1** Notification pro Tag: dedupeKey `oracle:takeaway:<YYYY-MM-DD>`
- Optional: Wenn neue insights vorhanden (`insights[].isRead === false`):
  - sende Notification “X new Oracle insights” 1x pro 6h: dedupeKey `oracle:new:<bucket>`

Deep-Link:
- `url = "/oracle"`

---

## 5) Offline Behavior (verbindlich)

- Bei Network offline:
  - keine Notifications erzeugen
  - Polling backoff aktivieren
- UI muss weiterhin ohne Backend laufen:
  - SW darf keine UI Flows blockieren (keine hard failures)

---

## 6) Sicherheits-/Privacy Regeln

- Keine sensiblen Tokens in IDB persistieren.
- SW nutzt Fetch mit `credentials: "omit"` (standard) und `Authorization` nur, wenn UI den Token per `postMessage` liefert.

```ts
export interface SwAuthUpdateMessage {
  type: "SW_AUTH_UPDATE";
  accessToken: string | null;
}
```

> // BACKEND_TODO: echtes Auth-Handshake (Refresh, rotation) sobald Backend Auth aktiviert.


# Contract Drift Report (Ist-Zustand, Docs-only)

Ziel: Pro Endpoint dokumentieren, was **Contract** (Baseline: `shared/contracts/*`), was **Frontend** erwartet und was das **kanonische Backend** (`backend/`) tatsächlich liefert.

## Must-cover Risiken (global)

### Envelope Drift (systemweit)

- **Contract-Baseline (in `shared/contracts/*`)** enthält explizite Envelope-Formen wie:
  - `shared/contracts/sol-chart-ta-journal.ts`: `ResponseEnvelope<T> = { status: "ok", data: T }`
  - `shared/contracts/reasoning-router.ts`: `ApiOk<T> = { status: "ok", data: T }` und `ApiError = { error: ... }`
- **Frontend `ApiClient` (Default Mode)** erwartet dagegen:
  - Success: `{ status: "ok", data: T }`
  - Error: `{ error: { code, message, details? } }`
  - Quelle: `src/services/api/client.ts`
- **Kanonisches Backend `backend/`** liefert:
  - Success: `{ status: "ok", data: T }`
  - Error: `{ error: { code, message, details? } }`
  - Quelle: `backend/src/http/response.ts`, `backend/src/http/error.ts`

**Status:** ✅ Resolved (Frontend-Client und kanonisches Backend verwenden dasselbe Envelope).

### Multiple Backend Implementierungen

Es existieren parallel:

- **`backend/`** (kanonisch für Production `/api/*` via Vercel Rewrite Policy)
- **`api/`** (Vercel Functions Backend, nicht-kanonisch im Frontend-Projekt, solange `/api/*` extern rewritet wird)
- **`apps/backend-alerts/`** (separater Service, eigener Auth-Mechanismus und eigene Paths ohne `/api` Prefix)

Diese Implementierungen unterscheiden sich u.a. in Envelope, Auth-Policy, Rate Limiting, Persistenz und verfügbarem Route-Set.

### Auth Differences (JWT vs implicit vs none)

- **Frontend**: Auth ist standardmäßig deaktiviert (`VITE_ENABLE_AUTH !== "true"`), `ApiClient` setzt dann keinen `Authorization` Header.
- **`backend/`**: JWT ist optional; ohne Token läuft vieles als `userId="anon"`, aber einige Endpoints blockieren explizit `anon` (z.B. Settings, Journal Insights).
- **`api/`**: JWT ist standardmäßig required (pro Handler), außer `auth:"none"`.

### Env-dependent Behavior (missing vars → partial runtime)

Einige Features verhalten sich abhängig von Env/Providern:

- **Grok Pulse Snapshot Storage**: `backend/` nutzt Vercel KV **nur wenn** `KV_REST_API_URL` + `KV_REST_API_TOKEN` gesetzt sind; sonst Memory Fallback → Snapshots sind nicht persistent (Quelle: `backend/src/domain/grokPulse/kv.ts`).
- **LLM Provider Keys**: Reasoning/LLM kann je nach Keys/Model-Env in Errors laufen oder degradiert/disabled sein (Quelle: `backend/src/config/env.ts`, Reasoning Engine/LLM Router).

---

## GET /api/feed/pulse?asset=<ticker|address>

### Contract (shared/contracts)
- **Success shape**:
  - `shared/contracts/grokPulse.ts` definiert `GrokSentimentSnapshot`, `PulseHistoryPoint`, aber **kein** HTTP Response Envelope und **keinen** Feed Wrapper.
  - **TODO:** Es existiert kein `shared/contracts/*` Typ für das vollständige `/feed/pulse` Response-Payload (assetResolved/history/updatedAt).
- **Error shape**:
  - `shared/contracts/grokPulse.ts` definiert `GrokPulseApiError` (code/message/details), aber **kein** HTTP Error Envelope.
- **Notes**:
  - Contract ist primär “Snapshot/History types”, nicht “Endpoint contract”.

### Frontend expectation
- **Expected response shape**:
  - `PulseFeedResponse`:
    - `assetResolved: { input, kind, address, symbol? }`
    - `snapshot: GrokSentimentSnapshot | null` (aus `shared/contracts/grokPulse.ts`)
    - `history: PulseHistoryPoint[]`
    - `updatedAt: string`
  - Quelle: `src/services/api/grokPulse.ts`
- **Envelope assumption**:
  - Erwartet das **`ApiClient` Envelope** `{ data: PulseFeedResponse, status: number, message? }` (weil `apiClient.get<T>` benutzt wird).
  - Quelle: `src/services/api/client.ts`
- **Notes**:
  - Frontend koppelt Snapshot-Shape an `shared/contracts/grokPulse.ts`.

### Backend implementation
- **Actual response shape**:
  - `backend/src/routes/feed.ts` ruft `getPulseFeedSnapshot(...)` und sendet es via `sendJson`.
  - `sendJson` im `backend/` ergibt Envelope: `{ status: "ok", data: <payload> }`.
  - Payload ist `PulseFeed` (backend-domain), dessen `snapshot` typisiert ist als `unknown | null`.
  - Quellen: `backend/src/routes/feed.ts`, `backend/src/http/response.ts`, `backend/src/domain/feed/types.ts`
- **Status codes used**:
  - Success: 200
  - Validation error: 400 (via `validationError(...)` in `feed.ts`)
  - Not found: 404 (via `notFound(...)` in `feed.ts`)
- **Notes**:
  - Snapshot kommt aus KV/Memory als `backend`-Typ `GrokSentimentSnapshot` (`backend/src/domain/grokPulse/types.ts`) und **nicht** aus `shared/contracts/grokPulse.ts`.
  - `history` ist im Backend aktuell Stub (leeres Array) (Quelle: `backend/src/domain/grokPulse/grokPulseAdapter.ts`).

### Drift summary
- **✅ (Envelope resolved) / ⚠️ (Payload shape weiterhin prüfen)**
- **Mismatch**:
  - **Envelope**: **resolved** (Frontend erwartet `{status:"ok",data}`).
  - **Snapshot shape**: Frontend erwartet `shared/contracts/grokPulse.ts` Snapshot (z.B. `source: "grok" | "keyword_fallback"`), Backend speichert/serviert `backend` Snapshot (z.B. `source: "grok" | "fallback"`, `low_confidence` vs `low_confidence?`, zusätzliche Felder).

### Risk
- **High**
- **Warum**:
  - Runtime Bug: Frontend `apiClient.get` wirft `ApiContractError`.
  - Zusätzlich ist die Snapshot-Feldmenge/-Enums nicht kontraktgleich → selbst bei Raw-Mode könnten UI-Parser/Renderings inkonsistent sein.

### Recommended resolution (non-binding)
- Align backend to contract
- Align frontend to contract
- Update contract to reality

---

## POST /api/chart/analyze

### Contract (shared/contracts)
- **Success shape**:
  - `AnalysisResult` (Payload) und `ResponseEnvelope<T> = { status:"ok", data:T }`
  - Quelle: `shared/contracts/sol-chart-ta-journal.ts`
- **Error shape**:
  - **TODO:** `shared/contracts/sol-chart-ta-journal.ts` definiert kein HTTP Error Envelope.
- **Notes**:
  - Der Contract definiert **keinen** HTTP Path. Mapping zu `/api/chart/analyze` ist aus Backend-Routing ableitbar (Quelle: `backend/src/app.ts` + `backend/src/routes/chartAnalysis.ts`).

### Frontend expectation
- **Expected response shape**:
  - **TODO:** Im Frontend ist kein direkter Aufruf von `/chart/analyze` über `apiClient` auffindbar (im Audit für diesen Report).
- **Envelope assumption**:
  - Wenn Frontend den Standard-`ApiClient` nutzen würde: `{ data: AnalysisResult, status:number }` (Quelle: `src/services/api/client.ts`).
- **Notes**:
  - Keine Frontend-Wrapper/Hook im Scope gefunden → Usage ist derzeit unklar.

### Backend implementation
- **Actual response shape**:
  - Handler: `backend/src/routes/chartAnalysis.ts` → `sendJson(res, out, 200)`
  - Envelope: `{ status:"ok", data: <AnalysisResult-like> }`
  - Quelle: `backend/src/routes/chartAnalysis.ts`, `backend/src/http/response.ts`
- **Status codes used**:
  - Success: 200
  - Validation: 400 (via schema validation; Fehlerformat im Backend: `{error:{...}}`)
- **Notes**:
  - Payload-Felder müssen gegen `AnalysisResult` Contract geprüft werden. Der Handler liefert `out` aus `analyzeChartWithOnchainGating(...)`.
  - **TODO:** Vollständige Feld-1:1 Prüfung (AnalysisResult vs tatsächliches `out`) wurde für diesen Report nicht vollständig expandiert (keine vollständige Payload-Definition im Handler sichtbar).

### Drift summary
- **⚠️**
- **Mismatch**:
  - Backend Envelope entspricht **Contract** (`{status:"ok",data}`), aber würde **nicht** dem Frontend-`ApiClient` Envelope entsprechen.
  - Payload-1:1 Übereinstimmung zu `AnalysisResult` ist **TODO** (muss im Domain-Modul bestätigt werden).

### Risk
- **Medium**
- **Warum**:
  - Wenn ein UI-Call über `apiClient.get/post` existiert/kommt, ist Envelope-Drift ein harter Runtime-Fail.
  - Payload drift ist möglich, aber nicht nachgewiesen.

### Recommended resolution (non-binding)
- Align backend to contract
- Align frontend to contract
- Update contract to reality

---

## GET /api/settings

### Contract (shared/contracts)
- **Success shape**:
  - `UserSettingsV1` (enthält `ai.grokEnabled: boolean`)
  - Quelle: `shared/contracts/journal.settings.ts`
- **Error shape**:
  - Contract listet Errors als Kommentare:
    - `401 UNAUTHENTICATED`
    - `400 VALIDATION_ERROR`
  - Quelle: `shared/contracts/journal.settings.ts`
- **Notes**:
  - Contract definiert **keinen** Response Envelope.

### Frontend expectation
- **Expected response shape**:
  - **TODO:** Keine Frontend-API Calls zu `/api/settings` im audit-relevanten `src/services/**` gefunden.
- **Envelope assumption**:
  - Würde bei Nutzung von `apiClient.get` `{ data: UserSettingsV1, status:number }` erwarten.
- **Notes**:
  - Settings UI existiert, aber die Persistenz/Quelle scheint aktuell nicht über `/api/settings` verdrahtet (Usage unklar).

### Backend implementation
- **Actual response shape**:
  - `backend/src/routes/settings.ts`:
    - blockiert `userId === "anon"` → 401
    - `sendJson(res, settings)` → `{ status:"ok", data: settings }`
- **Status codes used**:
  - Success: 200
  - Unauthenticated: 401 (`ErrorCodes.UNAUTHENTICATED`)
- **Notes**:
  - Settings sind user-scoped; ohne Auth-Header wird dieser Endpoint im `backend/` immer 401 liefern.

### Drift summary
- **⚠️**
- **Mismatch**:
  - Contract beschreibt 401/400, Backend liefert 401 bei `anon` (aligned), aber Envelope nicht im Contract festgelegt.
  - Frontend hat (im Audit) keinen belegten Call; bei zukünftiger Nutzung wäre Envelope-Drift relevant.

### Risk
- **Medium**
- **Warum**:
  - Wenn UI später `/api/settings` nutzt, kollidiert es direkt mit “Auth disabled” im Frontend und dem 401‑Gate im Backend.

### Recommended resolution (non-binding)
- Align backend to contract
- Align frontend to contract
- Update contract to reality

---

## PATCH /api/settings

### Contract (shared/contracts)
- **Success shape**:
  - Patch Request: `UserSettingsPatchV1` (optional `ai.grokEnabled`)
  - Response: `UserSettingsV1` (impliziert)
  - Quelle: `shared/contracts/journal.settings.ts`
- **Error shape**:
  - Kommentierte Errors:
    - `401 UNAUTHENTICATED`
    - `403 FORBIDDEN_TIER` (tier < pro)
    - `400 VALIDATION_ERROR`
  - Quelle: `shared/contracts/journal.settings.ts`
- **Notes**:
  - Contract ist “shape-first”; Envelope ist nicht definiert.

### Frontend expectation
- **Expected response shape**:
  - **TODO:** Kein Frontend-Wrapper/Call gefunden.
- **Envelope assumption**:
  - Bei `apiClient.patch`: `{ data: UserSettingsV1, status:number }`

### Backend implementation
- **Actual response shape**:
  - `backend/src/routes/settings.ts`:
    - 401 wenn `anon`
    - `resolveTierFromAuthUser(req.user)` + `patchSettings(...)` (tier gating server-side)
    - `sendJson(res, settings)` → `{ status:"ok", data: settings }`
- **Status codes used**:
  - Success: 200
  - Unauthenticated: 401
  - Forbidden tier: 403 (aus domain/service; konkrete code: `ErrorCodes.FORBIDDEN_TIER` in anderen Modulen)
- **Notes**:
  - Tier-Gating existiert serverseitig; hängt aber davon ab, dass `req.user` (JWT) gesetzt ist.

### Drift summary
- **⚠️**
- **Mismatch**:
  - Contract beschreibt Tier-Gating und 401/403, Backend implementiert 401/ tier resolve → grundsätzlich aligned.
  - Envelope drift bleibt (Frontend default envelope vs Backend `{status:"ok"}`).

### Risk
- **Medium**
- **Warum**:
  - Spätere UI-Verdrahtung würde ohne Auth-Enablement sofort scheitern (401), und zusätzlich am Envelope.

### Recommended resolution (non-binding)
- Align backend to contract
- Align frontend to contract
- Update contract to reality

---

## POST /api/journal/:id/insights

### Contract (shared/contracts)
- **Success shape**:
  - Request: `JournalInsightsRequestV1` mit `kind` und optional `includeGrok`
  - Response: **nicht** als Type definiert (nur semantisch beschrieben).
  - Quelle: `shared/contracts/journal.settings.ts`
- **Error shape**:
  - Kommentierte Errors:
    - `404 JOURNAL_NOT_FOUND`
    - `403 FORBIDDEN_TIER` (tier < pro)
    - `403 GROK_DISABLED` (includeGrok requested, aber Setting false)
  - Quelle: `shared/contracts/journal.settings.ts`
- **Notes**:
  - Contract ist unvollständig für die Response‑Payload (kein Response Type).

### Frontend expectation
- **Expected response shape**:
  - **TODO:** Kein Frontend-Call zu `/api/journal/:id/insights` gefunden; UI generiert “Insights” lokal (Hinweis: `src/components/journal/JournalInsightCard.tsx` nutzt lokale Engines).
- **Envelope assumption**:
  - Bei Nutzung von `apiClient.post`: `{ data: <unknown>, status:number }`

### Backend implementation
- **Actual response shape**:
  - `backend/src/routes/journalInsights.ts`:
    - 401 wenn `anon`
    - 404 wenn Journal entry nicht existiert
    - `includeGrok` gated: 403 FORBIDDEN_TIER oder 403 GROK_DISABLED
    - Response payload:
      - `{ kind, facts: { entry }, narrative?: { source:"grok_pulse_snapshot", pulse: <PulseFeedSnapshotResponse|null> } }`
    - Envelope: `{ status:"ok", data: <payload> }`
- **Status codes used**:
  - Success: 200
  - Unauthenticated: 401
  - Not found: 404
  - Forbidden tier / Grok disabled: 403
- **Notes**:
  - Response enthält “facts.entry: unknown” und optional narrative/pulse → nicht typisiert in `shared/contracts`.

### Drift summary
- **⚠️**
- **Mismatch**:
  - Contract hat keinen Response Type → Drift kann nur teilweise bewertet werden.
  - Envelope drift bleibt (Frontend default envelope vs Backend `{status:"ok"}`).

### Risk
- **Low / Medium**
- **Warum**:
  - Aktuell scheint dieser Endpoint im Frontend nicht verdrahtet (TODO). Bei späterer Nutzung besteht sofortiger Envelope/Auth-Risiko.

### Recommended resolution (non-binding)
- Align backend to contract
- Align frontend to contract
- Update contract to reality

---

## POST /api/reasoning/route

### Contract (shared/contracts)
- **Success shape**:
  - Request: `ReasoningRouteRequest`
  - Response: `ReasoningRouteResponse`
  - Optional Envelopes in Contract:
    - `ApiOk<T> = { status:"ok", data:T }`
    - `ApiError = { error:{code,message,details?} }`
  - Quelle: `shared/contracts/reasoning-router.ts`
- **Error shape**:
  - Siehe `ApiError` oben.
- **Notes**:
  - Contract listet keine HTTP status codes, aber definiert ein error object.

### Frontend expectation
- **Expected response shape**:
  - **TODO:** Kein Frontend-Aufruf zu `/reasoning/route` gefunden.
- **Envelope assumption**:
  - Bei `apiClient.post`: `{ data: ReasoningRouteResponse, status:number }`

### Backend implementation
- **Actual response shape**:
  - `backend/src/routes/reasoningRoute.ts`:
    - validiert body via Zod
    - `routeAndCompress(...)` liefert `out`
    - `sendJson(res, out, 200)` → `{ status:"ok", data: out }`
- **Status codes used**:
  - Success: 200
  - Validation: 400 (Backend Error Envelope `{error:{...}}`)
- **Notes**:
  - `out` ist direkt das Ergebnis von `routeAndCompress`, was semantisch zu `ReasoningRouteResponse` passt.
  - **TODO:** 1:1 Feldprüfung `ReasoningRouteResponse` vs `out` (im Report nicht vollständig expandiert).

### Drift summary
- **⚠️**
- **Mismatch**:
  - Backend scheint mit Contract-Envelope (status ok/error) zu alignen.
  - Frontend hätte bei Standard-`ApiClient` Envelope-Drift, falls es diesen Endpoint nutzt.

### Risk
- **Low / Medium**
- **Warum**:
  - Der Endpoint ist im Frontend aktuell nicht nachweislich genutzt.
  - Bei späterer Nutzung ist Envelope-Drift ein harter Fail.

### Recommended resolution (non-binding)
- Align backend to contract
- Align frontend to contract
- Update contract to reality

---

## POST /api/llm/execute

### Contract (shared/contracts)
- **Success shape**:
  - Request: `LlmExecuteRequest`
  - Response: `LlmExecuteResponse`
  - Contract Envelopes: `ApiOk<T>` / `ApiError` (status ok/error)
  - Quelle: `shared/contracts/reasoning-router.ts`
- **Error shape**:
  - `ApiError` (status error + error object)
- **Notes**:
  - Contract enthält klare Feldnamen für Response: `requestId`, `providerUsed`, `text`, optional `meta`.

### Frontend expectation
- **Expected response shape**:
  - **TODO:** Kein Frontend-Aufruf zu `/llm/execute` gefunden.
- **Envelope assumption**:
  - Bei `apiClient.post`: `{ data: LlmExecuteResponse, status:number }`

### Backend implementation
- **Actual response shape**:
  - `backend/src/routes/llm.ts`:
    - validiert request
    - ruft Provider (DeepSeek/OpenAI/Grok) über Router/Fallback
    - `sendJson(res, { requestId, providerUsed, text, meta }, 200)`
    - Envelope: `{ status:"ok", data: { requestId, providerUsed, text, meta } }`
- **Status codes used**:
  - Success: 200
  - Validation: 400
  - Upstream/provider errors: werden in Backend Error Envelope gemappt (Status abhängig von Error Mapping; **TODO**: konkrete Statuscodes in `backend/src/http/error.ts` pro Code)
- **Notes**:
  - Payload-Felder matchen die Contract-Namen in `LlmExecuteResponse`.
  - Envelope folgt `backend/` Standard (`status:"ok"`), nicht Frontend-ApiClient Standard.

### Drift summary
- **⚠️**
- **Mismatch**:
  - Backend ist im Envelope näher am Contract (`status:"ok"`), Frontend default wäre `{data,status:number}`.
  - Frontend nutzt Endpoint aktuell nicht (TODO).

### Risk
- **Low / Medium**
- **Warum**:
  - Unbenutzter Endpoint im Frontend → kurzfristig gering.
  - Bei späterer UI‑Verdrahtung besteht Envelope‑Risiko.

### Recommended resolution (non-binding)
- Align backend to contract
- Align frontend to contract
- Update contract to reality

---

## Appendix: Traceability Map (woher kommt was?)

| Bereich | Datei | Aussage |
|---|---|---|
| Contract Baseline | `shared/contracts/*` | Typen/Constraints; teils inkl. Envelope |
| Frontend Envelope | `src/services/api/client.ts` | erwartet `{data,status:number}`; wirft `ApiContractError` bei Abweichung |
| Backend Envelope | `backend/src/http/response.ts` | liefert `{status:"ok",data}` |
| Backend Routing | `backend/src/app.ts` | registriert alle `/api/*` Endpoints |
| Vercel Production Ownership | `vercel.json`, `scripts/verify-vercel-api-ownership.mjs` | `/api/*` → externes Node Backend (kanonisch) |


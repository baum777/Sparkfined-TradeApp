# Journal: Grok Toggle (Pro/High) + Auto-Archive Pending Buys on Sell

## Ziel

Dieses Dokument beschreibt die **exakte Backend-Logik** für:

1) **User Setting** `ai.grokEnabled` (nur **Pro/High**): Server-seitiger Toggle, der Grok-/X-Narrative-Usage gated.  
2) **Auto-Archive**: Wenn eine **SELL Capture** (Onchain) ingestet wird, wird automatisch die **best-passende** vorherige **PENDING BUY** Capture für dasselbe Asset archiviert (Reason: `matched_sell`).

Backend ist Source of Truth; keine Frontend-Provider-Calls.

---

## A) API/Contract: Settings

### GET `/api/settings`

- **Auth**: erforderlich (Bearer JWT).  
- **Response (Envelope)**:
  - `data`: `{ ai: { grokEnabled: boolean } }`
- **Defaults**:
  - Wenn kein Row existiert: `ai.grokEnabled = false`

### PATCH `/api/settings`

- **Body**: `{ ai?: { grokEnabled?: boolean } }`
- **Tier-Gating**:
  - `grokEnabled=true` ist **nur erlaubt**, wenn Tier ∈ `{pro, high}`.
  - Tier unbekannt ⇒ sicherer Default: **disallow enable**.
- **Errors**:
  - `401 UNAUTHENTICATED`: kein Token/kein User
  - `403 FORBIDDEN_TIER`: Enable versucht, aber Tier < pro / unbekannt
  - `400 VALIDATION_ERROR`: ungültige Body-Shape

Persistenz: `user_settings_v1(ai_grok_enabled)`.

---

## B) Insights: Grok-Gating

### POST `/api/journal/:id/insights`

- **Body**: `{ kind: "teaser"|"review"|"playbook", includeGrok?: boolean }`
- **Grok-Narrative wird nur inkludiert, wenn**:
  - `includeGrok === true` **und**
  - Tier ∈ `{pro, high}` **und**
  - `settings.ai.grokEnabled === true`
- **Errors**:
  - `404 JOURNAL_NOT_FOUND`: Entry nicht vorhanden (user-scoped)
  - `403 FORBIDDEN_TIER`: Tier < pro
  - `403 GROK_DISABLED`: `includeGrok=true`, aber Toggle aus

**Wichtig (No hallucinated insights):**
- Narrative ist **snapshot-only** und wird in der Response **separat von Facts** geliefert.
- Wenn `includeGrok` nicht gesetzt/false ist, wird **kein** Grok-/Narrative-Pfad angesprochen.

---

## C) Capture-Ingest (Idempotent) + Auto-Archive

### Capture-Felder (optional, backward compatible)

Journal Entries können optional `capture`-Metadaten tragen (Facts-only), u.a.:

- `capture.captureKey` (required wenn capture vorhanden)
- `capture.txSignature?`, `capture.wallet?`
- `capture.actionType?` (`buy`|`sell`|`swap`)
- `capture.assetMint?`, `capture.amount?`, `capture.priceHint?`
- `capture.linkedEntryId?` (z.B. BUY→SELL Link)
- `autoArchiveReason?` (`matched_sell` | `user_action` | `policy`)

Persistenz erfolgt über additive Columns auf `journal_entries_v2` + Archive-Reason in `journal_archives_v2.reason`.

### Idempotenz-Regel

- Capture ingest ist **idempotent** per `(user_id, capture_key)`:
  - gleiche `captureKey` ⇒ **kein** neuer Journal-Eintrag (stabiler Return der existierenden Entry).

### Auto-Archive Regel (SELL)

Wenn eine SELL Capture ingestet wird:

1) SELL-Entry wird (idempotent) erstellt (Status `pending`).  
2) System sucht Kandidaten:
   - `status === 'pending'`
   - `asset_mint === sell.assetMint`
   - `action_type ∈ {'buy','swap'}`
   - `timestamp < sell.timestamp`
3) **Best Match** ist deterministisch:
   - nächster Zeitpunkt **vor** Sell: max(`timestamp`)
   - Tie-break: `created_at` desc, dann `id` desc (lexicographic)
4) Genau **ein** Kandidat wird per **system-only transition** archiviert:
   - Entry `status = 'archived'`
   - `journal_archives_v2.reason = 'matched_sell'`
   - `linked_entry_id = <sellEntryId>`

### Edge Cases

- **Kein prior BUY**: keine Archivierung.
- **Duplicate SELL ingest**: keine Doppel-Archivierung (Kandidaten-Query matcht nur `pending`).
- **Bereits archivierter BUY**: wird nicht erneut verarbeitet.
- **Confirmed BUY**: wird **nicht** system-archiviert (nur `pending`).

---

## D) Datei-/Code-Referenzen

- **Settings**: `backend/src/routes/settings.ts`, `backend/src/domain/settings/*`
- **Journal Capture + Auto-Archive**: `backend/src/domain/journal/repo.ts`, `backend/src/domain/journal/autoArchive.ts`
- **Insights Gating**: `backend/src/routes/journalInsights.ts`
- **Migrations**: `backend/migrations/0004_user_settings.sql`, `backend/migrations/0005_journal_capture_fields.sql`


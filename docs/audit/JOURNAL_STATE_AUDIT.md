## 1) TL;DR

- **Pending/Confirmed/Archived existieren end-to-end** (DB/Schema/Backend-Routes/Frontend-Filter + Mutations). API-Responses liefern **lowercase** (`"pending"|"confirmed"|"archived"`), intern gibt es teils **uppercase** (`PENDING|CONFIRMED|ARCHIVED`) mit Mapper/Normalizer.
- **„Diary mode“ als expliziter List/Diary-Toggle ist im Code vorhanden, aber aktuell nicht an die Journal-Page verdrahtet** (Toggle-Komponente existiert; keine Nutzung in `src/pages/Journal.tsx`; kein localStorage für „diary/list“ sichtbar).
- **Diary-artige Darstellung (Grouping by day + Day header + Moment cards) ist implementiert** (u.a. in `JournalDiaryView` und auch in `JournalTimelineView`), aber der „Diary“-Pfad ist anhand der aktuellen Page nicht als eigener Modus nachweisbar.

---

## 2) Status Flow Audit

### Data model (types/schema): ✅

- **Frontend (canonical)**: `src/types/journal.ts`

```ts
// src/types/journal.ts (L1-L21)
export type JournalStatusV1 = "pending" | "confirmed" | "archived";

export interface JournalEntryV1 {
  id: string;
  status: JournalStatusV1;
  summary: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string; // only if confirmed
  archivedAt?: string; // only if archived
}
```

- **Backend (Node, API boundary)**: `backend/src/domain/journal/types.ts`

```ts
// backend/src/domain/journal/types.ts (L14-L33)
export type JournalStatusV1 = 'pending' | 'confirmed' | 'archived';

export interface JournalEntryV1 {
  id: string;
  status: JournalStatusV1;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  confirmedAt?: string; // ISO 8601
  archivedAt?: string; // ISO 8601
  summary?: string;
  timestamp?: string;
  symbolOrAddress?: string;
}
```

- **Backend validation (lowercase enum)**: `backend/src/validation/schemas.ts`

```ts
// backend/src/validation/schemas.ts (L12-L24)
export const journalEntryStatusSchema = z.enum(['pending', 'confirmed', 'archived']);

export const journalListQuerySchema = z.object({
  view: journalEntryStatusSchema.optional(),
  status: journalEntryStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});
```

- **DB constraints (lowercase)**: `backend/migrations/0001_init.sql` + `backend/migrations/0003_journal_multitenancy.sql`

```sql
-- backend/migrations/0001_init.sql (L12-L21)
CREATE TABLE IF NOT EXISTS journal_entries_v1 (
  id TEXT PRIMARY KEY,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'archived')),
  timestamp TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

```sql
-- backend/migrations/0003_journal_multitenancy.sql (L9-L21)
CREATE TABLE IF NOT EXISTS journal_entries_v2 (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'archived')),
  timestamp TEXT NOT NULL,
  summary TEXT NOT NULL,
  day_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
```

- **Vercel API domain (uppercase intern, lowercase API)**: `api/_lib/domain/journal/types.ts` + `api/_lib/domain/journal/mapper.ts`

```ts
// api/_lib/domain/journal/types.ts (L19-L31)
export type JournalStatus = 'PENDING' | 'CONFIRMED' | 'ARCHIVED';

export function normalizeStatus(status: string): JournalStatus {
  const upper = status.toUpperCase();
  if (upper === 'PENDING' || upper === 'CONFIRMED' || upper === 'ARCHIVED') {
    return upper;
  }
  throw new Error(`Invalid journal status: ${status}`);
}
```

```ts
// api/_lib/domain/journal/mapper.ts (L3-L33)
export type JournalEntryStatus = 'pending' | 'confirmed' | 'archived';

export function toApiJournalStatus(status: JournalStatus): JournalEntryStatus {
  switch (status) {
    case 'PENDING': return 'pending';
    case 'CONFIRMED': return 'confirmed';
    case 'ARCHIVED': return 'archived';
    default: return (status as string).toLowerCase() as JournalEntryStatus;
  }
}

export function toApiJournalEntryV1(event: JournalEvent): JournalEntryV1 {
  const entry: JournalEntryV1 = {
    id: event.id,
    status: toApiJournalStatus(event.status),
    timestamp: event.timestamp,
    summary: event.summary,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
  // ...
  return entry;
}
```

### Backend API: ✅

- **Node backend routes**: `backend/src/app.ts`

```ts
// backend/src/app.ts (L49-L56)
// Journal Routes
router.get('/journal', handleJournalList);
router.get('/journal/:id', handleJournalGetById);
router.post('/journal', handleJournalCreate);
router.post('/journal/:id/confirm', handleJournalConfirm);
router.post('/journal/:id/archive', handleJournalArchive);
router.post('/journal/:id/restore', handleJournalRestore);
router.delete('/journal/:id', handleJournalDelete);
```

- **Node backend handlers (Transitions + guards)**: `backend/src/routes/journal.ts`

```ts
// backend/src/routes/journal.ts (L77-L99)
export function handleJournalConfirm(req: ParsedRequest, res: ServerResponse): void {
  const { id } = req.params;
  const existing = journalGetById(req.userId, id);
  if (!existing) throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  if (existing.status === 'archived') {
    throw conflict('Cannot confirm an archived entry', ErrorCodes.INVALID_TRANSITION);
  }
  const entry = journalConfirm(req.userId, id);
  sendJson(res, entry);
}
```

```ts
// backend/src/routes/journal.ts (L101-L135)
export function handleJournalRestore(req: ParsedRequest, res: ServerResponse): void {
  const { id } = req.params;
  const existing = journalGetById(req.userId, id);
  if (!existing) throw notFound(`Journal entry not found: ${id}`, ErrorCodes.JOURNAL_NOT_FOUND);
  if (existing.status === 'confirmed') {
    throw conflict('Cannot restore a confirmed entry', ErrorCodes.INVALID_TRANSITION);
  }
  const entry = journalRestore(req.userId, id);
  sendJson(res, entry);
}
```

- **Vercel API (GET/POST list/create)**: `api/journal/index.ts`

```ts
// api/journal/index.ts (L19-L39)
GET: async ({ req, res, userId }) => {
  const query = validateQuery(journalListQuerySchema, getQueryParams(req));
  // Support both 'view' and 'status' query params
  const status = query.view || query.status;
  const result = await journalList(userId, status, query.limit, query.cursor);
  const response: JournalListResponse = {
    items: result.items.map(toApiJournalEntryV1),
    nextCursor: result.nextCursor,
  };
  sendJson(res, response);
},
```

- **Vercel API transitions (uppercase intern, lowercase response via mapper)**:
  - `api/journal/[id]/confirm.ts`
  - `api/journal/[id]/archive.ts`
  - `api/journal/[id]/restore.ts`

```ts
// api/journal/[id]/archive.ts (L24-L39)
// Canonical transitions: confirmed -> archived only (idempotent if already archived)
if (existing.status === 'PENDING') {
  throw conflict(
    'Cannot archive a pending entry (confirm it first)',
    ErrorCodes.JOURNAL_INVALID_STATE
  );
}
const entry = await journalArchive(userId, id);
sendJson(res, toApiJournalEntryV1(entry));
```

### Frontend UI: ✅

- **Journal Page Root + Status-Counts + Filter**: `src/pages/Journal.tsx`

```tsx
// src/pages/Journal.tsx (L313-L320)
return (
  <PageContainer testId="page-journal">
    <ScreenState status="loading" loadingVariant={<JournalSkeleton />} />
  </PageContainer>
);
```

```tsx
// src/pages/Journal.tsx (L74-L116)
// Legacy view state (for v2 compatibility)
const [activeView, setActiveView] = useState<JournalView>("pending");

const counts = useMemo(() => ({
  pending: entries.filter((e) => e.status === "pending").length,
  confirmed: entries.filter((e) => e.status === "confirmed").length,
  archived: entries.filter((e) => e.status === "archived").length,
}), [entries]);

// Filter entries for timeline (confirmed + pending)
const timelineEntries = useMemo(() => {
  let result = entries.filter((e) => e.status === "pending" || e.status === "confirmed");
  // ...
  return result;
}, [entries, searchQuery]);
```

- **Pending/Confirmed/Archived Tabs (Segmented Control)**: `src/components/journal/JournalSegmentedControl.tsx`

```tsx
// src/components/journal/JournalSegmentedControl.tsx (L1-L48)
export type JournalView = "pending" | "confirmed" | "archived";
// ...
<ToggleGroupItem value="pending" aria-label="Show pending entries">
  Pending ({counts.pending})
</ToggleGroupItem>
<ToggleGroupItem value="confirmed" aria-label="Show confirmed entries">
  Confirmed ({counts.confirmed})
</ToggleGroupItem>
<ToggleGroupItem value="archived" aria-label="Show archived entries">
  Archived ({counts.archived})
</ToggleGroupItem>
```

- **Archived-Filter in Timeline Mode**: `src/pages/Journal.tsx`

```tsx
// src/pages/Journal.tsx (L418-L439)
{mode === "timeline" && (
  <JournalTimelineView
    entries={activeView === "archived"
      ? entries.filter((e) => e.status === "archived" && (
          !searchQuery.trim() ||
          e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.id.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      : timelineEntries
    }
    onArchive={(id) => handleArchive(id)}
  />
)}
```

### Actions (confirm/archive/undo): ✅

- **Frontend actions (confirm/archive/restore + Undo)**: `src/pages/Journal.tsx`

```ts
// src/pages/Journal.tsx (L195-L223)
const handleConfirm = (id: string) => {
  confirmEntry(id);
  toast.success("Confirmed");
};

const handleArchive = (id: string) => {
  const current = entries.find((e) => e.id === id);
  if (current?.status === "pending") {
    toast.error("Confirm the entry before archiving");
    return;
  }
  archiveEntry(id);
  toast.success("Archived", {
    action: { label: "Undo", onClick: () => handleRestore(id) },
  });
};

const handleRestore = (id: string) => {
  restoreEntry(id);
  toast.success("Entry restored");
};
```

- **Frontend mutations + optimistic status updates**: `src/services/journal/useJournalApi.ts`

```ts
// src/services/journal/useJournalApi.ts (L290-L313)
const confirmEntry = useCallback((id: string) => {
  if (id.startsWith('local-')) return;
  setEntries(prev => prev.map(entry =>
    entry.id === id ? { ...entry, status: 'confirmed' as const, confirmedAt: new Date().toISOString(), _isQueued: true } : entry
  ));
  enqueue('CONFIRM', id);
}, [enqueue]);
```

```ts
// src/services/journal/useJournalApi.ts (L315-L348)
const archiveEntry = useCallback((id: string) => {
  if (id.startsWith('local-')) return;
  let blocked = false;
  setEntries(prev => {
    const current = prev.find(e => e.id === id);
    if (current?.status === 'pending') { blocked = true; return prev; }
    return prev.map(entry => entry.id === id
      ? { ...entry, status: 'archived' as const, archivedAt: new Date().toISOString(), _isQueued: true }
      : entry
    );
  });
  if (blocked) return;
  enqueue('ARCHIVE', id);
}, [enqueue]);
```

```ts
// src/services/journal/useJournalApi.ts (L367-L390)
const restoreEntry = useCallback((id: string) => {
  if (id.startsWith('local-')) return;
  setEntries(prev => prev.map(entry =>
    entry.id === id ? { ...entry, status: 'pending' as const, archivedAt: undefined, _isQueued: true } : entry
  ));
  enqueue('RESTORE', id);
}, [enqueue]);
```

---

## 3) Diary Mode Audit

### Toggle exists: ✅ (aber nicht als Page-Feature nachweisbar)

- **Toggle-Komponente existiert inkl. `data-testid`**: `src/components/journal/JournalViewToggle.tsx`

```tsx
// src/components/journal/JournalViewToggle.tsx (L4-L39)
export type JournalViewMode = "list" | "diary";

export function JournalViewToggle({ value, onChange }: JournalViewToggleProps) {
  return (
    <div data-testid="journal-view-toggle">
      <ToggleGroup type="single" value={value} onValueChange={(v) => v && onChange(v as JournalViewMode)}>
        <ToggleGroupItem value="list" data-testid="journal-view-list">List</ToggleGroupItem>
        <ToggleGroupItem value="diary" data-testid="journal-view-diary">Diary</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
```

- **Aber: keine Nutzung auf der Journal-Page gefunden**.
  - Suche nach `<JournalHeader` (die den Toggle konditional rendert) hat **keine Treffer** ergeben.
  - `JournalHeader` ist der einzige gefundene Konsument des `JournalViewToggle`:

```tsx
// src/components/journal/JournalHeader.tsx (L43-L47)
{/* View toggle */}
{viewMode && onViewModeChange && (
  <JournalViewToggle value={viewMode} onChange={onViewModeChange} />
)}
```

### Grouping by day: ✅ (Implementierung vorhanden)

- **`JournalDiaryView` gruppiert nach Tag (`yyyy-MM-dd`)**: `src/components/journal/JournalDiaryView.tsx`

```tsx
// src/components/journal/JournalDiaryView.tsx (L39-L70)
// Group entries by day
const dayGroups = useMemo(() => {
  const groups: Map<string, DayGroup> = new Map();
  entries.forEach((entry) => {
    const date = new Date(entry.timestamp);
    const dateKey = format(date, "yyyy-MM-dd");
    if (!groups.has(dateKey)) groups.set(dateKey, { date, dateKey, entries: [] });
    groups.get(dateKey)!.entries.push(entry);
  });
  const sortedGroups = Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  sortedGroups.forEach((group) => group.entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  return sortedGroups;
}, [entries]);
```

### Day header + KPIs: ✅ (Implementierung vorhanden)

- **Day header + Mini-KPIs (confirmed/pending counts)**: `src/components/journal/JournalDiaryView.tsx`

```tsx
// src/components/journal/JournalDiaryView.tsx (L104-L132)
<div data-testid="journal-day-header" className="flex items-center justify-between py-2 border-b border-border/50">
  <div className="flex items-baseline gap-2">
    <span className="text-lg font-semibold text-foreground">{dateStr}</span>
    <span className="text-xs font-medium text-muted-foreground tracking-wide">{weekday}</span>
  </div>
  {/* Mini KPIs */}
  <div className="flex items-center gap-2">
    {tradesCount > 0 && (<Badge variant="outline" className="text-xs gap-1">{tradesCount}</Badge>)}
    {pendingCount > 0 && (<Badge variant="secondary" className="text-xs gap-1 text-amber-500">{pendingCount}</Badge>)}
  </div>
</div>
```

### Moment cards: ✅ (Implementierung vorhanden)

- **Moment Card Komponente + `data-testid`**: `src/components/journal/JournalMomentCard.tsx`

```tsx
// src/components/journal/JournalMomentCard.tsx (L33-L76)
export function JournalMomentCard({ entry, onClick }: JournalMomentCardProps) {
  return (
    <Card data-testid="journal-moment-card" onClick={onClick}>
      <CardContent className="p-4 pl-5">
        <Badge data-testid="journal-status-badge" variant="secondary">
          {entry.status}
        </Badge>
        <p className="text-sm line-clamp-2">{entry.summary}</p>
      </CardContent>
    </Card>
  );
}
```

- **DiaryView rendert Moment Cards pro Tag**: `src/components/journal/JournalDiaryView.tsx`

```tsx
// src/components/journal/JournalDiaryView.tsx (L135-L143)
{/* Moment cards for this day */}
<div className="space-y-2">
  {group.entries.map((entry, entryIndex) => (
    <JournalMomentCard
      key={entry.id}
      entry={entry}
      onClick={() => onCardClick(entry, getGlobalIndex(groupIndex, entryIndex))}
    />
  ))}
</div>
```

**Hinweis (Drift):** Obwohl `JournalDiaryView`/`JournalViewToggle` existieren, nutzt die aktuelle Journal-Page stattdessen `mode=timeline|inbox|learn|playbook` (siehe `src/pages/Journal.tsx` + `src/components/journal/JournalModeToggle.tsx`). Die Diary/List-View-Mode-Persistenz ist nicht nachweisbar:

```tsx
// src/pages/Journal.tsx (L340-L355)
<h1 className="text-2xl font-bold tracking-tight text-foreground">
  Journal
</h1>
<JournalModeToggle
  value={mode}
  onChange={handleModeChange}
  pendingCount={counts.pending}
/>
```

```ts
// src/components/journal/JournalModeToggle.tsx (L7-L25)
const JOURNAL_MODE_KEY = "journalModeV3";

export function getStoredJournalMode(): JournalMode {
  const stored = localStorage.getItem(JOURNAL_MODE_KEY);
  if (stored === "timeline" || stored === "inbox" || stored === "learn" || stored === "playbook") {
    return stored;
  }
  return "timeline";
}

export function setStoredJournalMode(mode: JournalMode): void {
  localStorage.setItem(JOURNAL_MODE_KEY, mode);
}
```

```ts
// src/pages/Journal.tsx (L37-L39)
// localStorage key for view mode persistence (legacy)
const VIEW_MODE_KEY = "journalViewMode";
```

Zusätzlich wurde im Repo nur diese eine Referenz auf `journalViewMode` gefunden (Suchbegriff: `journalViewMode`).

**Zusatz: JournalDiaryView ist nicht als Page-Rendering nachweisbar.** Suche nach `JournalDiaryView` in `src/` zeigte nur Definition/Export (keine Verwendung in Pages).

---

## 3.1 Zusatz-Checks (explizit angefragt)

### `data-testid` vorhanden?

- **Page root (`page-journal`)**: ✅ (`src/pages/Journal.tsx`)
- **Nav Tab (`tab-journal`)**: ✅ (`src/routes/routes.ts`)

```ts
// src/routes/routes.ts (L73-L81)
{
  key: "journal",
  label: "Journal",
  route: "/journal?view=pending",
  tabTestId: "tab-journal",
  pageTestId: "page-journal",
  showInMobileNav: true,
},
```

- **Toggle (Mode: timeline/inbox/learn/playbook)**: ✅ (`src/components/journal/JournalModeToggle.tsx`)

```tsx
// src/components/journal/JournalModeToggle.tsx (L39-L49)
return (
  <div data-testid="journal-mode-toggle" className="inline-flex">
    <ToggleGroup type="single" value={value} onValueChange={handleChange}>
      <ToggleGroupItem data-testid="journal-mode-timeline" value="timeline" />
      <ToggleGroupItem data-testid="journal-mode-inbox" value="inbox" />
      {/* ... */}
    </ToggleGroup>
  </div>
);
```

- **Toggle (View: list/diary)**: ✅ als Komponente (`src/components/journal/JournalViewToggle.tsx`), aber **nicht** als aktives Page-Feature belegt (siehe oben).
- **Tabs Pending/Confirmed/Archived**: ❌ `data-testid` nicht gefunden in `JournalSegmentedControl` (Suchbegriff: `data-testid` in `src/components/journal/JournalSegmentedControl.tsx`).

### Persistenz List/Diary Toggle (localStorage)?

- **List/Diary**: ❌ nicht gefunden (Suchbegriff: `journalViewMode`; nur 1 Treffer = Konstante in `src/pages/Journal.tsx`)
- **Mode (timeline/inbox/learn/playbook)**: ✅ (`journalModeV3`) – siehe Snippet oben.

### Welche API-Responses enthalten `status`? (Case sensitivity)

- **Vercel API Response ist lowercase** via Mapper: `api/_lib/domain/journal/mapper.ts`

```ts
// api/_lib/domain/journal/mapper.ts (L19-L33)
export function toApiJournalStatus(status: JournalStatus): JournalEntryStatus {
  switch (status) {
    case 'PENDING': return 'pending';
    case 'CONFIRMED': return 'confirmed';
    case 'ARCHIVED': return 'archived';
    default: return (status as string).toLowerCase() as JournalEntryStatus;
  }
}
```

- **Vercel API akzeptiert Status case-insensitive im List-Filter** (Normalizer uppercased): `api/_lib/domain/journal/types.ts`

```ts
// api/_lib/domain/journal/types.ts (L25-L31)
export function normalizeStatus(status: string): JournalStatus {
  const upper = status.toUpperCase();
  if (upper === 'PENDING' || upper === 'CONFIRMED' || upper === 'ARCHIVED') return upper;
  throw new Error(`Invalid journal status: ${status}`);
}
```

- **Node backend Query-Validation ist lowercase-only** (Zod enum): `backend/src/validation/schemas.ts`

```ts
// backend/src/validation/schemas.ts (L12-L22)
export const journalEntryStatusSchema = z.enum(['pending', 'confirmed', 'archived']);
export const journalListQuerySchema = z.object({
  view: journalEntryStatusSchema.optional(),
  status: journalEntryStatusSchema.optional(),
  // ...
});
```

---

## 4) Gaps / Drift

### P0

- **Diary/List Toggle nicht verdrahtet**: `JournalViewToggle` existiert, aber keine Verwendung in der aktuellen Journal-Page nachweisbar (Suche nach `<JournalHeader` ergab keine Treffer; `JournalHeader` wäre der Konsument).
- **Keine Persistenz für Diary/List Mode sichtbar**: `VIEW_MODE_KEY = "journalViewMode"` ist deklariert, aber es gibt keinen `localStorage.getItem/setItem` dazu (Suchbegriff: `journalViewMode` → nur 1 Treffer).
- **`data-testid` für Pending/Confirmed/Archived Tabs nicht vorhanden**: `JournalSegmentedControl` nutzt `aria-label`, aber keine `data-testid` auf den ToggleGroupItems (relevant, falls Tests/Selectors das benötigen).

### P1

- **Doppelte Backend-Implementierungen** (Drift-Risiko): Journal-Routen existieren sowohl in `backend/` (Node Router) als auch in `api/` (Vercel Functions) mit ähnlicher Semantik.
- **Confirm/Archive Zusatzdaten sind explizit „local-only“**: UI sammelt `mood/note/tags` bzw. `archive reason`, sendet diese aber nicht ans Backend (Kommentare in den Dialog-Komponenten).
- **MomentCard enthält Platzhalter-Logik** (Attachments/ChartLink werden aus `entry.id.includes(...)` abgeleitet).

---

## 5) “Source of truth” Map

- **Zentrale Journal Page**: `src/pages/Journal.tsx`
- **Review Overlay**: `src/components/journal/JournalReviewOverlay.tsx`
- **Entry-Typ (Frontend)**:
  - Canonical v1: `src/types/journal.ts` (`JournalEntryV1`, `JournalStatusV1`)
  - UI/API layer: `src/services/journal/types.ts` (`JournalEntryLocal` extends `JournalEntryV1`)
- **Status-Enums/Strings**:
  - Frontend canonical lowercase: `src/types/journal.ts`
  - Node backend validation lowercase: `backend/src/validation/schemas.ts`
  - Vercel domain uppercase intern: `api/_lib/domain/journal/types.ts` (`JournalStatus`)
  - Vercel API response lowercase mapping: `api/_lib/domain/journal/mapper.ts` (`toApiJournalStatus`)


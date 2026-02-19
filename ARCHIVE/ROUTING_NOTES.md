# Routing Notes

## Canonical routes

- `/research?view=chart&q=<ticker|solanaBase58>`  
  - `view=chart` is required and normalized automatically.
  - `q` carries the market query.
  - `/research/:assetId` is allowed and **must preserve the path segment** during normalization (inject `view=chart`, preserve other params).
  - Optional `replay=true` toggles replay mode without leaving the `/research` path.
- `/insights`  
  - Consolidated workspace for the former Oracle area.
  - Optional URL state:
    - `?filter=unread` for inbox-like filtering
    - `?mode=status` for provider/status mode
  - Detail route: `/insights/:insightId`
- `/journal?view=pending|confirmed|archived`  
  - List filters only; UI mode (`mode=inbox|learn|timeline`) stays on `/journal`.
- `/journal/:entryId` is the **only** detail route; UI state never lives on a query parameter.
  - Legacy input support only: `/journal?entry=<id>` redirects to `/journal/<id>`.

## Legacy redirect layer

- `/chart?q=...` → `/research?view=chart&q=...`
- `/replay?q=...` → `/research?view=chart&replay=true&q=...`
- `/replay` → `/research?view=chart&replay=true`
- `/watchlist` → `/research?view=chart&panel=watchlist`
- `/journal?entry=<id>` → `/journal/<id>`
- `/journal/review` → `/journal?mode=inbox&view=pending`
- `/journal/insights` → `/journal?mode=learn&view=pending`
- `/asset/:assetId` → `/research/:assetId`
- `/oracle` → `/insights` (preserves query params)
- `/oracle/inbox` → `/insights?filter=unread`
- `/oracle/status` → `/insights?mode=status`
- `/oracle/:insightId` → `/insights/:insightId`
- `/learn` (and `/learn/:id`) → `/journal?mode=learn` (preserves query params)
- `/handbook` → `/journal?mode=playbook` (preserves query params)
- `/settings/providers` → `/settings?section=providers`
- `/settings/data` → `/settings?section=data`
- `/settings/privacy` → `/settings?section=privacy`
- `/settings/experiments` → `/settings?section=experiments`

## Notes

- Clicking the Research tab lands on `/research`, which immediately rewrites to the canonical query.  
- `mode` is persisted as `?mode=...` and updated whenever the user switches between timeline/inbox/learn.  
- The `JournalRoute` wrapper guarantees `view` is always present before rendering the main list.
- Tests treat query parameter ordering as **order-independent**; assertions validate key/value semantics via parsed search params.
- Legacy redirects preserve existing query params where applicable; canonical defaults are injected (e.g. `view=chart`, `replay=true`, `panel=watchlist`).


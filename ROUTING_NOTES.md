# Routing Notes

## Canonical routes

- `/research?view=chart&q=<ticker|solanaBase58>`  
  - `view=chart` is required and normalized automatically.
  - `q` carries the market query. `/research/:assetId` redirects here and sets `q`.
  - Optional `replay=true` toggles replay mode without leaving the `/research` path.
- `/journal?view=pending|confirmed|archived`  
  - List filters only; UI mode (`mode=inbox|learn|timeline`) stays on `/journal`.
- `/journal/:entryId` is the detail route; UI state never lives on a query parameter.

## Legacy redirect layer

- `/chart?q=...` → `/research?view=chart&q=...`
- `/replay?q=...` → `/research?view=chart&replay=true&q=...`
- `/replay` → `/research?view=chart&replay=true`
- `/journal?entry=<id>` → `/journal/<id>`
- `/journal/review` → `/journal?mode=inbox&view=pending`
- `/journal/insights` → `/journal?mode=learn&view=pending`
- `/research/:assetId` → `/research?view=chart&q=<assetId>`

## Notes

- Clicking the Research tab lands on `/research`, which immediately rewrites to the canonical query.  
- `mode` is persisted as `?mode=...` and updated whenever the user switches between timeline/inbox/learn.  
- The `JournalRoute` wrapper guarantees `view` is always present before rendering the main list.


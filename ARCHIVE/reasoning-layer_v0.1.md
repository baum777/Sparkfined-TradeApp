# Reasoning Layer v0.1

Diese Datei ist die **initiale Spezifikation** für den Reasoning-Layer in `appshell-foundation`.

> Hinweis: Diese Version basiert auf den im Repo vorhandenen Architektur-/Contract-Patterns (`api/_lib/*`, `backend/src/*`, `src/services/db/db.ts`, Offline-Context) und den **Fix-Vorgaben** aus dem aktuellen Produktauftrag:
> - Trade Review
> - Session Review
> - Board Scenarios
> - Insight Critic

## Ziele (v0.1)

- **Offline-first**: letzte gültige Insights werden lokal (IndexedDB) vorgehalten und offline angezeigt.
- **Revalidate**: online werden Insights revalidiert und Cache aktualisiert.
- **Maschinen-parsebare Outputs**: Reasoning-Outputs sind strikt JSON und gegen Zod-Schemas validierbar.
- **Safety**: der *Insight Critic* ist ein separater finaler Schritt (Konflikte/fehlende Daten/Overreach).

## Datenvertrag (v0.1)

- `ReasoningResponse<T>`
- `ReasoningError`
- `ReasoningMeta`

Pflichtfelder:
- `status`
- `data`
- `warnings`
- `confidence`
- `meta.latency_ms`
- `meta.model`
- `meta.version`

## Kommunikationsfluss

```
UI → Hook → Service → /api/reasoning/* → (optional Railway Backend) → LLM
```

## Offline Cache Key

```
{ type, referenceId, version, hash(context) }
```

## Routen (v0.1)

- `POST /api/reasoning/trade-review`
- `POST /api/reasoning/session-review`
- `POST /api/reasoning/board-scenarios`
- `POST /api/reasoning/insight-critic`



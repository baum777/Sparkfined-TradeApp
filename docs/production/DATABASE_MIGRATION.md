# Database Migration — SQLite → Postgres

## Ziel

Production nutzt Postgres (managed), Local Dev darf SQLite verwenden. Die Auswahl erfolgt via `DATABASE_URL`.

## Supported `DATABASE_URL` Formate

- SQLite (local dev):
  - `sqlite:./.data/tradeapp.sqlite`
- Postgres (production):
  - `postgres://user:pass@host:5432/db`
  - `postgresql://user:pass@host:5432/db`

## Migration-Runner

Der Migrations-Runner nutzt die gleiche DB wie die App:

```bash
pnpm -C backend migrate
```

Das Script liest `DATABASE_URL` aus der Umgebung und führt alle `backend/migrations/*.sql` in Reihenfolge aus.

## Railway / Managed Postgres (Production)

1. Postgres-Service im Provider anlegen (z.B. Railway).
2. `DATABASE_URL` als **Runtime Env** im Backend setzen.
3. Migrations-Runner ausführen (CI/CD oder manuell per Job).
4. Backend starten.

## Rollback-Strategie

Migrations sind **forward-only**. Rollbacks erfolgen via:

- Backup Restore (Provider Snapshot)
- Manuelle Down-Migration (nur bei Bedarf schreiben)

## Troubleshooting

- **`relation does not exist`**: Migrations wurden nicht ausgeführt.
- **`Invalid environment variables`**: `DATABASE_URL` fehlt oder falsch formatiert.


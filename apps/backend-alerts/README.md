# Backend Alerts Service

Dedicated backend service for Sparkfined alerts, providing:
- Watcher loop for asset monitoring
- Web Push notifications (VAPID)
- Real-time in-app updates (SSE)
- REST API for alert management

## Environment Variables

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL`: Postgres connection string
- `API_KEY`: Simple bearer token for auth
- `VAPID_*`: Web Push keys (generate with `npx web-push generate-vapid-keys`)
- `WATCHER_INTERVAL_MS`: Interval for checking alerts (default 5000ms)

## Local Development

1. Start local Postgres via Docker:
   ```bash
   pnpm db:up
   ```
2. Copy `.env.example` to `.env` (or `env.example`), then verify `DATABASE_URL` points to local Docker Postgres.
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Run dev server:
   ```bash
   pnpm dev
   ```
   This runs migrations automatically on start.
5. Optional: follow DB logs / stop DB
   ```bash
   pnpm db:logs
   pnpm db:down
   ```

## Railway Deployment

1. Create a new project on Railway.
2. Add a PostgreSQL database service.
3. Add this service (backend-alerts).
4. Connect the database via `DATABASE_URL` variable (use Reference).
5. Set `API_KEY` and `VAPID_*` variables.
6. The service listens on `PORT` (Railway automatically sets this).
7. Health check endpoint: `/health`.

## API Usage

Auth: `Authorization: Bearer <API_KEY>`

### Create Alert
```bash
curl -X POST http://localhost:3000/alerts \
  -H "Authorization: Bearer secret" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "u1",
    "name": "BTC Spike",
    "enabled": true,
    "channels": {"inApp": true, "push": false},
    "rules": {
      "asset": {"type": "CRYPTO", "id": "BTC"},
      "triggers": [{"kind": "VOLUME_SPIKE", "windowMinutes": 5, "minIncreasePct": 10}],
      "confirm": {"need": 1, "of": 1, "withinMinutes": 5}
    }
  }'
```

### Subscribe to Push
```bash
curl -X POST http://localhost:3000/push/subscribe \
  -H "Authorization: Bearer secret" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "u1",
    "deviceId": "d1",
    "subscription": {...}
  }'
```

### SSE Stream
```bash
curl "http://localhost:3000/stream?userId=u1&token=secret"
```

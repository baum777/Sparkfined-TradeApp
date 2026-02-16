# Deployment Notes

## Discover tokens cache strategy

### Pre-Launch constraint (mandatory)

- Deploy the API as a **single instance** for `/api/discover/tokens`.
- Do **not** enable horizontal scaling before the cache backend is shared.

### Why single-instance is required

- The Discover token catalog cache is currently **in-memory per instance**.
- Cache TTL is **45 seconds**.
- In a multi-instance deployment, each instance can hold a different cache snapshot during the TTL window, which can produce divergent token lists between requests.

### Current guardrails

- Endpoint rate limit: **120 requests / 60 seconds** per requester (`x-forwarded-for`).
- Cache headers: `public, max-age=45`.
- Upstream fallback: if Jupiter `/tokens` fails, the endpoint serves deterministic **mock/fallback token data**.
  - Implication: the endpoint remains available, but token quality/source is degraded until upstream recovers.

### Launch monitoring targets

- Monitor `/api/discover/tokens` per-request log fields:
  - `durationMs`
  - `payloadBytes`
- Target latency requirement: **p95 < 500ms**.
- Response size target (recommended): **ideally < 50KB**. Treat this as a monitoring threshold first, then optimize if consistently above target.

### Post-Launch plan

- Move Discover cache to a distributed store (**Redis** or **Vercel KV**) with shared TTL semantics.
- Keep the same logical TTL window (45s) initially, then tune based on production telemetry.

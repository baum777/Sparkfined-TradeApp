# Externe Provider (Ist-Zustand)

Regel: Provider/Secrets sind **backend-only**. Frontend nutzt keine Provider-Keys.

## Übersicht

| Provider | Zweck | Genutzt in | Auth / Secret |
|---|---|---|---|
| **Helius** | Solana Onchain/RPC + Enhanced Transactions | `backend/` (Onchain gating / Solana Analysis), `api/` (Wallet ingest / optional) | `HELIUS_API_KEY` (backend required; api optional/feature-gated) |
| **Moralis (Solana Gateway)** | Token/Metadata (Pulse/Onchain) | `backend/` (Pulse Token Metadata), `api/` (Onchain Snapshot/Journal enrich) | `MORALIS_API_KEY` (Header `X-API-Key`) |
| **DexPaprika** | Solana Token Markt-/FDV/Vol/Price Metadaten | `backend/` (Pulse Token Data, public), `api/` (Onchain snapshot, optional key) | optional `DEXPAPRIKA_API_KEY` (Bearer) |
| **OpenAI** | LLM Calls (JSON/Chat) | `backend/` (`opusClient`, LLM Providers), `api/` (optional) | `OPENAI_API_KEY` (Bearer) |
| **DeepSeek** | LLM Router/Reasoning | `backend/`, `api/` (optional) | `DEEPSEEK_API_KEY` (Bearer) |
| **Grok (x.ai)** | LLM + Pulse Sentiment | `backend/`, `api/` (optional) | `GROK_API_KEY` (Bearer) |
| **Vercel KV / Upstash** | Key-Value Store (State/RateLimits/Idempotency) | `api/` (primär), `backend/` hat KV-Env Variablen + Adaptercode | `KV_REST_API_URL`, `KV_REST_API_TOKEN` (+ optional read-only token) |
| **Web Push (VAPID)** | Push Notifications | `backend/` (VAPID envs vorhanden), `apps/backend-alerts/` (aktiv) | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| **Postgres** | Persistenz für `apps/backend-alerts/` | `apps/backend-alerts/` | `DATABASE_URL` (Connection String) |

## Details pro Backend-Layer

### `backend/` (Always-on Node Server)

- **Helius**: `backend/src/domain/solOnchain/adapters/helius.ts` (RPC + REST).
  - `HELIUS_API_KEY` ist **required** im Env Schema.
- **DexPaprika**: Pulse Token Daten via public Endpoint `https://api.dexpaprika.com/...` (kein Key im `backend/` Env Schema).
- **Moralis**: Pulse Token Metadata via `https://solana-gateway.moralis.io/...` mit `MORALIS_API_KEY`.
- **LLMs**: OpenAI/DeepSeek/Grok (Bearer Keys).

### `api/` (Vercel Serverless Functions)

- **Vercel KV**: KV‑backed Rate Limiting/State.
- **Cron Security**: `CRON_SECRET` (prod required; siehe `api/_lib/env.ts`).
- **Onchain Snapshot**: DexPaprika + Moralis optional; Helius wird in Auto‑Capture‑Features referenziert.

### `apps/backend-alerts/` (separater Service)

- **Postgres** als Hauptpersistenz (`DATABASE_URL` required).
- **Web Push** über VAPID Keys.
- **Auth**: API-Key Bearer Token (`API_KEY`).

## Nicht implementiert / Stub

- Pulse Source Adapter in `api/_lib/domain/pulse/adapter.ts` ist aktuell Stub/Manual Seed (keine echte Twitter/News Integration).


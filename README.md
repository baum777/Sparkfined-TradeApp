# Sparkfined — Trading Intelligence Platform

---
Owner: Core Team
Status: active
Version: 2.0
LastUpdated: 2026-02-27
Canonical: true
---

## 1. Purpose

Non-custodial trading terminal with integrated journal, signals, and AI-powered research tools. Built for deterministic execution and governed by the Dominance Layer for quality control.

## 2. Quickstart

**Prerequisites:** Node.js 20+, pnpm 10.x

```bash
pnpm install
pnpm dev            # Frontend: http://localhost:8080
pnpm -C backend dev # Backend:  http://localhost:3000
```

**Required:** `HELIUS_API_KEY` in `backend/.env`

## 3. Architectural Layers

|    Layer | Code                   | Responsibility                                 |     Canonical     |
| -------: | ---------------------- | ---------------------------------------------- | :---------------: |
| Frontend | `src/`                 | Vite/React SPA (Terminal, Discover, Research)  |         ✅         |
|  Backend | `backend/`             | Canonical Node server (always-on), persistence |         ✅         |
|      API | `api/`                 | Vercel Functions alternative / edge routing    | ❌ (non-canonical) |
|   Alerts | `apps/backend-alerts/` | Push/SSE notifications service                 |         ✅         |
|   Shared | `shared/contracts/`    | Additive-only TS contracts & docs              |         ✅         |

### Canonical Source-of-Truth Rules

* **Backend is canonical** for server behavior and API semantics.
* **HTTP boundary is JSON**, not TypeScript imports.
* **Contracts in `shared/contracts/` are additive-only** (backward compatible).
* Any duplicate implementations must either:
  1. be removed, or
  2. be explicitly documented as compatibility shims.

## 4. Agent Model (Dominance Layer)

Location: `backend/src/lib/dominance/*`

* Autonomy Tiers 1–4 (Tier 2 default)
* Golden Tasks: lint, tsc, build, test:backend, test:e2e
* Auto-Correct Loop with max iterations
* Risk Policy: approval gates for core_engine, adapters, ci_deploy, large_diff

## 5. Prompt Governance (Reasoning Layer)

Location: `shared/contracts/reasoning-prompts.ts` (single source of truth)

* Trade Review, Session Review, Board Scenarios, Insight Critic
* RCTC-compliant prompts: Task, Rules, Context, Constraints
* Machine-parseable JSON outputs only

**Rule:** prompts must not exist in multiple sources without an explicit single canonical origin.

## 6. Runtime Logic

* Frontend Dev: `http://localhost:8080`
* Backend Dev: `http://localhost:3000`
* API Base: `/api`
  * dev: Vite proxy → backend
  * prod: Vercel rewrite → Railway backend (or documented target)

## 7. Model Strategy

* Providers: DeepSeek (default reasoning), OpenAI, Grok (x.ai)
* Tiers: free | standard | pro | high (budget/capability governance)
* Router: fallback with budget awareness and deterministic output contracts

## 8. Documentation Map

| Document                       | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `docs/ARCHITECTURE.md`         | System architecture, boundaries, data flow   |
| `docs/TERMINAL.md`             | Trading Terminal UX + execution model        |
| `docs/DISCOVER.md`             | Token discovery, ranking, filters            |
| `docs/DEPLOYMENT.md`           | Railway/Vercel deploy, env, release flow     |
| `docs/SECURITY.md`             | Auth model, rate limits, threat model        |
| `docs/QA.md`                   | Test strategy, CI expectations, golden tasks |
| `docs/CONTRIBUTING.md`         | Dev workflow, PR rules, review gates         |
| `docs/FUNCTIONAL_SPEC.md`      | API surface, module contracts, NFRs          |
| `docs/DOMINANCE_LAYER.md`      | Governance, risk policy, autonomy tiers      |
| `shared/docs/API_CONTRACTS.md` | API envelopes, request/response shapes       |
| `shared/docs/ENVIRONMENT.md`   | env vars, local/prod parity                  |
| `shared/docs/PROVIDERS.md`     | External provider configs, secrets handling  |
| `shared/docs/LOCAL_DEV.md`     | Detailed local setup, troubleshooting        |

## 9. Contribution Workflow

* Small PRs, single concern per PR
* Update docs when behavior changes
* Run golden tasks before PR:
  * `pnpm lint`
  * `pnpm -s tsc --noEmit`
  * `pnpm -r build`
  * tests per folder (backend + e2e when relevant)

## 10. Versioning Policy

* **Contracts:** additive-only, versioned (`*_v1`, `*_v2`)
* **Docs:** must include `Owner`, `Status`, `Version`, `LastUpdated`
* **Breaking changes** require:
  * migration notes
  * explicit deprecation window
  * compatibility plan

## 11. Security & Deployment Quick Reference

* **Auth:** Disabled by default (`VITE_ENABLE_AUTH=false`). See `docs/SECURITY.md` for Auth Behavior Matrix.
* **Secrets:** Never in `VITE_*` env vars. See `shared/docs/ENVIRONMENT.md`.
* **Deployment:** Railway (backend) + Vercel (frontend). See `docs/DEPLOYMENT.md`.
* **Feature Flags:** `VITE_RESEARCH_EMBED_TERMINAL`, `ENABLE_SPARKFINED_DOMINANCE`. See `docs/DEPLOYMENT.md`.

## 12. Troubleshooting

### `/api` Routing issues
- Local: Vite proxy → `http://localhost:3000`
- Production: Vercel rewrite → `$VERCEL_BACKEND_URL`

### Backend won't start
- Check `HELIUS_API_KEY` in `backend/.env`
- Validate with `pnpm -C backend verify:env`

### Contract Drift
- See `shared/docs/API_CONTRACTS.md` for envelope definitions
- Backend envelope: `{ status: "ok", data }` / `{ error: {...} }`

---
id: p0JwtTestFixtureParity
type: function
category: api-test
canonical: api/tests/helpers/jwt.ts
updated: 2026-05-13
freshness: stable
tags: [p0, jwt, auth, tests]
perf:
  avg_latency_ms: null
  avg_tokens_est: null
  cache_hit_rate: 0.0
optimization_candidates:
  - env-fixture-contract-tests
---

# p0JwtTestFixtureParity

## Zweck
Stellt sicher, dass JWT-Testfixtures dieselben `secret`-, `issuer`- und `audience`-Werte wie `getEnv()` verwenden, damit Negativtests nur den beabsichtigten Fehlerpfad ausloesen.

## Scope
- `createTestToken`, `createExpiredToken`, `createTokenWithWrongIssuer`, `createTokenWithWrongAudience`, `createTokenWithWrongSecret`
- Ableitung von Signaturparametern aus Laufzeitumgebung statt Hardcoding

## Verifikation
- `corepack pnpm -C api run test` (exit 0, inklusive `tests/unit/auth-jwt.spec.ts`)

# API Specification (Canonical Backend)

**Source of Truth:** `backend/src/routes/*` — Production `/api/*` is served by the Node backend (Railway). Vercel rewrites all `/api/*` to the backend.

## Response Envelope

- **Success:** `{ "status": "ok", "data": <T> }`
- **Error:** `{ "error": { "code": string, "message": string, "details"?: { requestId?: string, ... } } }`
- **Headers:** `x-request-id` on all responses

## Trading Endpoints

### GET /api/quote

Quote preview for Terminal swap (Jupiter v6).

**Query:**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| baseMint | string | yes | - |
| quoteMint | string | yes | - |
| side | `buy` \| `sell` | yes | - |
| amount | string | yes | - |
| amountMode | `quote` \| `base` | yes | - |
| slippageBps | number 0–5000 | no | 50 |
| feeBps | number 0–5000 | no | 65 |
| priorityFeeEnabled | string | no | - |
| priorityFeeMicroLamports | number 0–500000 | no | - |

**Response (200):** `TerminalQuoteData` (expectedOut, minOut, feeBps, feeAmountEstimate, meta?, provider)

**Auth:** None (public read)

---

### POST /api/swap

Build swap transaction (Jupiter v6).

**Body:**
| Field | Type | Required |
|-------|------|----------|
| publicKey | string | yes |
| baseMint | string | yes |
| quoteMint | string | yes |
| side | `buy` \| `sell` | yes |
| amount | string | yes |
| amountMode | `quote` \| `base` | yes |
| slippageBps | number | yes |
| feeBps | number | yes |
| priorityFee | { enabled, microLamports? } | no |
| providerQuote | unknown | no (required for Phase 1) |

**Response (200):** `{ swapTransactionBase64, lastValidBlockHeight?, prioritizationFeeLamports? }`

**Auth:** Default anon allowed. Set `TERMINAL_SWAP_REQUIRE_AUTH=true` to require auth.

**Note:** If `feeBps > 0`, `JUPITER_PLATFORM_FEE_ACCOUNT` must be set in backend env.

---

### GET /api/discover/tokens

Token list for Discover overlay (seeded from Jupiter token list).

**Query:**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| limit | number 1–600 | no | all |
| cursor | number ≥ 0 | no | 0 |

**Response (200):** Array of `DiscoverToken` (mint, symbol, name, launchpad, market, liquidity, holders, trading, manipulation, safety, social, oracle)

**Headers:** `x-next-cursor` when pagination continues

**Auth:** None. Rate limit: 120 req/min per IP.

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request / Validation |
| 401 | Unauthenticated |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Internal Error |

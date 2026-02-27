---
Owner: Trading Terminal Team
Status: active
Version: 1.0
LastUpdated: 2026-02-27
Canonical: true
---

# Trading Terminal

**Implementation Status:** ✅ Phase 1 Complete + Research Integration (Feature-Flagged)  
**Last Updated:** 2024-12-19

---

## Overview

The Trading Terminal provides non-custodial Solana swap execution with:
- Jupiter integration for routing
- Fee engine with tier-based reduction
- Race-safe quote fetching
- Stale quote protection
- Safety warnings (slippage, priority fee)

**Routes:**
- Standalone: `/terminal`
- Embedded in Research: `/research` (feature-flagged via `VITE_RESEARCH_EMBED_TERMINAL`)

---

## Architecture

### Components

**TerminalShell** (`src/components/terminal/TerminalShell.tsx`)
- Top Bar: Wallet Connect + PairSelector + Discover Button
- Main: ChartPanel (left) + ExecutionPanel (right, w-96)
- Bottom: TxStatusToast (global notifications)

**ExecutionPanel** (`src/components/terminal/ExecutionPanel.tsx`)
- OrderForm (Buy/Sell toggle, Amount input, Slippage, Priority Fee)
- FeePreviewCard (Expected Out, Min Out, Fee, Price Impact)

**ChartPanel** (`src/components/terminal/ChartPanel.tsx`)
- Currently: Placeholder (shows pair label)
- Props: `baseMint`, `quoteMint`
- Ready for chart library integration

**EmbeddedTerminal** (`src/components/terminal/EmbeddedTerminal.tsx`)
- Wrapper for embedding in Research tab
- No TopBar (Wallet/PairSelector removed)
- Responsive: `flex-col` on mobile, `flex-row` on desktop

### State Management

**TerminalStore** (`src/lib/state/terminalStore.ts`)
- Zustand store with:
  - `pair: TerminalPair | null`
  - `side: 'buy' | 'sell'`
  - `amount: TerminalAmountState`
  - `slippageBps: number`
  - `priorityFee: { enabled: boolean; microLamports?: number }`
  - `feeTier: FeeTier`
  - `quote: TerminalQuoteState`
  - `tx: TerminalTxState`

**Key Actions:**
- `setPair()` - Sets pair and triggers quote fetch
- `setSide()` - Sets buy/sell side
- `setAmountValue()` - Sets amount input
- `executeSwap()` - Executes swap transaction

**Race-Safe Quote Fetching:**
- `requestId` sequencing prevents out-of-order responses
- `scheduledSeq` marks in-flight responses as obsolete
- 400ms debounce prevents excessive API calls
- 25s stale quote guard

---

## Research Integration

### Feature Flag

**`VITE_RESEARCH_EMBED_TERMINAL`** (default: `false`)
- When `true`: Trading Terminal appears as collapsible drawer in Research tab
- When `false`: Research tab unchanged, Terminal only available at `/terminal`

### One-Way Sync

**ResearchTerminalSync** (`src/components/Research/ResearchTerminalSync.tsx`)
- Syncs `selectedSymbol` (Research) → `terminalStore.setPair()` (Terminal)
- Uses `resolveSymbolToMint()` to convert symbols to mint addresses
- Supported symbols: SOL, USDC, USDT, mSOL, BONK
- Guards: Skips if symbol→mint mapping fails or pair already set

**Symbol → Mint Resolver** (`src/lib/trading/symbolResolver.ts`)
- Converts trading symbols to Solana mint addresses
- Well-known mints only (no Jupiter registry lookup in MVP)
- Returns `null` for unknown symbols (no partial behavior)

### Layout

**Bottom Drawer Pattern:**
```
┌─────────────────────────────────────────┐
│ ChartTopBar                             │
├─────────────────────────────────────────┤
│ Chart Canvas (Research)                 │
├─────────────────────────────────────────┤
│ [▼ Trading Terminal] (Collapsible)     │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ ChartPanel + ExecutionPanel         │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Execution Flow

### 1. Pair Selection
- User selects pair via PairSelector or Discover Overlay
- `terminalStore.setPair()` called
- Quote fetch scheduled (400ms debounce)

### 2. Quote Fetching
- `fetchQuote()` validates inputs (pair, amount, slippage, fee)
- Calls `/api/quote` with parameters
- Updates `quote` state (loading → success/error)
- Stale check: 25s TTL, force fetch if stale

### 3. Order Configuration
- User sets side (buy/sell)
- User sets amount (quote currency for buy, base for sell)
- User sets slippage (default 50bps, warning at >500bps)
- User sets priority fee (optional, warning at >50k microLamports)

### 4. Swap Execution
- User clicks "Buy" or "Sell"
- `executeSwap()` called with wallet + connection
- **Input Snapshot:** State captured at execution start (prevents drift)
- **Fresh Quote Check:** Ensures quote is not stale
- Transaction built via `/api/swap`
- Transaction simulated (best-effort, RPC errors ignored)
- Transaction signed by wallet
- Transaction sent with retry logic (maxRetries: 3)
- Transaction confirmed with blockhash validation

### 5. Confirmation
- TxStatusToast shows success/failure
- Explorer link provided for successful transactions
- Error messages displayed for failures

---

## Fee Engine

### Fee Tiers

| Tier | Fee (bps) | Description |
|------|-----------|-------------|
| free | 65 | Default tier |
| soft | 55 | Soft lock tier |
| hardI | 40 | Hard lock tier I |
| hardII | 30 | Hard lock tier II |
| genesis | 20 | Genesis tier |

**Current Implementation:**
- Frontend shows `free` tier (65 bps) by default
- Backend may apply tier reduction based on lock status
- Fee calculation: Round DOWN to prevent overcharging

### Fee Calculation

```typescript
feeAmount = (notionalBaseUnits * feeBps) / 10000n
```

**Important:** Integer math, rounds down (prevents overcharging).

---

## Safety Features

### Slippage Warning
- **Threshold:** >500 bps (5%)
- **Display:** Yellow warning box below SlippageSelector
- **Message:** "High slippage tolerance - You may receive significantly less than expected"
- **Non-blocking:** Does not prevent swap execution

### Priority Fee Warning
- **Threshold:** >50,000 microLamports (0.05 SOL)
- **Display:** Yellow warning box below PriorityFeeToggle
- **Message:** "High priority fee - This will significantly increase transaction costs"
- **Non-blocking:** Does not prevent swap execution

### Error Boundaries
- Terminal page wrapped in ErrorBoundary
- Research embedded terminal wrapped in ErrorBoundary
- Fallback UI with error ID, reset, and reload actions

---

## Testing Checklist

### Manual Verification

1. **Standalone Terminal:**
   - [ ] Navigate to `/terminal`
   - [ ] Wallet connects successfully
   - [ ] Pair selector works (SOL/USDC, USDT/USDC, mSOL/USDC)
   - [ ] Discover button opens overlay
   - [ ] Quote loads after pair selection
   - [ ] Swap executes successfully

2. **Research Integration (if feature enabled):**
   - [ ] Navigate to `/research?q=SOL`
   - [ ] Trading Terminal drawer opens
   - [ ] Terminal shows SOL/USDC pair (via sync)
   - [ ] Wallet connects in embedded terminal
   - [ ] Swap executes from Research tab
   - [ ] `/terminal` route still works unchanged

3. **Safety Warnings:**
   - [ ] Set slippage to 10% → warning appears
   - [ ] Set priority fee to 100k microLamports → warning appears
   - [ ] Swap still executable with warnings

4. **Error Handling:**
   - [ ] Force error in Terminal → fallback appears
   - [ ] Reset button works (closes overlays)
   - [ ] Reload button works

---

## Environment Variables

See `shared/docs/ENVIRONMENT.md` for complete list.

**Terminal-Specific:**
- `VITE_SOLANA_CLUSTER` - devnet | mainnet-beta
- `VITE_SOLANA_RPC_URL` - Custom RPC endpoint (optional)
- `VITE_RESEARCH_EMBED_TERMINAL` - Enable Research integration (default: false)

---

## API Endpoints

**Quote:**
```
GET /api/quote
Query: baseMint, quoteMint, side, amount, amountMode, slippageBps, feeBps, priorityFeeEnabled, priorityFeeMicroLamports
Response: TerminalQuoteData
```

**Swap:**
```
POST /api/swap
Body: { publicKey, baseMint, quoteMint, side, amount, amountMode, slippageBps, feeBps, priorityFee, providerQuote }
Response: { swapTransactionBase64, lastValidBlockHeight }
```

---

## Known Limitations

1. **Symbol Coverage:** Only well-known mints supported (SOL, USDC, USDT, mSOL, BONK)
   - **Workaround:** User can set pair manually via Discover Overlay

2. **ChartPanel:** Placeholder (not implemented)
   - **Workaround:** Research chart remains functional above terminal

3. **Fee Tier Selection:** Frontend shows only `free` tier
   - **Note:** Backend may apply tier reduction based on lock status

4. **Priority Fee Input:** No UI for custom microLamports value
   - **Note:** Default 5k microLamports used when enabled

---

## Related Documentation

- [Architecture](../docs/ARCHITECTURE.md) - System architecture
- [Discover](../docs/DISCOVER.md) - Discover overlay integration
- [Deployment](../docs/DEPLOYMENT.md) - Feature flags, monitoring
- [Security](../docs/SECURITY.md) - Non-custodial constraints
- [QA](../docs/QA.md) - Testing procedures


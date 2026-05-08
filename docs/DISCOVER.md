---
Owner: Discover Team
Status: active
Version: 1.0
LastUpdated: 2026-02-27
Canonical: true
---

# Discover Overlay

**Implementation Status:** ✅ Phase 2 Complete  
**Last Updated:** 2024-12-19

---

## Overview

The Discover Overlay provides token discovery with:
- Filter engine (hard rejects, presets, requirements)
- Ranking system (0-100 scores)
- Reason chips (max 2 per token)
- Deep-link integration with Terminal

**Access:**
- Terminal: "Discover" button in TerminalShell
- Global: `useDiscoverStore().openOverlay()`

---

## Architecture

### Components

**DiscoverOverlay** (`src/components/discover/DiscoverOverlay.tsx`)
- Drawer component (90vh height)
- Opens/closes without page reload
- Dismissible via ESC, click outside, or close button

**DiscoverTabs** (`src/components/discover/DiscoverTabs.tsx`)
- Tab navigation: Not Bonded / Bonded / Ranked
- Each tab has default preset
- Tab switch resets to default preset

**DiscoverFiltersPanel** (`src/components/discover/DiscoverFiltersPanel.tsx`)
- Launchpad multi-select (pumpfun, moonshot)
- Time window selector (5m, 15m, 60m, all)
- Min liquidity input (SOL)
- Search input (symbol/name/mint)
- Preset profile selector (5 presets, tab-specific)

**DiscoverTokenList** (`src/components/discover/DiscoverTokenList.tsx`)
- Virtualized token list (ScrollArea)
- Memoized token evaluation
- Handles 200+ tokens smoothly

**DiscoverTokenCard** (`src/components/discover/DiscoverTokenCard.tsx`)
- Token card UI with:
  - Symbol / name
  - Liquidity metric (SOL)
  - Volume metric (5m USD)
  - Holder count
  - Launchpad badge
  - Up to 2 reason chips
  - Score badge (ranked tab only, 0-100)

### State Management

**DiscoverStore** (`src/lib/state/discoverStore.ts`)
- Zustand store with:
  - `isOpen: boolean`
  - `activeTab: 'not_bonded' | 'bonded' | 'ranked'`
  - `filters: DiscoverFilters`
  - `selectedPreset: Record<Tab, PresetId>`
  - `tokens: Token[]`
  - `isLoading: boolean`
  - `error: string | null`

---

## Filter Engine

### Evaluation Flow

1. **Hard Reject Rules** (fixed per tab)
   - Applied first, immediate reject if matched
   - Examples: freeze authority present, mint authority present, Jupiter Shield critical

2. **Requirements** (fixed per tab)
   - Min liquidity, top holder caps, activity floors
   - Applied per tab (not_bonded, bonded, ranked)

3. **Preset Rules** (user-selectable)
   - Merged with fixed rules (stricter wins)
   - Tab-specific presets available

4. **Fallback Rules**
   - Applied if token passes all above checks

5. **Ranking** (ranked tab only)
   - Score calculation (0-100)
   - Downrank if score < 30

### Presets

**Not Bonded Tab:**
- `bundler_exclusion_gate` (default)

**Bonded Tab:**
- `strict_safety_gate` (default)

**Ranked Tab:**
- `signal_fusion` (default)

**Preset Merge Logic:**
- Fixed rules remain active
- Preset rules add/strengthen requirements
- Stricter rules win in conflicts

---

## Ranking System

### Score Calculation

**Ranked Tab Only:**
- Score range: 0-100
- Calculated via `computeRankScore()`
- Based on: liquidity, volume, holder count, launchpad, safety metrics

**Downranking:**
- If score < 30 and action is 'allow' → action becomes 'downrank'
- Downranked tokens still shown, but lower in list

---

## Integration

### Terminal → Discover

- "Discover" button in TerminalShell
- Calls `useDiscoverStore().openOverlay()`
- Overlay opens without page reload

### Discover → Terminal

- Token card click calls `terminalStore.setPair()`
- Pair set with:
  - `baseMint`: token.mint
  - `quoteMint`: USDC (default)
  - `baseSymbol`: token.symbol
  - `quoteSymbol`: 'USDC'
- Overlay closes after pair is set
- Quote fetch triggered automatically

---

## UI Components

- **Drawer** (vaul) - Overlay container
- **Tabs** (Radix) - Tab navigation
- **Card** - Token cards + filter panel
- **ScrollArea** - Virtualized list container
- **Badge** - Reason chips + score badges
- **Select** - Preset + filter dropdowns
- **Checkbox** - Launchpad multi-select
- **Input** - Search + min liquidity

---

## Data Source

**Current Implementation:**
- `discoverService.getTokens()` calls `/api/discover/tokens`
- Returns empty array if endpoint not available (graceful fallback)
- Ready for backend integration

**Required Endpoint:**
```
GET /api/discover/tokens
Response: Token[] (normalized Token[] matching filter/types.ts schema)
```

**Note:** For MVP testing, mock data can be added in `discoverService.ts`.

---

## Performance

- **Memoized Evaluation:** Token evaluation memoized per filter change
- **ScrollArea:** Handles 200+ tokens smoothly
- **Virtualization:** Consider `@tanstack/react-virtual` for 500+ tokens

---

## Testing Checklist

### Manual Verification

1. **Overlay Behavior:**
   - [ ] Overlay opens without page reload
   - [ ] Overlay dismissible (ESC, click outside, close button)
   - [ ] Token click → pair set in Terminal → overlay closes

2. **Tabs & Defaults:**
   - [ ] Not Bonded tab shows default preset
   - [ ] Bonded tab shows default preset
   - [ ] Ranked tab shows default preset
   - [ ] Tab switch resets to default preset

3. **Filters:**
   - [ ] Launchpad multi-select works
   - [ ] Time window selector works
   - [ ] Min liquidity input works
   - [ ] Search input works (symbol/name/mint)
   - [ ] Preset selector works

4. **Token Display:**
   - [ ] Symbol / name shown
   - [ ] Liquidity metric shown
   - [ ] Volume metric shown
   - [ ] Holder count shown
   - [ ] Launchpad badge shown
   - [ ] Up to 2 reason chips shown
   - [ ] Score badge shown (ranked tab only)

5. **Performance:**
   - [ ] 200+ tokens scroll smoothly
   - [ ] Filter changes don't freeze UI
   - [ ] Scrolling remains smooth

---

## Known Limitations

1. **Virtualization:** Currently using `ScrollArea`. For 500+ tokens, consider true virtualization.
2. **Data Source:** `/api/discover/tokens` endpoint not yet implemented (returns empty array gracefully).
3. **Quick Amount Buttons:** In Terminal, still using placeholder logic.

---

## Related Documentation

- [Terminal](../docs/TERMINAL.md) - Terminal integration
- [Architecture](../docs/ARCHITECTURE.md) - System architecture
- [QA](../docs/QA.md) - Testing procedures


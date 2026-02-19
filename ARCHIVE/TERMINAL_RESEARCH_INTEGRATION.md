# Trading Terminal + Research Tab → Integration Concept

**Datum:** 2024-12-19  
**Status:** Audit & Konzept abgeschlossen  
**Ziel:** Trading Terminal in Research Tab einbetten für Research + Execution Workspace

---

## 1. Findings (Bestehende Architektur)

### 1.1 Routen & Navigation
- **Research Route:** `/research` (optional: `/research/:assetId`)
  - Datei: `src/pages/Research.tsx`
  - URL-State: `?view=chart&q=<symbol>&panel=watchlist&replay=true`
  - Layout: `AppShell` → `PageContainer` → Research Workspace
  
- **Terminal Route:** `/terminal` (standalone)
  - Datei: `src/pages/Terminal.tsx` → `TerminalShell`
  - Layout: `AppShell` → `PageContainer` → Terminal Shell

- **Shared Layout:** `AppShell` (Sidebar, Header, BottomNav)
  - Datei: `src/components/layout/AppShell.tsx`
  - Responsive: Desktop (Sidebar) + Mobile (BottomNav)

### 1.2 Terminal Module
- **TerminalShell** (`src/components/terminal/TerminalShell.tsx`)
  - Top Bar: Wallet + PairSelector + Discover Button
  - Main: ChartPanel (links) + ExecutionPanel (rechts, w-96)
  - Bottom: TxStatusToast (global toast notifications)
  
- **ExecutionPanel** (`src/components/terminal/ExecutionPanel.tsx`)
  - OrderForm (Buy/Sell, Amount, Slippage, Priority Fee)
  - FeePreviewCard (Expected Out, Min Out, Fee, Price Impact)
  
- **ChartPanel** (`src/components/terminal/ChartPanel.tsx`)
  - Aktuell: Placeholder (zeigt nur Pair-Label)
  - Props: `baseMint`, `quoteMint`
  
- **TerminalStore** (`src/lib/state/terminalStore.ts`)
  - Zustand: `pair: TerminalPair | null`
  - Actions: `setPair()`, `setSide()`, `setAmountValue()`, `executeSwap()`
  - Auto-Quote: `setPair()` triggert `scheduleQuoteFetch()`
  
- **PairSelector** (`src/components/terminal/PairSelector.tsx`)
  - Hardcoded: `STARTER_PAIRS` (SOL/USDC, USDT/USDC, mSOL/USDC)
  - Setzt Pair via `terminalStore.setPair()`

### 1.3 Research Tab UI
- **Layout-Struktur:**
  - Top: ChartTopBar (Symbol, Timeframe, Replay Toggle)
  - Action Bar: Watchlist Toggle, Start Research Button, MarketsBanner
  - Main: Watchlist Panel (links, optional) + Chart Canvas (center) + ResearchToolsPanel (rechts, lg+)
  - Bottom: ChartFeedPanel, BottomCardsCarousel
  - Collapsible: ResearchTerminal (LLM-Terminal, nicht Trading-Terminal!)
  
- **State Management:**
  - `selectedSymbol: string | null` (aus `useChartStub()`)
  - URL-Sync: `?q=<symbol>` → `setSelectedSymbol()`
  - Watchlist: localStorage-basiert
  
- **Chart Workspace:**
  - `ChartCanvas` (zeigt Chart für `selectedSymbol`)
  - `DrawingToolbar` (Elliott Wave, Rectangle, etc.)
  - `ResearchToolsPanel` (Indicators, Drawings)

### 1.4 Data & State Flow
- **Research → Terminal Mapping:**
  - Problem: Research verwendet `symbol: string` (z.B. "SOL")
  - Terminal benötigt `TerminalPair` mit `baseMint` + `quoteMint` (Solana-Adressen)
  - Lösung: Symbol → Mint Mapping erforderlich (siehe `getWellKnownMint()` in `assetResolver.ts`)
  
- **Discover Overlay Integration:**
  - `DiscoverTokenCard` setzt Pair via `terminalStore.setPair()` (Zeile 22-27)
  - Deep-Link funktioniert bereits: Token Click → `setPair()` → Quote Refresh
  
- **State-Konflikt:**
  - Research: `selectedSymbol` (String, aus ChartStub)
  - Terminal: `pair` (TerminalPair, aus terminalStore)
  - Keine automatische Synchronisation vorhanden

---

## 2. Recommended Integration Variant

### Variante 2: Bottom Drawer Terminal (Collapsible) ✅ EMPFOHLEN

**Layout:**
```
┌─────────────────────────────────────────┐
│ ChartTopBar                             │
├─────────────────────────────────────────┤
│ Action Bar (Watchlist, Markets)         │
├─────────────────────────────────────────┤
│                                         │
│  Chart Canvas (Research)                │
│  (Drawing Tools, Indicators)            │
│                                         │
├─────────────────────────────────────────┤
│ [▼ Terminal] (Collapsible Trigger)     │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Terminal Execution Panel            │ │
│ │ ┌─────────────┬───────────────────┐ │ │
│ │ │ ChartPanel  │ ExecutionPanel     │ │ │
│ │ │ (embedded)  │ (OrderForm, Fees) │ │ │
│ │ └─────────────┴───────────────────┘ │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Warum diese Variante:**
- ✅ Research-Kontext bleibt sichtbar (Chart oben)
- ✅ Terminal kann bei Bedarf erweitert werden
- ✅ Mobile-freundlich (Drawer-Pattern)
- ✅ Minimal-invasive Änderungen (nutzt bestehendes Collapsible-Pattern)
- ✅ Keine Chart-Konflikte (Terminal Chart ist separater Bereich)
- ✅ Konsistent mit bestehendem ResearchTerminal Collapsible

**Alternative Varianten (verworfen):**
- ❌ Split View (Research links, Terminal rechts): Zu viel horizontaler Platz, mobile Probleme
- ❌ Tabbed Execution Panel: Zu klein für OrderForm + Chart, schlechte UX

---

## 3. Architecture & State Contract

### 3.1 Single Source of Truth: Terminal Store bleibt autoritativ

**Entscheidung:** `terminalStore.pair` bleibt die autoritative Quelle für Pair-Auswahl.

**Begründung:**
- Terminal-Logik (Quote, Swap) hängt von `pair` ab
- Research kann Pair setzen, aber Terminal kontrolliert Execution
- Vermeidet zirkuläre Updates (Research → Terminal → Research)

### 3.2 Shared State Interface

```typescript
// Minimal Interface für Research → Terminal Sync
interface ResearchTerminalSync {
  // Research setzt Pair (wenn Symbol → Mint konvertiert werden kann)
  syncPairFromSymbol: (symbol: string, quoteMint?: string) => void;
  
  // Terminal meldet Pair-Änderungen zurück (optional, für URL-Sync)
  onPairChange?: (pair: TerminalPair | null) => void;
}
```

**Implementierung:**
- Research: `selectedSymbol` → `syncPairFromSymbol()` → `terminalStore.setPair()`
- Terminal: `pair` Änderungen → optional URL-Sync (nicht zwingend für MVP)

### 3.3 Symbol → Mint Mapping

**Problem:** Research verwendet Symbol-Strings ("SOL"), Terminal benötigt Mint-Adressen.

**Lösung:** Symbol → Mint Resolver (nutzt bestehende Infrastruktur)

```typescript
// Nutze bestehende getWellKnownMint() Logik
// Erweitere um Jupiter Token Registry Lookup (falls nötig)
function resolveSymbolToMint(symbol: string): string | null {
  // 1. Well-known mints (SOL, USDC, USDT, etc.)
  // 2. Jupiter Token Registry (falls verfügbar)
  // 3. Fallback: null (keine Konvertierung möglich)
}
```

**Fallback-Strategie:**
- Wenn Symbol → Mint nicht möglich: Terminal bleibt leer, User kann Pair manuell wählen
- Discover Overlay kann weiterhin Pair direkt setzen (hat bereits Mint)

---

## 4. Component Composition Plan

### 4.1 Wiederverwendete Komponenten (as-is)
- ✅ `ExecutionPanel` (OrderForm + FeePreviewCard)
- ✅ `OrderForm` (Buy/Sell Toggle, Amount Input, Slippage, Priority Fee)
- ✅ `FeePreviewCard` (Quote Preview)
- ✅ `TxStatusToast` (Transaction Notifications)
- ✅ `ChartPanel` (Terminal Chart, wenn implementiert)
- ✅ `PairSelector` (optional, kann in Research TopBar integriert werden)

### 4.2 Neue Wrapper-Komponenten

**1. `EmbeddedTerminal`** (`src/components/terminal/EmbeddedTerminal.tsx`)
```typescript
interface EmbeddedTerminalProps {
  // Optional: Initial Pair (wird von Research gesetzt)
  initialPair?: TerminalPair | null;
  
  // Optional: Callback wenn Pair geändert wird
  onPairChange?: (pair: TerminalPair | null) => void;
  
  // Compact Mode (reduziert Padding, kleineres Chart)
  compact?: boolean;
}
```

**Zweck:**
- Wrapper um TerminalShell-Logik ohne TopBar (Wallet/PairSelector)
- Integriert Wallet + Connection aus React Context
- Zeigt nur ExecutionPanel + ChartPanel

**2. `ResearchTerminalSync`** (`src/components/Research/ResearchTerminalSync.tsx`)
```typescript
interface ResearchTerminalSyncProps {
  selectedSymbol: string | null;
  onPairChange?: (pair: TerminalPair | null) => void;
}
```

**Zweck:**
- Sync-Logik: `selectedSymbol` → `terminalStore.setPair()`
- Nutzt Symbol → Mint Resolver
- Optional: URL-Sync für Pair (nicht zwingend für MVP)

### 4.3 Layout-Integration

**Research.tsx Änderungen:**
- Ersetze `ResearchTerminal` Collapsible durch `EmbeddedTerminal` Collapsible
- Füge `ResearchTerminalSync` hinzu (unsichtbar, nur für State-Sync)
- Optional: PairSelector in ChartTopBar integrieren (ersetzt manuelles Symbol-Eingabe)

**TerminalShell.tsx:**
- Bleibt unverändert (standalone Route funktioniert weiterhin)
- Optional: `compact` Prop für embedded Mode (später)

---

## 5. Routing Plan

### 5.1 Standalone Route bleibt erhalten
- `/terminal` Route bleibt funktionsfähig
- `TerminalShell` wird nicht geändert
- Backward Compatibility gewährleistet

### 5.2 Embedded Terminal in Research
- Keine neue Route erforderlich
- Terminal wird als Komponente in Research gerendert
- Kein Page Reload (React Component Composition)

### 5.3 Lazy Loading (optional, später)
- Terminal-Komponenten können lazy-loaded werden
- Reduziert initial Bundle Size
- Nicht kritisch für MVP

---

## 6. Step-by-Step Implementation Tasks

### Phase 1: Symbol → Mint Resolver (Foundation)
**Datei:** `src/lib/trading/symbolResolver.ts` (neu)

**Tasks:**
- [ ] Erstelle `resolveSymbolToMint(symbol: string): string | null`
- [ ] Nutze `getWellKnownMint()` Logik (aus `assetResolver.ts`)
- [ ] Optional: Jupiter Token Registry Integration (später)
- [ ] Tests: SOL → So1111..., USDC → EPjFWdd5...

**Acceptance Criteria:**
- ✅ `resolveSymbolToMint("SOL")` → `"So11111111111111111111111111111111111111112"`
- ✅ `resolveSymbolToMint("USDC")` → `"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"`
- ✅ `resolveSymbolToMint("UNKNOWN")` → `null`

---

### Phase 2: ResearchTerminalSync Component
**Datei:** `src/components/Research/ResearchTerminalSync.tsx` (neu)

**Tasks:**
- [ ] Erstelle Component mit `selectedSymbol` Prop
- [ ] Implementiere `useEffect` für Symbol → Pair Sync
- [ ] Nutze `resolveSymbolToMint()` + `terminalStore.setPair()`
- [ ] Optional: `onPairChange` Callback für URL-Sync

**Acceptance Criteria:**
- ✅ Wenn `selectedSymbol="SOL"` → `terminalStore.pair` wird auf SOL/USDC gesetzt
- ✅ Wenn `selectedSymbol=null` → `terminalStore.pair` bleibt unverändert
- ✅ Keine zirkulären Updates (nur Research → Terminal, nicht umgekehrt)

---

### Phase 3: EmbeddedTerminal Component
**Datei:** `src/components/terminal/EmbeddedTerminal.tsx` (neu)

**Tasks:**
- [ ] Erstelle Wrapper um Terminal-Logik
- [ ] Nutze `useConnection()` + `useWallet()` aus React Context
- [ ] Rendere `ChartPanel` + `ExecutionPanel` (ohne TopBar)
- [ ] Optional: `compact` Prop für reduziertes Padding
- [ ] Integriere `TxStatusToast` (global)

**Layout:**
```tsx
<div className="flex flex-col gap-4">
  <div className="flex gap-4">
    <div className="flex-1">
      <ChartPanel baseMint={pair?.baseMint} quoteMint={pair?.quoteMint} />
    </div>
    <div className="w-96">
      <ExecutionPanel wallet={wallet} connection={connection} />
    </div>
  </div>
  <TxStatusToast />
</div>
```

**Acceptance Criteria:**
- ✅ Rendert ChartPanel + ExecutionPanel korrekt
- ✅ Wallet + Connection aus Context verfügbar
- ✅ Pair aus `terminalStore` gelesen
- ✅ Keine TopBar (Wallet/PairSelector) im embedded Mode

---

### Phase 4: Research.tsx Integration
**Datei:** `src/pages/Research.tsx` (modifizieren)

**Tasks:**
- [ ] Importiere `EmbeddedTerminal` + `ResearchTerminalSync`
- [ ] Ersetze `ResearchTerminal` Collapsible durch `EmbeddedTerminal` Collapsible
- [ ] Füge `ResearchTerminalSync` hinzu (unsichtbar, vor return)
- [ ] Optional: PairSelector in ChartTopBar integrieren (später)

**Änderungen:**
```tsx
// Vor return in ResearchWorkspace:
<ResearchTerminalSync selectedSymbol={selectedSymbol} />

// Im Layout (ersetzt ResearchTerminal Collapsible):
<Collapsible open={terminalOpen} onOpenChange={setTerminalOpen}>
  <CollapsibleTrigger>...</CollapsibleTrigger>
  <CollapsibleContent>
    <EmbeddedTerminal />
  </CollapsibleContent>
</Collapsible>
```

**Acceptance Criteria:**
- ✅ Terminal erscheint als Collapsible unter Chart
- ✅ `selectedSymbol` wird automatisch zu Pair konvertiert
- ✅ Terminal kann Pair manuell ändern (via PairSelector, wenn integriert)
- ✅ Research Chart bleibt oben sichtbar

---

### Phase 5: PairSelector Integration (Optional, später)
**Datei:** `src/components/chart/ChartTopBar.tsx` (modifizieren)

**Tasks:**
- [ ] Füge PairSelector neben Symbol-Anzeige hinzu
- [ ] Sync: PairSelector → `terminalStore.setPair()`
- [ ] Optional: Symbol-Anzeige aus `terminalStore.pair.baseSymbol` lesen

**Acceptance Criteria:**
- ✅ PairSelector erscheint in ChartTopBar
- ✅ Pair-Änderung aktualisiert Terminal + Research Chart (wenn möglich)

---

### Phase 6: Testing & Edge Cases
**Tasks:**
- [ ] Test: Research Symbol → Terminal Pair Sync
- [ ] Test: Terminal Pair → Research Symbol Sync (optional)
- [ ] Test: Mobile Layout (Terminal Drawer)
- [ ] Test: Discover Overlay → Research Terminal (Deep-Link)
- [ ] Test: Wallet nicht verbunden (Terminal zeigt Connect Button)
- [ ] Test: Unbekanntes Symbol (keine Konvertierung möglich)

**Acceptance Criteria:**
- ✅ Alle Tests bestehen
- ✅ Keine Layout-Brüche auf Mobile
- ✅ Discover Deep-Link funktioniert
- ✅ Wallet-Status wird korrekt angezeigt

---

## 7. Risk & Edge Cases

### 7.1 Layout Breakpoints (Mobile)
**Risiko:** Terminal ExecutionPanel (w-96) zu breit für Mobile

**Lösung:**
- Mobile: ExecutionPanel full-width, ChartPanel darunter
- Nutze `useIsMobile()` Hook (bereits vorhanden)
- Responsive Layout: `flex-col` auf Mobile, `flex-row` auf Desktop

**Code:**
```tsx
const isMobile = useIsMobile();
<div className={isMobile ? "flex flex-col gap-4" : "flex gap-4"}>
  {isMobile ? (
    <>
      <ChartPanel ... />
      <ExecutionPanel ... />
    </>
  ) : (
    <>
      <div className="flex-1"><ChartPanel ... /></div>
      <div className="w-96"><ExecutionPanel ... /></div>
    </>
  )}
</div>
```

---

### 7.2 Wallet Provider Availability
**Risiko:** Wallet Provider nicht verfügbar in nested Routes

**Status:** ✅ Kein Problem
- `useWallet()` + `useConnection()` kommen aus React Context
- Context ist in `AppShell` oder höher gemountet
- Terminal kann Wallet in Research Tab nutzen

---

### 7.3 Discover Overlay Interactions
**Risiko:** Discover Overlay Deep-Link funktioniert nicht in Research Tab

**Status:** ✅ Funktioniert bereits
- `DiscoverTokenCard` setzt Pair via `terminalStore.setPair()`
- Terminal reagiert automatisch (Quote Refresh)
- Research Terminal zeigt Pair an (via `EmbeddedTerminal`)

**Optional Enhancement:**
- Wenn Pair in Research Tab gesetzt wird → Research Chart auf Symbol aktualisieren (falls Symbol verfügbar)

---

### 7.4 Circular State Updates
**Risiko:** Research → Terminal → Research → Terminal (Endlosschleife)

**Lösung:**
- **Einseitige Sync:** Nur Research → Terminal (nicht umgekehrt)
- **Terminal bleibt autoritativ:** Terminal kann Pair ändern, Research reagiert nicht automatisch
- **Optional URL-Sync:** Wenn Terminal Pair ändert → URL `?q=<symbol>` aktualisieren (nur wenn Symbol bekannt)

**Implementierung:**
```tsx
// ResearchTerminalSync: Nur Research → Terminal
useEffect(() => {
  if (selectedSymbol) {
    const mint = resolveSymbolToMint(selectedSymbol);
    if (mint) {
      terminalStore.setPair({ baseMint: mint, quoteMint: USDC_MINT, ... });
    }
  }
}, [selectedSymbol]); // Nur selectedSymbol als Dependency

// Terminal → Research Sync (optional, später):
// Nur wenn User explizit Pair in Terminal ändert UND Symbol bekannt ist
```

---

### 7.5 Chart Conflict (Research Chart vs Terminal Chart)
**Risiko:** Zwei Charts zeigen unterschiedliche Daten

**Status:** ✅ Kein Problem
- Research Chart: Zeigt `selectedSymbol` (String-basiert)
- Terminal Chart: Zeigt `pair.baseMint/quoteMint` (Mint-basiert)
- Beide können unterschiedlich sein (z.B. Research: "SOL", Terminal: "USDT/USDC")
- User kann beide Charts unabhängig nutzen

**Optional Enhancement:**
- Wenn Pair gesetzt wird → Research Chart auf entsprechendes Symbol aktualisieren (falls Mapping möglich)

---

## 8. Open Questions

### Q1: Soll Terminal Pair → Research Symbol Sync implementiert werden?
**Antwort:** Nein, für MVP nicht erforderlich.
- Research kann Pair setzen (Symbol → Mint)
- Terminal kann Pair ändern (manuell via PairSelector)
- Bidirektionale Sync ist komplex und nicht kritisch für MVP

**Später:** Optional URL-Sync: `/research?q=SOL&pair=SOL/USDC`

---

### Q2: Soll PairSelector in Research ChartTopBar integriert werden?
**Antwort:** Optional, später.
- MVP: Terminal kann Pair manuell ändern (wenn Terminal geöffnet ist)
- Enhancement: PairSelector in TopBar für schnelleren Zugriff

---

### Q3: Soll Terminal Chart mit Research Chart synchronisiert werden?
**Antwort:** Nein.
- Research Chart: Für Analyse (Timeframe, Indicators, Drawings)
- Terminal Chart: Für Execution (Price Action, Order Placement)
- Beide können unterschiedliche Zwecke erfüllen

---

## 9. Definition of Done

### Functional Requirements
- ✅ Terminal erscheint als Collapsible in Research Tab
- ✅ Research Symbol → Terminal Pair Sync funktioniert (für bekannte Symbole)
- ✅ Terminal Execution (OrderForm, Swap) funktioniert in Research Tab
- ✅ Wallet + Connection verfügbar in Research Tab
- ✅ Discover Overlay Deep-Link funktioniert
- ✅ Standalone `/terminal` Route funktioniert weiterhin

### Quality Requirements
- ✅ Keine Layout-Brüche auf Mobile
- ✅ Keine zirkulären State-Updates
- ✅ Terminal-Logik bleibt unverändert (keine Refactor erforderlich)
- ✅ Backward Compatibility: `/terminal` Route funktioniert

### Performance Requirements
- ✅ Keine Performance-Regression (Terminal lazy-loading optional)
- ✅ Memo-Boundaries für Terminal-Komponenten (später)

---

## 10. Migration Strategy (Safe Rollout)

### Step 1: Foundation (Symbol Resolver)
- Erstelle `symbolResolver.ts`
- Tests schreiben
- Keine Breaking Changes

### Step 2: Sync Component (ResearchTerminalSync)
- Erstelle Component
- Integriere in Research (unsichtbar)
- Test: Symbol → Pair Sync

### Step 3: Embedded Terminal (EmbeddedTerminal)
- Erstelle Component
- Test: Rendert korrekt, Wallet verfügbar

### Step 4: Research Integration
- Ersetze ResearchTerminal durch EmbeddedTerminal
- Test: Terminal erscheint, Execution funktioniert

### Step 5: Optional Enhancements
- PairSelector in TopBar
- Terminal → Research Sync
- URL-Sync für Pair

---

## 11. File Changes Summary

### New Files
- `src/lib/trading/symbolResolver.ts` - Symbol → Mint Resolver
- `src/components/Research/ResearchTerminalSync.tsx` - Sync-Logik
- `src/components/terminal/EmbeddedTerminal.tsx` - Embedded Terminal Wrapper

### Modified Files
- `src/pages/Research.tsx` - Integriert EmbeddedTerminal + ResearchTerminalSync
- `src/components/chart/ChartTopBar.tsx` - Optional: PairSelector Integration

### Unchanged Files (Backward Compatibility)
- `src/pages/Terminal.tsx` - Bleibt unverändert
- `src/components/terminal/TerminalShell.tsx` - Bleibt unverändert
- `src/lib/state/terminalStore.ts` - Bleibt unverändert
- `src/components/terminal/ExecutionPanel.tsx` - Bleibt unverändert
- `src/components/terminal/OrderForm.tsx` - Bleibt unverändert

---

**Ende des Konzepts**


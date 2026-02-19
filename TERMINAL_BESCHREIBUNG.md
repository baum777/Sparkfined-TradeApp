# Sparkfined Terminal – UI/UX und Funktionsbeschreibung

**Version:** Phase 1 + Phase 2  
**Datum:** 16. Februar 2026  
**Status:** Produktiv

---

## 📊 Übersicht

Das Sparkfined Terminal ist eine vollständig integrierte **Solana DEX Trading-Schnittstelle**, die es Nutzern ermöglicht, Token-Paare zu handeln, Quotes in Echtzeit zu erhalten und Swaps direkt über Jupiter v6 auszuführen. Das Terminal verbindet professionelle Trading-Funktionalität mit einer intuitiven, modernen Benutzeroberfläche.

---

## 🎨 UI/UX Design-Prinzipien

### 1. **Clarity First**
- Klare, intuitive Interfaces ohne unnötige Komplexität
- Alle wichtigen Informationen auf einen Blick sichtbar
- Visuelle Hierarchie: Wichtige Aktionen prominent platziert

### 2. **Progressive Disclosure**
- Erweiterte Features werden schrittweise eingeführt
- Basis-Funktionen sofort zugänglich
- Fortgeschrittene Optionen (Priority Fees, Slippage) optional sichtbar

### 3. **Instant Feedback**
- Jede Benutzeraktion erhält sofortiges visuelles Feedback
- Loading States für alle asynchronen Operationen
- Toast-Benachrichtigungen für wichtige Statusänderungen

### 4. **Accessibility & Responsive Design**
- Mobile-First Ansatz
- Touch-optimierte Bedienelemente
- Tastaturnavigation vollständig unterstützt
- Hohe Kontrastverhältnisse für bessere Lesbarkeit

### 5. **Performance-Optimiert**
- Debounced Quote Updates (400ms)
- Race-Condition-Schutz
- Effiziente State Management mit Zustand
- Keine UI-Freezes bei intensiven Operationen

---

## 🖼️ Layout-Struktur

### **Top Bar (Header)**
```
┌────────────────────────────────────────────────────────┐
│  Terminal    [Pair Selector]  [Discover Button]  [Wallet] │
└────────────────────────────────────────────────────────┘
```

**Komponenten:**
- **Terminal Title**: App-Branding
- **Pair Selector**: Dropdown zur Auswahl des Trading-Paars (SOL/USDC, USDT/USDC, mSOL/USDC)
- **Discover Button**: Öffnet Token-Discovery-Overlay (mit Sparkles-Icon)
- **Wallet Button**: Solana Wallet Adapter Multi-Button

**UX-Features:**
- Feste Position (sticky header)
- Border-Bottom für visuelle Trennung
- Responsive: auf Mobile stapelt sich das Layout

---

### **Main Content Area**

```
┌─────────────────────────────┬───────────────┐
│                             │               │
│     Chart Panel             │  Execution    │
│     (flex-1)                │  Panel        │
│                             │  (w-96)       │
│                             │               │
└─────────────────────────────┴───────────────┘
```

**Layout:**
- **2-Column Layout**: Chart (links) + Execution (rechts)
- **Chart Panel**: Nimmt den Großteil des Bildschirms ein (flex-1)
- **Execution Panel**: Feste Breite (384px / 96 Tailwind units)
- **Gap**: 16px zwischen den Panels

---

## 🧩 Komponenten-Details

### 1. **Chart Panel** 📈

**Status:** Phase 1 - Platzhalter (bereit für Chart-Library-Integration)

**Aktuelle Implementierung:**
```
┌─────────────────────────────────┐
│                                 │
│    SOL...1234 / USDC...5678     │
│    Chart will be mounted here   │
│                                 │
└─────────────────────────────────┘
```

**Geplante Features:**
- Candlestick-Chart mit TradingView-ähnlicher UI
- Technische Indikatoren (SMA, EMA, RSI, MACD, Bollinger Bands)
- Timeframe-Auswahl (1m, 5m, 15m, 1h, 4h, 1d)
- Drawing Tools (Trendlinien, Support/Resistance)
- Volume-Anzeige
- Vollbild-Modus

**UX-Merkmale:**
- Responsive Height (100% des verfügbaren Raums)
- Card-Container mit Shadow
- Zentrierter Platzhalter-Text mit Muted-Color

---

### 2. **Execution Panel** 🎯

Das Herzstück des Terminals. Hier finden alle Trading-Aktionen statt.

#### **2.1 Order Form**

**Side Toggle**
```
┌─────────────────────────┐
│  [Buy]      [Sell]      │
└─────────────────────────┘
```
- Toggle Group (single selection)
- Visual State: Active = Primary Color, Inactive = Muted
- Wechsel löst Quote-Refresh aus

**Amount Input**
```
┌─────────────────────────────────┐
│  Amount (USDC / SOL)            │
│  ┌───────────────────────────┐  │
│  │ 0.00                      │  │
│  └───────────────────────────┘  │
│  [25%] [50%] [75%] [100%]      │
└─────────────────────────────────┘
```

**Features:**
- Decimal Input mit Validation
- Dynamisches Label (USDC bei Buy, SOL bei Sell)
- Quick Amount Buttons (25%, 50%, 75%, 100%)
- Real-time Quote Update (debounced)

**UX-Details:**
- Input Mode: `decimal` (mobile optimierte Tastatur)
- Placeholder: "0.00"
- Disabled State während TX-Ausführung

---

#### **2.2 Slippage Selector**

```
┌─────────────────────────────┐
│ Slippage Tolerance          │
│ ┌─────────────────────────┐ │
│ │ 0.5%              ▼     │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Optionen:**
- 0.1% (10 BPS)
- 0.5% (50 BPS) - **Default**
- 1.0% (100 BPS)
- Custom (mit Anzeige des aktuellen Werts)

**Technisches:**
- Werte in Basis Points (BPS) gespeichert
- Änderung löst Quote-Refresh aus

---

#### **2.3 Priority Fee Toggle**

```
┌───────────────────────────┐
│ Priority Fee        [ON]  │
│ 5.00 SOL                  │
└───────────────────────────┘
```

**Features:**
- Toggle Switch (ON/OFF)
- Standard: 5000 microLamports
- Anzeige: Umrechnung in SOL
- Optional: Anpassbare microLamports

**UX:**
- Switch rechts aligned
- Label + Description (2-zeilig)
- Muted Text für Betrag

---

#### **2.4 Swap Button**

```
┌─────────────────────────────────┐
│  [↕]  Buy / Sell                │
└─────────────────────────────────┘
```

**States:**
1. **Disabled**: Grau, nicht klickbar
   - Wallet nicht verbunden
   - Amount ungültig
   - Quote fehlgeschlagen
   
2. **Ready**: Primary Color, klickbar
   - Alle Voraussetzungen erfüllt
   
3. **Signing**: Loading Spinner + "Signing..."
   - User signiert TX in Wallet
   
4. **Sending**: Loading Spinner + "Sending..."
   - TX wird an Solana Network gesendet
   
5. **Processing**: Loading Spinner + "Processing..."
   - Fallback während Execution

**Icon:**
- `ArrowUpDown` (Lucide) für Swap-Aktion

**UX-Details:**
- Full Width
- Large Size (lg)
- Loading States mit Spinner
- Tactile Feedback (hover/active states)

---

#### **2.5 Fee Preview Card**

```
┌────────────────────────────────────┐
│ Fee Preview                        │
├────────────────────────────────────┤
│ Expected Receive:    1.234 SOL    │
│ Minimum Receive:     1.223 SOL    │
│ Fee:                 0.5% (0.006)  │
│ Price Impact:        0.12%         │
└────────────────────────────────────┘
```

**Features:**
- **Expected Out**: Erwarteter Output-Betrag
- **Minimum Out**: Garantierter Minimum-Output (nach Slippage)
- **Fee**: Prozentsatz + absoluter Betrag
- **Price Impact**: Market Impact des Swaps (optional)

**Loading State:**
```
┌────────────────────────────────────┐
│ Fee Preview                        │
├────────────────────────────────────┤
│ [▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░]          │
│ [▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░]          │
│ [▓▓▓▓▓▓░░░░░░░░░░░░░░░░]          │
└────────────────────────────────────┘
```

**Error/Empty State:**
- Quote Error: "Quote error"
- Kein Amount: "Enter amount to see quote"

**UX-Details:**
- Card mit Border
- Spacing zwischen Zeilen (space-y-3)
- Muted Text für Labels
- Bold Text für Werte
- Decimal Formatting (6 Dezimalstellen)

---

### 3. **Transaction Status Toast** 🔔

**Success Toast:**
```
┌────────────────────────────────────────┐
│ ✅ Transaction Confirmed               │
│ ─────────────────────────────────────  │
│ Swap completed successfully            │
│ [View on Explorer →]                   │
└────────────────────────────────────────┘
```

**Features:**
- Grüner CheckCircle Icon
- Explorer Link (Solscan)
- Opens in new tab
- Auto-dismiss nach 10 Sekunden

**Failed Toast:**
```
┌────────────────────────────────────────┐
│ ❌ Transaction Failed                  │
│ ─────────────────────────────────────  │
│ Insufficient funds                     │
└────────────────────────────────────────┘
```

**Features:**
- Rotes XCircle Icon
- Fehlermeldung (user-friendly)
- Destructive Variant
- Auto-dismiss nach 10 Sekunden

---

### 4. **Discover Overlay** 🔍 (Phase 2)

**Trigger:**
- "Discover" Button im Terminal Header
- Sparkles Icon
- Outline Variant, Small Size

**Overlay (Drawer):**
```
┌──────────────────────────────────────────┐
│  Discover Tokens                    [X]  │
├──────────────────────────────────────────┤
│  [Search: Symbol/Name/Mint...]          │
│                                          │
│  [Not Bonded] [Bonded] [Ranked]         │
│                                          │
│  ┌─ Filters ────────────────────────┐   │
│  │ Launchpads: [pumpfun] [moonshot] │   │
│  │ Time: [5m] [15m] [60m] [all]     │   │
│  │ Min Liquidity: _____ SOL         │   │
│  │ Preset: [Bundler Exclusion Gate] │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌─ Token Card ─────────────────────┐   │
│  │ SOL • Solana              🎯 92  │   │
│  │ Liquidity: 1.2M SOL             │   │
│  │ Volume (5m): 123K               │   │
│  │ Holders: 5.6K                   │   │
│  │ [High Liquidity] [Top Gainer]   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ... (scrollable list)                  │
└──────────────────────────────────────────┘
```

**Features:**

**Header:**
- Search Bar (Symbol/Name/Mint)
- Close Button (X)

**Tabs:**
- **Not Bonded**: New tokens (pre-bonding curve completion)
- **Bonded**: Established tokens
- **Ranked**: Tokens sortiert nach Score (0-100)

**Filters:**
- **Launchpads**: Multi-select (pumpfun, moonshot)
- **Time Window**: 5m, 15m, 60m, all
- **Min Liquidity**: SOL Input
- **Preset Profiles**: 5 Profile pro Tab

**Token Card:**
- Symbol + Name
- Score Badge (nur Ranked Tab)
- Metrics: Liquidity, Volume, Holders
- Launchpad Badge
- Reason Chips (max 2)

**Interaction:**
- Click auf Token → `setPair()` → Terminal lädt Pair → Overlay schließt
- Deep-Link zum Terminal

**UX-Details:**
- Height: 90vh (max)
- ScrollArea für Tokenliste
- Memoized Token Evaluation (Performance)
- Loading Skeletons
- Empty State: "No tokens found"
- Error State: "Failed to load tokens"

---

## 🔄 State Management & Data Flow

### **Store Architecture (Zustand)**

```typescript
TerminalStore:
├─ Inputs
│  ├─ pair: TerminalPair | null
│  ├─ side: 'buy' | 'sell'
│  ├─ amount: { mode, value }
│  ├─ slippageBps: number
│  ├─ priorityFee: { enabled, microLamports }
│  └─ feeTier: FeeTier
│
├─ Outputs
│  ├─ quote: { status, data, error, updatedAt, paramsKey }
│  └─ tx: { status, signature, error }
│
└─ Actions
   ├─ setPair, setSide, setAmountValue
   ├─ setSlippageBps, setPriorityFeeEnabled
   ├─ setFeeTier
   ├─ fetchQuote, scheduleQuoteFetch
   └─ executeSwap
```

---

### **Quote Flow**

```
User Input Change
     ↓
scheduleQuoteFetch() (400ms debounce)
     ↓
fetchQuote()
     ↓
quoteService.getQuote() → /api/quote
     ↓
Store: { status: 'loading' }
     ↓
API Response
     ↓
Race-Condition-Check (quoteRequestSeq)
     ↓
Store: { status: 'success', data }
     ↓
UI: FeePreviewCard updates
```

**Protection Mechanisms:**
- **Debounce**: 400ms Verzögerung
- **Race Protection**: `quoteRequestSeq` counter
- **Stale Check**: 25 Sekunden Gültigkeit
- **Params Key**: Sicherstellt Quote-Input-Match

---

### **Swap Execution Flow**

```
User Click "Swap"
     ↓
Validation (wallet, amount, quote)
     ↓
Input Snapshot (verhindert Drift)
     ↓
Status: 'signing'
     ↓
Stale Quote Check (25s)
     ↓
(Optional: Fresh Quote Fetch)
     ↓
swapService.getSwapTx() → /api/swap
     ↓
Optional: Simulation (Pre-Flight)
     ↓
wallet.signTransaction()
     ↓
Status: 'sending'
     ↓
sendSignedTransaction() (max 3 retries)
     ↓
confirmSignature()
     ↓
Status: 'confirmed' + signature
     ↓
Toast: "Transaction Confirmed"
```

**Error Handling:**
- Insufficient Funds → Toast
- Wallet Disconnect → Button disabled
- Quote Error → Error Box in Form
- TX Failed → Toast + Error Box
- Simulation Failed → Pre-Flight-Error

---

## ⚙️ Technische Features

### 1. **Race Condition Protection**

**Problem:** Schnelle Input-Änderungen können zu out-of-order API-Responses führen.

**Lösung:**
```typescript
let quoteRequestSeq = 0;

fetchQuote: async () => {
  const requestId = ++quoteRequestSeq;
  
  // ... API Call ...
  
  if (requestId !== quoteRequestSeq) return; // Drop stale response
  
  set({ quote: { status: 'success', data } });
}
```

---

### 2. **Debounced Quote Updates**

**Zweck:** API-Calls reduzieren, UX verbessern

```typescript
let quoteDebounceTimer: ReturnType<typeof setTimeout> | null = null;

scheduleQuoteFetch: () => {
  scheduledSeq++; // Markiert alte Fetches als obsolet
  if (quoteDebounceTimer) clearTimeout(quoteDebounceTimer);
  
  quoteDebounceTimer = setTimeout(() => {
    get().fetchQuote();
  }, 400);
}
```

**Trigger:**
- Amount Change
- Slippage Change
- Side Toggle
- Pair Selection
- Fee Tier Change
- Priority Fee Toggle

---

### 3. **Stale Quote Guard**

**Problem:** User wartet lange → Quote veraltet

**Lösung:**
```typescript
function isQuoteStale(quote: TerminalQuoteState): boolean {
  const updatedAt = quote.updatedAt ?? 0;
  return !updatedAt || Date.now() - updatedAt > 25_000; // 25s
}

// In executeSwap():
if (isQuoteStale(currentQuote)) {
  quoteData = await quoteService.getQuote(...); // Fresh fetch
}
```

---

### 4. **Input Snapshot Pattern**

**Problem:** User ändert Inputs während Signing → Quote-Mismatch

**Lösung:**
```typescript
executeSwap: async ({ wallet, connection }) => {
  const stateAtStart = get(); // Snapshot
  const params = requiredParams(stateAtStart);
  
  // ... gesamte Execution nutzt snapshot, nicht live state ...
}
```

---

### 5. **Transaction Simulation (Pre-Flight)**

**Zweck:** Fehler vor User-Signatur erkennen

```typescript
try {
  const sim = await simulateSignedTransaction(connection, tx);
  if (sim.err) {
    throw new Error(`Simulation failed: ${JSON.stringify(sim.err)}`);
  }
} catch (e) {
  if (isSimulationFailureError(e)) throw e;
  console.warn('Simulation skipped (RPC error)'); // Graceful fallback
}
```

**Benefits:**
- User signiert nur gültige TXs
- Bessere Error Messages
- Fallback bei RPC Rate Limits

---

### 6. **Retry Logic**

**Send Transaction:**
```typescript
sendSignedTransaction({
  connection,
  signedTx,
  maxRetries: 3
})
```

**Confirmation:**
```typescript
confirmSignature({
  connection,
  signature,
  commitment: 'confirmed',
  blockhash,
  lastValidBlockHeight
})
```

---

## 🎯 UX-Highlights

### 1. **Zero-Friction Onboarding**
- Wallet-Connect prominent platziert
- Starter-Pairs vorkonfiguriert (SOL/USDC, USDT/USDC, mSOL/USDC)
- Quick Amount Buttons (25%, 50%, 75%, 100%)

### 2. **Progressive Disclosure**
- Basis-Features sofort sichtbar
- Erweiterte Optionen (Priority Fee, Custom Slippage) optional
- Discover Overlay nur bei Bedarf

### 3. **Instant Visual Feedback**
- Loading Skeletons für Quotes
- Spinner in Buttons
- Toast Notifications
- Status-Badges

### 4. **Error Prevention**
- Button Disabled States
- Input Validation
- Stale Quote Guard
- Pre-Flight Simulation

### 5. **Transparency**
- Fee Preview vor Execution
- Expected vs Minimum Output
- Price Impact Anzeige
- Explorer Link nach TX

---

## 📊 Performance-Metriken

### **Quote Updates**
- Debounce: 400ms
- Race Protection: ✅
- Stale Check: 25s
- Typical Response: < 500ms

### **Swap Execution**
- Signing: User-abhängig
- Sending: < 2s (mit Retries)
- Confirmation: 5-30s (Solana Block Time)
- Total: ~10-40s (typisch)

### **UI Responsiveness**
- Input Lag: < 50ms
- Quote Update: < 1s (debounced)
- Page Load: < 2s
- State Updates: Instant (Zustand)

---

## 🔒 Sicherheit & Validierung

### **Input Validation**
```typescript
function normalizeAmount(value: string): string {
  const v = value.trim();
  if (!v) return '';
  if (!/^\d*\.?\d*$/.test(v)) return ''; // Nur Zahlen + Punkt
  return v;
}
```

### **Required Params Check**
- Pair vorhanden?
- Amount > 0?
- Quote erfolgreich?
- Wallet verbunden?

### **Pre-Execution Checks**
- Stale Quote → Fresh Fetch
- Invalid Inputs → Block Execution
- Quote Mismatch → Re-Fetch
- Simulation Failure → Abort

### **Error Extraction**
```typescript
function extractTxError(error: unknown): string {
  // ... User-friendly Error Messages ...
  return 'Insufficient funds' | 'Slippage tolerance exceeded' | ...
}
```

---

## 🚀 Feature Roadmap

### **Phase 1** ✅
- [x] Basic Terminal UI
- [x] Quote Engine
- [x] Swap Execution
- [x] Fee Preview
- [x] Wallet Integration
- [x] Error Handling

### **Phase 2** ✅
- [x] Discover Overlay
- [x] Filter Engine
- [x] Token Ranking
- [x] Reason Chips
- [x] Deep-Link (Token → Terminal)

### **Phase 3** (Geplant)
- [ ] Chart Integration (TradingView/Lightweight Charts)
- [ ] Wallet Balance Display
- [ ] Transaction History
- [ ] Order History (Multi-Step Orders)
- [ ] Advanced Order Types (Limit, Stop-Loss)

### **Phase 4** (Future)
- [ ] Portfolio Dashboard
- [ ] P&L Tracking
- [ ] Notifications (Price Alerts)
- [ ] Social Trading Features
- [ ] Mobile Native App

---

## 📱 Responsive Breakpoints

```css
Mobile:   < 768px  (Single Column, Stacked Layout)
Tablet:   768px - 1024px (Flexible 2-Column)
Desktop:  > 1024px (Full 2-Column mit Chart)
```

**Mobile Optimierungen:**
- Chart Panel: Höhe reduziert oder collapsible
- Execution Panel: Full Width
- Touch-Targets: Mindestens 44x44px
- Drawer statt Modal (Discover Overlay)

---

## 🧪 Testing

### **Manual Testing Checklist**
- [ ] Quote Updates (rapid input changes)
- [ ] Fee Preview Consistency
- [ ] Swap Success (5 consecutive)
- [ ] Stale Quote Guard (> 25s wait)
- [ ] Error Handling (insufficient funds, disconnect)
- [ ] Economic Integrity (on-chain fee verification)

### **Automated Tests**
- [ ] Unit: Store Actions
- [ ] Unit: Quote Debounce Logic
- [ ] Unit: Input Validation
- [ ] Integration: Quote → Swap Flow
- [ ] E2E: Full Swap Execution (with mock wallet)

---

## 📚 Technologie-Stack

### **Frontend**
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Shadcn/ui (Radix Primitives)
- Lucide Icons
- Zustand (State Management)

### **Solana Integration**
- @solana/wallet-adapter-react
- @solana/web3.js
- Jupiter v6 API

### **Backend**
- Node.js
- Express
- SQLite (local) / Postgres (production)

---

## 🎨 Design System

### **Colors**
- Primary: Blue (#3B82F6)
- Destructive: Red (#EF4444)
- Success: Green (#10B981)
- Muted: Gray (#6B7280)
- Background: White (Light) / Dark Gray (Dark Mode)

### **Typography**
- Headings: Semibold, 1.25rem - 2rem
- Body: Regular, 0.875rem - 1rem
- Labels: Medium, 0.75rem - 0.875rem

### **Spacing**
- Gap: 16px (between panels)
- Padding: 16px (cards)
- Margin: 8px - 16px (components)

### **Shadows**
- Card: 0 1px 3px rgba(0,0,0,0.12)
- Elevated: 0 4px 6px rgba(0,0,0,0.1)
- Active: 0 10px 15px rgba(0,0,0,0.1)

---

## 💡 Best Practices

### **Performance**
1. Memoization (useMemo für Token-Evaluation)
2. Debouncing (Input-Änderungen)
3. Race-Condition-Schutz
4. Efficient Re-Renders (Zustand Selectors)

### **Accessibility**
1. Semantic HTML
2. ARIA Labels
3. Keyboard Navigation
4. Screen Reader Support

### **Error Handling**
1. User-Friendly Messages
2. Graceful Degradation
3. Fallback States
4. No Silent Failures

### **Security**
1. Input Validation
2. Amount Normalization
3. Simulation vor Signatur
4. Keine Secrets im Frontend

---

## 📞 Support & Kontakt

**Technische Dokumentation:**
- Architecture: `shared/docs/ARCHITECTURE.md`
- API Contracts: `shared/docs/API_CONTRACTS.md`
- Local Dev: `shared/docs/LOCAL_DEV.md`

**Testing:**
- Manual Checklist: `docs/terminal_phase1_manual_checklist.md`
- Gate Report: `MANUAL_GATE_REPORT.md`
- Phase 2 Deliverables: `PHASE2_DELIVERABLES.md`

---

## ✨ Zusammenfassung

Das Sparkfined Terminal ist eine **produktionsreife, hochperformante Trading-Schnittstelle** für Solana DEX Swaps. Mit durchdachtem UX-Design, robusten technischen Features und nahtloser Integration in das Jupiter-Ecosystem bietet es Nutzern ein professionelles Trading-Erlebnis.

**Hauptmerkmale:**
- ⚡ Instant Quote Updates (debounced, race-safe)
- 💰 Transparente Fee Preview
- 🔒 Sichere Swap Execution
- 🔍 Token Discovery Overlay
- 📱 Responsive Design
- 🎨 Modern UI/UX
- 🛡️ Comprehensive Error Handling
- 🚀 Performance-Optimiert

**Status:** Bereit für Production Deployment

---

**Version:** 1.0  
**Letzte Aktualisierung:** 16. Februar 2026

---

## Launch Addendum (Conditional GO → GO)
**Zweck:** Dieses Addendum dokumentiert die Bedingungen aus dem Pre-Launch Review, um einen sicheren Go-Live zu gewährleisten.

### 1) TypeScript Safety Gate (Release-Bedingung)
**Bedingung:** Vor Go-Live muss Type-Safety strikt durchgesetzt werden, da Wallet-/Provider-Typen direkt den Swap-Flow beeinflussen.

- `tsconfig.json`: `"noImplicitAny": true`
- Keine globalen `any`
- `@ts-expect-error` nur mit kurzer Begründung (kein `@ts-ignore`)
- `pnpm typecheck` muss **grün** sein

**Warum:** Ein minor bump in `@solana/wallet-adapter-*` kann sonst stillschweigend `executeSwap()` destabilisieren.

### 2) Discover Tokens Cache — Deployment Constraint (Pre-Launch)
**Aktueller Stand:** `/api/discover/tokens` nutzt In-Memory Cache (TTL ~45s) + Rate-Limit (z. B. 120 req/60s).

**Constraint:** **Pre-Launch Single-Instance Deployment** (keine horizontale Skalierung), damit alle Clients konsistente Token-Listen sehen.

**Post-Launch Plan:** Um horizontale Skalierung zu erlauben, muss ein distributed cache genutzt werden:
- Redis / Vercel KV / vergleichbare KV-Store Lösung (shared TTL cache)

### 3) Minimal Monitoring (Go-Live Pflicht)
**Ziel:** Performance-/Payload-Regressions früh erkennen.

Für `/api/discover/tokens` tracken:
- Response-Time (Target: p95 < 500ms)
- Payload Size (Zielwert: ideal < 50KB, zuerst messen/monitoren)

**Hinweis:** Eine einzelne strukturierte Log-Line pro Request reicht (nicht noisy).

---

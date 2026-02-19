## Sparkfined Terminal – Phase 1 Manual Flow Checklist

### Voraussetzungen (Env)

- **RPC**
  - **`VITE_SOLANA_RPC_URL`**: bevorzugt (voller RPC URL)
  - Fallback: **`VITE_SOLANA_CLUSTER`** = `mainnet-beta` | `devnet`
- **Wichtig: Cluster/Pairs müssen zusammenpassen**
  - Wenn dein RPC auf **Devnet** zeigt, darfst du keine **Mainnet**-Mints als Pair testen (sonst wirken Quote/Swap „random broken“, weil Tokens auf dem Cluster nicht existieren).
  - Wenn du **Jupiter v6** via `https://quote-api.jup.ag/v6` nutzt, ist **Mainnet** typischerweise der erwartete Cluster.

### 1) Wallet Connect

- Öffne die App und gehe zu **`/terminal`** (sobald UI integriert ist).
- Verbinde eine Wallet (Phantom / Solflare / Backpack).
- Erwartet:
  - PublicKey sichtbar (oder zumindest Wallet als “connected” im Button)
  - Keine Console Errors
  - In **Dev**: einmaliges Log mit `rpcEndpoint`, `cluster`, `commitment`

### 2) Quote Updates (Debounced)

- Wähle ein Pair (Base/Quote).
- Tippe einen Betrag (Buy: Quote input, Sell: Base input).
- Ändere Slippage / Priority Fee Toggle / Fee Tier.
- Erwartet:
  - Quote lädt ohne UI-Jank (debounced 300–500ms)
  - Nur das **letzte** Quote „gewinnt“ (keine out-of-order Überschreibung)
  - Fehler werden klar angezeigt und blocken Swap

### 3) Fee Preview Konsistenz

- Prüfe im FeePreview:
  - `preview.feeBps` == Store `feeTier.feeBps`
  - `preview.feeBps` == `/api/quote` Response `feeBps`
- Erwartet:
  - Preview & Execution nutzen exakt dieselbe Fee-Quelle

### 4) Swap Execution (Market)

- Klick “Swap” (Buy/Sell).
- Erwartet:
  - Status: signing → sending → confirmed (oder failed)
  - Bei success: Signature wird angezeigt
  - Explorer Link öffnet korrekt


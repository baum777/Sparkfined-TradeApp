## Onchain Phase-2 — Flows & Liquidity (Proxy) — Dokumentation

Diese Phase erweitert das Onchain-FeaturePack um **Flows** und **Liquidity** als **best-effort Proxies** (aus Helius Enhanced Transactions / `tokenTransfers`), die ausschließlich als **Filter** und **Risk Amplifier/Reducer** dienen.

### Grundprinzipien (Non-negotiables)

- **Kein echtes Orderbook / keine echte DEX-Pool-Liquidität**: Die Liquidity-Metrik ist ein **Proxy**.
- **Deterministisch**: `asOfTs` wird auf Bucket-Grenzen gerundet (Timeframe-abhängig). Onchain-Calls nutzen `asOfTs = chart.window.endTs`.
- **Kostenkontrolle**: Enhanced Calls (Flows/Liquidity) nur, wenn **`hasSetups === true`** und Tier es erlaubt.
- **FREE = No-op**: Keine Enhanced Calls; Setup-Confidences bleiben unverändert. Nur `riskFlags` können als Info erscheinen.

---

### Proxies & Disclaimer Notes (Pflichttexte)

#### Liquidity (Proxy)

- **Was es ist**: `liquidity.liquidityDeltaPct.short` ist ein Proxy basierend auf **Transfer-Rate** (tokenTransfers pro Minute) **kurz vs baseline**.
- **Pflicht-Note (immer, wenn liquidity verfügbar ist)**:
  - `proxy based on transfer-rate, not pool liquidity`

#### Flows (Proxy)

- **Was es ist**: `flows.netInflowProxy` ist ein best-effort Proxy aus `tokenTransfers` (Transfer-Rate kurz/baseline). Keine Exchange-Attribution.
- **Pflicht-Note (immer, wenn flows verfügbar ist)**:
  - `best-effort proxy from tokenTransfers; not exchange-identified flows`

---

### Tier-Matrix (Phase-2)

| Tier | Chart-Setups | Onchain riskFlags | Onchain activity/holders | Onchain flows/liquidity (Enhanced) |
|---|---:|---:|---:|---:|
| `free` | ✅ | ✅ (info-only) | ❌ (derzeit deaktiviert) | ❌ (NO-OP, **keine Enhanced Calls**) |
| `standard` | ✅ | ✅ | ✅ (provider-abhängig) | ✅ **Flows (short-only), nur wenn `hasSetups=true`** |
| `pro` | ✅ | ✅ | ✅ | ✅ **Flows+Liquidity, nur wenn `hasSetups=true`** |
| `high` | ✅ | ✅ | ✅ | ✅ **Flows+Liquidity, nur wenn `hasSetups=true`** |

---

### Hard Gate Guardrails (Phase-2)

#### `suddenLiquidityDrop` (Hard Gate)

Ein Hard Gate darf **nur** triggern, wenn **alle** Bedingungen erfüllt sind:

- **Tier**: `pro` oder `high`
- **Proxy-Delta**: `liquidityDeltaPct.short < -0.30` (default; per Tuning konfigurierbar)
- **Chart-Kontext-Trigger**: `nearResistance === true` **oder** Setup ist breakout-/breakdown-related

Wichtig (Schema-Freeze):

- **Liquidity drop ist ein Gate, kein riskFlag (Schema bleibt frozen).**
- **Gate basiert auf Transfer-Rate Proxy, nicht echter Pool Liquidity.**

> Motivation: Liquidity ist nur ein Proxy; ohne Chart-Kontext wäre das Signal zu fehleranfällig.

Pflicht (Reason-String, Guardrail gegen Drift):

- `onchainGate.notes[]` muss den Gate-Reason enthalten, z.B.:  
  `Hard gate: liquidity proxy drop (<-30%) + breakout context`

---

### Cache / Fingerprinting (Determinismus + Repro)

Damit Cache Keys stabil und reproduzierbar sind, ist der Provider-Fingerprint erweitert um:

- `enhanced_pages=6`
- `enhanced_limit=100`

Änderungen an Caps müssen **Fingerprint/CacheKey** verändern, um Cache-Kollisionen zu vermeiden.

---

### Onchain Tuning Profile

`ONCHAIN_TUNING_PROFILE` steuert konservativ/aggressiv die Confidence-Deltas und Hard-Gate-Schwellen:

- `default`: standard
- `conservative`: stärkere RiskFlag-Penalties, früheres Liquidity-Hard-Gate
- `aggressive`: mildere Penalties, späteres Liquidity-Hard-Gate

### HIGH Tier Delta Scaling

- `high` skaliert **nur Soft-Deltas** (Confidence-Anpassungen) mit **×1.25**.
- **Hard Gates** (z.B. `suddenLiquidityDrop`) werden **nicht** skaliert.


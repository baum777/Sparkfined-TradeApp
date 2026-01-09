## Onchain Confidence Matrix (Phase-2)

Ziel: **deterministisches** Confidence-Gating über Tiers, ohne Prompt-/Schema-Änderungen.

### Matrix (was wird angewendet)

| Tier | Enhanced Calls (Flows) | Enhanced Calls (Liquidity) | Confidence-Deltas | Hard Gates |
|---|---:|---:|---:|---:|
| `free` | ❌ | ❌ | ❌ (NO-OP) | ❌ |
| `standard` | ✅ (short-only im Pack; kein zScore) | ❌ | ✅ (soft) | ❌ |
| `pro` | ✅ (full: short+baseline+zScore) | ✅ (proxy) | ✅ (soft) | ✅ (guarded) |
| `high` | ✅ (full: short+baseline+zScore) | ✅ (proxy) | ✅ (soft ×1.25) | ✅ (guarded, nicht skaliert) |

### Tuning Profile (`ONCHAIN_TUNING_PROFILE`)

- **`default`**: Standardwerte
- **`conservative`**:
  - stärkere RiskFlag-Penalty
  - Liquidity-Hard-Gate früher (weniger negativer Schwellenwert)
- **`aggressive`**:
  - mildere RiskFlag-Penalty
  - Liquidity-Hard-Gate später (stärker negativer Schwellenwert)

### Notes/Disclaimers (Pflicht, kurz)

- Flows: `best-effort proxy from tokenTransfers; not exchange-identified flows`
- Liquidity: `proxy based on transfer-rate, not pool liquidity`

### < 1h Timeframes (micro/intraday) — Kontext-Regeln

- **Hard Gates** bleiben **guarded** und brauchen Chart-Kontext:
  - `nearResistance === true` **oder** breakout-/breakdown-related Setup
- **`nearResistance` Thresholds (Default)**:
  - micro (`15s|30s|1m`): \(0.003 = 0.3\%\)
  - intraday (`5m|15m|30m`): \(0.006 = 0.6\%\)


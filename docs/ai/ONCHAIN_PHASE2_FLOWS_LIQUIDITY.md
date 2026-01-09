# Onchain Phase‑2: Flows + Liquidity (Proxy) — Regeln, Tiers, Guardrails

Diese Datei beschreibt die **Phase‑2 Onchain‑Signale** für SOL‑Token (SPL mints) und wie sie als **Filter/Gating** in die Chart‑Setups einfließen.

## Wichtige Proxy‑Disclaimers (nicht verhandelbar)

- **Flows (`flows`)**
  - **Disclaimer**: *"best-effort proxy from tokenTransfers; not exchange-identified flows"*
  - Bedeutung: Flows werden **best‑effort** aus `tokenTransfers` abgeleitet. Das ist **keine** Exchange‑identifizierte Nettozufluss/Abfluss‑Messung.

- **Liquidity (`liquidity.liquidityDeltaPct`)**
  - **Disclaimer**: *"proxy based on transfer-rate, not pool liquidity"*
  - Bedeutung: Das ist **keine** echte DEX‑Pool‑Liquidität, sondern ein **Proxy** (Transfer‑Rate). Daraus folgt: harte Entscheidungen nur mit Guardrails.

## Tier‑Matrix (Surface + Kostenkontrolle)

| Tier | riskFlags | activity | holders | flows (enhanced) | liquidity (enhanced) |
|---|---:|---:|---:|---:|---:|
| `free` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `standard` | ✅ | ✅ | ✅ | ✅ (ohne zScore/baseline) | ❌ |
| `pro` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `high` | ✅ | ✅ | ✅ | ✅ | ✅ |

**Kosten‑Guard**:
- Enhanced Calls (Flows/Liquidity) nur wenn **`hasSetups === true`** **und** Tier es erlaubt.

## Hard‑Gate Guardrails (Liqudity Drop)

**Ziel**: `suddenLiquidityDrop` darf **nicht** blind feuern, weil `liquidityDeltaPct` nur ein Proxy ist.

Hard‑Gate (Pass=false) nur wenn ALLE Bedingungen erfüllt sind:
- **Tier**: `pro` oder `high`
- **Proxy‑Delta**: `liquidity.liquidityDeltaPct.short <= -0.30` (konfigurierbar via Tuning‑Profil)
- **Chart‑Kontext Trigger**: `nearResistance === true` **ODER** Setup ist breakout/retest‑related

Wenn eine Bedingung fehlt, kann höchstens ein **weicher Confidence‑Abschlag** oder ein **Hinweis** erfolgen (kein Hard‑Gate).

## Cache‑Fingerprint Caps (Determinismus)

Damit Caches stabil bleiben, enthält der Provider‑Fingerprint die Enhanced‑Caps:
- `pages=6`
- `limit=100`

Wenn diese Werte über Env konfiguriert werden, müssen sie weiterhin **im Fingerprint** enthalten sein, damit Cache Keys deterministisch bleiben.


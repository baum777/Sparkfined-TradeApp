# GPT-5.2 — Prompt Logic Spec (FROZEN) for SOL Chart TA + Journal (JSON+Text, expandable)

> **FROZEN**: This document is treated as a stable contract between backend feature extraction and LLM prompting/output.

## SCOPE
- **Chain**: Solana tokens only
- **Timeframes supported (must be explicit)**: 15s, 30s, 1m, 5m, 15m, 30m, 1h, 4h
- **Output**: BOTH
  1) JSON (cacheable, stable schema, knowledge foundation)
  2) Text (precise, structured, with expandable "Details" blocks)

## CORE PRINCIPLE (for accuracy)
- LLM must NOT "see" charts; it must interpret a deterministic backend FeaturePack:
  - pivots, S/R clusters, regime, volatility, volume structure, and PATTERN CANDIDATES
- LLM role: validate candidates, score confluence, propose scenarios, define invalidation/stop.

## DATA SOURCES (Solana)
- Price/OHLCV source: (existing oracle / aggregator in repo)
- Onchain source for SOL tokens: use SOL-capable provider (e.g. Helius/Shyft/Solana RPC indexer) — NOT Moralis EVM endpoints.
- Onchain is used as regime/filter signals, never as single-signal predictor.

---

## 1) TASK KINDS (FROZEN)

### Chart
- `chart_teaser_free`           (FREE strict: S/R + Stoploss only)
- `chart_setups`                (STANDARD+): setup catalog + scoring
- `chart_patterns_validate`     (PRO/HIGH): validate backend pattern candidates (H&S, Wolfe, wedges, triangles, double tops/bottoms)
- `chart_confluence_onchain`    (PRO/HIGH): chart setups/patterns + onchain gating/risk flags
- `chart_microstructure`        (15/30s, 1m): scalping microstructure (liquidity sweeps, reclaim, volatility bursts) — no long predictions

### Journal
- `journal_teaser_free`         (FREE strict)
- `journal_review`              (STANDARD): behavior patterns + 1–2 rules
- `journal_playbook_update`     (PRO/HIGH): playbook + anti-bias + checklist updates
- `journal_risk`                (ALL): risk posture & guardrails from recent sessions

---

## 2) FEATURE PACK SCHEMA (INPUT TO LLM) — BACKEND MUST PROVIDE

### 2.1 ChartFeaturePack (per timeframe)

`ChartFeaturePack`:
- `asset`: `{ symbol?: string, mint: string }`
- `timeframe`: `"15s"|"30s"|"1m"|"5m"|"15m"|"30m"|"1h"|"4h"`
- `window`: `{ candles: number, startTs: number, endTs: number }`
- `ohlcvSummary`:
  - `lastPrice`
  - `returns`: `{ r_15m?, r_1h?, r_4h? }` (if available)
  - `volume`: `{ mean, stdev, last, zScore }`
  - `volatility`: `{ atr, atrPct, bbWidth, bbWidthPct }`
- `marketRegime`:
  - `regime`: `"trend_up"|"trend_down"|"range"|"transition"`
  - `strength`: `0..1`
  - `structure`: `{ hhCount, hlCount, lhCount, llCount, lastSwing: "HH"|"HL"|"LH"|"LL" }`
- `pivots`:
  - `method`: `"zigzag"|"fractals"`
  - `points`: `Array<{ ts, price, type: "H"|"L", strength: 1..5 }>`
- `srLevels`:
  - `supports`: `Array<{ price, touches, clusterScore: 0..1 }>`
  - `resistances`: `Array<{ price, touches, clusterScore: 0..1 }>`
- `liquidityEvents` (for low TF esp 15/30s,1m):
  - `sweeps`: `Array<{ ts, level, side:"above"|"below", reclaimWithinBars:number, confidence:0..1 }>`
  - `gapsOrImbalances?`: `Array<{ ts, from, to, direction, confidence }>`
- `indicatorSnapshot` (minimal, avoid noise):
  - `rsi?`: `{ value, divergence?: "bull"|"bear"|"none" }`
  - `macd?`: `{ state:"bull"|"bear"|"flat" }`
  - `vwap?`: `{ distancePct }`
- `patternCandidates` (generated deterministically in backend, LLM validates):
  - `Array<{ type, tf, points, checks, rawConfidence }>`
  - `type`: `"HNS"|"IHNS"|"WOLFE"|"TRIANGLE"|"WEDGE"|"DBL_TOP"|"DBL_BOT"`
  - `tf`: timeframe
  - `points`: `Array<{ label:string, ts:number, price:number }>`
  - `checks`: `Array<{ name:string, pass:boolean, score:0..1 }>`
  - `rawConfidence`: `0..1`
- `constraintsHint`:
  - `minRR?`: number
  - `maxRiskPct?`: number

### 2.2 OnchainFeaturePack (Solana token)

`OnchainFeaturePack`:
- `mint`: string
- `window`: `{ w1m?, w5m?, w15m?, w1h?, w4h? }` (align to chart TF)
- `activity`:
  - `txCountDelta`: `{ short:number, baseline:number, zScore:number }`
  - `uniqueWalletDelta`: `{ short:number, baseline:number, zScore:number }`
- `holders`:
  - `holdersDeltaPct`: `{ short:number, long:number }`
  - `concentrationTop10Pct?`: number
- `flows` (best-effort depending on provider):
  - `netInflowProxy?`: number  // + = accumulation, - = distribution
  - `exchangeRelatedFlowProxy?`: number
- `liquidity`:
  - `liquidityDeltaPct?`: number
  - `poolCountDelta?`: number
- `riskFlags`:
  - `mintAuthorityActive?`: boolean
  - `freezeAuthorityActive?`: boolean
  - `largeHolderDominance?`: boolean
  - `suddenSupplyChange?`: boolean

---

## 3) OUTPUT SCHEMA (CACHEABLE JSON + TEXT + DETAILS)

`ResponseEnvelope`:
```json
{ "status":"ok", "data": { } }
```

`AnalysisResult`:
- `requestId`
- `tier`: `"free"|"standard"|"pro"|"high"`
- `taskKind`
- `asset`: `{ mint, symbol? }`
- `timeframesAnalyzed`: timeframe[]
- `headline`: string (1 line)
- `summaryBullets`: string[] (max 6)
- `plan`: `Array<SetupCard>` (0..5)
- `risk`: `RiskBlock`
- `details`: `DetailsBlock` (expandable payload)

`SetupCard`:
- `name`
- `bias`: `"long"|"short"|"neutral"`
- `timeframe`
- `entry`: `{ type:"market"|"limit"|"trigger", level:number|null, rule:string }`
- `stop`: `{ level:number, rule:string, invalidation:string }`
- `targets`: `Array<{ level:number, rationale:string }>`  // zones ok
- `confidence`: `0..1`
- `evidence`: string[] (max 6)
- `onchainGate`: `{ pass:boolean, notes:string[] }`
- `notes`: string[] (max 4)

`RiskBlock`:
- `posture`: `"low"|"medium"|"high"`
- `keyRisks`: string[] (max 5)
- `guardrails`: string[] (max 5)

`DetailsBlock` (expandable):
- `regimeExplain`: string
- `srTable`: `{ supports:number[], resistances:number[] }`
- `patternReview`: `Array<{ type, tf, verdict:"valid"|"weak"|"reject", why:string, confidence:number }>`
- `onchainExplain`: string
- `assumptions`: string[]
- `invalidationRules`: string[]

### TEXT RENDERING REQUIREMENTS
- Provide a structured layout:
  1) Headline
  2) Summary bullets
  3) Top 1–3 Setups (cards)
  4) Risk & Invalidation
  5) "Details (expand)" section referencing the JSON details keys
- Must be concise, no fluff.

---

## 4) TIER RULES (FROZEN, ENFORCE SERVER-SIDE)

### FREE
- Allowed taskKinds for OpenAI: `journal_teaser_free`, `chart_teaser_free` ONLY.
- `chart_teaser_free` output STRICT:
  - Support (1–3), Resistance (1–3), Stop-loss (1), Invalidation (1 line), Risk note (1 line)
  - No pattern targets, no long analysis
- Grok: allowed only for `sentiment_alpha`-like tasks (if present); else no.

### STANDARD
- `chart_setups` allowed; patterns validation allowed but keep outputs moderate.
- OpenAI allowed for chart analysis tasks if router chooses it.

### PRO/HIGH
- `chart_patterns_validate` + `chart_confluence_onchain` enabled.
- HIGH may run postprocess summarization to tighten final answer.

---

## 5) PROMPT TEMPLATES (SYSTEM PROMPTS) — DEFINE EXACTLY

### 5.1 Router System Prompt (DeepSeek R1)
> "You are a routing/compression engine. Output JSON only. Choose templateId and provider based on tier+taskKind. Never include secrets. Compressed prompt must be short and include only necessary constraints."

Router output JSON:
```json
{
  "provider": "deepseek|openai|grok",
  "templateId": "...",
  "maxTokens": 1234,
  "compressedPrompt": "...",
  "mustInclude": ["..."],
  "redactions": ["..."]
}
```

### 5.2 Template: CHART_TEASER_FREE (strict)
System:
> "You output ONLY in the strict teaser format. No targets, no patterns, no long analysis."

User inputs:
- ChartFeaturePack for ONE timeframe (choose best from available)
- srLevels + lastPrice + lastSwing

Output text format:
```
Support: ...
Resistance: ...
Stop-loss: ...
Invalidation: ...
Risk: ...
```

Output JSON must match `AnalysisResult` with `plan` empty or 1 setup card max (teaser).

### 5.3 Template: CHART_SETUPS (setup catalog + scoring)
System:
> "Validate regime, propose up to 3 setups, each must have entry/stop/invalidation/targets zones. Evidence must come from FeaturePack fields."

Rules:
- Always start from regime and S/R.
- Provide at most 3 setups.
- Confidence requires >= 3 evidence points; else cap <= 0.6.
- If liquidity sweeps present and reclaim confirmed, prefer "failed breakdown/breakout" setup.

### 5.4 Template: CHART_PATTERNS_VALIDATE (H&S, Wolfe, etc.)
System:
> "You DO NOT invent patterns. You only validate provided patternCandidates. Reject weak candidates and explain why. Targets are zones + probabilistic."

Rules:
- For each candidate: verdict valid/weak/reject
- Recompute confidence using checks + context (regime, volatility, volume).
- Wolfe: ensure 5 pivot structure; if missing/unclear -> reject.
- H&S: neckline coherence + shoulder symmetry; else weak/reject.

### 5.5 Template: CHART_CONFLUENCE_ONCHAIN (gated setups)
System:
> "Use onchain signals ONLY as a filter and risk amplifier/reducer, not as standalone predictor."

Rules:
- If riskFlags indicate high risk (mint/freeze authority, sudden supply): downgrade confidence, tighten stops, reduce targets.
- If activity zScore high + liquidity up + holders growth: allow higher follow-through probability.
- Always report onchainGate pass/fail per setup.

### 5.6 Journal Templates

#### JOURNAL_TEASER_FREE
- Output 3 bullets max:
  - "One thing to do next"
  - "One thing to avoid"
  - "One risk"
- No long coaching.

#### JOURNAL_REVIEW (standard)
- Identify 1–2 behavioral patterns from last N entries (provided by backend)
- Provide 2 concrete rules + 1 checklist item.

#### JOURNAL_PLAYBOOK_UPDATE (pro/high)
- Add/update playbook rules, anti-bias safeguards, and a review rubric.

---

## 6) IMPLEMENTATION NOTES (Backend)
- Backend selects which timeframe packs to send:
  - For low TF (15/30s, 1m): include liquidityEvents; keep output short.
  - For 4h: include patterns candidates primarily.
- For SOL-only:
  - Use SOL provider to populate OnchainFeaturePack; if missing fields, set null and mention in assumptions.
- Cache key:
  - (mint, timeframe, windowEndTs, taskKind, tier, featurePackHash)


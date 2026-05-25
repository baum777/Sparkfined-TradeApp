---
id: buildGeneratorPrompt
type: function
category: reasoning
canonical: shared/contracts/reasoning-prompts.ts#L32
updated: 2026-05-09
freshness: stable
tags: [prompt, token-heavy, v1-mvp]
perf:
  avg_latency_ms: 0
  avg_tokens_est: 169
  cache_hit_rate: 0.0
optimization_candidates:
  - context_dedup
  - schema_inline_refs
---

# buildGeneratorPrompt

## Zweck
Generiert LLM-Input-Prompts aus Reasoning-Context. Aktuell serialisiert die Funktion vollstaendigen JSON-Context und kann dadurch bei repetitiven Calls Token-Overhead erzeugen.

## Profiling-Status
- V1: CLI-Messung ohne LLM-Call (`tools/fn-profile.ts`)
- Metriken: geschaetzt via `ceil(chars / 4)`
- Naechster Schritt: Provider-Usage-Hook nach V1-Validierung

## Observability
- Siehe: `[[dashboards/performance-hotspots]]`
- Log: `[[log]]`

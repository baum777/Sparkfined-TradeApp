---
title: Function Performance Hotspots
type: dashboard
updated: 2026-05-09
---

# Performance Hotspots

```dataview
TABLE WITHOUT ID
  file.link AS "Function",
  perf.avg_latency_ms AS "Latenz (ms)",
  perf.avg_tokens_est AS "Tokens (est.)",
  perf.cache_hit_rate AS "Cache Hit",
  freshness AS "Status"
FROM "02-wiki/functions"
WHERE perf.avg_latency_ms > 200 OR perf.avg_tokens_est > 800
SORT perf.avg_latency_ms DESC
```

> Hinweis: `avg_tokens_est` basiert auf V1-Schaetzung (`chars/4`). Echte Provider-Metriken kommen mit Usage-Hook V2.

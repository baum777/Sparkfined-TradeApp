---
id: research-chart-timeframe-pills
type: function
canonical: src/components/chart/ChartTopBar.tsx
updated: 2026-05-20
freshness: stable
perf:
  avg_latency_ms: null
  avg_tokens_est: null
  cache_hit_rate: 0.0
---

# Research-Chart-Timeframe-Pills

Observed: Die Research-Chart-Topbar stellt Timeframes als Tooltip-Pills bereit.

Observed: Unterstützte Werte sind `15s`, `1m`, `5m`, `15m`, `30m`, `1h` und `4h`.

Observed: Die Live-Chart-Komponente mappt diese Werte auf Binance-Klines; `15s` wird aus `1s`-Kerzen aggregiert.

Observed: Beim Links-Scrollen lädt die Chart-Komponente ältere Kerzen lazily nach und erhält den sichtbaren Range nach dem Prepend.

Observed: Live-Polling scrollt nur dann zur Echtzeit, wenn der Nutzer bereits nahe am rechten Rand ist.

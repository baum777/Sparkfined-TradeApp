---
id: research-chart-indicators
type: function
canonical: src/components/chart/chartIndicators.ts
updated: 2026-05-20
freshness: stable
perf:
  avg_latency_ms: null
  avg_tokens_est: null
  cache_hit_rate: 0.0
---

# Research-Chart-Indicators

Observed: Die Research-Chart-Komponente rendert aktivierte Technical-Analysis-Indikatoren direkt auf dem Lightweight-Chart.

Observed: Preis-Overlays laufen im Hauptpane; Volume, RSI, MACD und ATR werden in getrennten Zusatzpanes visualisiert.

Observed: Unterstützte Visualisierungen sind `SMA`, `EMA`, `VWAP`, `Bollinger Bands`, `Volume`, `RSI`, `MACD` und `ATR`.

Observed: Der Enabled-Tab erlaubt Inline-Parameterbearbeitung für Indikatoren mit Parametern.

Verified: Im In-App-Browser wurde `SMA` von Periode `20` auf `30` geändert; Legende und Chart-Linie wurden aktualisiert.

Verified: Im In-App-Browser wurden `Bollinger Bands`, `Volume` und `RSI` sichtbar im Chart dargestellt.

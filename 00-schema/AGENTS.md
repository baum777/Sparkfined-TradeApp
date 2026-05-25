# Function-Wiki Schema

## Authority
- `00-schema/` beschreibt Workflow- und Schreibregeln.
- `02-wiki/` ist derived/agentenlesbare Orientierung, nicht kanonischer Code.
- `03-mspr/packets/` haelt Review-Packets bei Blockern oder Authority-Konflikten.
- Kanonische Source bleibt in den im Frontmatter referenzierten Dateien.

## Frontmatter-Pflichtfelder
- `id`: eindeutig; bestehende Funktionsnamen bleiben exakt erhalten.
- `type`: `function` | `hook` | `route` | `service`.
- `canonical`: relativer Pfad zur Source-Datei plus optional `#Lx`.
- `updated`: `YYYY-MM-DD`.
- `freshness`: `stable` | `stale` | `disputed`.
- `perf.avg_latency_ms`: Zahl oder `null`.
- `perf.avg_tokens_est`: Zahl oder `null`.
- `perf.cache_hit_rate`: Zahl zwischen `0.0` und `1.0`.

## Link-Regeln
- Wiki-intern: `[[functions/buildGeneratorPrompt]]`.
- Dashboard-intern: `[[dashboards/performance-hotspots]]`.
- Source-Referenz: nur im Frontmatter `canonical`, keine absoluten URLs im Body.
- MSPR-Verweis: `[[packets/{id}]]` nur bei Blockern.

## Update-Protokoll
1. Profiling-Run schreibt `perf.avg_latency_ms` und `perf.avg_tokens_est`.
2. Bei Schema- oder Prompt-Aenderung `freshness: stale` setzen.
3. Append `02-wiki/log.md` mit `update | {id} | metric_delta`.
4. Bei Authority-Konflikt: MSPR-Packet anlegen, menschlichen Review anfordern, keine Auto-Promotion.

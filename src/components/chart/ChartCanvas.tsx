import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, ColorType, HistogramSeries, LineSeries } from "lightweight-charts";
import type { HistogramData, ISeriesApi, LineData, LogicalRange, SeriesType, UTCTimestamp } from "lightweight-charts";
import { BarChart3, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { buildIndicatorLegend, buildIndicatorVisualSeries } from "./chartIndicators";
import type { IndicatorPane, IndicatorVisualSeries, MarketCandle } from "./chartIndicators";
import { getChartTimeframe } from "./timeframes";
import type { ChartTimeframeOption } from "./timeframes";
import type { EnabledIndicator } from "./research-tools/types";

interface ChartCanvasProps {
  symbol: string;
  timeframe: string;
  isLoading?: boolean;
  indicators?: EnabledIndicator[];
}

type FeedState = "idle" | "loading" | "live" | "error" | "unsupported";
type HistoryState = "idle" | "loading" | "end" | "error";
type IndicatorApiEntry =
  | { key: string; kind: "line"; api: ISeriesApi<"Line"> }
  | { key: string; kind: "histogram"; api: ISeriesApi<"Histogram"> };

const BINANCE_API_BASE = "https://api.binance.com/api/v3";
const MAX_CANDLES = 240;
const HISTORY_CHUNK_CANDLES = 500;
const MAX_BINANCE_LIMIT = 1000;
const HISTORY_PREFETCH_THRESHOLD = 60;
const DEFAULT_POLL_MS = 8_000;

function pollMsForTimeframe(seconds: number): number {
  if (seconds <= 15) return 3_000;
  if (seconds <= 60) return 5_000;
  return DEFAULT_POLL_MS;
}

function toExchangeSymbol(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return "";

  const noSeparators = normalized.replace(/[/\s_-]+/g, "");
  const cleaned = noSeparators.replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";

  if (cleaned.endsWith("USDT") || cleaned.endsWith("USDC")) {
    return cleaned;
  }
  return `${cleaned}USDT`;
}

function parseNumber(value: unknown): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(num) ? num : null;
}

function parseKlineToCandle(row: unknown): MarketCandle | null {
  if (!Array.isArray(row) || row.length < 6) return null;
  const openTimeMs = parseNumber(row[0]);
  const open = parseNumber(row[1]);
  const high = parseNumber(row[2]);
  const low = parseNumber(row[3]);
  const close = parseNumber(row[4]);
  const volume = parseNumber(row[5]);

  if (openTimeMs === null || open === null || high === null || low === null || close === null) {
    return null;
  }

  return {
    time: Math.floor(openTimeMs / 1000) as UTCTimestamp,
    open,
    high,
    low,
    close,
    volume: volume ?? 0,
  };
}

async function fetchKlines(
  symbol: string,
  interval: string,
  limit = MAX_CANDLES,
  endTimeMs?: number,
  allowEmpty = false
): Promise<MarketCandle[]> {
  const url = new URL(`${BINANCE_API_BASE}/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(Math.min(limit, MAX_BINANCE_LIMIT)));
  if (endTimeMs !== undefined) {
    url.searchParams.set("endTime", String(endTimeMs));
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Kline request failed (${response.status})`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Invalid kline payload");
  }

  const candles = payload
    .map((row) => parseKlineToCandle(row))
    .filter((row): row is MarketCandle => row !== null)
    .sort((a, b) => Number(a.time) - Number(b.time));

  if (candles.length === 0 && !allowEmpty) {
    throw new Error("Empty kline payload");
  }

  return candles;
}

function aggregateCandles(candles: MarketCandle[], bucketSeconds: number): MarketCandle[] {
  const aggregated: MarketCandle[] = [];

  candles.forEach((candle) => {
    const bucket = Math.floor(Number(candle.time) / bucketSeconds) * bucketSeconds;
    const previous = aggregated[aggregated.length - 1];

    if (previous && Number(previous.time) === bucket) {
      previous.high = Math.max(previous.high, candle.high);
      previous.low = Math.min(previous.low, candle.low);
      previous.close = candle.close;
      previous.volume = (previous.volume ?? 0) + (candle.volume ?? 0);
      return;
    }

    aggregated.push({
      time: bucket as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume ?? 0,
    });
  });

  return aggregated;
}

async function fetchTimeframeCandles(symbol: string, timeframe: ChartTimeframeOption): Promise<MarketCandle[]> {
  const sourceLimit = timeframe.sourceLimit ?? MAX_CANDLES;
  const source = await fetchKlines(symbol, timeframe.binanceInterval, sourceLimit);
  const candles = timeframe.aggregateSeconds ? aggregateCandles(source, timeframe.aggregateSeconds) : source;
  return candles.slice(Math.max(candles.length - MAX_CANDLES, 0));
}

async function fetchOlderTimeframeCandles(
  symbol: string,
  timeframe: ChartTimeframeOption,
  beforeSec: number
): Promise<MarketCandle[]> {
  const sourceLimit = timeframe.aggregateSeconds ? MAX_BINANCE_LIMIT : HISTORY_CHUNK_CANDLES;
  const source = await fetchKlines(symbol, timeframe.binanceInterval, sourceLimit, beforeSec * 1000 - 1, true);
  const candles = timeframe.aggregateSeconds ? aggregateCandles(source, timeframe.aggregateSeconds) : source;
  return candles.filter((candle) => Number(candle.time) < beforeSec);
}

async function fetchTickerPrice(symbol: string): Promise<number | null> {
  const url = new URL(`${BINANCE_API_BASE}/ticker/price`);
  url.searchParams.set("symbol", symbol);

  const response = await fetch(url.toString());
  if (!response.ok) return null;

  const payload = (await response.json()) as unknown;
  if (!payload || typeof payload !== "object") return null;

  const rawPrice = (payload as { price?: unknown }).price;
  return parseNumber(rawPrice);
}

function upsertCandles(
  candles: MarketCandle[],
  price: number,
  nowSec: number,
  intervalSeconds: number
): MarketCandle[] {
  if (candles.length === 0) return candles;

  const bucket = Math.floor(nowSec / intervalSeconds) * intervalSeconds;
  const next = [...candles];
  const last = next[next.length - 1];
  if (!last) return candles;

  if (bucket > Number(last.time)) {
    const prevClose = last.close;
    let cursor = Number(last.time) + intervalSeconds;

    while (cursor < bucket) {
      next.push({
        time: cursor as UTCTimestamp,
        open: prevClose,
        high: prevClose,
        low: prevClose,
        close: prevClose,
        volume: 0,
      });
      cursor += intervalSeconds;
    }

    next.push({
      time: bucket as UTCTimestamp,
      open: prevClose,
      high: Math.max(prevClose, price),
      low: Math.min(prevClose, price),
      close: price,
      volume: 0,
    });
  } else {
    next[next.length - 1] = {
      time: last.time,
      open: last.open,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
      volume: last.volume ?? 0,
    };
  }

  return next;
}

function mergeCandles(existing: MarketCandle[], incoming: MarketCandle[]): MarketCandle[] {
  if (incoming.length === 0) return existing;

  const byTime = new Map<number, MarketCandle>();
  incoming.forEach((candle) => byTime.set(Number(candle.time), candle));
  existing.forEach((candle) => byTime.set(Number(candle.time), candle));

  return Array.from(byTime.values()).sort((a, b) => Number(a.time) - Number(b.time));
}

function keepVisibleRangeAfterPrepend(range: LogicalRange | null, addedBars: number): LogicalRange | null {
  if (!range || addedBars <= 0) return range;
  return {
    from: (Number(range.from) + addedBars) as LogicalRange["from"],
    to: (Number(range.to) + addedBars) as LogicalRange["to"],
  };
}

function indicatorPaneIndex(visuals: IndicatorVisualSeries[], pane: IndicatorPane): number {
  if (pane === "price") return 0;
  const panes = Array.from(new Set(visuals.filter((visual) => visual.pane !== "price").map((visual) => visual.pane)));
  return panes.indexOf(pane) + 1;
}

export function ChartCanvas({ symbol, timeframe, isLoading, indicators = [] }: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [feedState, setFeedState] = useState<FeedState>("idle");
  const [historyState, setHistoryState] = useState<HistoryState>("idle");
  const [lastPrice, setLastPrice] = useState<number | null>(null);

  const exchangeSymbol = useMemo(() => toExchangeSymbol(symbol), [symbol]);
  const timeframeConfig = useMemo(() => getChartTimeframe(timeframe), [timeframe]);
  const visibleIndicatorLegend = useMemo(() => buildIndicatorLegend(indicators), [indicators]);

  useEffect(() => {
    if (!exchangeSymbol) {
      setFeedState("unsupported");
      setHistoryState("idle");
      setLastPrice(null);
      return;
    }

    const host = containerRef.current;
    if (!host) return;

    const intervalSeconds = timeframeConfig.seconds;
    const pollMs = pollMsForTimeframe(timeframeConfig.seconds);

    const chart = createChart(host, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.1)" },
        horzLines: { color: "rgba(148, 163, 184, 0.1)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.2)",
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.2)",
        timeVisible: true,
        secondsVisible: timeframeConfig.secondsVisible,
      },
      width: host.clientWidth,
      height: host.clientHeight,
      autoSize: false,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
    });

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ autoSize: false, width: host.clientWidth, height: host.clientHeight });
    });
    resizeObserver.observe(host);

    let disposed = false;
    let candles: MarketCandle[] = [];
    let indicatorApis: IndicatorApiEntry[] = [];
    let indicatorSignature = "";
    let consecutiveFailures = 0;
    let isLoadingOlder = false;
    let reachedOrigin = false;

    const syncIndicators = () => {
      const visuals = buildIndicatorVisualSeries(candles, indicators);
      const nextSignature = visuals.map((visual) => `${visual.key}:${visual.kind}:${visual.pane}`).join("|");

      if (nextSignature !== indicatorSignature) {
        indicatorApis.forEach((entry) => {
          chart.removeSeries(entry.api as ISeriesApi<SeriesType>);
        });

        indicatorApis = visuals.map((visual) => {
          const paneIndex = indicatorPaneIndex(visuals, visual.pane);

          if (visual.kind === "line") {
            return {
              key: visual.key,
              kind: visual.kind,
              api: chart.addSeries(
                LineSeries,
                {
                  color: visual.color,
                  lineWidth: 2,
                  lastValueVisible: false,
                  priceLineVisible: false,
                  title: visual.label,
                },
                paneIndex
              ),
            };
          }

          return {
            key: visual.key,
            kind: visual.kind,
            api: chart.addSeries(
              HistogramSeries,
              {
                color: visual.color,
                lastValueVisible: false,
                priceLineVisible: false,
                title: visual.label,
              },
              paneIndex
            ),
          };
        });

        indicatorSignature = nextSignature;
      }

      visuals.forEach((visual) => {
        const entry = indicatorApis.find((item) => item.key === visual.key);
        if (!entry) return;

        if (entry.kind === "line" && visual.kind === "line") {
          entry.api.setData(visual.data as LineData[]);
        }
        if (entry.kind === "histogram" && visual.kind === "histogram") {
          entry.api.setData(visual.data as HistogramData[]);
        }
      });
    };

    const loadOlder = async () => {
      if (disposed || isLoadingOlder || reachedOrigin || candles.length === 0) return;

      const firstCandle = candles[0];
      if (!firstCandle) return;

      isLoadingOlder = true;
      setHistoryState("loading");

      const visibleRange = chart.timeScale().getVisibleLogicalRange();
      const beforeSec = Number(firstCandle.time);

      try {
        const older = await fetchOlderTimeframeCandles(exchangeSymbol, timeframeConfig, beforeSec);
        if (disposed) return;

        const previousLength = candles.length;
        candles = mergeCandles(candles, older);
        const addedBars = candles.length - previousLength;

        if (addedBars <= 0) {
          reachedOrigin = true;
          setHistoryState("end");
          return;
        }

        series.setData(candles);
        syncIndicators();

        const preservedRange = keepVisibleRangeAfterPrepend(visibleRange, addedBars);
        if (preservedRange) {
          chart.timeScale().setVisibleLogicalRange(preservedRange);
        }

        setHistoryState("idle");
      } catch {
        if (!disposed) setHistoryState("error");
      } finally {
        isLoadingOlder = false;
      }
    };

    const handleVisibleRangeChange = (logicalRange: LogicalRange | null) => {
      if (!logicalRange || candles.length === 0 || reachedOrigin || isLoadingOlder) return;

      const barsInfo = series.barsInLogicalRange(logicalRange);
      if (barsInfo !== null && barsInfo.barsBefore < HISTORY_PREFETCH_THRESHOLD) {
        void loadOlder();
      }
    };

    const loadInitial = async () => {
      setFeedState("loading");
      setHistoryState("idle");
      try {
        const initial = await fetchTimeframeCandles(exchangeSymbol, timeframeConfig);
        if (disposed) return;

        candles = initial;
        series.setData(candles);
        syncIndicators();
        chart.timeScale().fitContent();
        setLastPrice(candles[candles.length - 1]?.close ?? null);
        setFeedState("live");
        handleVisibleRangeChange(chart.timeScale().getVisibleLogicalRange());
      } catch {
        if (disposed) return;
        setFeedState("unsupported");
      }
    };

    const poll = async () => {
      if (disposed) return;
      if (candles.length === 0) return;

      const price = await fetchTickerPrice(exchangeSymbol);
      if (disposed) return;

      if (!price || price <= 0) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) setFeedState("error");
        return;
      }

      consecutiveFailures = 0;
      setLastPrice(price);
      setFeedState("live");

      const nowSec = Math.floor(Date.now() / 1000);
      const shouldFollowRealtime = chart.timeScale().scrollPosition() < 3;
      const previousLength = candles.length;
      const previousLastTime = Number(candles[candles.length - 1]?.time);
      candles = upsertCandles(candles, price, nowSec, intervalSeconds);
      const latest = candles[candles.length - 1];

      if (latest && candles.length === previousLength && Number(latest.time) === previousLastTime) {
        series.update(latest);
      } else {
        series.setData(candles);
      }
      syncIndicators();

      if (shouldFollowRealtime) {
        chart.timeScale().scrollToRealTime();
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    void loadInitial().then(() => {
      void poll();
    });

    const timer = setInterval(() => {
      void poll();
    }, pollMs);

    return () => {
      disposed = true;
      clearInterval(timer);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [exchangeSymbol, timeframeConfig, indicators]);

  if (isLoading) {
    return (
      <div
        data-testid="chart-canvas-container"
        className="sf-chartPlaceholder flex items-center justify-center"
      >
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div
      data-testid="chart-canvas-container"
      className="sf-chartPlaceholder relative items-stretch justify-stretch overflow-hidden p-0"
    >
      <div ref={containerRef} className="h-full w-full min-h-[360px] md:min-h-[480px] lg:min-h-[520px]" />

      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/60 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
        {symbol} · {timeframeConfig.label}
      </div>

      {visibleIndicatorLegend.length > 0 && (
        <div
          data-testid="chart-indicator-legend"
          className="pointer-events-none absolute left-3 top-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5 text-[11px]"
        >
          {visibleIndicatorLegend.map((item) => (
            <span
              key={item.id}
              className="rounded-md bg-background/60 px-2 py-1 font-medium text-muted-foreground backdrop-blur-sm"
              style={{ borderLeft: `2px solid ${item.color}` }}
            >
              {item.label}
            </span>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-background/60 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
        {feedState === "loading" && (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Live lädt…
          </span>
        )}
        {feedState === "live" && (
          <span>
            Live · {lastPrice?.toLocaleString(undefined, { maximumFractionDigits: 8 })} USDT
          </span>
        )}
        {feedState === "error" && <span>Live-Feed temporär nicht verfügbar</span>}
        {feedState === "unsupported" && <span>Symbol auf Feed nicht verfügbar</span>}
        {feedState === "idle" && <span>Live-Feed vorbereitet</span>}
      </div>

      {historyState !== "idle" && (
        <div
          data-testid="chart-history-state"
          className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/65 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm"
        >
          {historyState === "loading" && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Historie lädt…
            </span>
          )}
          {historyState === "end" && <span>Ursprungscandle erreicht</span>}
          {historyState === "error" && <span>Historie temporär nicht verfügbar</span>}
        </div>
      )}

      {feedState === "unsupported" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/35 backdrop-blur-[1px]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
            <BarChart3 className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="px-4 text-center text-sm text-muted-foreground">
            Für <span className="font-medium">{symbol}</span> konnte kein Live-Markt gefunden werden.
          </p>
        </div>
      )}
    </div>
  );
}

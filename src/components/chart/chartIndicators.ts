import type { CandlestickData, HistogramData, LineData } from "lightweight-charts";
import type { EnabledIndicator } from "./research-tools/types";
import { INDICATOR_LIBRARY } from "./research-tools/constants";

export type IndicatorPane = "price" | "volume" | "rsi" | "macd" | "atr";

export type MarketCandle = CandlestickData & {
  volume?: number;
};

export type IndicatorVisualSeries =
  | {
      key: string;
      label: string;
      kind: "line";
      pane: IndicatorPane;
      color: string;
      data: LineData[];
    }
  | {
      key: string;
      label: string;
      kind: "histogram";
      pane: IndicatorPane;
      color: string;
      data: HistogramData[];
    };

export interface IndicatorLegendItem {
  id: string;
  label: string;
  color: string;
}

type CandleSource = "open" | "high" | "low" | "close";

const INDICATOR_COLORS = [
  "#22d3ee",
  "#f59e0b",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#60a5fa",
  "#f87171",
  "#c084fc",
];

function colorFor(index: number): string {
  return INDICATOR_COLORS[index % INDICATOR_COLORS.length];
}

function numberParam(
  indicator: EnabledIndicator,
  key: string,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): number {
  const raw = indicator.params[key];
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseFloat(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function decimalParam(
  indicator: EnabledIndicator,
  key: string,
  fallback: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER
): number {
  const raw = indicator.params[key];
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseFloat(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sourceParam(indicator: EnabledIndicator): CandleSource {
  const source = indicator.params.source;
  return source === "open" || source === "high" || source === "low" || source === "close" ? source : "close";
}

function valuesFor(candles: MarketCandle[], source: CandleSource): number[] {
  return candles.map((candle) => candle[source]);
}

function toLineData(candles: MarketCandle[], values: Array<number | null>): LineData[] {
  return values.flatMap((value, index) => {
    if (value === null || !Number.isFinite(value)) return [];
    return [{ time: candles[index].time, value }];
  });
}

function constantLine(candles: MarketCandle[], value: number): LineData[] {
  if (candles.length === 0) return [];
  return [
    { time: candles[0].time, value },
    { time: candles[candles.length - 1].time, value },
  ];
}

function rollingSma(values: number[], period: number): Array<number | null> {
  const output: Array<number | null> = Array(values.length).fill(null);
  let sum = 0;

  values.forEach((value, index) => {
    sum += value;
    if (index >= period) sum -= values[index - period];
    if (index >= period - 1) output[index] = sum / period;
  });

  return output;
}

function rollingStd(values: number[], period: number, means: Array<number | null>): Array<number | null> {
  return values.map((_, index) => {
    const mean = means[index];
    if (mean === null || index < period - 1) return null;
    let sum = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      sum += (values[cursor] - mean) ** 2;
    }
    return Math.sqrt(sum / period);
  });
}

function ema(values: Array<number | null>, period: number): Array<number | null> {
  const output: Array<number | null> = Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let seedSum = 0;
  let seedCount = 0;
  let previousEma: number | null = null;

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) return;

    if (previousEma === null) {
      seedSum += value;
      seedCount += 1;
      if (seedCount === period) {
        previousEma = seedSum / period;
        output[index] = previousEma;
      }
      return;
    }

    previousEma = (value - previousEma) * multiplier + previousEma;
    output[index] = previousEma;
  });

  return output;
}

function vwap(candles: MarketCandle[]): Array<number | null> {
  let cumulativeVolume = 0;
  let cumulativeValue = 0;

  return candles.map((candle) => {
    const volume = candle.volume ?? 0;
    if (volume <= 0) return null;
    const typical = (candle.high + candle.low + candle.close) / 3;
    cumulativeVolume += volume;
    cumulativeValue += typical * volume;
    return cumulativeValue / cumulativeVolume;
  });
}

function rsi(values: number[], period: number): Array<number | null> {
  const output: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return output;

  let gainSum = 0;
  let lossSum = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = values[index] - values[index - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let averageGain = gainSum / period;
  let averageLoss = lossSum / period;
  output[period] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const diff = values[index] - values[index - 1];
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    output[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return output;
}

function trueRange(candles: MarketCandle[]): number[] {
  return candles.map((candle, index) => {
    const previousClose = candles[index - 1]?.close ?? candle.close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
}

export function buildIndicatorVisualSeries(
  candles: MarketCandle[],
  enabledIndicators: EnabledIndicator[]
): IndicatorVisualSeries[] {
  const visibleIndicators = enabledIndicators.filter((indicator) => indicator.visible);
  const visuals: IndicatorVisualSeries[] = [];
  const closeValues = valuesFor(candles, "close");

  visibleIndicators.forEach((indicator, index) => {
    const color = colorFor(index);

    if (indicator.indicatorId === "sma") {
      const period = numberParam(indicator, "period", 20, 1, 500);
      const source = sourceParam(indicator);
      visuals.push({
        key: `${indicator.id}:sma`,
        label: `SMA ${period}`,
        kind: "line",
        pane: "price",
        color,
        data: toLineData(candles, rollingSma(valuesFor(candles, source), period)),
      });
    }

    if (indicator.indicatorId === "ema") {
      const period = numberParam(indicator, "period", 50, 1, 500);
      const source = sourceParam(indicator);
      visuals.push({
        key: `${indicator.id}:ema`,
        label: `EMA ${period}`,
        kind: "line",
        pane: "price",
        color,
        data: toLineData(candles, ema(valuesFor(candles, source), period)),
      });
    }

    if (indicator.indicatorId === "vwap") {
      visuals.push({
        key: `${indicator.id}:vwap`,
        label: "VWAP",
        kind: "line",
        pane: "price",
        color,
        data: toLineData(candles, vwap(candles)),
      });
    }

    if (indicator.indicatorId === "bollinger") {
      const period = numberParam(indicator, "period", 20, 1, 500);
      const multiplier = decimalParam(indicator, "multiplier", 2, 0.5, 10);
      const means = rollingSma(closeValues, period);
      const deviations = rollingStd(closeValues, period, means);
      const upper = means.map((mean, valueIndex) =>
        mean === null || deviations[valueIndex] === null ? null : mean + deviations[valueIndex]! * multiplier
      );
      const lower = means.map((mean, valueIndex) =>
        mean === null || deviations[valueIndex] === null ? null : mean - deviations[valueIndex]! * multiplier
      );

      visuals.push(
        {
          key: `${indicator.id}:bb-upper`,
          label: `BB Upper ${period}`,
          kind: "line",
          pane: "price",
          color,
          data: toLineData(candles, upper),
        },
        {
          key: `${indicator.id}:bb-mid`,
          label: `BB Mid ${period}`,
          kind: "line",
          pane: "price",
          color: "#94a3b8",
          data: toLineData(candles, means),
        },
        {
          key: `${indicator.id}:bb-lower`,
          label: `BB Lower ${period}`,
          kind: "line",
          pane: "price",
          color,
          data: toLineData(candles, lower),
        }
      );
    }

    if (indicator.indicatorId === "volume") {
      visuals.push({
        key: `${indicator.id}:volume`,
        label: "Volume",
        kind: "histogram",
        pane: "volume",
        color,
        data: candles.map((candle) => ({
          time: candle.time,
          value: candle.volume ?? 0,
          color: candle.close >= candle.open ? "rgba(34, 197, 94, 0.55)" : "rgba(239, 68, 68, 0.55)",
        })),
      });
    }

    if (indicator.indicatorId === "rsi") {
      const period = numberParam(indicator, "period", 14, 1, 100);
      visuals.push(
        {
          key: `${indicator.id}:rsi`,
          label: `RSI ${period}`,
          kind: "line",
          pane: "rsi",
          color,
          data: toLineData(candles, rsi(closeValues, period)),
        },
        {
          key: `${indicator.id}:rsi-70`,
          label: "RSI 70",
          kind: "line",
          pane: "rsi",
          color: "rgba(239, 68, 68, 0.7)",
          data: constantLine(candles, 70),
        },
        {
          key: `${indicator.id}:rsi-30`,
          label: "RSI 30",
          kind: "line",
          pane: "rsi",
          color: "rgba(34, 197, 94, 0.7)",
          data: constantLine(candles, 30),
        }
      );
    }

    if (indicator.indicatorId === "macd") {
      const fastPeriod = numberParam(indicator, "fastPeriod", 12, 1, 100);
      const slowPeriod = numberParam(indicator, "slowPeriod", 26, 1, 200);
      const signalPeriod = numberParam(indicator, "signalPeriod", 9, 1, 100);
      const fast = ema(closeValues, fastPeriod);
      const slow = ema(closeValues, slowPeriod);
      const macd = fast.map((fastValue, valueIndex) =>
        fastValue === null || slow[valueIndex] === null ? null : fastValue - slow[valueIndex]!
      );
      const signal = ema(macd, signalPeriod);
      const histogram = macd.map((value, valueIndex) =>
        value === null || signal[valueIndex] === null ? null : value - signal[valueIndex]!
      );

      visuals.push(
        {
          key: `${indicator.id}:macd`,
          label: "MACD",
          kind: "line",
          pane: "macd",
          color,
          data: toLineData(candles, macd),
        },
        {
          key: `${indicator.id}:macd-signal`,
          label: "MACD Signal",
          kind: "line",
          pane: "macd",
          color: "#f59e0b",
          data: toLineData(candles, signal),
        },
        {
          key: `${indicator.id}:macd-hist`,
          label: "MACD Hist",
          kind: "histogram",
          pane: "macd",
          color: "#64748b",
          data: histogram.flatMap((value, valueIndex) => {
            if (value === null || !Number.isFinite(value)) return [];
            return [
              {
                time: candles[valueIndex].time,
                value,
                color: value >= 0 ? "rgba(34, 197, 94, 0.55)" : "rgba(239, 68, 68, 0.55)",
              },
            ];
          }),
        }
      );
    }

    if (indicator.indicatorId === "atr") {
      const period = numberParam(indicator, "period", 14, 1, 100);
      visuals.push({
        key: `${indicator.id}:atr`,
        label: `ATR ${period}`,
        kind: "line",
        pane: "atr",
        color,
        data: toLineData(candles, rollingSma(trueRange(candles), period)),
      });
    }
  });

  return visuals;
}

export function buildIndicatorLegend(enabledIndicators: EnabledIndicator[]): IndicatorLegendItem[] {
  return enabledIndicators
    .filter((indicator) => indicator.visible)
    .map((indicator, index) => {
      const definition = INDICATOR_LIBRARY.find((item) => item.id === indicator.indicatorId);
      const period = indicator.params.period ?? indicator.params.fastPeriod;
      return {
        id: indicator.id,
        label: period ? `${definition?.label ?? indicator.indicatorId} ${period}` : definition?.label ?? indicator.indicatorId,
        color: colorFor(index),
      };
    });
}

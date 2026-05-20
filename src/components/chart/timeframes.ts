export type ChartTimeframeValue = "15s" | "1m" | "5m" | "15m" | "30m" | "1h" | "4h";

export interface ChartTimeframeOption {
  value: ChartTimeframeValue;
  label: string;
  tooltip: string;
  binanceInterval: string;
  seconds: number;
  secondsVisible: boolean;
  sourceLimit?: number;
  aggregateSeconds?: number;
}

export const DEFAULT_CHART_TIMEFRAME: ChartTimeframeValue = "1h";

export const CHART_TIMEFRAMES: ChartTimeframeOption[] = [
  {
    value: "15s",
    label: "15s",
    tooltip: "15 Sekunden",
    binanceInterval: "1s",
    seconds: 15,
    secondsVisible: true,
    sourceLimit: 1000,
    aggregateSeconds: 15,
  },
  {
    value: "1m",
    label: "1m",
    tooltip: "1 Minute",
    binanceInterval: "1m",
    seconds: 60,
    secondsVisible: true,
  },
  {
    value: "5m",
    label: "5m",
    tooltip: "5 Minuten",
    binanceInterval: "5m",
    seconds: 5 * 60,
    secondsVisible: false,
  },
  {
    value: "15m",
    label: "15m",
    tooltip: "15 Minuten",
    binanceInterval: "15m",
    seconds: 15 * 60,
    secondsVisible: false,
  },
  {
    value: "30m",
    label: "30m",
    tooltip: "30 Minuten",
    binanceInterval: "30m",
    seconds: 30 * 60,
    secondsVisible: false,
  },
  {
    value: "1h",
    label: "1h",
    tooltip: "1 Stunde",
    binanceInterval: "1h",
    seconds: 60 * 60,
    secondsVisible: false,
  },
  {
    value: "4h",
    label: "4h",
    tooltip: "4 Stunden",
    binanceInterval: "4h",
    seconds: 4 * 60 * 60,
    secondsVisible: false,
  },
];

export function getChartTimeframe(value: string): ChartTimeframeOption {
  return CHART_TIMEFRAMES.find((option) => option.value === value) ?? CHART_TIMEFRAMES.find((option) => option.value === DEFAULT_CHART_TIMEFRAME)!;
}

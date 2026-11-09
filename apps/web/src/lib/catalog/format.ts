const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const WHOLE_NUMBER_FORMATTER = new Intl.NumberFormat("en", {
  maximumFractionDigits: 0,
});

const USD_COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_STANDARD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCompactAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "n/a";
  }
  return COMPACT_NUMBER_FORMATTER.format(numericValue);
}

export function formatWholeAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "n/a";
  }
  return WHOLE_NUMBER_FORMATTER.format(numericValue);
}

export function formatBaseUnitAmount(
  value: string | number | null | undefined,
  decimals = 7,
  fractionDigits = 4,
): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "n/a";
  }
  return (numericValue / 10 ** decimals).toLocaleString("en", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatAssetAmount(
  value: string | number | null | undefined,
  decimals = 7,
): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "n/a";
  }
  const decimalValue = numericValue / 10 ** decimals;
  const absoluteValue = Math.abs(decimalValue);
  const maximumFractionDigits =
    absoluteValue > 0 && absoluteValue < 0.0001
      ? 7
      : absoluteValue > 0 && absoluteValue < 1
        ? 4
        : 2;
  return decimalValue.toLocaleString("en", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export function formatHumanAssetAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const absoluteValue = Math.abs(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: absoluteValue > 0 && absoluteValue < 0.0001 ? 7 : 4,
  });
}

export function formatUsdBaseUnitAmount(
  value: string | number | null | undefined,
  decimals = 7,
): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "n/a";
  }
  const decimalValue = numericValue / 10 ** decimals;
  const absoluteValue = Math.abs(decimalValue);
  return absoluteValue >= 10_000
    ? USD_COMPACT_FORMATTER.format(decimalValue)
    : USD_STANDARD_FORMATTER.format(decimalValue);
}

export function formatContractLabel(value: string | null | undefined, head = 6, tail = 4): string {
  if (!value) {
    return "Unassigned";
  }
  if (value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function formatBpsAsPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  return `${(value / 100).toFixed(2)}%`;
}

export function formatSignedBpsAsPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value / 100).toFixed(2)}%`;
}

export function formatFeeSummary(mgmtBps: number, perfBps: number): string {
  return `Management ${formatBpsAsPercent(mgmtBps)} · Performance ${formatBpsAsPercent(perfBps)}`;
}

export function formatRelativeTime(
  value: string | null | undefined,
  now = new Date(),
): string {
  if (!value) {
    return "n/a";
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "n/a";
  }
  const deltaSeconds = Math.round((timestamp.getTime() - now.getTime()) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absoluteSeconds < 60) {
    return formatter.format(deltaSeconds, "second");
  }
  if (absoluteSeconds < 3_600) {
    return formatter.format(Math.round(deltaSeconds / 60), "minute");
  }
  if (absoluteSeconds < 86_400) {
    return formatter.format(Math.round(deltaSeconds / 3_600), "hour");
  }
  return formatter.format(Math.round(deltaSeconds / 86_400), "day");
}

export function formatHealthLabel(healthy: boolean, degraded: boolean): string {
  if (!healthy) {
    return "Unavailable";
  }
  if (degraded) {
    return "Delayed";
  }
  return "Healthy";
}

export function formatWeightLabel(weightBps: number): string {
  return `${(weightBps / 100).toFixed(1)}%`;
}

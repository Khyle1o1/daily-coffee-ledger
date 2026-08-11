export function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPercent(n: number): string {
  return `${Number.isFinite(n) ? n.toFixed(2) : "0.00"}%`;
}

export function formatPHP(value: number): string {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** Compact peso formatting for KPI cards and charts (₱32.81M, ₱998K). */
export function formatCompactPHP(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return `${sign}\u20B1${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    const thousands = abs / 1_000;
    const digits = thousands >= 10 ? 0 : 1;
    return `${sign}\u20B1${thousands.toFixed(digits)}K`;
  }
  return `${sign}\u20B1${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

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

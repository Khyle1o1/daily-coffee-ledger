export function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPercent(n: number): string {
  return `${n}%`;
}

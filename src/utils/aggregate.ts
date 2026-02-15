import { CATEGORIES, type Category, type ProcessedRow, type UnmappedSummary } from "./types";

export function aggregateByCategory(rows: ProcessedRow[]) {
  const totals: Record<Category, number> = {} as any;
  const quantities: Record<Category, number> = {} as any;
  for (const cat of CATEGORIES) {
    totals[cat] = 0;
    quantities[cat] = 0;
  }

  for (const row of rows) {
    if (row.status === "SKIPPED") continue;
    if (row.mappedCat && CATEGORIES.includes(row.mappedCat)) {
      totals[row.mappedCat] += row.rowSales;
      quantities[row.mappedCat] += row.quantity;
    }
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const grandQuantity = Object.values(quantities).reduce((a, b) => a + b, 0);

  const percents: Record<Category, number> = {} as any;
  for (const cat of CATEGORIES) {
    percents[cat] = grandTotal > 0 ? Math.round((totals[cat] / grandTotal) * 100) : 0;
  }

  return { totals, quantities, grandTotal, grandQuantity, percents };
}

export function getUnmappedSummary(rows: ProcessedRow[]): UnmappedSummary[] {
  const map = new Map<string, { count: number; totalSales: number }>();
  for (const row of rows) {
    if (row.status !== "UNMAPPED") continue;
    const key = row.rawItemName;
    const existing = map.get(key) || { count: 0, totalSales: 0 };
    existing.count++;
    existing.totalSales += row.rowSales;
    map.set(key, existing);
  }
  return Array.from(map.entries())
    .map(([rawItemName, v]) => ({ rawItemName, ...v }))
    .sort((a, b) => b.totalSales - a.totalSales);
}

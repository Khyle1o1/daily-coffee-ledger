import { CATEGORIES, type Category, type ProcessedRow } from "@/utils/types";
import { buildDailyBreakdown } from "@/lib/reports/dailyBreakdown";

/** Local calendar day (browser TZ) — matches Cash Ledger derive. */
export function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localYmdFromUnknown(value: unknown): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return null;
  return toLocalYmd(d);
}

export function collectLocalDaysFromRowDetails(
  rowDetails: Array<{ transactionDate?: unknown }> | null | undefined,
): Set<string> {
  const days = new Set<string>();
  for (const row of rowDetails ?? []) {
    const day = localYmdFromUnknown(row.transactionDate);
    if (day) days.add(day);
  }
  return days;
}

export function contentDateBoundsFromRowDetails(
  rowDetails: Array<{ transactionDate?: unknown }> | null | undefined,
): { start: string; end: string } | null {
  const days = [...collectLocalDaysFromRowDetails(rowDetails)].sort();
  if (days.length === 0) return null;
  return { start: days[0], end: days[days.length - 1] };
}

/**
 * Rebuild summary aggregates after rowDetails were filtered (e.g. overlap strip).
 */
export function rebuildSummaryJsonFromRowDetails(
  summaryJson: Record<string, unknown>,
  keptRows: ProcessedRow[],
): Record<string, unknown> {
  const totals = {} as Record<Category, number>;
  const quantities = {} as Record<Category, number>;
  for (const cat of CATEGORIES) {
    totals[cat] = 0;
    quantities[cat] = 0;
  }

  let mapped = 0;
  let unmapped = 0;
  let skipped = 0;
  const unmappedMap = new Map<string, { count: number; totalSales: number }>();

  for (const row of keptRows) {
    if (row.status === "SKIPPED") {
      skipped += 1;
      continue;
    }
    if (row.status === "UNMAPPED") {
      unmapped += 1;
      const key = row.rawItemName || "(blank)";
      const cur = unmappedMap.get(key) || { count: 0, totalSales: 0 };
      cur.count += 1;
      cur.totalSales += Number(row.rowSales) || 0;
      unmappedMap.set(key, cur);
      continue;
    }
    mapped += 1;
    const cat = row.mappedCat;
    if (cat && CATEGORIES.includes(cat as Category)) {
      totals[cat as Category] += Number(row.rowSales) || 0;
      quantities[cat as Category] += Number(row.quantity) || 0;
    }
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const grandQuantity = Object.values(quantities).reduce((a, b) => a + b, 0);
  const percentByCat = {} as Record<Category, number>;
  for (const cat of CATEGORIES) {
    percentByCat[cat] = grandTotal > 0 ? Math.round((totals[cat] / grandTotal) * 100) : 0;
  }

  const unmappedSummary = [...unmappedMap.entries()]
    .map(([rawItemName, v]) => ({ rawItemName, ...v }))
    .sort((a, b) => b.totalSales - a.totalSales);

  return {
    ...summaryJson,
    rowDetails: keptRows,
    totalRows: keptRows.length,
    mappedRows: mapped,
    unmappedRows: unmapped,
    skippedRows: skipped,
    summaryTotalsByCat: totals,
    summaryQuantitiesByCat: quantities,
    grandTotal,
    grandQuantity,
    percentByCat,
    unmappedSummary,
    dailyBreakdown: buildDailyBreakdown(keptRows),
  };
}

import { CATEGORIES, type Category, type DailyBreakdownMap, type DailyReport, type DayTotals, type ProcessedRow } from "@/utils/types";

/**
 * HQ Sync calendar day for a transactionDate.
 * Matches report_line_totals / left(ISO, 10): UTC date from the stored timestamp,
 * not the browser's local calendar day. Local-midnight PH uploads serialize to the
 * previous UTC day — Monthly Branch must use this same key so it matches HQ Sync.
 */
export function reportTxnUtcYmd(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  if (typeof value === "number") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function emptyDayTotals(): DayTotals {
  const totals = {} as Record<Category, number>;
  const quantities = {} as Record<Category, number>;
  for (const cat of CATEGORIES) {
    totals[cat] = 0;
    quantities[cat] = 0;
  }
  return { totals, quantities, grandTotal: 0, grandQuantity: 0 };
}

function addRowInto(cell: DayTotals, row: ProcessedRow) {
  if (row.status === "SKIPPED") return;
  if (row.mappedCat && CATEGORIES.includes(row.mappedCat)) {
    cell.totals[row.mappedCat] += Number(row.rowSales) || 0;
    cell.quantities[row.mappedCat] += Number(row.quantity) || 0;
    cell.grandTotal += Number(row.rowSales) || 0;
    cell.grandQuantity += Number(row.quantity) || 0;
  }
}

export function percentsFromTotals(
  totals: Record<Category, number>,
  grandTotal: number,
): Record<Category, number> {
  const percents = {} as Record<Category, number>;
  for (const cat of CATEGORIES) {
    percents[cat] = grandTotal > 0 ? Math.round((totals[cat] / grandTotal) * 100) : 0;
  }
  return percents;
}

/**
 * Calendar day shown on the upload preview and stored on dailyBreakdown.
 * Date-only CSV values are local midnight. In Philippine time that instant is
 * still the previous UTC day, so the UTC key would drop the last day of the
 * file range (Sep 28 labeled Sep 27). Use the local calendar day instead.
 */
export function reportTxnLocalYmd(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildDailyBreakdown(rows: ProcessedRow[] | null | undefined): DailyBreakdownMap {
  const byDay = new Map<string, DayTotals>();
  for (const row of rows ?? []) {
    const day = reportTxnLocalYmd(row.transactionDate);
    if (!day) continue;
    let cell = byDay.get(day);
    if (!cell) {
      cell = emptyDayTotals();
      byDay.set(day, cell);
    }
    addRowInto(cell, row);
  }
  const out: DailyBreakdownMap = {};
  for (const day of [...byDay.keys()].sort()) {
    out[day] = byDay.get(day)!;
  }
  return out;
}

export function daysInRange(
  map: DailyBreakdownMap | null | undefined,
  fromYmd?: string | null,
  toYmd?: string | null,
): string[] {
  const from = fromYmd?.slice(0, 10) || null;
  const to = toYmd?.slice(0, 10) || null;
  return Object.keys(map ?? {})
    .filter((day) => (!from || day >= from) && (!to || day <= to))
    .sort();
}

export function daysInMonth(
  map: DailyBreakdownMap | null | undefined,
  monthKey: string,
): string[] {
  const prefix = monthKey.slice(0, 7);
  return Object.keys(map ?? {})
    .filter((day) => day.slice(0, 7) === prefix)
    .sort();
}

export function sliceDailyBreakdown(
  map: DailyBreakdownMap | null | undefined,
  fromYmd?: string | null,
  toYmd?: string | null,
): DayTotals & { percents: Record<Category, number> } {
  const combined = emptyDayTotals();
  for (const day of daysInRange(map, fromYmd, toYmd)) {
    const cell = map![day];
    for (const cat of CATEGORIES) {
      combined.totals[cat] += cell.totals[cat] || 0;
      combined.quantities[cat] += cell.quantities[cat] || 0;
    }
    combined.grandTotal += cell.grandTotal || 0;
    combined.grandQuantity += cell.grandQuantity || 0;
  }
  return {
    ...combined,
    percents: percentsFromTotals(combined.totals, combined.grandTotal),
  };
}

export function sliceDailyBreakdownByMonth(
  map: DailyBreakdownMap | null | undefined,
  monthKey: string,
): DayTotals & { percents: Record<Category, number> } {
  const prefix = monthKey.slice(0, 7);
  return sliceDailyBreakdown(map, `${prefix}-01`, `${prefix}-31`);
}

export function hasDailyBreakdown(report: Pick<DailyReport, "dailyBreakdown">): boolean {
  return !!report.dailyBreakdown && Object.keys(report.dailyBreakdown).length > 0;
}

function fileTotals(report: DailyReport): DayTotals & { percents: Record<Category, number> } {
  return {
    totals: report.summaryTotalsByCat,
    quantities: report.summaryQuantitiesByCat,
    grandTotal: report.grandTotal,
    grandQuantity: report.grandQuantity,
    percents: report.percentByCat,
  };
}

/**
 * Totals for a report inside [fromYmd, toYmd].
 * Prefers dailyBreakdown (list/meta), then rowDetails, then full-file totals.
 */
export function effectiveTotalsFromReport(
  report: DailyReport,
  fromYmd?: string | null,
  toYmd?: string | null,
): DayTotals & { percents: Record<Category, number> } {
  if (!fromYmd && !toYmd) return fileTotals(report);

  const from = fromYmd?.slice(0, 10) ?? "0000-01-01";
  const to = toYmd?.slice(0, 10) ?? "9999-12-31";
  const reportStart = report.date.slice(0, 10);
  const reportEnd = (report.dateRangeEnd ?? report.date).slice(0, 10);

  if (reportStart >= from && reportEnd <= to) return fileTotals(report);

  if (hasDailyBreakdown(report)) {
    return sliceDailyBreakdown(report.dailyBreakdown, from, to);
  }

  if (report.rowDetails?.some((r) => r.transactionDate != null)) {
    return sliceDailyBreakdown(buildDailyBreakdown(report.rowDetails), from, to);
  }

  return fileTotals(report);
}

export function calendarDaysForReport(report: DailyReport): string[] {
  if (hasDailyBreakdown(report)) return Object.keys(report.dailyBreakdown!).sort();
  if (report.rowDetails?.some((r) => r.transactionDate != null)) {
    return Object.keys(buildDailyBreakdown(report.rowDetails)).sort();
  }
  return report.date ? [report.date.slice(0, 10)] : [];
}

export function dayTotalsForReport(report: DailyReport, day: string): DayTotals {
  if (hasDailyBreakdown(report) && report.dailyBreakdown![day]) {
    return report.dailyBreakdown![day];
  }
  if (report.rowDetails?.some((r) => r.transactionDate != null)) {
    return buildDailyBreakdown(report.rowDetails)[day] ?? emptyDayTotals();
  }
  if (day === report.date.slice(0, 10)) {
    return {
      totals: report.summaryTotalsByCat,
      quantities: report.summaryQuantitiesByCat,
      grandTotal: report.grandTotal,
      grandQuantity: report.grandQuantity,
    };
  }
  return emptyDayTotals();
}

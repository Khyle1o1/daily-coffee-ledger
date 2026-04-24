import type { DailyReport } from "@/utils/types";
import { CATEGORIES } from "@/utils/types";
import type { ReportFilters } from "./compute";
import { getRowsForFilters } from "./compute";
import { getChannelFromPaymentType } from "./channel";

// ── Month name lookup ────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// ── Public types ─────────────────────────────────────────────────────────────

export interface ChannelPeriodRow {
  /** Human-readable label, e.g. "March" or "April 1–11" */
  periodLabel: string;
  /** ISO-style sort key, e.g. "2026-03" */
  periodKey: string;
  foodpanda: number;
  grab: number;
  walkIn: number;
  event: number;
  dotapp: number;
  total: number;
}

export interface ChannelSalesSummaryData {
  rows: ChannelPeriodRow[];
  totals: {
    foodpanda: number;
    grab: number;
    walkIn: number;
    event: number;
    dotapp: number;
    total: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip the time from a Date so we compare calendar days only. */
function calendarDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ── Main compute ─────────────────────────────────────────────────────────────

/**
 * Build the Channel Sales Summary report.
 *
 * Groups all transaction rows (across every category) by calendar month and by
 * sales channel (FoodPanda, Grab, Walk-in, Event, Dot App).
 *
 * Period labels:
 *   - Full month within the date range  → "March"
 *   - Partial month at either end       → "April 1–11"
 */
export function computeChannelSalesSummary(
  reports: DailyReport[],
  filters: ReportFilters,
): ChannelSalesSummaryData {
  // Include ALL mapped categories (channel report is not category-filtered)
  const allCatFilters: ReportFilters = {
    ...filters,
    selectedCategories: [...CATEGORIES],
  };

  const rows = getRowsForFilters(reports, allCatFilters);

  const start = calendarDay(new Date(filters.dateFrom));
  const end   = calendarDay(new Date(filters.dateTo));

  // ── Bucket rows by year-month ───────────────────────────────────────────────
  type Bucket = { foodpanda: number; grab: number; walkIn: number; event: number; dotapp: number };
  const byMonth = new Map<string, Bucket>();

  for (const row of rows) {
    if (!(row.transactionDate instanceof Date)) continue;
    const d = row.transactionDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    let bucket = byMonth.get(key);
    if (!bucket) {
      bucket = { foodpanda: 0, grab: 0, walkIn: 0, event: 0, dotapp: 0 };
      byMonth.set(key, bucket);
    }

    const channel = getChannelFromPaymentType(row.paymentType);
    const sales = Number.isFinite(row.rowSales) ? row.rowSales : 0;

    if      (channel === "GRAB")      bucket.grab      += sales;
    else if (channel === "FOODPANDA") bucket.foodpanda += sales;
    else if (channel === "DOTAPP")    bucket.dotapp    += sales;
    else if (channel === "EVENT")     bucket.event     += sales;
    else                              bucket.walkIn    += sales;
  }

  // ── Build period rows (sorted oldest → newest) ────────────────────────────
  const periodRows: ChannelPeriodRow[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, bucket]) => {
      const [yearStr, monthStr] = monthKey.split("-");
      const year     = Number(yearStr);
      const monthIdx = Number(monthStr) - 1; // 0-based

      const firstOfMonth = new Date(year, monthIdx, 1);
      const lastOfMonth  = new Date(year, monthIdx + 1, 0);

      // Clamp the period to the selected date range
      const periodStart = firstOfMonth < start ? start : firstOfMonth;
      const periodEnd   = lastOfMonth  > end   ? end   : lastOfMonth;

      // Full month when we cover the entire calendar month within the filter
      const isFullMonth =
        periodStart.getDate() === 1 &&
        periodEnd.getDate()   === lastOfMonth.getDate();

      const periodLabel = isFullMonth
        ? MONTH_NAMES[monthIdx]
        : `${MONTH_NAMES[monthIdx]} ${periodStart.getDate()}–${periodEnd.getDate()}`;

      const total =
        bucket.foodpanda + bucket.grab + bucket.walkIn +
        bucket.event     + bucket.dotapp;

      return {
        periodLabel,
        periodKey: monthKey,
        foodpanda: bucket.foodpanda,
        grab:      bucket.grab,
        walkIn:    bucket.walkIn,
        event:     bucket.event,
        dotapp:    bucket.dotapp,
        total,
      };
    });

  // ── Grand totals ─────────────────────────────────────────────────────────
  const totals = periodRows.reduce(
    (acc, r) => ({
      foodpanda: acc.foodpanda + r.foodpanda,
      grab:      acc.grab      + r.grab,
      walkIn:    acc.walkIn    + r.walkIn,
      event:     acc.event     + r.event,
      dotapp:    acc.dotapp    + r.dotapp,
      total:     acc.total     + r.total,
    }),
    { foodpanda: 0, grab: 0, walkIn: 0, event: 0, dotapp: 0, total: 0 },
  );

  console.log("[ChannelSalesSummary] periods:", periodRows.length, "total:", totals.total);

  return { rows: periodRows, totals };
}

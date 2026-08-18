import { CATEGORIES, type BranchId, type Category, type DailyReport } from "@/utils/types";
import { formatMonthDisplay } from "@/utils/aggregateMonthly";
import {
  hasDailyBreakdown,
  sliceDailyBreakdown,
  sliceDailyBreakdownByMonth,
} from "@/lib/reports/dailyBreakdown";

export type CategoryFilter = Category | "all";

export interface MonthlyBranchFilters {
  year: number | "all";
  /** YYYY-MM or "all" */
  monthKey: string | "all";
  branchId: BranchId | "all";
  category: CategoryFilter;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface MonthlyBranchTableRow {
  monthKey: string;
  monthLabel: string;
  branchId: BranchId;
  branchLabel: string;
  totals: Record<Category, number>;
  totalSales: number;
  grandTotal: number;
  reportCount: number;
  reports: Array<{
    id: string;
    date: string;
    dateRangeEnd: string;
    filename: string;
    grandTotal: number;
    totals: Record<Category, number>;
  }>;
}

export interface MonthlyBranchOverview {
  totalSales: number;
  branchesWithData: number;
  monthsWithData: number;
  averageMonthlySales: number;
  highestBranch: { id: BranchId; label: string; sales: number } | null;
  highestMonth: { monthKey: string; label: string; sales: number } | null;
}

export interface BranchComparisonMonth {
  monthKey: string;
  monthLabel: string;
  branches: Array<{ id: BranchId; label: string; sales: number }>;
}

export interface MonthlyTrendPoint {
  monthKey: string;
  monthLabel: string;
  sales: number | null;
  hasData: boolean;
}

export interface BranchPerfPoint {
  id: BranchId;
  label: string;
  sales: number;
}

export interface MonthlyBranchReportResult {
  filters: MonthlyBranchFilters;
  generatedAt: string;
  availableYears: number[];
  availableMonths: Array<{ monthKey: string; label: string; year: number }>;
  availableBranches: Array<{ id: BranchId; label: string }>;
  overview: MonthlyBranchOverview;
  tableRows: MonthlyBranchTableRow[];
  branchComparison: BranchComparisonMonth[];
  monthlyTrend: MonthlyTrendPoint[];
  branchPerformance: BranchPerfPoint[];
  hasData: boolean;
}

function emptyTotals(): Record<Category, number> {
  const t = {} as Record<Category, number>;
  for (const cat of CATEGORIES) t[cat] = 0;
  return t;
}

function cloneTotals(from: Partial<Record<Category, number>> | undefined): Record<Category, number> {
  const t = emptyTotals();
  for (const cat of CATEGORIES) t[cat] = Number(from?.[cat] ?? 0) || 0;
  return t;
}

function addTotals(
  into: Record<Category, number>,
  from: Partial<Record<Category, number>> | undefined,
) {
  for (const cat of CATEGORIES) {
    into[cat] += Number(from?.[cat] ?? 0) || 0;
  }
}

function monthSliceForReport(report: DailyReport, monthKey: string) {
  if (hasDailyBreakdown(report)) {
    return sliceDailyBreakdownByMonth(report.dailyBreakdown, monthKey);
  }
  return {
    totals: cloneTotals(report.summaryTotalsByCat),
    grandTotal: report.grandTotal,
  };
}

function salesForCategory(
  totals: Record<Category, number>,
  grandTotal: number,
  category: CategoryFilter,
): number {
  if (category === "all") return grandTotal;
  return Number(totals[category] ?? 0) || 0;
}

/** Inclusive YYYY-MM keys overlapping [start, end] (YYYY-MM-DD). */
export function monthsOverlappingRange(startYmd: string, endYmd: string): string[] {
  const start = startYmd.slice(0, 10);
  const end = (endYmd || startYmd).slice(0, 10);
  if (!start || start > end) return [];

  const out: string[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  const endY = Number(end.slice(0, 4));
  const endM = Number(end.slice(5, 7));

  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function maxYmd(a?: string | null, b?: string | null): string | null {
  const aa = a?.slice(0, 10) || null;
  const bb = b?.slice(0, 10) || null;
  if (!aa) return bb;
  if (!bb) return aa;
  return aa >= bb ? aa : bb;
}

function minYmd(a?: string | null, b?: string | null): string | null {
  const aa = a?.slice(0, 10) || null;
  const bb = b?.slice(0, 10) || null;
  if (!aa) return bb;
  if (!bb) return aa;
  return aa <= bb ? aa : bb;
}

function reportOverlapsDateRange(
  report: DailyReport,
  dateFrom?: string | null,
  dateTo?: string | null,
): boolean {
  if (!dateFrom && !dateTo) return true;
  const start = report.date.slice(0, 10);
  const end = (report.dateRangeEnd ?? report.date).slice(0, 10);
  const from = dateFrom?.slice(0, 10) ?? "0000-01-01";
  const to = dateTo?.slice(0, 10) ?? "9999-12-31";
  return start <= to && end >= from;
}

/**
 * Discover years / months / branches that actually have ledger uploads.
 * Months come from each report's date_range overlap (never a fake full calendar).
 */
export function discoverMonthlyBranchOptions(
  reports: DailyReport[],
  getBranchLabel: (id: string) => string,
): {
  years: number[];
  months: Array<{ monthKey: string; label: string; year: number }>;
  branches: Array<{ id: BranchId; label: string }>;
} {
  const monthSet = new Set<string>();
  const branchMap = new Map<BranchId, string>();

  for (const r of reports) {
    const start = r.date.slice(0, 10);
    const end = (r.dateRangeEnd ?? r.date).slice(0, 10);
    for (const mk of monthsOverlappingRange(start, end)) monthSet.add(mk);
    if (!branchMap.has(r.branch)) branchMap.set(r.branch, getBranchLabel(r.branch));
  }

  const months = Array.from(monthSet)
    .sort((a, b) => a.localeCompare(b))
    .map((monthKey) => ({
      monthKey,
      label: formatMonthDisplay(monthKey),
      year: Number(monthKey.slice(0, 4)),
    }));

  const years = Array.from(new Set(months.map((m) => m.year))).sort((a, b) => b - a);

  const branches = Array.from(branchMap.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { years, months, branches };
}

/**
 * Build Monthly Branch Report from daily meta (same Summary totals fields).
 *
 * Month membership uses date-range *overlap* (like Summary), not report_date alone.
 * Dual-month uploads (e.g. Jun 1–Jul 31 with report_date=Jun 1) appear under both
 * June and July when browsing by month — matching Summary's July filter.
 *
 * Overview totalSales / branchPerformance always count each upload once (by id)
 * so "All Months" is not double-counted.
 */
export function computeMonthlyBranchReport(
  reports: DailyReport[],
  filters: MonthlyBranchFilters,
  getBranchLabel: (id: string) => string,
): MonthlyBranchReportResult {
  const discovered = discoverMonthlyBranchOptions(reports, getBranchLabel);

  type Agg = {
    totals: Record<Category, number>;
    grandTotal: number;
    reports: MonthlyBranchTableRow["reports"];
    reportIds: Set<string>;
  };
  const cellMap = new Map<string, Agg>();
  const uniqueReports = new Map<string, DailyReport>();

  for (const r of reports) {
    if (!reportOverlapsDateRange(r, filters.dateFrom, filters.dateTo)) continue;
    if (filters.branchId !== "all" && r.branch !== filters.branchId) continue;

    const start = r.date.slice(0, 10);
    const end = (r.dateRangeEnd ?? r.date).slice(0, 10);
    let months = monthsOverlappingRange(start, end);
    if (months.length === 0) continue;

    if (filters.year !== "all") {
      months = months.filter((mk) => Number(mk.slice(0, 4)) === filters.year);
      if (months.length === 0) continue;
    }

    if (filters.monthKey !== "all") {
      if (!months.includes(filters.monthKey)) continue;
      months = [filters.monthKey];
    }

    uniqueReports.set(r.id, r);

    for (const monthKey of months) {
      const sliced = hasDailyBreakdown(r)
        ? sliceDailyBreakdown(
            r.dailyBreakdown,
            maxYmd(filters.dateFrom, `${monthKey}-01`),
            minYmd(filters.dateTo, `${monthKey}-31`),
          )
        : monthSliceForReport(r, monthKey);
      applyCell(monthKey, r, sliced);
    }
  }

  function applyCell(
    monthKey: string,
    r: DailyReport,
    sliced: { totals: Record<Category, number>; grandTotal: number },
  ) {
    const key = `${monthKey}::${r.branch}`;
    let cell = cellMap.get(key);
    if (!cell) {
      cell = {
        totals: emptyTotals(),
        grandTotal: 0,
        reports: [],
        reportIds: new Set(),
      };
      cellMap.set(key, cell);
    }
    if (cell.reportIds.has(r.id)) return;
    cell.reportIds.add(r.id);
    addTotals(cell.totals, sliced.totals);
    cell.grandTotal += sliced.grandTotal;
    cell.reports.push({
      id: r.id,
      date: r.date,
      dateRangeEnd: r.dateRangeEnd ?? r.date,
      filename: r.filename,
      grandTotal: sliced.grandTotal,
      totals: cloneTotals(sliced.totals),
    });
  }

  const tableRows: MonthlyBranchTableRow[] = Array.from(cellMap.entries())
    .map(([key, cell]) => {
      const [monthKey, branchId] = key.split("::");
      const totalSales = salesForCategory(cell.totals, cell.grandTotal, filters.category);
      if (filters.category !== "all" && totalSales <= 0) return null;
      return {
        monthKey,
        monthLabel: formatMonthDisplay(monthKey),
        branchId: branchId as BranchId,
        branchLabel: getBranchLabel(branchId),
        totals: cell.totals,
        totalSales,
        grandTotal: cell.grandTotal,
        reportCount: cell.reports.length,
        reports: cell.reports.sort((a, b) => a.date.localeCompare(b.date)),
      };
    })
    .filter((row): row is MonthlyBranchTableRow => row != null)
    .sort((a, b) => {
      const m = a.monthKey.localeCompare(b.monthKey);
      if (m !== 0) return m;
      return b.totalSales - a.totalSales;
    });

  const hasData = tableRows.length > 0;

  // Per-month / per-branch display totals (may include dual-month uploads in each month)
  const branchSalesDisplay = new Map<BranchId, number>();
  const monthSales = new Map<string, number>();
  for (const row of tableRows) {
    branchSalesDisplay.set(
      row.branchId,
      (branchSalesDisplay.get(row.branchId) ?? 0) + row.totalSales,
    );
    monthSales.set(row.monthKey, (monthSales.get(row.monthKey) ?? 0) + row.totalSales);
  }

  // Unique-upload totals for overview (no double-count across months)
  let uniqueTotalSales = 0;
  const uniqueBranchSales = new Map<BranchId, number>();
  for (const r of uniqueReports.values()) {
    let from = filters.dateFrom;
    let to = filters.dateTo;
    if (filters.monthKey !== "all") {
      from = maxYmd(from, `${filters.monthKey}-01`);
      to = minYmd(to, `${filters.monthKey}-31`);
    } else if (filters.year !== "all") {
      from = maxYmd(from, `${filters.year}-01-01`);
      to = minYmd(to, `${filters.year}-12-31`);
    }
    const sliced = hasDailyBreakdown(r)
      ? sliceDailyBreakdown(r.dailyBreakdown, from, to)
      : { totals: cloneTotals(r.summaryTotalsByCat), grandTotal: r.grandTotal };
    const sales = salesForCategory(sliced.totals, sliced.grandTotal, filters.category);
    if (filters.category !== "all" && sales <= 0) continue;
    uniqueTotalSales += sales;
    uniqueBranchSales.set(r.branch, (uniqueBranchSales.get(r.branch) ?? 0) + sales);
  }

  const monthsWithData = monthSales.size;
  let highestBranch: MonthlyBranchOverview["highestBranch"] = null;
  for (const [id, sales] of uniqueBranchSales) {
    if (!highestBranch || sales > highestBranch.sales) {
      highestBranch = { id, label: getBranchLabel(id), sales };
    }
  }
  let highestMonth: MonthlyBranchOverview["highestMonth"] = null;
  for (const [monthKey, sales] of monthSales) {
    if (!highestMonth || sales > highestMonth.sales) {
      highestMonth = { monthKey, label: formatMonthDisplay(monthKey), sales };
    }
  }

  const overview: MonthlyBranchOverview = {
    totalSales: uniqueTotalSales,
    branchesWithData: uniqueBranchSales.size,
    monthsWithData,
    averageMonthlySales: monthsWithData > 0 ? uniqueTotalSales / monthsWithData : 0,
    highestBranch,
    highestMonth,
  };

  const comparisonMap = new Map<string, BranchComparisonMonth>();
  for (const row of tableRows) {
    let block = comparisonMap.get(row.monthKey);
    if (!block) {
      block = { monthKey: row.monthKey, monthLabel: row.monthLabel, branches: [] };
      comparisonMap.set(row.monthKey, block);
    }
    const existing = block.branches.find((b) => b.id === row.branchId);
    if (existing) existing.sales += row.totalSales;
    else block.branches.push({ id: row.branchId, label: row.branchLabel, sales: row.totalSales });
  }
  const branchComparison = Array.from(comparisonMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((block) => ({
      ...block,
      branches: [...block.branches].sort((a, b) => b.sales - a.sales),
    }));

  let trendKeys: string[];
  if (filters.monthKey !== "all") {
    trendKeys = [filters.monthKey];
  } else if (filters.year !== "all") {
    trendKeys = discovered.months.filter((m) => m.year === filters.year).map((m) => m.monthKey);
  } else {
    trendKeys = discovered.months.map((m) => m.monthKey);
  }

  const monthlyTrend: MonthlyTrendPoint[] = trendKeys.map((monthKey) => {
    const sales = monthSales.get(monthKey);
    return {
      monthKey,
      monthLabel: formatMonthDisplay(monthKey),
      sales: sales === undefined ? null : sales,
      hasData: sales !== undefined,
    };
  });

  // Branch performance chart: for a single month use that month's rows; else unique totals
  const branchPerformance: BranchPerfPoint[] =
    filters.monthKey !== "all"
      ? Array.from(
          (branchComparison.find((b) => b.monthKey === filters.monthKey)?.branches ?? []).map(
            (b) => ({ id: b.id, label: b.label, sales: b.sales }),
          ),
        )
      : Array.from(uniqueBranchSales.entries())
          .map(([id, sales]) => ({ id, label: getBranchLabel(id), sales }))
          .sort((a, b) => b.sales - a.sales);

  const availableMonths =
    filters.year === "all"
      ? discovered.months
      : discovered.months.filter((m) => m.year === filters.year);

  const availableBranches = discovered.branches.filter((b) =>
    reports.some((r) => {
      if (r.branch !== b.id) return false;
      const start = r.date.slice(0, 10);
      const end = (r.dateRangeEnd ?? r.date).slice(0, 10);
      const months = monthsOverlappingRange(start, end);
      if (filters.monthKey !== "all") return months.includes(filters.monthKey);
      if (filters.year !== "all") {
        return months.some((mk) => Number(mk.slice(0, 4)) === filters.year);
      }
      return true;
    }),
  );

  return {
    filters,
    generatedAt: new Date().toISOString(),
    availableYears: discovered.years,
    availableMonths,
    availableBranches,
    overview,
    tableRows,
    branchComparison,
    monthlyTrend,
    branchPerformance,
    hasData,
  };
}

/** Drill-down for one branch (optional month). Uses date-range overlap like Summary. */
export function computeBranchDrillDown(
  reports: DailyReport[],
  branchId: BranchId,
  getBranchLabel: (id: string) => string,
  monthKey: string | "all" = "all",
): {
  branchId: BranchId;
  branchLabel: string;
  monthly: Array<{
    monthKey: string;
    monthLabel: string;
    totals: Record<Category, number>;
    grandTotal: number;
  }>;
  daily: Array<{
    date: string;
    dateRangeEnd: string;
    filename: string;
    totals: Record<Category, number>;
    grandTotal: number;
  }>;
  totals: Record<Category, number>;
  grandTotal: number;
} | null {
  const branchReports = reports.filter((r) => {
    if (r.branch !== branchId) return false;
    if (monthKey === "all") return true;
    const start = r.date.slice(0, 10);
    const end = (r.dateRangeEnd ?? r.date).slice(0, 10);
    return monthsOverlappingRange(start, end).includes(monthKey);
  });

  if (branchReports.length === 0) return null;

  const monthlyMap = new Map<string, { totals: Record<Category, number>; grandTotal: number }>();
  const totals = emptyTotals();
  const seen = new Set<string>();
  const daily: Array<{
    date: string;
    dateRangeEnd: string;
    filename: string;
    totals: Record<Category, number>;
    grandTotal: number;
  }> = [];

  for (const r of branchReports) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);

    if (hasDailyBreakdown(r)) {
      const days = Object.keys(r.dailyBreakdown!)
        .filter((day) => monthKey === "all" || day.slice(0, 7) === monthKey)
        .sort();
      for (const day of days) {
        const cell = r.dailyBreakdown![day];
        addTotals(totals, cell.totals);
        const mk = day.slice(0, 7);
        let m = monthlyMap.get(mk);
        if (!m) {
          m = { totals: emptyTotals(), grandTotal: 0 };
          monthlyMap.set(mk, m);
        }
        addTotals(m.totals, cell.totals);
        m.grandTotal += cell.grandTotal;
        daily.push({
          date: day,
          dateRangeEnd: day,
          filename: r.filename,
          totals: cloneTotals(cell.totals),
          grandTotal: cell.grandTotal,
        });
      }
      continue;
    }

    const t = cloneTotals(r.summaryTotalsByCat);
    addTotals(totals, r.summaryTotalsByCat);
    const start = r.date.slice(0, 10);
    const end = (r.dateRangeEnd ?? r.date).slice(0, 10);
    const months =
      monthKey !== "all" ? [monthKey] : monthsOverlappingRange(start, end);
    for (const mk of months) {
      let m = monthlyMap.get(mk);
      if (!m) {
        m = { totals: emptyTotals(), grandTotal: 0 };
        monthlyMap.set(mk, m);
      }
      addTotals(m.totals, r.summaryTotalsByCat);
      m.grandTotal += r.grandTotal;
    }
    daily.push({
      date: r.date,
      dateRangeEnd: r.dateRangeEnd ?? r.date,
      filename: r.filename,
      totals: t,
      grandTotal: r.grandTotal,
    });
  }

  daily.sort((a, b) => a.date.localeCompare(b.date));
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  const monthly = Array.from(monthlyMap.entries())
    .map(([mk, v]) => ({
      monthKey: mk,
      monthLabel: formatMonthDisplay(mk),
      totals: v.totals,
      grandTotal: v.grandTotal,
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  return {
    branchId,
    branchLabel: getBranchLabel(branchId),
    monthly,
    daily,
    totals,
    grandTotal,
  };
}

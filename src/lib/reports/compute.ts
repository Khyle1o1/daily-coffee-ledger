import type { DailyReport, Category, ProcessedRow } from "@/utils/types";
import { CATEGORIES } from "@/utils/types";
import { filterRowsByDateRange } from "./filterRowsByDateRange";
import type { Top5ByChannel } from "./computeTop5ByChannel";
import { computeTop5ByChannelFromRows } from "./computeTop5ByChannel";
import { getPercentChange } from "@/utils/percentChange";
import { hasDailyBreakdown, sliceDailyBreakdown } from "./dailyBreakdown";

// ============================================================================
// Filter types
// ============================================================================

export interface ReportFilters {
  branchId: string | "all" | string[];
  dateFrom: string;    // YYYY-MM-DD
  dateTo: string;      // YYYY-MM-DD
  compareFrom?: string | null;
  compareTo?: string | null;
  selectedCategories: Category[];
}

// ============================================================================
// Output types
// ============================================================================

export interface CategoryTotal {
  category: Category;
  sales: number;
  qty: number;
  percent: number;
  compareSales?: number;
  compareQty?: number;
  pctChange?: number;
}

export interface ProductTotal {
  name: string;
  category: Category;
  sales: number;
  qty: number;
  compareSales?: number;
  compareQty?: number;
  pctChange?: number;
}

export interface TopProduct {
  rank: number;
  name: string;
  category: Category;
  sales: number;
  qty: number;
}

export interface ComputedSalesMix {
  categoryTotals: CategoryTotal[];
  grandTotal: number;
  compareGrandTotal?: number;
  top5ByChannel?: Top5ByChannel;
}

export interface ComputedProductMix {
  category: Category | null;
  products: ProductTotal[];
  totalSales: number;
  compareTotalSales?: number;
}

export interface ComputedProductMixByCategory {
  groups: ComputedProductMix[]; // each group has category set
  excludedCategories?: Category[];
  grandTotalSales: number;
}

export interface ComputedTop5 {
  topByCategory: Record<string, TopProduct[]>;
  grandTotal: number;
}

export interface ComputedCategoryPerformance {
  categories: CategoryTotal[];
  grandTotal: number;
}

// ============================================================================
// Internal helpers
// ============================================================================

function filterReportsByBranch(
  reports: DailyReport[],
  branchId: string | "all" | string[]
): DailyReport[] {
  if (branchId === "all") return reports;
  if (Array.isArray(branchId)) {
    if (branchId.length === 0) return reports;
    const set = new Set(branchId);
    return reports.filter((r) => set.has(r.branch));
  }
  return reports.filter((r) => r.branch === branchId);
}

function getActiveCats(filters: ReportFilters): Category[] {
  return filters.selectedCategories.length > 0
    ? filters.selectedCategories
    : [...CATEGORIES];
}

const getRowsMemo = new WeakMap<object, Map<string, ProcessedRow[]>>();

function serializeFiltersForRows(filters: ReportFilters): string {
  const cats = getActiveCats(filters).slice().sort().join(",");
  const branch =
    Array.isArray(filters.branchId)
      ? filters.branchId.slice().sort().join(",")
      : String(filters.branchId);
  return `${branch}|${filters.dateFrom}|${filters.dateTo}|${cats}`;
}

function getRows(reports: DailyReport[], filters: ReportFilters): ProcessedRow[] {
  const cacheKey = serializeFiltersForRows(filters);
  let cache = getRowsMemo.get(reports);
  if (!cache) {
    cache = new Map();
    getRowsMemo.set(reports, cache);
  }
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const activeCats = getActiveCats(filters);
  const byBranch = filterReportsByBranch(reports, filters.branchId);

  const start = new Date(filters.dateFrom);
  const end = new Date(filters.dateTo);

  const allRows: ProcessedRow[] = byBranch.flatMap((r) =>
    r.rowDetails.filter((row) => row.transactionDate instanceof Date),
  );

  if (import.meta.env.DEV) {
    if (allRows.length === 0) {
      console.warn("[DateDebug] No rows have a valid transactionDate for filters", {
        filters,
      });
    } else {
      let min = Infinity;
      let max = -Infinity;
      for (const r of allRows) {
        const t = (r.transactionDate as Date).getTime();
        if (Number.isNaN(t)) continue;
        if (t < min) min = t;
        if (t > max) max = t;
      }
      if (Number.isFinite(min) && Number.isFinite(max)) {
        console.log("[DateDebug] Dataset span before range filter", {
          min: new Date(min).toISOString(),
          max: new Date(max).toISOString(),
          count: allRows.length,
        });
      }
    }
  }

  const inRange = filterRowsByDateRange(allRows, start, end);

  if (import.meta.env.DEV && inRange.length === 0 && allRows.length > 0) {
    console.warn("[DateDebug] 0 rows matched selected range", {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });
  }

  const rows = inRange.filter(
    (row) =>
      row.status === "MAPPED" &&
      row.mappedCat !== null &&
      activeCats.includes(row.mappedCat as Category),
  );

  cache.set(cacheKey, rows);
  return rows;
}

export function getRowsForFilters(
  reports: DailyReport[],
  filters: ReportFilters
): ProcessedRow[] {
  return getRows(reports, filters);
}

function getCompareRows(
  reports: DailyReport[],
  filters: ReportFilters
): ProcessedRow[] | null {
  if (!filters.compareFrom || !filters.compareTo) return null;
  return getRows(reports, {
    ...filters,
    dateFrom: filters.compareFrom,
    dateTo: filters.compareTo,
  });
}

function calcPctChange(current: number, previous: number): number | undefined {
  const result = getPercentChange(previous, current);
  if (result.raw === null) return undefined;
  return Math.round(result.raw);
}

/**
 * DB fetch bounds for report generation.
 * When compare mode is on, include both the primary and compare periods so
 * May/Jun (or any pair) are loaded in one query.
 */
export function getComputeFetchBounds(
  filters: Pick<ReportFilters, "dateFrom" | "dateTo" | "compareFrom" | "compareTo">,
): { dateFrom: string; dateTo: string } {
  let dateFrom = filters.dateFrom;
  let dateTo = filters.dateTo;

  if (filters.compareFrom && filters.compareTo) {
    if (filters.compareFrom < dateFrom) dateFrom = filters.compareFrom;
    if (filters.compareTo > dateTo) dateTo = filters.compareTo;
  }

  return { dateFrom, dateTo };
}

// ============================================================================
// Public compute functions
// ============================================================================

export function computeCategoryTotals(
  reports: DailyReport[],
  filters: ReportFilters
): ComputedSalesMix {
  const rows = getRows(reports, filters);
  const compareRows = getCompareRows(reports, filters);

  const salesMap: Partial<Record<Category, number>> = {};
  const qtyMap: Partial<Record<Category, number>> = {};
  const compareMap: Partial<Record<Category, number>> = {};

  for (const row of rows) {
    const cat = row.mappedCat as Category;
    salesMap[cat] = (salesMap[cat] ?? 0) + row.rowSales;
    qtyMap[cat] = (qtyMap[cat] ?? 0) + row.quantity;
  }

  if (compareRows) {
    for (const row of compareRows) {
      const cat = row.mappedCat as Category;
      compareMap[cat] = (compareMap[cat] ?? 0) + row.rowSales;
    }
  }

  const grandTotal = Object.values(salesMap).reduce(
    (a: number, b: number) => a + b,
    0
  );
  const compareGrandTotal = compareRows
    ? Object.values(compareMap).reduce((a: number, b: number) => a + b, 0)
    : undefined;

  const activeCats = getActiveCats(filters);
  const categoryTotals: CategoryTotal[] = activeCats
    .map((cat) => {
      const sales = salesMap[cat] ?? 0;
      const compare = compareMap[cat] ?? 0;
      return {
        category: cat,
        sales,
        qty: qtyMap[cat] ?? 0,
        percent: grandTotal > 0 ? (sales / grandTotal) * 100 : 0,
        compareSales: compareRows ? compare : undefined,
        pctChange: compareRows ? calcPctChange(sales, compare) : undefined,
      };
    })
    .sort((a, b) => b.sales - a.sales);
  const top5ByChannel = computeTop5ByChannelFromRows(rows);

  return { categoryTotals, grandTotal, compareGrandTotal, top5ByChannel };
}

export function computeProductTotals(
  reports: DailyReport[],
  filters: ReportFilters,
  category?: Category
): ComputedProductMix {
  const categoryFilter: ReportFilters = category
    ? { ...filters, selectedCategories: [category] }
    : filters;

  const rows = getRows(reports, categoryFilter);
  const compareRows = getCompareRows(reports, categoryFilter);

  const salesMap: Record<string, { sales: number; qty: number; category: Category }> = {};
  const compareMap: Record<string, { sales: number; qty: number }> = {};

  for (const row of rows) {
    const key = row.mappedItemName ?? row.rawItemName;
    if (!salesMap[key]) {
      salesMap[key] = { sales: 0, qty: 0, category: row.mappedCat as Category };
    }
    salesMap[key].sales += row.rowSales;
    salesMap[key].qty += row.quantity;
  }

  if (compareRows) {
    for (const row of compareRows) {
      const key = row.mappedItemName ?? row.rawItemName;
      if (!compareMap[key]) compareMap[key] = { sales: 0, qty: 0 };
      compareMap[key].sales += row.rowSales;
      compareMap[key].qty += row.quantity;
    }
  }

  const totalSales = Object.values(salesMap).reduce((a, b) => a + b.sales, 0);
  const compareTotalSales = compareRows
    ? Object.values(compareMap).reduce((a, b) => a + b.sales, 0)
    : undefined;

  const products: ProductTotal[] = Object.entries(salesMap)
    .map(([name, data]) => ({
      name,
      category: data.category,
      sales: data.sales,
      qty: data.qty,
      compareSales: compareRows ? (compareMap[name]?.sales ?? 0) : undefined,
      compareQty: compareRows ? (compareMap[name]?.qty ?? 0) : undefined,
      pctChange: compareRows
        ? calcPctChange(data.sales, compareMap[name]?.sales ?? 0)
        : undefined,
    }))
    .sort((a, b) => b.sales - a.sales);

  return { category: category ?? null, products, totalSales, compareTotalSales };
}

export function computeProductTotalsByCategory(
  reports: DailyReport[],
  filters: ReportFilters,
): ComputedProductMixByCategory {
  const cats = (filters.selectedCategories?.length ? filters.selectedCategories : [...CATEGORIES]) as Category[];

  const groups: ComputedProductMix[] = [];
  const excluded: Category[] = [];

  for (const cat of cats) {
    const mix = computeProductTotals(reports, filters, cat);
    if (!mix.products.length || mix.totalSales <= 0) {
      excluded.push(cat);
      continue;
    }
    groups.push(mix);
  }

  const grandTotalSales = groups.reduce((sum, g) => sum + (g.totalSales ?? 0), 0);

  return {
    groups,
    excludedCategories: excluded.length ? excluded : undefined,
    grandTotalSales,
  };
}

export function computeTopProducts(
  reports: DailyReport[],
  filters: ReportFilters,
  limit = 5
): ComputedTop5 {
  const allRows = getRows(reports, filters);

  const byCatItem: Record<
    string,
    Record<string, { sales: number; qty: number; cat: Category }>
  > = {};

  for (const row of allRows) {
    const cat = row.mappedCat as Category;
    const item = row.mappedItemName ?? row.rawItemName;
    if (!byCatItem[cat]) byCatItem[cat] = {};
    if (!byCatItem[cat][item]) byCatItem[cat][item] = { sales: 0, qty: 0, cat };
    byCatItem[cat][item].sales += row.rowSales;
    byCatItem[cat][item].qty += row.quantity;
  }

  const topByCategory: Record<string, TopProduct[]> = {};
  for (const [cat, items] of Object.entries(byCatItem)) {
    topByCategory[cat] = Object.entries(items)
      .sort(([, a], [, b]) => b.sales - a.sales)
      .slice(0, limit)
      .map(([name, data], idx) => ({
        rank: idx + 1,
        name,
        category: data.cat,
        sales: data.sales,
        qty: data.qty,
      }));
  }

  const grandTotal = allRows.reduce((sum, r) => sum + r.rowSales, 0);
  return { topByCategory, grandTotal };
}

export function computeComparison<
  T extends { sales: number; compareSales?: number }
>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    pctChange:
      item.compareSales !== undefined
        ? calcPctChange(item.sales, item.compareSales)
        : undefined,
  }));
}

export function computeCategoryPerformance(
  reports: DailyReport[],
  filters: ReportFilters
): ComputedCategoryPerformance {
  // Prefer dailyBreakdown (no rowDetails needed) when every report has it.
  const allHaveBreakdown = reports.length > 0 && reports.every(hasDailyBreakdown);
  if (allHaveBreakdown) {
    const activeCats = getActiveCats(filters);
    const byBranch = filterReportsByBranch(reports, filters.branchId);
    const salesMap: Partial<Record<Category, number>> = {};
    const qtyMap: Partial<Record<Category, number>> = {};

    for (const report of byBranch) {
      const sliced = sliceDailyBreakdown(
        report.dailyBreakdown,
        filters.dateFrom,
        filters.dateTo,
      );
      for (const cat of activeCats) {
        salesMap[cat] = (salesMap[cat] ?? 0) + (sliced.totals[cat] ?? 0);
        qtyMap[cat] = (qtyMap[cat] ?? 0) + (sliced.quantities[cat] ?? 0);
      }
    }

    const grandTotal = Object.values(salesMap).reduce(
      (a: number, b: number) => a + b,
      0,
    );
    const categories: CategoryTotal[] = activeCats
      .map((cat) => {
        const sales = salesMap[cat] ?? 0;
        return {
          category: cat,
          sales,
          qty: qtyMap[cat] ?? 0,
          percent: grandTotal > 0 ? (sales / grandTotal) * 100 : 0,
        };
      })
      .sort((a, b) => b.sales - a.sales);

    return { categories, grandTotal };
  }

  const result = computeCategoryTotals(reports, filters);
  return {
    categories: result.categoryTotals,
    grandTotal: result.grandTotal,
  };
}

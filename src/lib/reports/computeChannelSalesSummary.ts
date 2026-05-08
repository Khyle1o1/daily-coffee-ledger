import type { DailyReport } from "@/utils/types";
import { BRANCHES, CATEGORIES, type Category } from "@/utils/types";
import type { ReportFilters } from "./compute";
import { getChannelFromPaymentType } from "./channel";
import { filterRowsByDateRange } from "./filterRowsByDateRange";

// ── Public types ─────────────────────────────────────────────────────────────

export interface CategoryChannelBreakdownRow {
  category: string;
  foodpanda: number;
  grab: number;
  walkIn: number;
  total: number;
  foodpandaPct: number;
  grabPct: number;
  walkInPct: number;
}

export interface ChannelTotals {
  foodpanda: number;
  grab: number;
  walkIn: number;
  total: number;
}

export interface BranchChannelSection {
  branchId: string;
  branchName: string;
  rows: CategoryChannelBreakdownRow[];
  totals: ChannelTotals;
  channelMixPct: {
    foodpanda: number;
    grab: number;
    walkIn: number;
  };
}

export interface ChannelSalesSummaryData {
  branches: BranchChannelSection[];
  overall: {
    rows: CategoryChannelBreakdownRow[];
    totals: ChannelTotals;
    channelMixPct: {
      foodpanda: number;
      grab: number;
      walkIn: number;
    };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeCategoryName(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function toDisplayCategory(cat: string): string {
  const c = cat.trim().toUpperCase();
  if (c === "SNACKS") return "Pastries";
  if (c === "MERCH") return "Merchandise";
  if (c === "ICED" || c === "HOT") return "Coffee";
  if (c === "CANNED" || c === "COLD BREW" || c === "DOT TEA LINE" || c === "DEHUSK LINE") return "Non-Coffee";
  if (c === "ADD-ONS") return "Non-Coffee";
  return c
    .toLowerCase()
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function emptyTotals(): ChannelTotals {
  return { foodpanda: 0, grab: 0, walkIn: 0, total: 0 };
}

function toPct(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}

export function computeChannelSalesSummary(reports: DailyReport[], filters: ReportFilters): ChannelSalesSummaryData {
  const activeCategories =
    filters.selectedCategories && filters.selectedCategories.length > 0
      ? new Set(filters.selectedCategories)
      : new Set([...CATEGORIES]);

  const selectedBranchIds = Array.isArray(filters.branchId)
    ? filters.branchId
    : filters.branchId === "all"
      ? BRANCHES.map((b) => b.id)
      : [filters.branchId];
  const selectedBranchSet = new Set(selectedBranchIds);
  const selectedReports = reports.filter((report) => selectedBranchSet.has(report.branch));
  const start = new Date(filters.dateFrom);
  const end = new Date(filters.dateTo);

  const branchCategoryChannel = new Map<string, Map<string, ChannelTotals>>();
  let filteredRowsCount = 0;

  for (const report of selectedReports) {
    const reportRows = report.rowDetails.filter(
      (row) =>
        row.transactionDate instanceof Date &&
        row.status === "MAPPED" &&
        row.mappedCat &&
        activeCategories.has(row.mappedCat as Category),
    );
    const rowsInRange = filterRowsByDateRange(reportRows as any, start, end);

    for (const row of rowsInRange) {
      filteredRowsCount += 1;
      const branchId = report.branch;
      const rawCategory = String((row.mappedCat as Category | null) ?? "");
      if (!rawCategory) continue;
      const category = normalizeCategoryName(toDisplayCategory(rawCategory));

      const sales = Number.isFinite(row.rowSales) ? row.rowSales : 0;
      if (!sales) continue;

      const channel = getChannelFromPaymentType(row.paymentType);
      let branchMap = branchCategoryChannel.get(branchId);
      if (!branchMap) {
        branchMap = new Map();
        branchCategoryChannel.set(branchId, branchMap);
      }
      let totals = branchMap.get(category);
      if (!totals) {
        totals = emptyTotals();
        branchMap.set(category, totals);
      }

      if (channel === "FOODPANDA") totals.foodpanda += sales;
      else if (channel === "GRAB") totals.grab += sales;
      else totals.walkIn += sales;
      totals.total = totals.foodpanda + totals.grab + totals.walkIn;
    }
  }

  const buildBranchSection = (branchId: string): BranchChannelSection => {
    const branchName = BRANCHES.find((b) => b.id === branchId)?.label ?? branchId;
    const branchMap = branchCategoryChannel.get(branchId) ?? new Map<string, ChannelTotals>();
    const rows = Array.from(branchMap.entries())
      .map(([category, totals]) => ({
        category,
        foodpanda: totals.foodpanda,
        grab: totals.grab,
        walkIn: totals.walkIn,
        total: totals.total,
        foodpandaPct: toPct(totals.foodpanda, totals.total),
        grabPct: toPct(totals.grab, totals.total),
        walkInPct: toPct(totals.walkIn, totals.total),
      }))
      .sort((a, b) => b.total - a.total);

    const totals = rows.reduce(
      (acc, row) => ({
        foodpanda: acc.foodpanda + row.foodpanda,
        grab: acc.grab + row.grab,
        walkIn: acc.walkIn + row.walkIn,
        total: acc.total + row.total,
      }),
      emptyTotals(),
    );

    return {
      branchId,
      branchName,
      rows,
      totals,
      channelMixPct: {
        foodpanda: toPct(totals.foodpanda, totals.total),
        grab: toPct(totals.grab, totals.total),
        walkIn: toPct(totals.walkIn, totals.total),
      },
    };
  };

  const branches = selectedBranchIds.map(buildBranchSection);

  const overallCategoryMap = new Map<string, ChannelTotals>();
  for (const branch of branches) {
    for (const row of branch.rows) {
      const totals = overallCategoryMap.get(row.category) ?? emptyTotals();
      totals.foodpanda += row.foodpanda;
      totals.grab += row.grab;
      totals.walkIn += row.walkIn;
      totals.total = totals.foodpanda + totals.grab + totals.walkIn;
      overallCategoryMap.set(row.category, totals);
    }
  }

  const overallRows = Array.from(overallCategoryMap.entries())
    .map(([category, totals]) => ({
      category,
      foodpanda: totals.foodpanda,
      grab: totals.grab,
      walkIn: totals.walkIn,
      total: totals.total,
      foodpandaPct: toPct(totals.foodpanda, totals.total),
      grabPct: toPct(totals.grab, totals.total),
      walkInPct: toPct(totals.walkIn, totals.total),
    }))
    .sort((a, b) => b.total - a.total);

  const overallTotals = overallRows.reduce(
    (acc, row) => ({
      foodpanda: acc.foodpanda + row.foodpanda,
      grab: acc.grab + row.grab,
      walkIn: acc.walkIn + row.walkIn,
      total: acc.total + row.total,
    }),
    emptyTotals(),
  );

  console.log("[ChannelSalesSummary] Selected branches:", selectedBranchIds);
  console.log("[ChannelSalesSummary] Filtered rows:", filteredRowsCount);

  return {
    branches,
    overall: {
      rows: overallRows,
      totals: overallTotals,
      channelMixPct: {
        foodpanda: toPct(overallTotals.foodpanda, overallTotals.total),
        grab: toPct(overallTotals.grab, overallTotals.total),
        walkIn: toPct(overallTotals.walkIn, overallTotals.total),
      },
    },
  };
}

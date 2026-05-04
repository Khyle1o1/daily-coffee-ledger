import type { DailyReport, BranchId } from "@/utils/types";
import { BRANCHES } from "@/utils/types";
import type { ReportFilters } from "./compute";
import { endOfDay, format, startOfDay } from "date-fns";
import { normalizeText } from "@/utils/normalize";

function defaultGetBranchLabel(slug: string): string {
  return BRANCHES.find((b) => b.id === slug)?.label ?? slug;
}
import { getChannelFromPaymentType } from "./channel";
import { isCupItem } from "./cups";
import { filterRowsByDateRange } from "./filterRowsByDateRange";

export type PourRow = {
  branchId: BranchId;
  branchName: string;
  foodpandaQty: number;
  grabQty: number;
  walkinQty: number;
  grandTotal: number;
};

/** Per-day cup counts for a single-branch detail view */
export type PourDailyRow = {
  date: string;
  foodpandaQty: number;
  grabQty: number;
  walkinQty: number;
  grandTotal: number;
};

/** Per-item cup counts for a single-branch detail view */
export type PourItemRow = {
  itemName: string;
  foodpandaQty: number;
  grabQty: number;
  walkinQty: number;
  grandTotal: number;
};

export type ItemizedCupRow = {
  cupType: string;
  totalCups: number;
};

export type PerBranchItemizedCupBreakdown = {
  branchId: BranchId;
  branchName: string;
  rows: ItemizedCupRow[];
  grandTotal: number;
};

export type ItemizedCupPivotBranch = {
  branchId: BranchId;
  branchName: string;
};

export type ItemizedCupPivotRow = {
  cupType: string;
  byBranch: Record<string, number>;
  grandTotal: number;
};

export type ItemizedCupPivot = {
  branches: ItemizedCupPivotBranch[];
  rows: ItemizedCupPivotRow[];
  totalsByBranch: Record<string, number>;
  grandTotal: number;
};

export type PourMonthlyRow = {
  monthKey: string;
  monthLabel: string;
  foodpandaQty: number;
  grabQty: number;
  walkinQty: number;
  grandTotal: number;
};

export const ITEMIZED_CUP_TYPES = [
  "12oz Bamboo Cup",
  "12oz Iced Dabba Cup",
  "12oz Paper Cup",
  "16oz Iced Dabba Cup",
  "16oz Paper Cup",
] as const;

export type PourReportData = {
  title: string;
  rows: PourRow[];
  totals: {
    foodpandaQty: number;
    grabQty: number;
    walkinQty: number;
    grandTotal: number;
  };
  /** Optional note: selected branches with no matching rows */
  excludedBranches?: string[];
  /** Populated only when a single branch is selected */
  dailyBreakdown?: PourDailyRow[];
  /** Populated only when a single branch is selected */
  itemBreakdown?: PourItemRow[];
  itemizedCupBreakdown: ItemizedCupRow[];
  itemizedCupGrandTotal: number;
  itemizedCupPivot: ItemizedCupPivot;
  monthlySummary?: PourMonthlyRow[];
};

function normalizeCupTypeLabel(itemName: string): string | null {
  const n = normalizeText(itemName);
  const has12oz = /\b12\s*oz\b|\b12oz\b/.test(n);
  const has16oz = /\b16\s*oz\b|\b16oz\b/.test(n);

  if (has12oz && n.includes("bamboo") && n.includes("cup")) return "12oz Bamboo Cup";
  if (has12oz && n.includes("paper") && n.includes("cup")) return "12oz Paper Cup";
  if (has12oz && n.includes("dabba") && n.includes("cup")) return "12oz Iced Dabba Cup";

  if (has16oz && n.includes("paper") && n.includes("cup")) return "16oz Paper Cup";
  if (has16oz && n.includes("dabba") && n.includes("cup")) return "16oz Iced Dabba Cup";

  return null;
}

export function computePourItForward(
  reports: DailyReport[],
  filters: ReportFilters,
  title: string,
  getBranchLabel?: (slug: string) => string,
): PourReportData {
  const { dateFrom, dateTo, branchId } = filters;

  const resolveBranchLabel = getBranchLabel ?? defaultGetBranchLabel;
  const isSingleBranch = typeof branchId === "string" && branchId !== "all";

  const selectedBranchIds: BranchId[] | null = Array.isArray(branchId)
    ? (branchId as BranchId[])
    : typeof branchId === "string" && branchId !== "all"
      ? ([branchId as BranchId] as BranchId[])
      : null;
  const selectedBranchIdsForBreakdown: BranchId[] = selectedBranchIds
    ? [...selectedBranchIds]
    : BRANCHES.map((b) => b.id as BranchId);
  const selectedBranchSet = selectedBranchIds ? new Set(selectedBranchIds) : null;

  const perBranch = new Map<
    BranchId,
    { branchId: BranchId; branchName: string; foodpandaQty: number; grabQty: number; walkinQty: number }
  >();

  const ensureBranch = (id: BranchId) => {
    let entry = perBranch.get(id);
    if (!entry) {
      entry = {
        branchId: id,
        branchName: resolveBranchLabel(id),
        foodpandaQty: 0,
        grabQty: 0,
        walkinQty: 0,
      };
      perBranch.set(id, entry);
    }
    return entry;
  };

  // Detail accumulators — only used for single-branch view
  const perDay = new Map<string, { foodpandaQty: number; grabQty: number; walkinQty: number }>();
  const perItem = new Map<string, { foodpandaQty: number; grabQty: number; walkinQty: number }>();
  const perMonth = new Map<string, { monthLabel: string; foodpandaQty: number; grabQty: number; walkinQty: number }>();
  const itemizedCupTotals = new Map<string, number>(
    ITEMIZED_CUP_TYPES.map((cupType) => [cupType, 0]),
  );
  const perBranchItemizedTotals = new Map<
    BranchId,
    Map<string, number>
  >();
  let filteredRowsCount = 0;

  const ensureDay = (date: string) => {
    if (!perDay.has(date)) perDay.set(date, { foodpandaQty: 0, grabQty: 0, walkinQty: 0 });
    return perDay.get(date)!;
  };

  const ensureItem = (name: string) => {
    if (!perItem.has(name)) perItem.set(name, { foodpandaQty: 0, grabQty: 0, walkinQty: 0 });
    return perItem.get(name)!;
  };

  const toLocalDateKey = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const parseLocalYmd = (ymd: string): Date => {
    const [year, month, day] = ymd.split("-").map((part) => Number(part));
    return new Date(year, month - 1, day);
  };

  const selectedStart = startOfDay(parseLocalYmd(dateFrom));
  const selectedEnd = endOfDay(parseLocalYmd(dateTo));
  const startKey = toLocalDateKey(selectedStart);
  const endKey = toLocalDateKey(selectedEnd);

  const isInSelectedLocalRange = (date: Date): boolean => {
    const txKey = toLocalDateKey(date);
    return txKey >= startKey && txKey <= endKey;
  };

  const toLocalDateString = (date: Date): string => format(date, "yyyy-MM-dd");

  for (const report of reports) {
    if (selectedBranchSet && !selectedBranchSet.has(report.branch)) continue;

    const rowsInRange = filterRowsByDateRange(
      report.rowDetails.filter((row) => row.transactionDate instanceof Date) as any,
      selectedStart,
      selectedEnd,
    );

    for (const row of rowsInRange) {
      if (row.status !== "MAPPED") continue;
      const name = row.mappedItemName ?? row.rawItemName;
      if (!name || !isCupItem(name)) continue;

      const qty = Number.isFinite(row.quantity) ? row.quantity : 0;
      if (!qty) continue;
      filteredRowsCount += 1;

      const canonicalCupType = normalizeCupTypeLabel(name);
      if (canonicalCupType) {
        itemizedCupTotals.set(
          canonicalCupType,
          (itemizedCupTotals.get(canonicalCupType) ?? 0) + qty,
        );

        const branchMap =
          perBranchItemizedTotals.get(report.branch) ??
          new Map<string, number>(ITEMIZED_CUP_TYPES.map((cupType) => [cupType, 0]));
        branchMap.set(
          canonicalCupType,
          (branchMap.get(canonicalCupType) ?? 0) + qty,
        );
        perBranchItemizedTotals.set(report.branch, branchMap);
      }

      const branchEntry = ensureBranch(report.branch);
      const channel = getChannelFromPaymentType(row.paymentType);

      if (channel === "FOODPANDA") {
        branchEntry.foodpandaQty += qty;
      } else if (channel === "GRAB") {
        branchEntry.grabQty += qty;
      } else {
        branchEntry.walkinQty += qty;
      }

      if (row.transactionDate instanceof Date) {
        const monthKey = format(row.transactionDate, "yyyy-MM");
        const monthLabel = format(row.transactionDate, "MMM yyyy");
        const monthEntry = perMonth.get(monthKey) ?? {
          monthLabel,
          foodpandaQty: 0,
          grabQty: 0,
          walkinQty: 0,
        };
        if (channel === "FOODPANDA") monthEntry.foodpandaQty += qty;
        else if (channel === "GRAB") monthEntry.grabQty += qty;
        else monthEntry.walkinQty += qty;
        perMonth.set(monthKey, monthEntry);
      }

      // Per-day and per-item detail (single branch only)
      if (isSingleBranch && row.transactionDate instanceof Date) {
        if (!isInSelectedLocalRange(row.transactionDate)) continue;

        const dateStr = toLocalDateString(row.transactionDate);
        const dayEntry = ensureDay(dateStr);
        const itemEntry = ensureItem(name);

        if (channel === "FOODPANDA") {
          dayEntry.foodpandaQty += qty;
          itemEntry.foodpandaQty += qty;
        } else if (channel === "GRAB") {
          dayEntry.grabQty += qty;
          itemEntry.grabQty += qty;
        } else {
          dayEntry.walkinQty += qty;
          itemEntry.walkinQty += qty;
        }
      }
    }
  }

  const rows: PourRow[] = Array.from(perBranch.values())
    .map((b) => ({
      ...b,
      grandTotal: b.foodpandaQty + b.grabQty + b.walkinQty,
    }))
    .sort((a, b) => b.grandTotal - a.grandTotal);

  const totals = rows.reduce(
    (acc, row) => {
      acc.foodpandaQty += row.foodpandaQty;
      acc.grabQty += row.grabQty;
      acc.walkinQty += row.walkinQty;
      acc.grandTotal += row.grandTotal;
      return acc;
    },
    { foodpandaQty: 0, grabQty: 0, walkinQty: 0, grandTotal: 0 }
  );

  const itemizedCupBreakdown: ItemizedCupRow[] = ITEMIZED_CUP_TYPES.map((cupType) => ({
    cupType,
    totalCups: itemizedCupTotals.get(cupType) ?? 0,
  }));
  const itemizedCupGrandTotal = itemizedCupBreakdown.reduce(
    (sum, row) => sum + row.totalCups,
    0,
  );
  const perBranchItemizedCupBreakdown: PerBranchItemizedCupBreakdown[] =
    selectedBranchIdsForBreakdown
      .map((branchId) => {
        const branchName = resolveBranchLabel(branchId);
        const branchRowsMap =
          perBranchItemizedTotals.get(branchId) ??
          new Map<string, number>(ITEMIZED_CUP_TYPES.map((cupType) => [cupType, 0]));
        const rows = ITEMIZED_CUP_TYPES.map((cupType) => ({
          cupType,
          totalCups: branchRowsMap.get(cupType) ?? 0,
        }));
        const grandTotal = rows.reduce((sum, row) => sum + row.totalCups, 0);
        return { branchId, branchName, rows, grandTotal };
      })
      .sort((a, b) => b.grandTotal - a.grandTotal);
  const pivotBranches: ItemizedCupPivotBranch[] = perBranchItemizedCupBreakdown.map((branch) => ({
    branchId: branch.branchId,
    branchName: branch.branchName,
  }));
  const pivotRows: ItemizedCupPivotRow[] = ITEMIZED_CUP_TYPES.map((cupType) => {
    const byBranch: Record<string, number> = {};
    for (const branch of perBranchItemizedCupBreakdown) {
      byBranch[branch.branchId] =
        branch.rows.find((row) => row.cupType === cupType)?.totalCups ?? 0;
    }
    const grandTotal = Object.values(byBranch).reduce((sum, v) => sum + v, 0);
    return { cupType, byBranch, grandTotal };
  });
  const totalsByBranch: Record<string, number> = {};
  for (const branch of perBranchItemizedCupBreakdown) {
    totalsByBranch[branch.branchId] = branch.grandTotal;
  }
  const itemizedCupPivot: ItemizedCupPivot = {
    branches: pivotBranches,
    rows: pivotRows,
    totalsByBranch,
    grandTotal: Object.values(totalsByBranch).reduce((sum, v) => sum + v, 0),
  };
  const monthlySummaryRows: PourMonthlyRow[] = Array.from(perMonth.entries())
    .map(([monthKey, v]) => ({
      monthKey,
      monthLabel: v.monthLabel,
      foodpandaQty: v.foodpandaQty,
      grabQty: v.grabQty,
      walkinQty: v.walkinQty,
      grandTotal: v.foodpandaQty + v.grabQty + v.walkinQty,
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const monthlySummary =
    monthlySummaryRows.length >= 2 ? monthlySummaryRows : undefined;

  if (itemizedCupGrandTotal !== totals.grandTotal) {
    console.debug("[computePourItForward] Itemized cup total differs from summary total", {
      itemizedCupGrandTotal,
      summaryGrandTotal: totals.grandTotal,
      dateFrom,
      dateTo,
    });
  }
  console.log("Selected branches:", selectedBranchIds ?? "all");
  console.log("Selected branches (resolved):", selectedBranchIdsForBreakdown);
  console.log("Filtered rows:", filteredRowsCount);
  console.log(
    "Per branch cup breakdown:",
    perBranchItemizedCupBreakdown.reduce<Record<string, Record<string, number>>>(
      (acc, branch) => {
        acc[branch.branchName] = Object.fromEntries(
          branch.rows.map((row) => [row.cupType, row.totalCups]),
        );
        return acc;
      },
      {},
    ),
  );

  // Build detail arrays (single branch only)
  let dailyBreakdown: PourDailyRow[] | undefined;
  let itemBreakdown: PourItemRow[] | undefined;

  if (isSingleBranch) {
    dailyBreakdown = Array.from(perDay.entries())
      .map(([date, v]) => ({
        date,
        ...v,
        grandTotal: v.foodpandaQty + v.grabQty + v.walkinQty,
      }))
      .filter((row) => {
        const d = parseLocalYmd(row.date);
        return isInSelectedLocalRange(d);
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const outOfRangeRows = dailyBreakdown.filter((row) => {
      const d = parseLocalYmd(row.date);
      return !isInSelectedLocalRange(d);
    });
    if (outOfRangeRows.length > 0) {
      console.debug("[computePourItForward] Dropping out-of-range day rows", {
        dateFrom,
        dateTo,
        outOfRangeDates: outOfRangeRows.map((r) => r.date),
      });
      dailyBreakdown = dailyBreakdown.filter(
        (row) => !outOfRangeRows.some((bad) => bad.date === row.date),
      );
    }

    const hasOutOfRangeAfterFilter = dailyBreakdown.some((row) => {
      const d = parseLocalYmd(row.date);
      return !isInSelectedLocalRange(d);
    });
    if (hasOutOfRangeAfterFilter) {
      console.warn("[computePourItForward] Out-of-range day row remained after safety filter", {
        dateFrom,
        dateTo,
      });
    }

    itemBreakdown = Array.from(perItem.entries())
      .map(([itemName, v]) => ({
        itemName,
        ...v,
        grandTotal: v.foodpandaQty + v.grabQty + v.walkinQty,
      }))
      .sort((a, b) => b.grandTotal - a.grandTotal);
  }

  const excludedBranches =
    selectedBranchIds && selectedBranchIds.length > 1
      ? selectedBranchIds
          .filter((id) => !perBranch.has(id))
          .map((id) => resolveBranchLabel(id))
      : undefined;

  return {
    title,
    rows,
    totals,
    excludedBranches: excludedBranches && excludedBranches.length > 0 ? excludedBranches : undefined,
    dailyBreakdown,
    itemBreakdown,
    itemizedCupBreakdown,
    itemizedCupGrandTotal,
    itemizedCupPivot,
    monthlySummary,
  };
}

import type { DailyReport, BranchId } from "@/utils/types";
import { BRANCHES } from "@/utils/types";
import type { ReportFilters } from "./compute";

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

export type PourReportData = {
  title: string;
  rows: PourRow[];
  totals: {
    foodpandaQty: number;
    grabQty: number;
    walkinQty: number;
    grandTotal: number;
  };
  /** Populated only when a single branch is selected */
  dailyBreakdown?: PourDailyRow[];
  /** Populated only when a single branch is selected */
  itemBreakdown?: PourItemRow[];
};

export function computePourItForward(
  reports: DailyReport[],
  filters: ReportFilters,
  title: string,
  getBranchLabel?: (slug: string) => string,
): PourReportData {
  const { dateFrom, dateTo, branchId } = filters;

  const resolveBranchLabel = getBranchLabel ?? defaultGetBranchLabel;
  const isSingleBranch = branchId !== "all";

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

  const ensureDay = (date: string) => {
    if (!perDay.has(date)) perDay.set(date, { foodpandaQty: 0, grabQty: 0, walkinQty: 0 });
    return perDay.get(date)!;
  };

  const ensureItem = (name: string) => {
    if (!perItem.has(name)) perItem.set(name, { foodpandaQty: 0, grabQty: 0, walkinQty: 0 });
    return perItem.get(name)!;
  };

  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  for (const report of reports) {
    if (branchId !== "all" && report.branch !== branchId) continue;

    const rowsInRange = filterRowsByDateRange(
      report.rowDetails.filter((row) => row.transactionDate instanceof Date) as any,
      start,
      end,
    );

    for (const row of rowsInRange) {
      if (row.status !== "MAPPED") continue;
      const name = row.mappedItemName ?? row.rawItemName;
      if (!name || !isCupItem(name)) continue;

      const qty = Number.isFinite(row.quantity) ? row.quantity : 0;
      if (!qty) continue;

      const branchEntry = ensureBranch(report.branch);
      const channel = getChannelFromPaymentType(row.paymentType);

      if (channel === "FOODPANDA") {
        branchEntry.foodpandaQty += qty;
      } else if (channel === "GRAB") {
        branchEntry.grabQty += qty;
      } else {
        branchEntry.walkinQty += qty;
      }

      // Per-day and per-item detail (single branch only)
      if (isSingleBranch && row.transactionDate instanceof Date) {
        const dateStr = row.transactionDate.toISOString().slice(0, 10);
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
      .sort((a, b) => a.date.localeCompare(b.date));

    itemBreakdown = Array.from(perItem.entries())
      .map(([itemName, v]) => ({
        itemName,
        ...v,
        grandTotal: v.foodpandaQty + v.grabQty + v.walkinQty,
      }))
      .sort((a, b) => b.grandTotal - a.grandTotal);
  }

  return {
    title,
    rows,
    totals,
    dailyBreakdown,
    itemBreakdown,
  };
}

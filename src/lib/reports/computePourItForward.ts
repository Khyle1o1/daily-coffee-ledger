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

export type PourReportData = {
  title: string;
  rows: PourRow[];
  totals: {
    foodpandaQty: number;
    grabQty: number;
    walkinQty: number;
    grandTotal: number;
  };
};

export function computePourItForward(
  reports: DailyReport[],
  filters: ReportFilters,
  title: string,
  getBranchLabel?: (slug: string) => string,
): PourReportData {
  const { dateFrom, dateTo, branchId } = filters;

  const resolveBranchLabel = getBranchLabel ?? defaultGetBranchLabel;

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

  return {
    title,
    rows,
    totals,
  };
}


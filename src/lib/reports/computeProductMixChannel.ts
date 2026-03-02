import type { DailyReport, ProcessedRow, Category } from "@/utils/types";
import type { ReportFilters } from "./compute";
import { getRowsForFilters } from "./compute";
import { getChannelFromPaymentType, type SalesChannel } from "./channel";

export type ProductMixChannelRow = {
  name: string;
  totalQty: number;
  walkInQty: number;
  grabQty: number;
  foodpandaQty: number;
  dotappQty: number;
  totalSales: number;
  walkInSales: number;
  grabSales: number;
  foodpandaSales: number;
  dotappSales: number;
};

export type ProductMixChannelData = {
  periodLabel: string;
  category: Category | "ALL";
  rows: ProductMixChannelRow[];
  totals: {
    totalQty: number;
    walkInQty: number;
    grabQty: number;
    foodpandaQty: number;
    dotappQty: number;
    totalSales: number;
    walkInSales: number;
    grabSales: number;
    foodpandaSales: number;
    dotappSales: number;
  };
};

export function computeProductMixChannel(
  reports: DailyReport[],
  filters: ReportFilters,
  periodLabel: string,
  category: Category | "ALL"
): ProductMixChannelData {
  const rows = getRowsForFilters(reports, filters);

  const map = new Map<
    string,
    {
      name: string;
      walkInQty: number;
      grabQty: number;
      foodpandaQty: number;
      dotappQty: number;
      walkInSales: number;
      grabSales: number;
      foodpandaSales: number;
      dotappSales: number;
    }
  >();

  const applyRow = (row: ProcessedRow) => {
    const name = row.mappedItemName ?? row.rawItemName;
    if (!name.trim()) return;

    const channel: SalesChannel = getChannelFromPaymentType(row.paymentType);
    const qty = Number.isFinite(row.quantity) ? row.quantity : 0;
    const sales = Number.isFinite(row.rowSales) ? row.rowSales : 0;

    const existing =
      map.get(name) ??
      {
        name,
        walkInQty: 0,
        grabQty: 0,
        foodpandaQty: 0,
        dotappQty: 0,
        walkInSales: 0,
        grabSales: 0,
        foodpandaSales: 0,
        dotappSales: 0,
      };

    if (channel === "GRAB") {
      existing.grabQty += qty;
      existing.grabSales += sales;
    } else if (channel === "FOODPANDA") {
      existing.foodpandaQty += qty;
      existing.foodpandaSales += sales;
    } else if (channel === "DOTAPP") {
      existing.dotappQty += qty;
      existing.dotappSales += sales;
    } else {
      existing.walkInQty += qty;
      existing.walkInSales += sales;
    }

    map.set(name, existing);
  };

  rows.forEach(applyRow);

  const resultRows: ProductMixChannelRow[] = Array.from(map.values())
    .map((r) => ({
      name: r.name,
      totalQty: r.walkInQty + r.grabQty + r.foodpandaQty + r.dotappQty,
      walkInQty: r.walkInQty,
      grabQty: r.grabQty,
      foodpandaQty: r.foodpandaQty,
      dotappQty: r.dotappQty,
      totalSales:
        r.walkInSales + r.grabSales + r.foodpandaSales + r.dotappSales,
      walkInSales: r.walkInSales,
      grabSales: r.grabSales,
      foodpandaSales: r.foodpandaSales,
      dotappSales: r.dotappSales,
    }))
    .sort((a, b) => b.totalQty - a.totalQty);

  const totals = resultRows.reduce(
    (acc, row) => {
      acc.totalQty += row.totalQty;
      acc.walkInQty += row.walkInQty;
      acc.grabQty += row.grabQty;
      acc.foodpandaQty += row.foodpandaQty;
      acc.dotappQty += row.dotappQty;
      acc.totalSales += row.totalSales;
      acc.walkInSales += row.walkInSales;
      acc.grabSales += row.grabSales;
      acc.foodpandaSales += row.foodpandaSales;
      acc.dotappSales += row.dotappSales;
      return acc;
    },
    {
      totalQty: 0,
      walkInQty: 0,
      grabQty: 0,
      foodpandaQty: 0,
      dotappQty: 0,
      totalSales: 0,
      walkInSales: 0,
      grabSales: 0,
      foodpandaSales: 0,
      dotappSales: 0,
    },
  );

  return {
    periodLabel,
    category,
    rows: resultRows,
    totals,
  };
}


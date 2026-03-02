import type { ProcessedRow } from "@/utils/types";
import { getChannelFromPaymentType, type SalesChannel } from "./channel";

export type TopItem = {
  name: string;
  qty: number;
  sales: number;
};

export type ChannelTotals = {
  totalSales: number;
  totalQty: number;
};

export type ChannelTop5 = {
  items: TopItem[];
  totals: ChannelTotals;
};

export type Top5ByChannel = Record<SalesChannel, ChannelTop5>;

export function computeTop5ByChannelFromRows(rows: ProcessedRow[]): Top5ByChannel {
  const buckets: Record<SalesChannel, Record<string, { qty: number; sales: number }>> = {
    WALK_IN: {},
    GRAB: {},
    FOODPANDA: {},
    DOTAPP: {},
  };

  for (const row of rows) {
    const channel = getChannelFromPaymentType(row.paymentType);
    const key = row.mappedItemName ?? row.rawItemName;
    const qty = Number.isFinite(row.quantity) ? row.quantity : 0;
    const sales = Number.isFinite(row.rowSales) ? row.rowSales : 0;

    if (!buckets[channel][key]) {
      buckets[channel][key] = { qty: 0, sales: 0 };
    }
    buckets[channel][key].qty += qty;
    buckets[channel][key].sales += sales;
  }

  const result: Top5ByChannel = {
    WALK_IN: { items: [], totals: { totalSales: 0, totalQty: 0 } },
    GRAB: { items: [], totals: { totalSales: 0, totalQty: 0 } },
    FOODPANDA: { items: [], totals: { totalSales: 0, totalQty: 0 } },
    DOTAPP: { items: [], totals: { totalSales: 0, totalQty: 0 } },
  };

  (Object.keys(buckets) as SalesChannel[]).forEach((channel) => {
    let totalSales = 0;
    let totalQty = 0;

    const items = Object.entries(buckets[channel])
      .map(([name, agg]) => {
        totalSales += agg.sales;
        totalQty += agg.qty;
        return {
          name,
          qty: agg.qty,
          sales: agg.sales,
        };
      })
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    result[channel] = {
      items,
      totals: {
        totalSales,
        totalQty,
      },
    };
  });

  return result;
}



import type { DailyReport, Category } from "@/utils/types";
import {
  computeCategoryTotals,
  computeProductTotals,
  getRowsForFilters,
  type ReportFilters,
  type ComputedSalesMix,
  type ComputedProductMix,
} from "./compute";
import { getChannelFromPaymentType, type SalesChannel } from "./channel";

// ─── Category groups ──────────────────────────────────────────────────────────

export const HQ_DRINK_CATS: Category[] = ["ICED", "HOT"];
export const HQ_PASTRY_CATS: Category[] = ["SNACKS"];
export const HQ_ADDON_CATS: Category[] = ["ADD-ONS"];

const PRESENTATION_CHANNELS: SalesChannel[] = ["WALK_IN", "GRAB", "FOODPANDA"];

// ─── Output types ──────────────────────────────────────────────────────────────

export interface CupSizeTotal {
  name: string;
  qty: number;
}

export interface HQChannelItem {
  name: string;
  qty: number;
  sales: number;
}

export interface HQChannelData {
  key: SalesChannel;
  share: number;
  items: HQChannelItem[];
  totalSales: number;
  totalQty: number;
}

export interface HQTop5ByChannel {
  label: string;
  channels: HQChannelData[];
  grandTotal: number;
}

export interface ComputedHQSyncPack {
  overview: ComputedSalesMix;
  icedDetail: ComputedProductMix;
  hotDetail: ComputedProductMix;
  pastriesDetail: ComputedProductMix;
  addOnsDetail: ComputedProductMix;
  top5Drinks: HQTop5ByChannel;
  top5Pastry: HQTop5ByChannel;
  top5AddOn: HQTop5ByChannel;
  cupsData: CupSizeTotal[];
}

// ─── Channel top-5 builder ────────────────────────────────────────────────────

function buildChannelTop5(
  reports: DailyReport[],
  filters: ReportFilters,
  categories: Category[],
  label: string,
  limit = 5,
): HQTop5ByChannel {
  const rows = getRowsForFilters(reports, {
    ...filters,
    selectedCategories: categories,
  });

  type ItemAgg = { qty: number; sales: number };
  const buckets: Record<SalesChannel, Record<string, ItemAgg>> = {
    WALK_IN: {},
    GRAB: {},
    FOODPANDA: {},
    DOTAPP: {},
  };
  const chTotals: Record<SalesChannel, { sales: number; qty: number }> = {
    WALK_IN: { sales: 0, qty: 0 },
    GRAB:    { sales: 0, qty: 0 },
    FOODPANDA: { sales: 0, qty: 0 },
    DOTAPP:  { sales: 0, qty: 0 },
  };

  for (const row of rows) {
    const ch = getChannelFromPaymentType(row.paymentType);
    const key = row.mappedItemName ?? row.rawItemName;
    const qty = Number.isFinite(row.quantity) ? row.quantity : 0;
    const sales = Number.isFinite(row.rowSales) ? row.rowSales : 0;
    if (!buckets[ch][key]) buckets[ch][key] = { qty: 0, sales: 0 };
    buckets[ch][key].qty += qty;
    buckets[ch][key].sales += sales;
    chTotals[ch].sales += sales;
    chTotals[ch].qty += qty;
  }

  const grandTotal = PRESENTATION_CHANNELS.reduce(
    (sum, ch) => sum + chTotals[ch].sales,
    0,
  );

  const channels: HQChannelData[] = PRESENTATION_CHANNELS.map((ch) => ({
    key: ch,
    share: grandTotal > 0 ? (chTotals[ch].sales / grandTotal) * 100 : 0,
    items: Object.entries(buckets[ch])
      .map(([name, a]) => ({ name, qty: a.qty, sales: a.sales }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit),
    totalSales: chTotals[ch].sales,
    totalQty:   chTotals[ch].qty,
  }));

  return { label, channels, grandTotal };
}

// ─── Cups sold ────────────────────────────────────────────────────────────────

function computeCupsData(
  reports: DailyReport[],
  filters: ReportFilters,
): CupSizeTotal[] {
  const rows = getRowsForFilters(reports, {
    ...filters,
    selectedCategories: [], // empty = all standard categories (incl. PACKAGING)
  });

  const qtyMap: Record<string, number> = {};
  for (const row of rows) {
    const name = row.mappedItemName ?? row.rawItemName;
    if (!name) continue;
    if (/\d+\s*oz/i.test(name) && /cup/i.test(name)) {
      qtyMap[name] = (qtyMap[name] ?? 0) + (Number.isFinite(row.quantity) ? row.quantity : 0);
    }
  }

  return Object.entries(qtyMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => {
      const ozA = parseInt(a.name.match(/(\d+)\s*oz/i)?.[1] ?? "0", 10);
      const ozB = parseInt(b.name.match(/(\d+)\s*oz/i)?.[1] ?? "0", 10);
      if (ozB !== ozA) return ozB - ozA;
      return a.name.localeCompare(b.name);
    });
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function computeHQSyncPack(
  reports: DailyReport[],
  filters: ReportFilters,
): ComputedHQSyncPack {
  return {
    overview:       computeCategoryTotals(reports, filters),
    icedDetail:     computeProductTotals(reports, filters, "ICED"),
    hotDetail:      computeProductTotals(reports, filters, "HOT"),
    pastriesDetail: computeProductTotals(reports, filters, "SNACKS"),
    addOnsDetail:   computeProductTotals(reports, filters, "ADD-ONS"),
    top5Drinks:     buildChannelTop5(reports, filters, HQ_DRINK_CATS,  "DRINKS"),
    top5Pastry:     buildChannelTop5(reports, filters, HQ_PASTRY_CATS, "PASTRY"),
    top5AddOn:      buildChannelTop5(reports, filters, HQ_ADDON_CATS,  "ADD-ON"),
    cupsData:       computeCupsData(reports, filters),
  };
}

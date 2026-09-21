import type { DailyReport, ProcessedRow } from "@/utils/types";
import { BRANCHES, CATEGORIES, type Category } from "@/utils/types";
import type { ReportFilters } from "./compute";
import { reportTxnUtcYmd } from "./dailyBreakdown";

/** Spreadsheet columns from finance "Sales by Product GROSS". Excel export only. */
export const SALES_BY_PRODUCT_GROSS_COLS = [
  "ICED",
  "HOT",
  "SNACKS",
  "ADD-ONS",
  "CANNED",
  "COLD BREW",
  "MERCH",
  "PROMO",
  "LOYALTY CARD",
  "PACKAGING",
] as const;

export type SalesByProductGrossCol = (typeof SALES_BY_PRODUCT_GROSS_COLS)[number];

export const SALES_BY_PRODUCT_GROSS_SOURCE = "POS+ DOT APP";

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

export interface SalesByProductGrossBranchRef {
  slug: string;
  code: string;
  label: string;
}

export interface SalesByProductGrossRow {
  monthKey: string;
  monthLabel: string;
  branchId: string;
  branchCode: string;
  branchLabel: string;
  amounts: Record<SalesByProductGrossCol, number>;
  total: number;
  source: typeof SALES_BY_PRODUCT_GROSS_SOURCE;
}

export interface SalesByProductGrossData {
  columns: readonly SalesByProductGrossCol[];
  rows: SalesByProductGrossRow[];
}

function emptyAmounts(): Record<SalesByProductGrossCol, number> {
  const amounts = {} as Record<SalesByProductGrossCol, number>;
  for (const col of SALES_BY_PRODUCT_GROSS_COLS) amounts[col] = 0;
  return amounts;
}

export function monthInputLabel(monthKey: string): string {
  const m = Number(monthKey.slice(5, 7));
  if (!m || m < 1 || m > 12) return monthKey;
  return `${String(m).padStart(2, "0")}_${MONTH_NAMES[m - 1]}`;
}

function isColdBrewRow(row: ProcessedRow): boolean {
  const item = `${row.mappedItemName ?? ""} ${row.rawItemName ?? ""} ${row.rawCategory ?? ""}`.toLowerCase();
  return item.includes("cold brew");
}

function isCannedRow(row: ProcessedRow): boolean {
  const item = `${row.mappedItemName ?? ""} ${row.rawItemName ?? ""} ${row.rawCategory ?? ""}`.toLowerCase();
  return /\bcanned\b/.test(item);
}

/** Map a POS line onto one spreadsheet product column (mutually exclusive). */
export function sheetColumnForRow(row: ProcessedRow): SalesByProductGrossCol | null {
  if (isCannedRow(row)) return "CANNED";
  const cat = row.mappedCat as Category | null;
  if (!cat || !CATEGORIES.includes(cat)) return null;
  if (cat === "ICED") return isColdBrewRow(row) ? "COLD BREW" : "ICED";
  if (cat === "HOT") return "HOT";
  if (cat === "SNACKS") return "SNACKS";
  if (cat === "ADD-ONS") return "ADD-ONS";
  if (cat === "MERCH") return "MERCH";
  if (cat === "PROMO") return "PROMO";
  if (cat === "LOYALTY CARD") return "LOYALTY CARD";
  if (cat === "PACKAGING") return "PACKAGING";
  return null;
}

function defaultBranchRefs(): SalesByProductGrossBranchRef[] {
  return BRANCHES.map((b) => ({
    slug: b.id,
    code: b.label.slice(0, 3).toUpperCase(),
    label: b.label,
  }));
}

/**
 * Finance "Sales by Product GROSS" layout for Channel Sales Excel export:
 * month × branch rows with ICED…PACKAGING + TOTAL + "POS+ DOT APP".
 * Days use HQ Sync UTC calendar keys (reportTxnUtcYmd).
 */
export function computeSalesByProductGross(
  reports: DailyReport[],
  filters: ReportFilters,
  branchRefs?: SalesByProductGrossBranchRef[],
): SalesByProductGrossData {
  const refs = branchRefs && branchRefs.length > 0 ? branchRefs : defaultBranchRefs();
  const refBySlug = new Map(refs.map((r) => [r.slug, r]));

  const selectedBranchIds = Array.isArray(filters.branchId)
    ? filters.branchId
    : filters.branchId === "all"
      ? refs.map((r) => r.slug)
      : [filters.branchId];
  const selectedBranchSet = new Set(selectedBranchIds);

  const dateFrom = filters.dateFrom.slice(0, 10);
  const dateTo = filters.dateTo.slice(0, 10);

  const activeCategories =
    filters.selectedCategories && filters.selectedCategories.length > 0
      ? new Set(filters.selectedCategories)
      : new Set([...CATEGORIES]);

  type Agg = {
    monthKey: string;
    branchId: string;
    amounts: Record<SalesByProductGrossCol, number>;
  };
  const cellMap = new Map<string, Agg>();

  for (const report of reports) {
    if (!selectedBranchSet.has(report.branch)) continue;
    for (const row of report.rowDetails) {
      if (row.status !== "MAPPED") continue;
      if (!row.mappedCat || !activeCategories.has(row.mappedCat as Category)) continue;
      const day = reportTxnUtcYmd(row.transactionDate);
      if (!day || day < dateFrom || day > dateTo) continue;

      const col = sheetColumnForRow(row);
      if (!col) continue;

      const sales = Number.isFinite(row.rowSales) ? row.rowSales : 0;
      if (!sales) continue;

      const monthKey = day.slice(0, 7);
      const key = `${monthKey}::${report.branch}`;
      let cell = cellMap.get(key);
      if (!cell) {
        cell = { monthKey, branchId: report.branch, amounts: emptyAmounts() };
        cellMap.set(key, cell);
      }
      cell.amounts[col] += sales;
    }
  }

  const rows: SalesByProductGrossRow[] = Array.from(cellMap.values())
    .map((cell) => {
      const ref = refBySlug.get(cell.branchId);
      const total = SALES_BY_PRODUCT_GROSS_COLS.reduce((sum, col) => sum + cell.amounts[col], 0);
      return {
        monthKey: cell.monthKey,
        monthLabel: monthInputLabel(cell.monthKey),
        branchId: cell.branchId,
        branchCode: (ref?.code || cell.branchId).toUpperCase(),
        branchLabel: ref?.label || cell.branchId,
        amounts: cell.amounts,
        total,
        source: SALES_BY_PRODUCT_GROSS_SOURCE,
      };
    })
    .sort((a, b) => {
      const m = a.monthKey.localeCompare(b.monthKey);
      if (m !== 0) return m;
      return a.branchCode.localeCompare(b.branchCode);
    });

  return { columns: SALES_BY_PRODUCT_GROSS_COLS, rows };
}

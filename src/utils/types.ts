export const CATEGORIES = [
  "ICED", "HOT", "SNACKS", "ADD-ONS",
  "MERCH", "PROMO", "LOYALTY CARD", "PACKAGING"
] as const;

export type Category = typeof CATEGORIES[number];

export const BRANCHES = [
  { id: "greenbelt", label: "Greenbelt" },
  { id: "greenhills", label: "Greenhills" },
  { id: "podium", label: "Podium" },
  { id: "mind_museum", label: "The Mind Museum" },
  { id: "trinoma", label: "Trinoma" },
  { id: "uptown", label: "Uptown" },
  { id: "wgc", label: "WGC" },
  { id: "wcc", label: "WCC" },
   { id: "events", label: "Events" },
] as const;

export type BranchId = string;

export const EMPTY_ROWS_TOP = 7;
export const EMPTY_ROWS_MIDDLE = 3;

/**
 * One row from VALIDATION DATA.xlsx.
 *
 * The validation file is the authoritative mapping source.
 * Matching is done on Category + Item + Option (all three fields).
 * The output is:
 *   mappedCat      = mappedName
 *   mappedItemName = item  (the raw item name, unchanged)
 */
export interface MappingEntry {
  /** "Mapped Name" column — the final reporting category */
  mappedName: Category;
  /** "Category" column — the source category from the transaction CSV */
  category: string;
  /** "Item" column — the source item name from the transaction CSV */
  item: string;
  /** "Option" column — the source option text from the transaction CSV */
  option: string;
  /** Pre-normalized category for fast lookup (computed at build time) */
  catNorm: string;
  /** Pre-normalized item for fast lookup (computed at build time) */
  itemNorm: string;
  /** Pre-normalized option for fast lookup (computed at build time) */
  optionNorm: string;
  /**
   * Override for the output item name (mappedItemName in ProcessedRow).
   * When set (manual mappings), this is returned instead of `item`.
   * When absent (validation table), `item` is used as the output.
   */
  outputItem?: string;
}

export interface RawRow {
  rawCategory: string;
  rawItemName: string;
  option: string;
  quantity: number;
  unitPrice: number;
  // Optional: original payment type / channel indicator from the CSV
  paymentType?: string;
  // Optional: normalized transaction date for reporting
  transactionDate?: Date;
}

export interface ProcessedRow extends RawRow {
  rowSales: number;
  mappedCat: Category | null;
  mappedItemName: string | null;
  status: "MAPPED" | "UNMAPPED" | "SKIPPED";
}

export interface UnmappedSummary {
  rawItemName: string;
  count: number;
  totalSales: number;
}

export interface SummaryRow {
  branch: string; // branch name/label for display
  totals: Record<Category, number>;
  quantities: Record<Category, number>;
  grandTotal: number;
  grandQuantity: number;
  percents: Record<Category, number>;
  rowType: "empty" | "totals" | "quantities" | "percent"; // type of row
}

export interface DailyReport {
  id: string; // unique identifier for this record
  date: string; // the report date (dateKey)
  branch: BranchId; // branch identifier
  filename: string;
  uploadedAt: number; // timestamp
  totalRows: number;
  mappedRows: number;
  unmappedRows: number;
  skippedRows: number;
  summaryTotalsByCat: Record<Category, number>;
  summaryQuantitiesByCat: Record<Category, number>;
  grandTotal: number;
  grandQuantity: number;
  percentByCat: Record<Category, number>;
  rowDetails: ProcessedRow[];
  unmappedSummary: UnmappedSummary[];
}

export interface ColumnMapping {
  rawCategory: string;
  rawItemName: string;
  option: string;
  quantity: string;
  unitPrice: string;
  paymentType?: string;
}

// View mode type
export type ViewMode = "daily" | "monthly";

// Month key type for grouping (YYYY-MM format)
export type MonthKey = string;

// Monthly report structure
export interface MonthlyReport {
  monthKey: MonthKey; // Format: "2026-02"
  displayMonth: string; // Format: "February 2026"
  branch: BranchId | "all"; // "all" for combined view
  totalFiles: number;
  totalRows: number;
  mappedRows: number;
  unmappedRows: number;
  skippedRows: number;
  grandTotal: number;
  grandQuantity: number;
  // Per-branch breakdown (only populated when branch is "all")
  branchBreakdown: {
    branchId: BranchId;
    branchLabel: string;
    totals: Record<Category, number>;
    quantities: Record<Category, number>;
    grandTotal: number;
    grandQuantity: number;
    percents: Record<Category, number>;
  }[];
  // Daily breakdown within the month
  dailyBreakdown: {
    date: string; // YYYY-MM-DD
    branches: BranchId[];
    totals: Record<Category, number>;
    grandTotal: number;
  }[];
  // Unmapped items for the month
  unmappedSummary: UnmappedSummary[];
}

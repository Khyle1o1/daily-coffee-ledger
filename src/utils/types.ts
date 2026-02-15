export const CATEGORIES = [
  "ICED", "HOT", "SNACKS", "ADD-ONS", "CANNED",
  "COLD BREW", "MERCH", "PROMO", "LOYALTY CARD", "PACKAGING"
] as const;

export type Category = typeof CATEGORIES[number];

export const BRANCHES = [
  { id: "greenbelt", label: "Greenbelt" },
  { id: "podium", label: "Podium" },
  { id: "mind_museum", label: "The Mind Museum" },
  { id: "trinoma", label: "Trinoma" },
  { id: "uptown", label: "Uptown" },
] as const;

export type BranchId = typeof BRANCHES[number]["id"];

export const EMPTY_ROWS_TOP = 7;
export const EMPTY_ROWS_MIDDLE = 3;

export interface MappingEntry {
  CAT: string;
  ITEM_NAME: string;
  UTAK: string;
  utakNorm?: string;
}

export interface RawRow {
  rawCategory: string;
  rawItemName: string;
  option: string;
  quantity: number;
  unitPrice: number;
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
}

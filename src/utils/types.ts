export const CATEGORIES = [
  "ICED", "HOT", "SNACKS", "ADD-ONS", "CANNED",
  "COLD BREW", "MERCH", "PROMO", "LOYALTY CARD", "PACKAGING"
] as const;

export type Category = typeof CATEGORIES[number];

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

export interface DailyReport {
  date: string;
  filename: string;
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

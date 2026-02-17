// TypeScript types for Supabase data structures
// These extend the app types to match the database schema

import type { 
  Category, 
  BranchId, 
  ProcessedRow, 
  UnmappedSummary 
} from '@/utils/types';

// ============================================================================
// BRANCH TYPES
// ============================================================================
export interface Branch {
  id: string; // UUID
  name: BranchId;
  label: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DAILY SUMMARY JSON STRUCTURE
// ============================================================================
// This is the exact structure stored in reports_daily.summary_json
export interface DailySummaryJSON {
  // Core summary data
  summaryTotalsByCat: Record<Category, number>;
  summaryQuantitiesByCat: Record<Category, number>;
  grandTotal: number;
  grandQuantity: number;
  percentByCat: Record<Category, number>;
  
  // Row counts
  totalRows: number;
  mappedRows: number;
  unmappedRows: number;
  skippedRows: number;
  
  // Detailed row data
  rowDetails: ProcessedRow[];
  
  // Unmapped items summary
  unmappedSummary: UnmappedSummary[];
  
  // Metadata
  filename: string;
  uploadedAt: number; // timestamp
}

// ============================================================================
// MONTHLY SUMMARY JSON STRUCTURE
// ============================================================================
// This is the exact structure stored in reports_monthly.summary_json
export interface MonthlySummaryJSON {
  // Display information
  displayMonth: string; // e.g., "February 2026"
  
  // Aggregated summary data
  summaryTotalsByCat: Record<Category, number>;
  summaryQuantitiesByCat: Record<Category, number>;
  grandTotal: number;
  grandQuantity: number;
  percentByCat: Record<Category, number>;
  
  // Row counts
  totalRows: number;
  mappedRows: number;
  unmappedRows: number;
  skippedRows: number;
  totalFiles: number;
  
  // Per-branch breakdown (only when aggregating all branches)
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

// ============================================================================
// DATABASE ROW TYPES (fetched from Supabase)
// ============================================================================
export interface DailyReportRow {
  id: string;
  branch_id: string;
  report_date: string; // YYYY-MM-DD
  date_range_start: string;
  date_range_end: string;
  transactions_file_name: string | null;
  mapping_file_name: string | null;
  summary_json: DailySummaryJSON;
  created_at: string;
  updated_at: string;
  // Joined branch data
  branch?: Branch;
}

export interface MonthlyReportRow {
  id: string;
  branch_id: string | null;
  month_key: string; // YYYY-MM
  date_range_start: string;
  date_range_end: string;
  summary_json: MonthlySummaryJSON;
  created_at: string;
  updated_at: string;
  // Joined branch data
  branch?: Branch;
}

// ============================================================================
// SERVICE PAYLOAD TYPES
// ============================================================================
export interface SaveDailyReportPayload {
  branchId: string; // Branch UUID from database
  reportDate: string; // YYYY-MM-DD
  dateRangeStart: string; // YYYY-MM-DD
  dateRangeEnd: string; // YYYY-MM-DD
  transactionsFileName: string;
  mappingFileName?: string;
  summaryJson: DailySummaryJSON;
}

export interface SaveMonthlyReportPayload {
  branchId: string | null; // null means "all branches"
  monthKey: string; // YYYY-MM
  dateRangeStart: string; // YYYY-MM-DD
  dateRangeEnd: string; // YYYY-MM-DD
  summaryJson: MonthlySummaryJSON;
}

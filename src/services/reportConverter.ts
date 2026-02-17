// Report Converter - Transform between app types and Supabase types
// This ensures data consistency between local state and database

import type { DailyReport } from '@/utils/types';
import type { 
  DailyReportRow, 
  DailySummaryJSON,
  Branch 
} from '@/lib/supabase-types';
import type { BranchId } from '@/utils/types';

/**
 * Convert DailyReport (app type) to DailySummaryJSON (Supabase format)
 */
export function dailyReportToJSON(report: DailyReport): DailySummaryJSON {
  return {
    summaryTotalsByCat: report.summaryTotalsByCat,
    summaryQuantitiesByCat: report.summaryQuantitiesByCat,
    grandTotal: report.grandTotal,
    grandQuantity: report.grandQuantity,
    percentByCat: report.percentByCat,
    totalRows: report.totalRows,
    mappedRows: report.mappedRows,
    unmappedRows: report.unmappedRows,
    skippedRows: report.skippedRows,
    rowDetails: report.rowDetails,
    unmappedSummary: report.unmappedSummary,
    filename: report.filename,
    uploadedAt: report.uploadedAt,
  };
}

/**
 * Convert DailyReportRow (from Supabase) to DailyReport (app type)
 */
export function dailyReportFromRow(row: DailyReportRow): DailyReport {
  const json = row.summary_json as DailySummaryJSON;
  
  return {
    id: row.id,
    date: row.report_date,
    branch: (row.branch?.name || 'greenbelt') as BranchId,
    filename: json.filename,
    uploadedAt: json.uploadedAt,
    totalRows: json.totalRows,
    mappedRows: json.mappedRows,
    unmappedRows: json.unmappedRows,
    skippedRows: json.skippedRows,
    summaryTotalsByCat: json.summaryTotalsByCat,
    summaryQuantitiesByCat: json.summaryQuantitiesByCat,
    grandTotal: json.grandTotal,
    grandQuantity: json.grandQuantity,
    percentByCat: json.percentByCat,
    rowDetails: json.rowDetails,
    unmappedSummary: json.unmappedSummary,
  };
}

/**
 * Convert multiple DailyReportRows to DailyReports
 */
export function dailyReportsFromRows(rows: DailyReportRow[]): DailyReport[] {
  return rows.map(dailyReportFromRow);
}

/**
 * Get branch UUID by BranchId name
 */
export function getBranchId(branches: Branch[], branchName: BranchId): string | null {
  const branch = branches.find(b => b.name === branchName);
  return branch?.id || null;
}

/**
 * Get BranchId name by UUID
 */
export function getBranchName(branches: Branch[], branchId: string): BranchId {
  const branch = branches.find(b => b.id === branchId);
  return (branch?.name || 'greenbelt') as BranchId;
}

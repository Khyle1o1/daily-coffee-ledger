// Monthly Report Service - Handle monthly aggregation and saving
// This service computes monthly reports from daily reports and saves to Supabase

import { format, startOfMonth, endOfMonth } from 'date-fns';
import { CATEGORIES } from '@/utils/types';
import type { Category, BranchId, DailyReport, UnmappedSummary } from '@/utils/types';
import type { MonthlySummaryJSON } from '@/lib/supabase-types';
import { 
  saveMonthlyReport as saveMonthlyReportToDb,
  listMonthlyReports,
} from './reportsService';
import { getBranchId } from './reportConverter';
import type { Branch } from '@/lib/supabase-types';
import { formatMonthDisplay } from '@/utils/aggregateMonthly';

/**
 * Compute and save monthly report from daily reports
 */
export async function computeAndSaveMonthlyReport(
  dailyReports: DailyReport[],
  monthKey: string, // YYYY-MM
  branchFilter: BranchId | "all",
  branches: Branch[]
): Promise<void> {
  // Filter reports for this month
  const monthReports = dailyReports.filter(r => r.date.startsWith(monthKey));
  
  // Apply branch filter
  const filteredReports = branchFilter === "all" 
    ? monthReports 
    : monthReports.filter(r => r.branch === branchFilter);

  if (filteredReports.length === 0) {
    throw new Error(`No daily reports found for ${monthKey}`);
  }

  // Compute monthly summary
  const summaryJson = computeMonthlySummaryJSON(filteredReports, monthKey, branchFilter);

  // Determine date range
  const [year, month] = monthKey.split('-').map(Number);
  const monthDate = new Date(year, month - 1, 1);
  const dateRangeStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const dateRangeEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

  // Get branch UUID (null for "all")
  const branchUuid = branchFilter === "all" 
    ? null 
    : getBranchId(branches, branchFilter);

  if (branchFilter !== "all" && !branchUuid) {
    throw new Error(`Branch not found: ${branchFilter}`);
  }

  // Save to Supabase
  await saveMonthlyReportToDb({
    branchId: branchUuid,
    monthKey,
    dateRangeStart,
    dateRangeEnd,
    summaryJson,
  });
}

/**
 * Compute monthly summary JSON from daily reports
 */
function computeMonthlySummaryJSON(
  reports: DailyReport[],
  monthKey: string,
  branchFilter: BranchId | "all"
): MonthlySummaryJSON {
  // Aggregate totals
  let totalRows = 0;
  let mappedRows = 0;
  let unmappedRows = 0;
  let skippedRows = 0;
  let grandTotal = 0;
  let grandQuantity = 0;

  const summaryTotalsByCat: Record<Category, number> = {} as any;
  const summaryQuantitiesByCat: Record<Category, number> = {} as any;
  
  CATEGORIES.forEach(cat => {
    summaryTotalsByCat[cat] = 0;
    summaryQuantitiesByCat[cat] = 0;
  });

  // Track unique files
  const fileNames = new Set<string>();
  
  // Aggregate unmapped items
  const unmappedMap = new Map<string, { count: number; totalSales: number }>();

  reports.forEach(report => {
    fileNames.add(report.filename);
    totalRows += report.totalRows;
    mappedRows += report.mappedRows;
    unmappedRows += report.unmappedRows;
    skippedRows += report.skippedRows;
    grandTotal += report.grandTotal;
    grandQuantity += report.grandQuantity;

    CATEGORIES.forEach(cat => {
      summaryTotalsByCat[cat] += report.summaryTotalsByCat[cat] || 0;
      summaryQuantitiesByCat[cat] += report.summaryQuantitiesByCat[cat] || 0;
    });

    report.unmappedSummary.forEach(item => {
      const existing = unmappedMap.get(item.rawItemName);
      if (existing) {
        existing.count += item.count;
        existing.totalSales += item.totalSales;
      } else {
        unmappedMap.set(item.rawItemName, { count: item.count, totalSales: item.totalSales });
      }
    });
  });

  // Calculate percentages
  const percentByCat: Record<Category, number> = {} as any;
  CATEGORIES.forEach(cat => {
    percentByCat[cat] = grandTotal > 0 ? (summaryTotalsByCat[cat] / grandTotal) * 100 : 0;
  });

  const unmappedSummary: UnmappedSummary[] = Array.from(unmappedMap.entries())
    .map(([rawItemName, data]) => ({ rawItemName, ...data }))
    .sort((a, b) => b.totalSales - a.totalSales);

  // Build branch breakdown
  const branchBreakdown = computeBranchBreakdown(reports);

  // Build daily breakdown
  const dailyBreakdown = computeDailyBreakdown(reports);

  return {
    displayMonth: formatMonthDisplay(monthKey),
    summaryTotalsByCat,
    summaryQuantitiesByCat,
    grandTotal,
    grandQuantity,
    percentByCat,
    totalRows,
    mappedRows,
    unmappedRows,
    skippedRows,
    totalFiles: fileNames.size,
    branchBreakdown,
    dailyBreakdown,
    unmappedSummary,
  };
}

/**
 * Compute per-branch breakdown for monthly summary
 */
function computeBranchBreakdown(reports: DailyReport[]) {
  const branchMap = new Map<BranchId, DailyReport[]>();
  reports.forEach(report => {
    if (!branchMap.has(report.branch)) {
      branchMap.set(report.branch, []);
    }
    branchMap.get(report.branch)!.push(report);
  });

  const breakdown = Array.from(branchMap.entries()).map(([branchId, branchReports]) => {
    const totals: Record<Category, number> = {} as any;
    const quantities: Record<Category, number> = {} as any;
    CATEGORIES.forEach(cat => {
      totals[cat] = 0;
      quantities[cat] = 0;
    });

    let grandTotal = 0;
    let grandQuantity = 0;

    branchReports.forEach(report => {
      CATEGORIES.forEach(cat => {
        totals[cat] += report.summaryTotalsByCat[cat] || 0;
        quantities[cat] += report.summaryQuantitiesByCat[cat] || 0;
      });
      grandTotal += report.grandTotal;
      grandQuantity += report.grandQuantity;
    });

    const percents: Record<Category, number> = {} as any;
    CATEGORIES.forEach(cat => {
      percents[cat] = grandTotal > 0 ? (totals[cat] / grandTotal) * 100 : 0;
    });

    // Get branch label from BRANCHES constant
    const branchLabel = branchId.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    return {
      branchId,
      branchLabel,
      totals,
      quantities,
      grandTotal,
      grandQuantity,
      percents,
    };
  });

  return breakdown.sort((a, b) => a.branchLabel.localeCompare(b.branchLabel));
}

/**
 * Compute daily breakdown within the month
 */
function computeDailyBreakdown(reports: DailyReport[]) {
  const dateMap = new Map<string, DailyReport[]>();
  reports.forEach(report => {
    if (!dateMap.has(report.date)) {
      dateMap.set(report.date, []);
    }
    dateMap.get(report.date)!.push(report);
  });

  const breakdown = Array.from(dateMap.entries()).map(([date, dayReports]) => {
    const branches = dayReports.map(r => r.branch);

    const totals: Record<Category, number> = {} as any;
    CATEGORIES.forEach(cat => {
      totals[cat] = 0;
    });

    let grandTotal = 0;

    dayReports.forEach(report => {
      CATEGORIES.forEach(cat => {
        totals[cat] += report.summaryTotalsByCat[cat] || 0;
      });
      grandTotal += report.grandTotal;
    });

    return {
      date,
      branches,
      totals,
      grandTotal,
    };
  });

  return breakdown.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get saved monthly reports from Supabase
 */
export async function getSavedMonthlyReports(
  branchId: string | null,
  monthStart?: string,
  monthEnd?: string
) {
  return await listMonthlyReports(branchId, monthStart, monthEnd);
}

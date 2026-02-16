import { CATEGORIES, BRANCHES, type Category, type DailyReport, type MonthlyReport, type BranchId, type UnmappedSummary } from "./types";

/**
 * Extract month key from a date string (YYYY-MM-DD) → (YYYY-MM)
 */
export function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7); // "2026-02-15" → "2026-02"
}

/**
 * Format month key to display format
 * "2026-02" → "February 2026"
 */
export function formatMonthDisplay(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Get previous/next month key
 */
export function adjustMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${newYear}-${newMonth}`;
}

/**
 * Group daily reports by month
 */
export function groupReportsByMonth(reports: DailyReport[]): Record<string, DailyReport[]> {
  const grouped: Record<string, DailyReport[]> = {};
  reports.forEach(report => {
    const monthKey = getMonthKey(report.date);
    if (!grouped[monthKey]) {
      grouped[monthKey] = [];
    }
    grouped[monthKey].push(report);
  });
  return grouped;
}

/**
 * Compute monthly report from daily reports for a specific month
 * @param reports - All daily reports
 * @param monthKey - Month to compute (YYYY-MM)
 * @param branchFilter - Optional branch filter ("all" or specific branch ID)
 */
export function computeMonthlyReport(
  reports: DailyReport[],
  monthKey: string,
  branchFilter: BranchId | "all" = "all"
): MonthlyReport | null {
  // Filter reports for this month
  const monthReports = reports.filter(r => getMonthKey(r.date) === monthKey);
  
  // Apply branch filter if specified
  const filteredReports = branchFilter === "all" 
    ? monthReports 
    : monthReports.filter(r => r.branch === branchFilter);

  if (filteredReports.length === 0) return null;

  // Aggregate totals
  let totalRows = 0;
  let mappedRows = 0;
  let unmappedRows = 0;
  let skippedRows = 0;
  let grandTotal = 0;
  let grandQuantity = 0;

  // Track unique files
  const fileNames = new Set<string>();
  
  // Aggregate unmapped items
  const unmappedMap = new Map<string, { count: number; totalSales: number }>();

  filteredReports.forEach(report => {
    fileNames.add(report.filename);
    totalRows += report.totalRows;
    mappedRows += report.mappedRows;
    unmappedRows += report.unmappedRows;
    skippedRows += report.skippedRows;
    grandTotal += report.grandTotal;
    grandQuantity += report.grandQuantity;

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

  const unmappedSummary: UnmappedSummary[] = Array.from(unmappedMap.entries())
    .map(([rawItemName, data]) => ({ rawItemName, ...data }))
    .sort((a, b) => b.totalSales - a.totalSales);

  // Build branch breakdown (per-branch totals)
  const branchBreakdown = computeBranchBreakdown(filteredReports);

  // Build daily breakdown (per-day totals within the month)
  const dailyBreakdown = computeDailyBreakdown(filteredReports);

  return {
    monthKey,
    displayMonth: formatMonthDisplay(monthKey),
    branch: branchFilter,
    totalFiles: fileNames.size,
    totalRows,
    mappedRows,
    unmappedRows,
    skippedRows,
    grandTotal,
    grandQuantity,
    branchBreakdown,
    dailyBreakdown,
    unmappedSummary,
  };
}

/**
 * Compute per-branch breakdown for monthly summary
 */
function computeBranchBreakdown(reports: DailyReport[]) {
  // Group by branch
  const branchMap = new Map<BranchId, DailyReport[]>();
  reports.forEach(report => {
    if (!branchMap.has(report.branch)) {
      branchMap.set(report.branch, []);
    }
    branchMap.get(report.branch)!.push(report);
  });

  const breakdown = Array.from(branchMap.entries()).map(([branchId, branchReports]) => {
    const branchLabel = BRANCHES.find(b => b.id === branchId)?.label || branchId;

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

  // Sort by branch name
  return breakdown.sort((a, b) => a.branchLabel.localeCompare(b.branchLabel));
}

/**
 * Compute daily breakdown within the month
 */
function computeDailyBreakdown(reports: DailyReport[]) {
  // Group by date
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

  // Sort by date descending
  return breakdown.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get all available months from reports (sorted newest first)
 */
export function getAvailableMonths(reports: DailyReport[]): { monthKey: string; displayMonth: string; totalAmount: number }[] {
  const grouped = groupReportsByMonth(reports);
  
  return Object.keys(grouped)
    .sort((a, b) => b.localeCompare(a)) // Sort descending (newest first)
    .map(monthKey => {
      const monthReports = grouped[monthKey];
      const totalAmount = monthReports.reduce((sum, r) => sum + r.grandTotal, 0);
      return {
        monthKey,
        displayMonth: formatMonthDisplay(monthKey),
        totalAmount,
      };
    });
}

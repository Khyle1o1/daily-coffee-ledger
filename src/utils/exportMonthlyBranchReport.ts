import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CATEGORIES } from "@/utils/types";
import { formatPHP } from "@/utils/format";
import type { MonthlyBranchReportResult } from "@/lib/reports/computeMonthlyBranchReport";

function filterSummary(result: MonthlyBranchReportResult): string {
  const f = result.filters;
  const parts = [
    f.year === "all" ? "All years" : String(f.year),
    f.monthKey === "all" ? "All months" : f.monthKey,
    f.branchId === "all" ? "All branches" : f.branchId,
    f.category === "all" ? "All categories" : f.category,
  ];
  if (f.dateFrom || f.dateTo) {
    parts.push(`${f.dateFrom ?? "…"} → ${f.dateTo ?? "…"}`);
  }
  return parts.join(" · ");
}

export function exportMonthlyBranchCsv(result: MonthlyBranchReportResult): void {
  const headers = [
    "Month",
    "Branch",
    ...CATEGORIES,
    "Total Sales",
  ];
  const lines = [headers.join(",")];
  for (const row of result.tableRows) {
    const cells = [
      row.monthLabel,
      row.branchLabel,
      ...CATEGORIES.map((c) => String(row.totals[c] ?? 0)),
      String(row.totalSales),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  lines.push(`"Grand Total",,,${"".padEnd(CATEGORIES.length - 1, ",")},,"${result.overview.totalSales}"`);

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `monthly-branch-report-${result.generatedAt.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMonthlyBranchExcel(result: MonthlyBranchReportResult): void {
  const rows = result.tableRows.map((row) => {
    const obj: Record<string, string | number> = {
      Month: row.monthLabel,
      Branch: row.branchLabel,
    };
    for (const cat of CATEGORIES) obj[cat] = row.totals[cat] ?? 0;
    obj["Total Sales"] = row.totalSales;
    return obj;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Monthly Branch");

  const overview = [
    { Metric: "Filters", Value: filterSummary(result) },
    { Metric: "Generated", Value: result.generatedAt },
    { Metric: "Total Sales", Value: result.overview.totalSales },
    { Metric: "Branches with Data", Value: result.overview.branchesWithData },
    { Metric: "Months with Data", Value: result.overview.monthsWithData },
    { Metric: "Avg Monthly Sales", Value: result.overview.averageMonthlySales },
    {
      Metric: "Highest Branch",
      Value: result.overview.highestBranch
        ? `${result.overview.highestBranch.label} (${result.overview.highestBranch.sales})`
        : "—",
    },
    {
      Metric: "Highest Month",
      Value: result.overview.highestMonth
        ? `${result.overview.highestMonth.label} (${result.overview.highestMonth.sales})`
        : "—",
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overview), "Overview");

  XLSX.writeFile(wb, `monthly-branch-report-${result.generatedAt.slice(0, 10)}.xlsx`);
}

export function exportMonthlyBranchPdf(result: MonthlyBranchReportResult): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("DOT Coffee — Monthly Branch Report", margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(filterSummary(result), margin, 58);
  doc.text(`Generated: ${new Date(result.generatedAt).toLocaleString()}`, margin, 72);
  doc.text(
    `Total Sales: ${formatPHP(result.overview.totalSales)}  |  Branches: ${result.overview.branchesWithData}  |  Months: ${result.overview.monthsWithData}`,
    margin,
    86,
  );

  autoTable(doc, {
    startY: 100,
    head: [["Month", "Branch", ...CATEGORIES.map((c) => c.replace("LOYALTY CARD", "LOYALTY")), "Total"]],
    body: result.tableRows.map((row) => [
      row.monthLabel,
      row.branchLabel,
      ...CATEGORIES.map((c) => formatPHP(row.totals[c] ?? 0)),
      formatPHP(row.totalSales),
    ]),
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [14, 45, 73], textColor: 255 },
    margin: { left: margin, right: margin },
  });

  doc.save(`monthly-branch-report-${result.generatedAt.slice(0, 10)}.pdf`);
}

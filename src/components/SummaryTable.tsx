import { CATEGORIES, type Category, type DailyReport } from "@/utils/types";
import { formatNumber, formatPercent } from "@/utils/format";
import { BRANCHES } from "@/utils/types";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SingleBranchProps {
  mode: "single";
  totals: Record<Category, number>;
  quantities: Record<Category, number>;
  grandTotal: number;
  grandQuantity: number;
  percents: Record<Category, number>;
  branchLabel: string;
}

interface MultiBranchProps {
  mode: "multi";
  reports: DailyReport[];
}

type Props = SingleBranchProps | MultiBranchProps;

export default function SummaryTable(props: Props) {
  const cats = [...CATEGORIES];
  const allCols = ["BRANCH" as const, ...cats, "TOTAL" as const];
  
  // Track which branches have their quantity details expanded
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());

  const toggleBranch = (branchLabel: string) => {
    setExpandedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchLabel)) {
        next.delete(branchLabel);
      } else {
        next.add(branchLabel);
      }
      return next;
    });
  };

  const totalsRow = (branchText: string, totals: Record<Category, number>, grandTotal: number, isClickable: boolean = true) => [
    branchText,
    ...cats.map(c => formatNumber(totals[c])),
    formatNumber(grandTotal),
    isClickable, // Store clickable state for rendering
  ];
  const quantitiesRow = (branchText: string, quantities: Record<Category, number>, grandQuantity: number) => [
    branchText,
    ...cats.map(c => formatNumber(quantities[c])),
    formatNumber(grandQuantity),
    false, // quantities rows are not clickable
  ];
  const percentRow = (branchText: string, percents: Record<Category, number>, grandTotal: number) => [
    branchText,
    ...cats.map(c => formatPercent(percents[c])),
    grandTotal > 0 ? "100%" : "0%",
    false, // percent rows are not clickable
  ];

  const rows: { cells: (string | boolean)[]; className: string; isQuantityRow?: boolean; branchLabel?: string }[] = [];

  if (props.mode === "single") {
    // Single branch mode - show only totals by default
    const { branchLabel, totals, quantities, grandTotal, grandQuantity, percents } = props;
    
    const isExpanded = expandedBranches.has(branchLabel);
    
    // Totals row (sales) - clickable
    rows.push({ 
      cells: totalsRow(branchLabel, totals, grandTotal, true), 
      className: "totals-row cursor-pointer hover:bg-primary/5",
      branchLabel 
    });
    
    // Quantities row - only show if expanded
    if (isExpanded) {
      rows.push({ 
        cells: quantitiesRow(branchLabel, quantities, grandQuantity), 
        className: "quantities-row",
        isQuantityRow: true 
      });
    }
    
    // Percentage row
    rows.push({ 
      cells: percentRow(branchLabel, percents, grandTotal), 
      className: "percent-row" 
    });
  } else {
    // Multi-branch mode - show all branches together
    const { reports } = props;
    
    // Sort reports by branch name for consistent display
    const sortedReports = [...reports].sort((a, b) => a.branch.localeCompare(b.branch));
    
    // For each branch, add totals row and conditionally quantities row
    sortedReports.forEach((report) => {
      const branchLabel = BRANCHES.find(b => b.id === report.branch)?.label || report.branch;
      const isExpanded = expandedBranches.has(branchLabel);
      
      // Totals row (clickable)
      rows.push({ 
        cells: totalsRow(branchLabel, report.summaryTotalsByCat, report.grandTotal, true), 
        className: "totals-row cursor-pointer hover:bg-primary/5",
        branchLabel 
      });
      
      // Quantities row - only show if expanded
      if (isExpanded) {
        rows.push({ 
          cells: quantitiesRow(branchLabel, report.summaryQuantitiesByCat, report.grandQuantity), 
          className: "quantities-row",
          isQuantityRow: true 
        });
      }
    });
    
    // Add combined totals at the end
    const combinedTotals = sortedReports.reduce((acc, report) => {
      cats.forEach(cat => {
        acc[cat] = (acc[cat] || 0) + (report.summaryTotalsByCat[cat] || 0);
      });
      return acc;
    }, {} as Record<Category, number>);
    
    const combinedQuantities = sortedReports.reduce((acc, report) => {
      cats.forEach(cat => {
        acc[cat] = (acc[cat] || 0) + (report.summaryQuantitiesByCat[cat] || 0);
      });
      return acc;
    }, {} as Record<Category, number>);
    
    const combinedGrandTotal = sortedReports.reduce((sum, r) => sum + r.grandTotal, 0);
    const combinedGrandQuantity = sortedReports.reduce((sum, r) => sum + r.grandQuantity, 0);
    
    const combinedPercents = {} as Record<Category, number>;
    cats.forEach(cat => {
      combinedPercents[cat] = combinedGrandTotal > 0 ? (combinedTotals[cat] / combinedGrandTotal) * 100 : 0;
    });
    
    const isCombinedExpanded = expandedBranches.has("COMBINED TOTAL");
    
    // Add combined totals row (clickable)
    rows.push({ 
      cells: totalsRow("COMBINED TOTAL", combinedTotals, combinedGrandTotal, true), 
      className: "totals-row font-bold bg-primary/10 cursor-pointer hover:bg-primary/15",
      branchLabel: "COMBINED TOTAL"
    });
    
    // Add combined quantities row - only if expanded
    if (isCombinedExpanded) {
      rows.push({ 
        cells: quantitiesRow("COMBINED TOTAL", combinedQuantities, combinedGrandQuantity), 
        className: "quantities-row font-bold bg-primary/10",
        isQuantityRow: true 
      });
    }
    
    // Add percentage row for combined data
    rows.push({ 
      cells: percentRow("COMBINED TOTAL", combinedPercents, combinedGrandTotal), 
      className: "percent-row font-bold" 
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl shadow-lg">
      <table className="w-full border-collapse min-w-[1000px]">
        <thead className="sticky top-0 z-10">
          <tr>
            {allCols.map(col => (
              <th
                key={col}
                className={`spreadsheet-header ${
                  col === "BRANCH" ? "min-w-[120px]" : 
                  col === "TOTAL" ? "min-w-[100px]" : 
                  "min-w-[80px]"
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const isClickable = row.cells[row.cells.length - 1] === true;
            const displayCells = row.cells.slice(0, -1); // Remove the isClickable flag
            const branchName = displayCells[0] as string;
            const isExpanded = row.branchLabel ? expandedBranches.has(row.branchLabel) : false;
            
            return (
              <tr 
                key={ri} 
                className={row.className}
                onClick={isClickable && row.branchLabel ? () => toggleBranch(row.branchLabel!) : undefined}
              >
                {displayCells.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`spreadsheet-cell ${
                      ci === 0 ? "font-semibold text-left sticky left-0 bg-inherit z-5" : 
                      ci === displayCells.length - 1 ? "font-bold border-l-2 border-l-primary" : 
                      ""
                    }`}
                  >
                    {ci === 0 && isClickable ? (
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-primary" />
                        )}
                        <span>{cell}</span>
                      </div>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

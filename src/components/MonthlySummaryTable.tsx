import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CATEGORIES, type Category, type MonthlyReport } from "@/utils/types";
import { formatNumber, formatPercent } from "@/utils/format";

interface MonthlySummaryTableProps {
  monthlyReport: MonthlyReport;
}

export default function MonthlySummaryTable({ monthlyReport }: MonthlySummaryTableProps) {
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

  const cats = [...CATEGORIES];
  const allCols = ["BRANCH" as const, ...cats, "TOTAL" as const];

  // If single branch filter, show that branch only
  if (monthlyReport.branch !== "all" && monthlyReport.branchBreakdown.length === 1) {
    const branch = monthlyReport.branchBreakdown[0];
    const isExpanded = expandedBranches.has(branch.branchLabel);

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
            {/* Totals Row */}
            <tr
              className="totals-row cursor-pointer hover:bg-primary/5"
              onClick={() => toggleBranch(branch.branchLabel)}
            >
              <td className="spreadsheet-cell font-semibold text-left sticky left-0 bg-inherit z-5">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-primary" />
                  )}
                  <span>{branch.branchLabel}</span>
                </div>
              </td>
              {cats.map(cat => (
                <td key={cat} className="spreadsheet-cell">
                  {formatNumber(branch.totals[cat])}
                </td>
              ))}
              <td className="spreadsheet-cell font-bold border-l-2 border-l-primary">
                {formatNumber(branch.grandTotal)}
              </td>
            </tr>

            {/* Quantities Row (if expanded) */}
            {isExpanded && (
              <tr className="quantities-row">
                <td className="spreadsheet-cell font-semibold text-left sticky left-0 bg-inherit z-5">
                  {branch.branchLabel}
                </td>
                {cats.map(cat => (
                  <td key={cat} className="spreadsheet-cell">
                    {formatNumber(branch.quantities[cat])}
                  </td>
                ))}
                <td className="spreadsheet-cell font-bold border-l-2 border-l-primary">
                  {formatNumber(branch.grandQuantity)}
                </td>
              </tr>
            )}

            {/* Percentage Row */}
            <tr className="percent-row">
              <td className="spreadsheet-cell font-semibold text-left sticky left-0 bg-inherit z-5">
                {branch.branchLabel}
              </td>
              {cats.map(cat => (
                <td key={cat} className="spreadsheet-cell">
                  {formatPercent(Math.round(branch.percents[cat]))}
                </td>
              ))}
              <td className="spreadsheet-cell font-bold border-l-2 border-l-primary">
                100%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Multi-branch view: show all branches + combined total
  const branches = monthlyReport.branchBreakdown;

  // Compute combined totals
  const combinedTotals: Record<Category, number> = {} as any;
  const combinedQuantities: Record<Category, number> = {} as any;
  CATEGORIES.forEach(cat => {
    combinedTotals[cat] = 0;
    combinedQuantities[cat] = 0;
  });

  let combinedGrandTotal = 0;
  let combinedGrandQuantity = 0;

  branches.forEach(branch => {
    CATEGORIES.forEach(cat => {
      combinedTotals[cat] += branch.totals[cat];
      combinedQuantities[cat] += branch.quantities[cat];
    });
    combinedGrandTotal += branch.grandTotal;
    combinedGrandQuantity += branch.grandQuantity;
  });

  const combinedPercents: Record<Category, number> = {} as any;
  CATEGORIES.forEach(cat => {
    combinedPercents[cat] = combinedGrandTotal > 0 ? (combinedTotals[cat] / combinedGrandTotal) * 100 : 0;
  });

  const isCombinedExpanded = expandedBranches.has("COMBINED TOTAL");

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
          {/* Per-branch rows */}
          {branches.map(branch => {
            const isExpanded = expandedBranches.has(branch.branchLabel);

            return (
              <React.Fragment key={branch.branchId}>
                {/* Totals Row */}
                <tr
                  className="totals-row cursor-pointer hover:bg-primary/5"
                  onClick={() => toggleBranch(branch.branchLabel)}
                >
                  <td className="spreadsheet-cell font-semibold text-left sticky left-0 bg-inherit z-5">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-primary" />
                      )}
                      <span>{branch.branchLabel}</span>
                    </div>
                  </td>
                  {cats.map(cat => (
                    <td key={cat} className="spreadsheet-cell">
                      {formatNumber(branch.totals[cat])}
                    </td>
                  ))}
                  <td className="spreadsheet-cell font-bold border-l-2 border-l-primary">
                    {formatNumber(branch.grandTotal)}
                  </td>
                </tr>

                {/* Quantities Row (if expanded) */}
                {isExpanded && (
                  <tr className="quantities-row">
                    <td className="spreadsheet-cell font-semibold text-left sticky left-0 bg-inherit z-5 pl-10">
                      Quantity
                    </td>
                    {cats.map(cat => (
                      <td key={cat} className="spreadsheet-cell">
                        {formatNumber(branch.quantities[cat])}
                      </td>
                    ))}
                    <td className="spreadsheet-cell font-bold border-l-2 border-l-primary">
                      {formatNumber(branch.grandQuantity)}
                    </td>
                  </tr>
                )}

                {/* Category Distribution (if expanded) */}
                {isExpanded && (
                  <tr className="percent-row">
                    <td className="spreadsheet-cell font-semibold text-left sticky left-0 bg-inherit z-5 pl-10">
                      Distribution
                    </td>
                    {cats.map(cat => (
                      <td key={cat} className="spreadsheet-cell">
                        {formatPercent(Math.round(branch.percents[cat]))}
                      </td>
                    ))}
                    <td className="spreadsheet-cell font-bold border-l-2 border-l-primary">
                      100%
                    </td>
                  </tr>
                )}

                {/* Top Categories (if expanded) */}
                {isExpanded && (
                  <tr className="bg-muted/30">
                    <td colSpan={allCols.length} className="spreadsheet-cell text-left pl-10 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2 py-1">
                        <span className="font-semibold">Top Categories:</span>
                        {Object.entries(branch.totals)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 3)
                          .filter(([, amount]) => amount > 0)
                          .map(([cat, amount]) => (
                            <span key={cat} className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                              {cat}: ₱{formatNumber(amount)}
                            </span>
                          ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}

          {/* Combined Total Rows */}
          <tr
            className="totals-row font-bold bg-primary/10 cursor-pointer hover:bg-primary/15"
            onClick={() => toggleBranch("COMBINED TOTAL")}
          >
            <td className="spreadsheet-cell font-semibold text-left sticky left-0 bg-inherit z-5">
              <div className="flex items-center gap-2">
                {isCombinedExpanded ? (
                  <ChevronDown className="h-4 w-4 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
                <span>COMBINED TOTAL</span>
              </div>
            </td>
            {cats.map(cat => (
              <td key={cat} className="spreadsheet-cell">
                {formatNumber(combinedTotals[cat])}
              </td>
            ))}
            <td className="spreadsheet-cell font-bold border-l-2 border-l-primary">
              {formatNumber(combinedGrandTotal)}
            </td>
          </tr>

          {/* Combined Quantities (if expanded) */}
          {isCombinedExpanded && (
            <tr className="quantities-row font-bold bg-primary/10">
              <td className="spreadsheet-cell font-semibold text-left sticky left-0 bg-inherit z-5 pl-10">
                Quantity
              </td>
              {cats.map(cat => (
                <td key={cat} className="spreadsheet-cell">
                  {formatNumber(combinedQuantities[cat])}
                </td>
              ))}
              <td className="spreadsheet-cell font-bold border-l-2 border-l-primary">
                {formatNumber(combinedGrandQuantity)}
              </td>
            </tr>
          )}

          {/* Combined Percentage */}
          <tr className="percent-row font-bold">
            <td className="spreadsheet-cell font-semibold text-left sticky left-0 bg-inherit z-5">
              COMBINED TOTAL
            </td>
            {cats.map(cat => (
              <td key={cat} className="spreadsheet-cell">
                {formatPercent(Math.round(combinedPercents[cat]))}
              </td>
            ))}
            <td className="spreadsheet-cell font-bold border-l-2 border-l-primary">
              100%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

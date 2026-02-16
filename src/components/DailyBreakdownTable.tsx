import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CATEGORIES, BRANCHES, type Category, type MonthlyReport } from "@/utils/types";
import { formatNumber } from "@/utils/format";

interface DailyBreakdownTableProps {
  monthlyReport: MonthlyReport;
}

export default function DailyBreakdownTable({ monthlyReport }: DailyBreakdownTableProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const cats = [...CATEGORIES];
  const allCols = ["DATE" as const, ...cats, "TOTAL" as const];

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00"); // Add time to avoid timezone issues
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {monthlyReport.dailyBreakdown.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No daily data available for this month.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl shadow-lg">
          <table className="w-full border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-10">
              <tr>
                {allCols.map(col => (
                  <th
                    key={col}
                    className={`spreadsheet-header ${
                      col === "DATE" ? "min-w-[180px]" :
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
              {monthlyReport.dailyBreakdown.map(day => {
                const isExpanded = expandedDays.has(day.date);

                return (
                  <React.Fragment key={day.date}>
                    {/* Day summary row */}
                    <tr
                      className="totals-row cursor-pointer hover:bg-primary/5"
                      onClick={() => toggleDay(day.date)}
                    >
                      <td className="spreadsheet-cell font-semibold text-left sticky left-0 bg-inherit z-5">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-primary" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-primary" />
                          )}
                          <div>
                            <div>{formatDate(day.date)}</div>
                            {day.branches.length > 1 && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {day.branches.length} branches
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {cats.map(cat => (
                        <td key={cat} className="spreadsheet-cell">
                          {formatNumber(day.totals[cat])}
                        </td>
                      ))}
                      <td className="spreadsheet-cell font-bold border-l-2 border-l-primary">
                        {formatNumber(day.grandTotal)}
                      </td>
                    </tr>

                    {/* Expanded details: show category breakdown */}
                    {isExpanded && (
                      <tr className="bg-muted/30">
                        <td colSpan={allCols.length} className="spreadsheet-cell text-left pl-10">
                          <div className="py-3 space-y-2">
                            {/* Branch badges */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              <span className="text-xs font-semibold text-muted-foreground">Branches:</span>
                              {day.branches.map(branchId => {
                                const branchLabel = BRANCHES.find(b => b.id === branchId)?.label || branchId;
                                return (
                                  <span
                                    key={branchId}
                                    className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium"
                                  >
                                    {branchLabel}
                                  </span>
                                );
                              })}
                            </div>

                            {/* Top categories */}
                            <div className="flex flex-wrap gap-2">
                              <span className="text-xs font-semibold text-muted-foreground">Top Categories:</span>
                              {Object.entries(day.totals)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 5)
                                .filter(([, amount]) => amount > 0)
                                .map(([cat, amount]) => (
                                  <span
                                    key={cat}
                                    className="text-xs px-2.5 py-1 rounded-full bg-card border border-primary/20 font-medium"
                                  >
                                    {cat}: ₱{formatNumber(amount)}
                                  </span>
                                ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

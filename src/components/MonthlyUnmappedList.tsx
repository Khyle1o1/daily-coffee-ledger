import { AlertCircle } from "lucide-react";
import { formatNumber } from "@/utils/format";
import type { UnmappedSummary } from "@/utils/types";

interface MonthlyUnmappedListProps {
  items: UnmappedSummary[];
  monthDisplay: string;
}

export default function MonthlyUnmappedList({ items, monthDisplay }: MonthlyUnmappedListProps) {
  if (items.length === 0) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-8 text-center">
        <div className="bg-emerald-100 rounded-full p-4 w-fit mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <p className="text-lg font-bold text-emerald-900 mb-1">All items mapped!</p>
        <p className="text-sm text-emerald-700">
          No unmapped items found for {monthDisplay}
        </p>
      </div>
    );
  }

  const totalUnmapped = items.reduce((sum, item) => sum + item.totalSales, 0);

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 rounded-full p-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-amber-900">
                {items.length} Unmapped Item{items.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-700">
                Total unmapped sales for {monthDisplay}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-900">₱{formatNumber(totalUnmapped)}</p>
          </div>
        </div>
      </div>

      {/* Unmapped items list */}
      <div className="overflow-x-auto rounded-2xl shadow-lg">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="spreadsheet-header text-left min-w-[300px]">ITEM NAME</th>
              <th className="spreadsheet-header min-w-[100px]">COUNT</th>
              <th className="spreadsheet-header min-w-[120px]">TOTAL SALES</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                <td className="spreadsheet-cell text-left font-medium">
                  {item.rawItemName}
                </td>
                <td className="spreadsheet-cell">
                  {formatNumber(item.count)}
                </td>
                <td className="spreadsheet-cell font-semibold text-amber-700">
                  ₱{formatNumber(item.totalSales)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CTA message */}
      <div className="bg-muted/50 rounded-2xl p-4 text-center text-sm text-muted-foreground">
        <p>
          <strong>Tip:</strong> Upload an updated mapping CSV to categorize these items, 
          then recompute the monthly report.
        </p>
      </div>
    </div>
  );
}

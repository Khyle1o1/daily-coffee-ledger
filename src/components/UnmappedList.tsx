import type { UnmappedSummary } from "@/utils/types";
import { formatNumber } from "@/utils/format";
import { AlertTriangle } from "lucide-react";

interface Props {
  items: UnmappedSummary[];
}

export default function UnmappedList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-emerald-50 rounded-2xl border-2 border-emerald-200">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
          <span className="text-3xl">✓</span>
        </div>
        <p className="text-base font-semibold text-emerald-700">All items mapped successfully</p>
        <p className="text-sm text-emerald-600 mt-1">No unmapped items found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 bg-amber-50 p-4 rounded-xl border-2 border-amber-200">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <span className="text-base font-bold text-amber-700">{items.length} unmapped item(s) require attention</span>
      </div>
      <div className="overflow-x-auto rounded-2xl shadow-lg">
        <table className="w-full border-collapse text-sm bg-white">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-primary-foreground bg-primary rounded-tl-2xl">Item Name</th>
              <th className="px-4 py-3 text-right font-semibold text-primary-foreground bg-primary">Count</th>
              <th className="px-4 py-3 text-right font-semibold text-primary-foreground bg-primary rounded-tr-2xl">Total Sales</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border hover:bg-table-row-hover transition-colors">
                <td className="px-4 py-3 font-medium text-card-foreground">{item.rawItemName}</td>
                <td className="px-4 py-3 text-right tabular-nums text-card-foreground">{item.count}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">{formatNumber(item.totalSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

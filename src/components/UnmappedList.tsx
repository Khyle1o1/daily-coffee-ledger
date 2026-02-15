import type { UnmappedSummary } from "@/utils/types";
import { formatNumber } from "@/utils/format";
import { AlertTriangle } from "lucide-react";

interface Props {
  items: UnmappedSummary[];
}

export default function UnmappedList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        ✓ All items were mapped successfully
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold">{items.length} unmapped item(s)</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-secondary">
              <th className="px-3 py-2 text-left font-bold text-secondary-foreground">Item Name</th>
              <th className="px-3 py-2 text-right font-bold text-secondary-foreground">Count</th>
              <th className="px-3 py-2 text-right font-bold text-secondary-foreground">Total Sales</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border">
                <td className="px-3 py-2">{item.rawItemName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{item.count}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(item.totalSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

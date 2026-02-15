import { useState } from "react";
import type { ProcessedRow } from "@/utils/types";
import { formatNumber } from "@/utils/format";
import { Input } from "@/components/ui/input";

interface Props {
  rows: ProcessedRow[];
}

type Filter = "ALL" | "MAPPED" | "UNMAPPED" | "SKIPPED";

export default function DetailsTable({ rows }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const filtered = rows.filter(r => {
    if (filter !== "ALL" && r.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        r.rawItemName.toLowerCase().includes(s) ||
        r.rawCategory.toLowerCase().includes(s) ||
        (r.mappedItemName?.toLowerCase().includes(s) ?? false)
      );
    }
    return true;
  });

  const filters: Filter[] = ["ALL", "MAPPED", "UNMAPPED", "SKIPPED"];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {f} ({f === "ALL" ? rows.length : rows.filter(r => r.status === f).length})
          </button>
        ))}
        <Input
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto max-w-[200px] h-8 text-xs"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-xs min-w-[800px]">
          <thead>
            <tr className="bg-secondary">
              {["Category", "Item Name", "Option", "Qty", "Unit Price", "Sales", "Mapped Cat", "Mapped Name", "Status"].map(h => (
                <th key={h} className="px-2 py-2 text-left font-bold text-secondary-foreground border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((r, i) => (
              <tr key={i} className="border-b border-border hover:bg-muted/50">
                <td className="px-2 py-1.5">{r.rawCategory}</td>
                <td className="px-2 py-1.5">{r.rawItemName}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{r.option || "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.quantity}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(r.unitPrice)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{formatNumber(r.rowSales)}</td>
                <td className="px-2 py-1.5">{r.mappedCat || "—"}</td>
                <td className="px-2 py-1.5">{r.mappedItemName || "—"}</td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    r.status === "MAPPED" ? "bg-emerald-100 text-emerald-700" :
                    r.status === "UNMAPPED" ? "bg-orange-100 text-orange-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <p className="text-xs text-muted-foreground p-2">Showing first 200 of {filtered.length} rows</p>
        )}
      </div>
    </div>
  );
}

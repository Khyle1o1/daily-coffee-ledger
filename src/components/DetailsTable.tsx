import { useState } from "react";
import type { ProcessedRow, Category } from "@/utils/types";
import { CATEGORIES } from "@/utils/types";
import { formatNumber } from "@/utils/format";
import { Input } from "@/components/ui/input";

interface Props {
  rows: ProcessedRow[];
}

type Filter = "ALL" | "MAPPED" | "UNMAPPED" | "SKIPPED";

export default function DetailsTable({ rows }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<Category | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const filtered = rows.filter(r => {
    if (filter !== "ALL" && r.status !== filter) return false;
    if (categoryFilter !== "ALL" && r.mappedCat !== categoryFilter) return false;
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
      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-5 py-2 rounded-full font-semibold transition-all ${
              filter === f
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f} ({f === "ALL" ? rows.length : rows.filter(r => r.status === f).length})
          </button>
        ))}
        <Input
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto max-w-[240px] h-10 text-sm rounded-full border-2 px-4"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-sm font-semibold text-muted-foreground">Category:</span>
        <button
          onClick={() => setCategoryFilter("ALL")}
          className={`text-sm px-4 py-1.5 rounded-full font-semibold transition-all ${
            categoryFilter === "ALL"
              ? "bg-primary text-primary-foreground shadow-lg"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          ALL
        </button>
        {CATEGORIES.map(cat => {
          const categoryRows = rows.filter(r => r.mappedCat === cat);
          const totalQty = categoryRows.reduce((sum, r) => sum + r.quantity, 0);
          if (totalQty === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`text-sm px-4 py-1.5 rounded-full font-semibold transition-all ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat} ({totalQty})
            </button>
          );
        })}
      </div>

      {/* Clean Table */}
      <div className="overflow-x-auto rounded-2xl shadow-lg">
        <table className="w-full border-collapse text-sm min-w-[800px] bg-white">
          <thead>
            <tr>
              {["Category", "Item Name", "Option", "Qty", "Unit Price", "Sales", "Mapped Cat", "Mapped Name", "Status"].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-left font-semibold text-primary-foreground bg-primary border-none ${
                    i === 0 ? 'rounded-tl-2xl' : i === 8 ? 'rounded-tr-2xl' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((r, i) => (
              <tr key={i} className="border-b border-border hover:bg-table-row-hover transition-colors">
                <td className="px-4 py-3 text-card-foreground">{r.rawCategory}</td>
                <td className="px-4 py-3 text-card-foreground">{r.rawItemName}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.option || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-card-foreground">{r.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums text-card-foreground">{formatNumber(r.unitPrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-card-foreground">{formatNumber(r.rowSales)}</td>
                <td className="px-4 py-3 text-card-foreground">{r.mappedCat || "—"}</td>
                <td className="px-4 py-3 text-card-foreground">{r.mappedItemName || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    r.status === "MAPPED" ? "bg-emerald-100 text-emerald-700" :
                    r.status === "UNMAPPED" ? "bg-amber-100 text-amber-700" :
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
          <p className="text-sm text-muted-foreground p-4 bg-muted">Showing first 200 of {filtered.length} rows</p>
        )}
      </div>
    </div>
  );
}

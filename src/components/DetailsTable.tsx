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
  const [categoryFilter, setCategoryFilter] = useState<Category | "ALL" | "COLD BREW">("ALL");
  const [search, setSearch] = useState("");

  // Identify Cold Brew items (they're in ICED category but contain "cold brew")
  const isColdBrewItem = (r: ProcessedRow) => {
    return r.mappedCat === "ICED" && 
           (r.rawItemName.toLowerCase().includes("cold brew") || 
            r.rawCategory.toLowerCase().includes("cold brew"));
  };

  const coldBrewRows = rows.filter(isColdBrewItem);
  const coldBrewTotal = coldBrewRows.reduce((sum, r) => sum + r.quantity, 0);

  const filtered = rows.filter(r => {
    if (filter !== "ALL" && r.status !== filter) return false;
    
    // Special handling for Cold Brew filter
    if (categoryFilter === "COLD BREW") {
      if (!isColdBrewItem(r)) return false;
    } else if (categoryFilter !== "ALL" && r.mappedCat !== categoryFilter) {
      return false;
    }
    
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
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-4 py-1.5 rounded-full font-semibold transition-all ${
                filter === f
                  ? "bg-[#2B67B2] text-white shadow-md"
                  : "bg-[#F1F5F9] text-[#334155] hover:bg-[#E5EBF3]"
              }`}
            >
              {f} ({f === "ALL" ? rows.length : rows.filter(r => r.status === f).length})
            </button>
          ))}
        </div>
        <Input
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto max-w-[240px] h-9 text-xs rounded-full border px-3 bg-white text-[#0F172A] placeholder:text-[#94A3B8]"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="space-y-2 mb-5">
        <span className="text-xs font-semibold text-muted-foreground block">Category</span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter("ALL")}
            className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
              categoryFilter === "ALL"
                ? "bg-[#2B67B2] text-white shadow-md"
                : "bg-[#F1F5F9] text-[#334155] hover:bg-[#E5EBF3]"
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
                className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                  categoryFilter === cat
                    ? "bg-[#2B67B2] text-white shadow-md"
                    : "bg-[#F1F5F9] text-[#334155] hover:bg-[#E5EBF3]"
                }`}
              >
                {cat} ({totalQty})
              </button>
            );
          })}
          
          {/* Special Cold Brew Filter (subcategory of ICED) */}
          {coldBrewTotal > 0 && (
            <button
              onClick={() => setCategoryFilter("COLD BREW")}
              className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full font-semibold transition-all border ${
                categoryFilter === "COLD BREW"
                  ? "bg-[#2B67B2] text-white shadow-md border-[#2B67B2]"
                  : "bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD] hover:bg-[#CFF0FF]"
              }`}
            >
              🧊 COLD BREW ({coldBrewTotal})
            </button>
          )}
        </div>
      </div>

      {/* Clean Table */}
      <div className="overflow-x-auto rounded-2xl shadow-lg max-h-[340px] bg-white border border-[#E2E8F0]">
        <table className="w-full border-collapse text-sm min-w-[800px] bg-white">
          <thead className="sticky top-0 z-10">
            <tr>
              {["Category", "Item Name", "Option", "Qty", "Unit Price", "Sales", "Mapped Cat", "Mapped Name", "Status"].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-left font-semibold text-white bg-[#2B67B2] border-none ${
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
              <tr key={i} className="border-b border-border hover:bg-[#EEF2F7] transition-colors even:bg-[#F7F9FC]">
                <td className="px-4 py-3 text-card-foreground">{r.rawCategory}</td>
                <td className="px-4 py-3 text-card-foreground">{r.rawItemName}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.option || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-card-foreground">{r.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums text-card-foreground">{formatNumber(r.unitPrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-card-foreground">{formatNumber(r.rowSales)}</td>
                <td className="px-4 py-3 text-card-foreground">{r.mappedCat || "—"}</td>
                <td className="px-4 py-3 text-card-foreground">{r.mappedItemName || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
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

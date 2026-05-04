import { useEffect, useState } from "react";
import type { ProcessedRow, Category } from "@/utils/types";
import { CATEGORIES } from "@/utils/types";
import { formatNumber } from "@/utils/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createManualMapping } from "@/lib/api/manualMappings";
import { ApiAuthError } from "@/lib/api/authGuards";

interface Props {
  rows: ProcessedRow[];
  /** When set, unmapped rows can open "Add to Mapping" to persist overrides and refresh the parent report. */
  onManualMappingSaved?: () => Promise<void>;
}

type Filter = "ALL" | "MAPPED" | "UNMAPPED" | "SKIPPED";

export default function DetailsTable({ rows, onManualMappingSaved }: Props) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<Category | "ALL" | "COLD BREW">("ALL");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(200);
  const [mappingDialogRow, setMappingDialogRow] = useState<ProcessedRow | null>(null);
  const [mappedCategory, setMappedCategory] = useState<Category>("ICED");
  const [mappedItemName, setMappedItemName] = useState("");
  const [savingMapping, setSavingMapping] = useState(false);

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
  const displayedRows = filtered.slice(0, visibleCount);
  const hasMoreRows = filtered.length > visibleCount;
  const canShowLess = visibleCount > 200;

  useEffect(() => {
    setVisibleCount(200);
  }, [filter, categoryFilter, search, rows]);

  useEffect(() => {
    if (mappingDialogRow) {
      setMappedItemName(mappingDialogRow.rawItemName.trim());
      const o = (mappingDialogRow.option || "").toLowerCase();
      if (/\bhot\b/.test(o) && !/\biced\b/.test(o)) setMappedCategory("HOT");
      else if (/\biced\b/.test(o)) setMappedCategory("ICED");
      else setMappedCategory("ICED");
    }
  }, [mappingDialogRow]);

  const filters: Filter[] = ["ALL", "MAPPED", "UNMAPPED", "SKIPPED"];
  const showManualMapping = Boolean(onManualMappingSaved) && filter === "UNMAPPED";
  const headers = showManualMapping
    ? ["Category", "Item Name", "Option", "Qty", "Unit Price", "Sales", "Mapped Cat", "Mapped Name", "Status", "Actions"]
    : ["Category", "Item Name", "Option", "Qty", "Unit Price", "Sales", "Mapped Cat", "Mapped Name", "Status"];
  const lastHeaderIndex = headers.length - 1;

  const handleSaveManualMapping = async () => {
    if (!mappingDialogRow || !onManualMappingSaved) return;
    const name = mappedItemName.trim();
    if (!name) {
      toast({ variant: "destructive", title: "Mapped name required", description: "Enter the display name for this item." });
      return;
    }
    setSavingMapping(true);
    try {
      await createManualMapping({
        sourceCategory: mappingDialogRow.rawCategory,
        sourceItem: mappingDialogRow.rawItemName,
        sourceOption: mappingDialogRow.option ?? "",
        mappedCategory,
        mappedItemName: name,
        notes: "Added from daily report details (UNMAPPED)",
      });
      setMappingDialogRow(null);
      await onManualMappingSaved();
      toast({ title: "Mapping saved", description: "This combination will map automatically on future uploads." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save mapping";
      if (e instanceof ApiAuthError && e.status === 401) {
        toast({
          variant: "destructive",
          title: "Sign in required",
          description: "Log in to save manual mappings.",
        });
      } else {
        toast({ variant: "destructive", title: "Save failed", description: msg });
      }
    } finally {
      setSavingMapping(false);
    }
  };

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
          className="w-full sm:w-auto sm:ml-auto sm:max-w-[240px] h-9 text-xs rounded-full border px-3 bg-white text-[#0F172A] placeholder:text-[#94A3B8]"
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

      {/* Row visibility controls */}
      {filtered.length > 200 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs text-muted-foreground">
            Showing {displayedRows.length} of {filtered.length} rows
          </p>
          <div className="flex items-center gap-2">
            {hasMoreRows && (
              <button
                onClick={() => setVisibleCount(prev => Math.min(prev + 200, filtered.length))}
                className="text-xs px-3 py-1.5 rounded-full font-semibold bg-[#F1F5F9] text-[#334155] hover:bg-[#E5EBF3] transition-all"
              >
                Show next 200
              </button>
            )}
            {hasMoreRows && (
              <button
                onClick={() => setVisibleCount(filtered.length)}
                className="text-xs px-3 py-1.5 rounded-full font-semibold bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD] hover:bg-[#CFF0FF] transition-all"
              >
                Show all rows
              </button>
            )}
            {canShowLess && (
              <button
                onClick={() => setVisibleCount(200)}
                className="text-xs px-3 py-1.5 rounded-full font-semibold bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-all"
              >
                Show first 200
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clean Table */}
      <div className="overflow-x-auto rounded-2xl shadow-lg max-h-[340px] bg-white border border-[#E2E8F0]">
        <table className="w-full border-collapse text-xs sm:text-sm min-w-[880px] bg-white">
          <thead className="sticky top-0 z-10">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-left font-semibold text-white bg-[#2B67B2] border-none ${
                    i === 0 ? "rounded-tl-2xl" : i === lastHeaderIndex ? "rounded-tr-2xl" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r, i) => (
              <tr
                key={`${r.rawCategory}|${r.rawItemName}|${r.option}|${r.quantity}|${r.unitPrice}|${i}`}
                className="border-b border-border hover:bg-[#EEF2F7] transition-colors even:bg-[#F7F9FC]"
              >
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
                {showManualMapping && (
                  <td className="px-3 py-2 align-middle">
                    {r.status === "UNMAPPED" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] font-semibold whitespace-nowrap"
                        onClick={() => setMappingDialogRow(r)}
                      >
                        Add to Mapping
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {hasMoreRows && (
          <p className="text-sm text-muted-foreground p-4 bg-muted">
            Showing {displayedRows.length} of {filtered.length} rows
          </p>
        )}
      </div>

      <Dialog open={mappingDialogRow !== null} onOpenChange={(open) => !open && setMappingDialogRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add manual mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-muted-foreground">
              Map this POS line to a reporting category. The source category, item, and option are stored exactly as in your file.
            </p>
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs">
              <div>
                <span className="font-semibold text-foreground">Category: </span>
                {mappingDialogRow?.rawCategory}
              </div>
              <div>
                <span className="font-semibold text-foreground">Item: </span>
                {mappingDialogRow?.rawItemName}
              </div>
              <div>
                <span className="font-semibold text-foreground">Option: </span>
                {mappingDialogRow?.option || "—"}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapped-cat">Mapped category</Label>
              <Select value={mappedCategory} onValueChange={(v) => setMappedCategory(v as Category)}>
                <SelectTrigger id="mapped-cat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapped-name">Mapped name</Label>
              <Input
                id="mapped-name"
                value={mappedItemName}
                onChange={(e) => setMappedItemName(e.target.value)}
                placeholder="e.g. Cereal Milk"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setMappingDialogRow(null)} disabled={savingMapping}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveManualMapping()} disabled={savingMapping}>
              {savingMapping ? "Saving…" : "Save mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

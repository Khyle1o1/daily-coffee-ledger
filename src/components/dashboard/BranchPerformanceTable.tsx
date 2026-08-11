import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown } from "lucide-react";
import { CATEGORIES, type Category } from "@/utils/types";
import { formatNumber, formatPercent } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { PctChangeTone } from "@/utils/percentChange";

export type BranchPerformanceRow = {
  id: string;
  name: string;
  totals: Record<Category, number>;
  grandTotal: number;
  share: number;
  trendTone: PctChangeTone;
  trendLabel: string;
};

const PREVIEW_COUNT = 5;

export function BranchPerformanceTable({ rows }: { rows: BranchPerformanceRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<"name" | "grandTotal" | "share">("grandTotal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      const av = sortKey === "name" ? a.name.toLowerCase() : a[sortKey];
      const bv = sortKey === "name" ? b.name.toLowerCase() : b[sortKey];
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return next;
  }, [rows, sortKey, sortDir]);

  const visible = expanded ? sorted : sorted.slice(0, PREVIEW_COUNT);
  const hiddenCount = Math.max(0, sorted.length - PREVIEW_COUNT);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "name" ? "asc" : "desc");
  };

  return (
    <section className="saas-card overflow-hidden" aria-label="Branch performance">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Branch Performance
        </p>
        <Link
          to="/app/reports"
          className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View full report
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-primary text-primary-foreground">
              <th className="sticky left-0 z-20 bg-primary px-4 py-3 text-left font-semibold">
                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("name")}>
                  Branch
                </button>
              </th>
              <th className="px-3 py-3 text-right font-semibold">
                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("grandTotal")}>
                  Total Sales
                </button>
              </th>
              <th className="px-3 py-3 text-right font-semibold">
                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("share")}>
                  % of Total
                </button>
              </th>
              {CATEGORIES.map((cat) => (
                <th key={cat} className="px-3 py-3 text-right font-medium">
                  {cat === "LOYALTY CARD" ? "Loyalty Card" : cat === "ADD-ONS" ? "Add-ons" : cat.charAt(0) + cat.slice(1).toLowerCase()}
                </th>
              ))}
              <th className="px-3 py-3 text-center font-semibold">Trend</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                  No branch performance data for the current filters.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.id} className="border-b border-border/80 last:border-0 hover:bg-[#F8FAFC]">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-medium text-[#172B4D] hover:bg-[#F8FAFC]">
                    {row.name}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#172B4D]">
                    ₱{formatNumber(row.grandTotal)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                    {formatPercent(row.share)}
                  </td>
                  {CATEGORIES.map((cat) => (
                    <td
                      key={cat}
                      className={cn(
                        "px-3 py-3 text-right tabular-nums",
                        (row.totals[cat] || 0) < 0 ? "text-red-500" : "text-[#172B4D]",
                      )}
                    >
                      ₱{formatNumber(row.totals[cat] || 0)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center">
                    <TrendMark tone={row.trendTone} label={row.trendLabel} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 && (
        <div className="border-t border-border px-5 py-3 text-center">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show fewer branches" : `Show ${hiddenCount} more branches`}
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
        </div>
      )}
    </section>
  );
}

function TrendMark({ tone, label }: { tone: PctChangeTone; label: string }) {
  const Icon = tone === "positive" ? ArrowUp : tone === "negative" ? ArrowDown : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 text-xs font-medium",
        tone === "positive" && "text-emerald-600",
        tone === "negative" && "text-red-500",
        tone === "neutral" && "text-muted-foreground",
      )}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{label}</span>
      <span aria-hidden>{label}</span>
    </span>
  );
}

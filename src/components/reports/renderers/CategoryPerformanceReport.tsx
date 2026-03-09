import type { ComputedCategoryPerformance } from "@/lib/reports/compute";

function formatPHP(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  ICED: "#3B82F6",
  HOT: "#F97316",
  SNACKS: "#8B5CF6",
  "ADD-ONS": "#F59E0B",
  "CANNED ESPRESSO": "#10B981",
  "COLD BREW": "#06B6D4",
  MERCH: "#EC4899",
  PROMO: "#84CC16",
  "LOYALTY CARD": "#EF4444",
  PACKAGING: "#94A3B8",
};

interface Props {
  data: ComputedCategoryPerformance;
  branchLabel: string;
  dateRangeLabel: string;
}

export default function CategoryPerformanceReport({
  data,
  branchLabel,
  dateRangeLabel,
}: Props) {
  const maxSales = Math.max(...data.categories.map((c) => Math.abs(c.sales)), 1);
  const hasCompare = data.categories.some((c) => c.compareSales !== undefined);

  return (
    <div className="bg-white rounded-none p-8 min-h-[500px] font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#C05A1F]">
            HQ Weekly Sync
          </p>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f] mt-1">
            Category Performance
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{branchLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">{dateRangeLabel}</p>
          <p className="text-2xl font-black text-[#1e3a5f] mt-1">
            {formatPHP(data.grandTotal)}
          </p>
          <p className="text-xs text-slate-400">Gross Sales</p>
        </div>
      </div>

      {/* Ranked list */}
      <div className="space-y-3">
        {data.categories.map((row, idx) => {
          const barWidth =
            data.grandTotal > 0
              ? Math.max((Math.abs(row.sales) / maxSales) * 100, 0.5)
              : 0;
          const color = CATEGORY_COLORS[row.category] || "#64748B";

          return (
            <div key={row.category}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-400 w-6 text-right">
                    {idx + 1}
                  </span>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-sm font-semibold text-slate-800">
                    {row.category}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {hasCompare && row.compareSales !== undefined && (
                    <span className="text-xs text-slate-400 tabular-nums">
                      {formatPHP(row.compareSales)}
                    </span>
                  )}
                  {hasCompare && row.pctChange !== undefined && (
                    <span
                      className={`text-xs font-bold tabular-nums w-12 text-right ${
                        row.pctChange >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {row.pctChange >= 0 ? "+" : ""}
                      {row.pctChange}%
                    </span>
                  )}
                  <span className="text-sm font-bold text-slate-900 tabular-nums w-28 text-right">
                    {formatPHP(row.sales)}
                  </span>
                  <span className="text-xs text-[#1e3a5f] font-semibold tabular-nums w-12 text-right">
                    {row.percent.toFixed(1)}%
                  </span>
                </div>
              </div>
              {/* Contribution bar */}
              <div className="ml-9 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${barWidth}%`,
                    background: color,
                    opacity: 0.75,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer totals */}
      <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">
          Grand Total
        </span>
        <span className="text-xl font-black text-[#1e3a5f]">
          {formatPHP(data.grandTotal)}
        </span>
      </div>
    </div>
  );
}

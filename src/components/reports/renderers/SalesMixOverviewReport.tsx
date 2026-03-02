import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ComputedSalesMix } from "@/lib/reports/compute";

const CATEGORY_COLORS: Record<string, string> = {
  ICED: "#3B82F6",
  HOT: "#F97316",
  SNACKS: "#8B5CF6",
  "ADD-ONS": "#F59E0B",
  CANNED: "#10B981",
  "COLD BREW": "#06B6D4",
  MERCH: "#EC4899",
  PROMO: "#84CC16",
  "LOYALTY CARD": "#EF4444",
  PACKAGING: "#94A3B8",
};

function formatPHP(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

interface Props {
  data: ComputedSalesMix;
  branchLabel: string;
  dateRangeLabel: string;
}

export default function SalesMixOverviewReport({ data, branchLabel, dateRangeLabel }: Props) {
  const pieData = data.categoryTotals
    .filter((c) => c.sales > 0)
    .map((c) => ({
      name: c.category,
      value: c.sales,
    }));

  const hasCompare = data.categoryTotals.some((c) => c.compareSales !== undefined);

  return (
    <div className="bg-white rounded-none p-8 min-h-[600px] font-sans">
      {/* Report header strip */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#C05A1F]">
            HQ Weekly Sync
          </p>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f] mt-1">
            PRODUCT MIX for {dateRangeLabel}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{branchLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Gross Sales</p>
          <p className="text-3xl font-black text-[#1e3a5f]">{formatPHP(data.grandTotal)}</p>
          {hasCompare && data.compareGrandTotal !== undefined && (
            <p className="text-xs text-slate-400 mt-1">
              Compare: {formatPHP(data.compareGrandTotal)}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-8 items-start">
        {/* Pie chart */}
        <div className="w-[280px] flex-shrink-0">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                labelLine={false}
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={CATEGORY_COLORS[entry.name] || "#64748B"}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: number) => [formatPHP(val), "Sales"]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category table */}
        <div className="flex-1 min-w-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#1e3a5f] text-white">
                <th className="px-4 py-2.5 text-left font-semibold text-xs tracking-wide">CATEGORY</th>
                <th className="px-4 py-2.5 text-right font-semibold text-xs tracking-wide">SALES</th>
                <th className="px-4 py-2.5 text-right font-semibold text-xs tracking-wide">% MIX</th>
                {hasCompare && (
                  <>
                    <th className="px-4 py-2.5 text-right font-semibold text-xs tracking-wide">COMPARE</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-xs tracking-wide">CHG</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.categoryTotals.map((row, idx) => (
                <tr
                  key={row.category}
                  className={idx % 2 === 0 ? "bg-white" : "bg-[#F7F9FC]"}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ background: CATEGORY_COLORS[row.category] || "#64748B" }}
                      />
                      <span className="font-medium text-slate-800">{row.category}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                    {formatPHP(row.sales)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#1e3a5f] font-semibold text-xs">
                    {row.percent.toFixed(1)}%
                  </td>
                  {hasCompare && (
                    <>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 text-xs">
                        {row.compareSales !== undefined ? formatPHP(row.compareSales) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs font-bold">
                        {row.pctChange !== undefined ? (
                          <span className={row.pctChange >= 0 ? "text-emerald-600" : "text-red-500"}>
                            {row.pctChange >= 0 ? "+" : ""}
                            {row.pctChange}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#1e3a5f] text-white">
                <td className="px-4 py-2.5 font-bold text-sm">GROSS SALES</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-black text-sm">
                  {formatPHP(data.grandTotal)}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-sm">100%</td>
                {hasCompare && (
                  <>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-sm">
                      {data.compareGrandTotal !== undefined
                        ? formatPHP(data.compareGrandTotal)
                        : "—"}
                    </td>
                    <td />
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

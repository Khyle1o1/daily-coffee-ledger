import type { ComputedProductMix } from "@/lib/reports/compute";
import type { Category } from "@/utils/types";

function fmtNum(n: number) {
  return n.toLocaleString("en-PH", { maximumFractionDigits: 0 });
}

interface Props {
  data: ComputedProductMix;
  category: Category;
  branchLabel: string;
  dateRangeLabel: string;
  compareLabel?: string;
}

export default function RunningSalesMixCategoryReport({
  data,
  category,
  branchLabel,
  dateRangeLabel,
  compareLabel,
}: Props) {
  const top5 = data.products.slice(0, 5);
  const hasCompare = top5.some((p) => p.compareSales !== undefined);

  return (
    <div className="bg-white rounded-none p-8 min-h-[500px] font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#C05A1F]">
            HQ Weekly Sync
          </p>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f] mt-1">
            2026 Running Sales Mix_{category}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{branchLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider">
            TOP 5 {category}
          </p>
          <p className="text-sm text-slate-500">YTD as of {dateRangeLabel}</p>
        </div>
      </div>

      {/* Top 5 section */}
      <div className="mb-8">
        <h2 className="text-base font-black text-[#1e3a5f] uppercase tracking-widest mb-4">
          Top 5 {category} — YTD as of {dateRangeLabel}
        </h2>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#1e3a5f] text-white">
              <th className="w-10 px-3 py-2.5 text-center text-xs font-semibold">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide">ITEM</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold tracking-wide">QTY</th>
              {hasCompare && (
                <th className="px-4 py-2.5 text-right text-xs font-semibold tracking-wide whitespace-nowrap">
                  {compareLabel ?? "PREV PERIOD"}
                </th>
              )}
              {hasCompare && (
                <th className="px-4 py-2.5 text-right text-xs font-semibold w-16">CHG</th>
              )}
            </tr>
          </thead>
          <tbody>
            {top5.map((item, idx) => (
              <tr
                key={item.name}
                className={idx % 2 === 0 ? "bg-[#EFF6FF]" : "bg-white"}
              >
                <td className="px-3 py-2.5 text-center text-xs font-black text-[#1e3a5f]">
                  {String(idx + 1).padStart(2, "0")}
                </td>
                <td className="px-4 py-2.5 text-slate-800 font-medium">{item.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#1e3a5f]">
                  {fmtNum(item.qty)}
                </td>
                {hasCompare && (
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 text-xs">
                    {item.compareSales !== undefined ? fmtNum(item.compareQty ?? 0) : "—"}
                  </td>
                )}
                {hasCompare && (
                  <td className="px-4 py-2.5 text-right text-xs font-bold">
                    {item.pctChange !== undefined ? (
                      <span className={item.pctChange >= 0 ? "text-emerald-600" : "text-red-500"}>
                        {item.pctChange >= 0 ? "+" : ""}{item.pctChange}%
                      </span>
                    ) : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Full breakdown below top 5 */}
      {data.products.length > 5 && (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
            Full {category} breakdown
          </h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="w-8 px-3 py-2 text-center">#</th>
                <th className="px-4 py-2 text-left">ITEM</th>
                <th className="px-4 py-2 text-right">QTY</th>
                {hasCompare && <th className="px-4 py-2 text-right">COMPARE QTY</th>}
                {hasCompare && <th className="px-4 py-2 text-right w-14">CHG</th>}
              </tr>
            </thead>
            <tbody>
              {data.products.slice(5).map((item, idx) => (
                <tr
                  key={item.name}
                  className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                >
                  <td className="px-3 py-1.5 text-center text-slate-400">
                    {idx + 6}
                  </td>
                  <td className="px-4 py-1.5 text-slate-700">{item.name}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-700">
                    {fmtNum(item.qty)}
                  </td>
                  {hasCompare && (
                    <td className="px-4 py-1.5 text-right tabular-nums text-slate-400">
                      {item.compareQty !== undefined ? fmtNum(item.compareQty) : "—"}
                    </td>
                  )}
                  {hasCompare && (
                    <td className="px-4 py-1.5 text-right font-bold">
                      {item.pctChange !== undefined ? (
                        <span className={item.pctChange >= 0 ? "text-emerald-500" : "text-red-400"}>
                          {item.pctChange >= 0 ? "+" : ""}{item.pctChange}%
                        </span>
                      ) : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {top5.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-12">
          No data available for {category}.
        </p>
      )}
    </div>
  );
}

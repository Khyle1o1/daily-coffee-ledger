import type { ComputedProductMix } from "@/lib/reports/compute";

function formatPHP(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

interface Props {
  data: ComputedProductMix;
  branchLabel: string;
  dateRangeLabel: string;
  compareLabel?: string;
}

export default function ProductMixReport({
  data,
  branchLabel,
  dateRangeLabel,
  compareLabel,
}: Props) {
  const hasCompare = data.products.some((p) => p.compareSales !== undefined);
  const categoryLabel = data.category ?? "ALL";
  const totalLabel = `${formatPHP(data.totalSales)}`;

  return (
    <div className="bg-white rounded-none p-8 min-h-[500px] font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#C05A1F]">
            HQ Weekly Sync
          </p>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f] mt-1">
            Product Mix_{categoryLabel}{" "}
            <span className="text-[#C05A1F]">{totalLabel}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{branchLabel}</p>
        </div>
        <p className="text-xs text-slate-400 mt-1">{dateRangeLabel}</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#1e3a5f] text-white">
              <th className="w-10 px-3 py-2.5 text-center font-semibold text-xs">#</th>
              <th className="px-4 py-2.5 text-left font-semibold text-xs tracking-wide">MENU</th>
              {hasCompare ? (
                <>
                  <th className="px-4 py-2.5 text-right font-semibold text-xs tracking-wide whitespace-nowrap">
                    {dateRangeLabel}
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-xs tracking-wide whitespace-nowrap">
                    {compareLabel ?? "COMPARE"}
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-xs tracking-wide w-16">
                    CHG
                  </th>
                </>
              ) : (
                <>
                  <th className="px-4 py-2.5 text-right font-semibold text-xs tracking-wide">
                    QTY
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-xs tracking-wide">
                    SALES
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {data.products.map((row, idx) => (
              <tr
                key={row.name}
                className={idx % 2 === 0 ? "bg-white" : "bg-[#FDF6EE]"}
              >
                <td className="px-3 py-2.5 text-center text-xs font-semibold text-[#C05A1F]">
                  {String(idx + 1).padStart(2, "0")}
                </td>
                <td className="px-4 py-2.5 text-slate-800 font-medium">{row.name}</td>
                {hasCompare ? (
                  <>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                      {formatPHP(row.sales)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 text-xs">
                      {row.compareSales !== undefined
                        ? formatPHP(row.compareSales)
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-bold">
                      {row.pctChange !== undefined ? (
                        <span
                          className={
                            row.pctChange >= 0 ? "text-emerald-600" : "text-red-500"
                          }
                        >
                          {row.pctChange >= 0 ? "+" : ""}
                          {row.pctChange}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 text-xs">
                      {row.qty.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                      {formatPHP(row.sales)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#1e3a5f] text-white">
              <td colSpan={2} className="px-4 py-2.5 font-bold text-sm">
                TOTAL
              </td>
              {hasCompare ? (
                <>
                  <td className="px-4 py-2.5 text-right tabular-nums font-black text-sm">
                    {formatPHP(data.totalSales)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-sm">
                    {data.compareTotalSales !== undefined
                      ? formatPHP(data.compareTotalSales)
                      : "—"}
                  </td>
                  <td />
                </>
              ) : (
                <>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-sm">
                    {data.products
                      .reduce((s, p) => s + p.qty, 0)
                      .toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-black text-sm">
                    {formatPHP(data.totalSales)}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

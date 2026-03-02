import type { ProductMixChannelData } from "@/lib/reports/computeProductMixChannel";
import { formatPHP } from "@/utils/format";

interface Props {
  data: ProductMixChannelData;
  branchLabel: string;
}

export default function ProductMixChannelReport({ data, branchLabel }: Props) {
  const { periodLabel, rows, totals, category } = data;

  const categoryLabel =
    category === "ALL" ? "ALL CATEGORIES" : category;

  return (
    <div className="bg-white rounded-none p-8 min-h-[600px] font-sans">
      {/* Header strip */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#C05A1F]">
            HQ Weekly Sync
          </p>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f] mt-1">
            {category === "ALL"
              ? `PRODUCT MIX — ${periodLabel}`
              : `PRODUCT MIX — ${category} — ${periodLabel}`}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{branchLabel}</p>
          <p className="text-xs text-slate-400 mt-1">
            Category: {categoryLabel}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Quantity breakdown */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full table-fixed border-collapse text-xs text-slate-900">
          <colgroup>
            <col style={{ width: "48px" }} />
            <col style={{ width: "340px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e3a5f] text-white">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">MENU</th>
              <th className="px-3 py-2 text-right">{periodLabel}</th>
              <th className="px-3 py-2 text-right">WALKIN QTY</th>
              <th className="px-3 py-2 text-right">GRAB QTY</th>
              <th className="px-3 py-2 text-right">FOODPANDA QTY</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.name}
                className={index % 2 === 0 ? "bg-white" : "bg-[#F7F9FC]"}
              >
                <td className="px-3 py-1.5 text-left font-semibold text-[11px] text-slate-500">
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-1.5 text-left text-[12px] font-medium text-slate-800 truncate whitespace-nowrap overflow-hidden">
                  {row.name}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-[12px] font-semibold text-slate-900">
                  {row.totalQty.toLocaleString("en-PH")}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-[12px] text-slate-800">
                  {row.walkInQty.toLocaleString("en-PH")}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-[12px] text-slate-800">
                  {row.grabQty.toLocaleString("en-PH")}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-[12px] text-slate-800">
                  {row.foodpandaQty.toLocaleString("en-PH")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#1e3a5f] text-white">
              <td className="px-3 py-2 text-left text-[11px] font-bold">#</td>
              <td className="px-3 py-2 text-left text-[11px] font-bold">TOTAL</td>
              <td className="px-3 py-2 text-right text-[11px] font-bold">
                {totals.totalQty.toLocaleString("en-PH")}
              </td>
              <td className="px-3 py-2 text-right text-[11px] font-bold">
                {totals.walkInQty.toLocaleString("en-PH")}
              </td>
              <td className="px-3 py-2 text-right text-[11px] font-bold">
                {totals.grabQty.toLocaleString("en-PH")}
              </td>
              <td className="px-3 py-2 text-right text-[11px] font-bold">
                {totals.foodpandaQty.toLocaleString("en-PH")}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>

        {/* Sales breakdown */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full table-fixed border-collapse text-xs text-slate-900">
          <colgroup>
            <col style={{ width: "48px" }} />
            <col style={{ width: "340px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e3a5f] text-white">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">MENU</th>
              <th className="px-3 py-2 text-right">{periodLabel}</th>
              <th className="px-3 py-2 text-right">WALKIN SALES</th>
              <th className="px-3 py-2 text-right">GRAB SALES</th>
              <th className="px-3 py-2 text-right">FOODPANDA SALES</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.name}-sales`}
                className={index % 2 === 0 ? "bg-white" : "bg-[#F7F9FC]"}
              >
                <td className="px-3 py-1.5 text-left font-semibold text-[11px] text-slate-500">
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-1.5 text-left text-[12px] font-medium text-slate-800 truncate whitespace-nowrap overflow-hidden">
                  {row.name}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-[12px] font-semibold text-slate-900">
                  {formatPHP(row.totalSales)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-[12px] text-slate-800">
                  {formatPHP(row.walkInSales)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-[12px] text-slate-800">
                  {formatPHP(row.grabSales)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-[12px] text-slate-800">
                  {formatPHP(row.foodpandaSales)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#1e3a5f] text-white">
              <td className="px-3 py-2 text-left text-[11px] font-bold">#</td>
              <td className="px-3 py-2 text-left text-[11px] font-bold">TOTAL</td>
              <td className="px-3 py-2 text-right text-[11px] font-bold">
                {formatPHP(totals.totalSales)}
              </td>
              <td className="px-3 py-2 text-right text-[11px] font-bold">
                {formatPHP(totals.walkInSales)}
              </td>
              <td className="px-3 py-2 text-right text-[11px] font-bold">
                {formatPHP(totals.grabSales)}
              </td>
              <td className="px-3 py-2 text-right text-[11px] font-bold">
                {formatPHP(totals.foodpandaSales)}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  );
}


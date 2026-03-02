import type { PourReportData } from "@/lib/reports/computePourItForward";

interface Props {
  data: PourReportData;
}

export default function PourItForwardReport({ data }: Props) {
  const { title, rows, totals } = data;

  return (
    <div className="bg-white rounded-none p-8 min-h-[480px] font-sans">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-slate-200">
        <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#C05A1F]">
          HQ Weekly Sync
        </p>
        <h1 className="text-2xl font-extrabold text-[#1e3a5f] mt-1">
          {title}
        </h1>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full table-fixed border-collapse text-xs text-slate-900">
          <colgroup>
            <col style={{ width: "260px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "160px" }} />
          </colgroup>
          <thead className="bg-[#1e3a5f] text-white">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wide">
                Branch
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wide">
                Foodpanda
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wide">
                Grab
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wide">
                Walk-in
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wide">
                Grand Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.branchId}
                className="odd:bg-white even:bg-[#F7F9FC]"
              >
                <td className="px-4 py-2 text-left text-[12px] font-medium text-slate-800 truncate whitespace-nowrap overflow-hidden">
                  {row.branchName}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-[12px] text-slate-800">
                  {row.foodpandaQty.toLocaleString("en-PH")}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-[12px] text-slate-800">
                  {row.grabQty.toLocaleString("en-PH")}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-[12px] text-slate-800">
                  {row.walkinQty.toLocaleString("en-PH")}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-[12px] font-semibold text-slate-900">
                  {row.grandTotal.toLocaleString("en-PH")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#1e3a5f] text-white">
              <td className="px-4 py-2 text-left text-[11px] font-bold">
                Grand Total
              </td>
              <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums">
                {totals.foodpandaQty.toLocaleString("en-PH")}
              </td>
              <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums">
                {totals.grabQty.toLocaleString("en-PH")}
              </td>
              <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums">
                {totals.walkinQty.toLocaleString("en-PH")}
              </td>
              <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums">
                {totals.grandTotal.toLocaleString("en-PH")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


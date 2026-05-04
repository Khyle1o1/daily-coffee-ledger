import { format } from "date-fns";
import type { PourReportData } from "@/lib/reports/computePourItForward";

interface Props {
  data: PourReportData;
  dateRangeLabel: string;
}

// ── Shared column layout ────────────────────────────────────────────────────
const COL_LABEL_W = "260px";
const COL_NUM_W   = "140px";

function ChannelHead({ label }: { label: string }) {
  return (
    <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wide">
      {label}
    </th>
  );
}

function NumCell({ value }: { value: number }) {
  return (
    <td className="px-4 py-2 text-right tabular-nums text-[12px] text-slate-800">
      {value.toLocaleString("en-PH")}
    </td>
  );
}

function TotalCell({ value, bold }: { value: number; bold?: boolean }) {
  return (
    <td
      className={`px-4 py-2 text-right tabular-nums text-[12px] ${
        bold ? "font-extrabold text-[#1e3a5f]" : "font-semibold text-slate-900"
      }`}
    >
      {value.toLocaleString("en-PH")}
    </td>
  );
}

// ── Reusable section header ─────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#1e3a5f] mb-3 mt-8 border-b border-slate-200 pb-2">
      {children}
    </h2>
  );
}

export default function PourItForwardReport({ data, dateRangeLabel }: Props) {
  const {
    title,
    rows,
    totals,
    excludedBranches,
    dailyBreakdown,
    itemBreakdown,
    itemizedCupPivot,
    monthlySummary,
  } = data;
  const hasSingleBranch = !!(dailyBreakdown && itemBreakdown);

  return (
    <div className="bg-white rounded-none p-8 font-sans">
      {/* ── Report header ───────────────────────────────────────────────── */}
      <div className="mb-6 pb-4 border-b border-slate-200">
        <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#C05A1F]">
          HQ Weekly Sync
        </p>
        <h1 className="text-2xl font-extrabold text-[#1e3a5f] mt-1">{title}</h1>
      </div>

      {/* ── Summary table / empty state ────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="mt-2 text-sm text-slate-400 text-center py-8 border border-dashed border-slate-200 rounded-2xl">
          No transactions found for the selected branches in the chosen date range.
        </div>
      ) : (
        <>
          {excludedBranches && excludedBranches.length > 0 && (
            <p className="text-xs text-slate-500 mb-2">
              Some selected branches had no matching data and were excluded:{" "}
              <span className="font-medium text-slate-700">
                {excludedBranches.join(", ")}
              </span>
            </p>
          )}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
            <table className="w-full table-fixed border-collapse text-xs text-slate-900">
              <colgroup>
                <col style={{ width: COL_LABEL_W }} />
                <col style={{ width: COL_NUM_W }} />
                <col style={{ width: COL_NUM_W }} />
                <col style={{ width: COL_NUM_W }} />
                <col style={{ width: "160px" }} />
              </colgroup>
              <thead className="bg-[#1e3a5f] text-white">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wide">
                    Branch
                  </th>
                  <ChannelHead label="Foodpanda" />
                  <ChannelHead label="Grab" />
                  <ChannelHead label="Walk-in" />
                  <ChannelHead label="Grand Total" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.branchId} className="odd:bg-white even:bg-[#F7F9FC]">
                    <td className="px-4 py-2 text-left text-[12px] font-medium text-slate-800 truncate whitespace-nowrap overflow-hidden">
                      {row.branchName}
                    </td>
                    <NumCell value={row.foodpandaQty} />
                    <NumCell value={row.grabQty} />
                    <NumCell value={row.walkinQty} />
                    <TotalCell value={row.grandTotal} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#1e3a5f] text-white">
                  <td className="px-4 py-2 text-left text-[11px] font-bold">
                    Grand Total
                  </td>
                  {[
                    totals.foodpandaQty,
                    totals.grabQty,
                    totals.walkinQty,
                    totals.grandTotal,
                  ].map((v, i) => (
                    <td
                      key={i}
                      className="px-4 py-2 text-right text-[11px] font-bold tabular-nums"
                    >
                      {v.toLocaleString("en-PH")}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* ── Itemized cup breakdown ───────────────────────────────────────── */}
      <SectionTitle>
        Itemized Cup Breakdown
        <span className="block text-[11px] font-semibold tracking-normal normal-case text-slate-500 mt-1">
          ({dateRangeLabel})
        </span>
      </SectionTitle>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full min-w-[860px] border-collapse text-[11px] text-slate-900">
          <colgroup>
            <col style={{ width: "220px" }} />
            {itemizedCupPivot.branches.map((branch) => (
              <col key={branch.branchId} style={{ width: "110px" }} />
            ))}
            <col style={{ width: "130px" }} />
          </colgroup>
          <thead className="bg-[#1e3a5f] text-white sticky top-0 z-20">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide sticky left-0 z-30 bg-[#1e3a5f]">
                Cup Type
              </th>
              {itemizedCupPivot.branches.map((branch) => (
                <th
                  key={`head-${branch.branchId}`}
                  className="px-2 py-2 text-right text-[10px] uppercase tracking-wide whitespace-nowrap"
                >
                  {branch.branchName}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide whitespace-nowrap">
                Grand Total
              </th>
            </tr>
          </thead>
          <tbody>
            {itemizedCupPivot.rows.map((row) => (
              <tr key={row.cupType} className="odd:bg-white even:bg-[#F7F9FC]">
                <td className="px-3 py-1.5 text-left text-[11px] font-medium text-slate-800 sticky left-0 z-10 bg-inherit">
                  {row.cupType}
                </td>
                {itemizedCupPivot.branches.map((branch) => (
                  <td
                    key={`${row.cupType}-${branch.branchId}`}
                    className="px-2 py-1.5 text-right tabular-nums text-[11px] text-slate-800"
                  >
                    {(row.byBranch[branch.branchId] ?? 0).toLocaleString("en-PH")}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right tabular-nums text-[11px] font-semibold text-slate-900">
                  {row.grandTotal.toLocaleString("en-PH")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#1e3a5f] text-white">
              <td className="px-3 py-2 text-left text-[10px] font-bold sticky left-0 z-30 bg-[#1e3a5f]">
                Grand Total
              </td>
              {itemizedCupPivot.branches.map((branch) => (
                <td
                  key={`foot-${branch.branchId}`}
                  className="px-2 py-2 text-right text-[10px] font-bold tabular-nums"
                >
                  {(itemizedCupPivot.totalsByBranch[branch.branchId] ?? 0).toLocaleString("en-PH")}
                </td>
              ))}
              <td className="px-3 py-2 text-right text-[10px] font-extrabold tabular-nums">
                {itemizedCupPivot.grandTotal.toLocaleString("en-PH")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Monthly summary (2+ months only) ─────────────────────────────── */}
      {monthlySummary && monthlySummary.length >= 2 && (
        <>
          <SectionTitle>Monthly Summary</SectionTitle>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
            <table className="w-full min-w-[760px] table-fixed border-collapse text-xs text-slate-900">
              <colgroup>
                <col style={{ width: COL_LABEL_W }} />
                <col style={{ width: COL_NUM_W }} />
                <col style={{ width: COL_NUM_W }} />
                <col style={{ width: COL_NUM_W }} />
                <col style={{ width: "160px" }} />
              </colgroup>
              <thead className="bg-[#1e3a5f] text-white">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wide">
                    Month
                  </th>
                  <ChannelHead label="Foodpanda" />
                  <ChannelHead label="Grab" />
                  <ChannelHead label="Walk-in" />
                  <ChannelHead label="Month Total" />
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((row) => (
                  <tr key={row.monthKey} className="odd:bg-white even:bg-[#F7F9FC]">
                    <td className="px-4 py-2 text-left text-[12px] font-medium text-slate-800">
                      {row.monthLabel}
                    </td>
                    <NumCell value={row.foodpandaQty} />
                    <NumCell value={row.grabQty} />
                    <NumCell value={row.walkinQty} />
                    <TotalCell value={row.grandTotal} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#1e3a5f] text-white">
                  <td className="px-4 py-2 text-left text-[11px] font-bold">Grand Total</td>
                  <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums">
                    {monthlySummary.reduce((sum, row) => sum + row.foodpandaQty, 0).toLocaleString("en-PH")}
                  </td>
                  <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums">
                    {monthlySummary.reduce((sum, row) => sum + row.grabQty, 0).toLocaleString("en-PH")}
                  </td>
                  <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums">
                    {monthlySummary.reduce((sum, row) => sum + row.walkinQty, 0).toLocaleString("en-PH")}
                  </td>
                  <td className="px-4 py-2 text-right text-[11px] font-extrabold tabular-nums">
                    {monthlySummary.reduce((sum, row) => sum + row.grandTotal, 0).toLocaleString("en-PH")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* ── Single-branch detail ─────────────────────────────────────────── */}
      {hasSingleBranch && (
        <>
          {/* Daily breakdown */}
          {dailyBreakdown!.length > 0 && (
            <>
              <SectionTitle>Day-by-Day Breakdown</SectionTitle>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
                <table className="w-full table-fixed border-collapse text-xs text-slate-900">
                  <colgroup>
                    <col style={{ width: COL_LABEL_W }} />
                    <col style={{ width: COL_NUM_W }} />
                    <col style={{ width: COL_NUM_W }} />
                    <col style={{ width: COL_NUM_W }} />
                    <col style={{ width: "160px" }} />
                  </colgroup>
                  <thead className="bg-[#1e3a5f] text-white">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wide">
                        Date
                      </th>
                      <ChannelHead label="Foodpanda" />
                      <ChannelHead label="Grab" />
                      <ChannelHead label="Walk-in" />
                      <ChannelHead label="Day Total" />
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBreakdown!.map((row) => (
                      <tr key={row.date} className="odd:bg-white even:bg-[#F7F9FC]">
                        <td className="px-4 py-2 text-left text-[12px] font-medium text-slate-700">
                          {format(new Date(row.date + "T00:00:00"), "EEE, MMM dd yyyy")}
                        </td>
                        <NumCell value={row.foodpandaQty} />
                        <NumCell value={row.grabQty} />
                        <NumCell value={row.walkinQty} />
                        <TotalCell value={row.grandTotal} />
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#1e3a5f] text-white">
                      <td className="px-4 py-2 text-left text-[11px] font-bold">
                        Total
                      </td>
                      {[
                        totals.foodpandaQty,
                        totals.grabQty,
                        totals.walkinQty,
                        totals.grandTotal,
                      ].map((v, i) => (
                        <td
                          key={i}
                          className="px-4 py-2 text-right text-[11px] font-bold tabular-nums"
                        >
                          {v.toLocaleString("en-PH")}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {/* Item breakdown */}
          {itemBreakdown!.length > 0 && (
            <>
              <SectionTitle>Cups by Item</SectionTitle>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
                <table className="w-full table-fixed border-collapse text-xs text-slate-900">
                  <colgroup>
                    <col style={{ width: COL_LABEL_W }} />
                    <col style={{ width: COL_NUM_W }} />
                    <col style={{ width: COL_NUM_W }} />
                    <col style={{ width: COL_NUM_W }} />
                    <col style={{ width: "160px" }} />
                  </colgroup>
                  <thead className="bg-[#1e3a5f] text-white">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wide">
                        Item
                      </th>
                      <ChannelHead label="Foodpanda" />
                      <ChannelHead label="Grab" />
                      <ChannelHead label="Walk-in" />
                      <ChannelHead label="Total" />
                    </tr>
                  </thead>
                  <tbody>
                    {itemBreakdown!.map((row) => (
                      <tr key={row.itemName} className="odd:bg-white even:bg-[#F7F9FC]">
                        <td className="px-4 py-2 text-left text-[12px] font-medium text-slate-800 truncate whitespace-nowrap overflow-hidden">
                          {row.itemName}
                        </td>
                        <NumCell value={row.foodpandaQty} />
                        <NumCell value={row.grabQty} />
                        <NumCell value={row.walkinQty} />
                        <TotalCell value={row.grandTotal} bold />
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#1e3a5f] text-white">
                      <td className="px-4 py-2 text-left text-[11px] font-bold">
                        Total
                      </td>
                      {[
                        totals.foodpandaQty,
                        totals.grabQty,
                        totals.walkinQty,
                        totals.grandTotal,
                      ].map((v, i) => (
                        <td
                          key={i}
                          className="px-4 py-2 text-right text-[11px] font-bold tabular-nums"
                        >
                          {v.toLocaleString("en-PH")}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {/* Empty state for detail */}
          {dailyBreakdown!.length === 0 && itemBreakdown!.length === 0 && (
            <p className="mt-8 text-sm text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-2xl">
              No cup-item transactions found for this branch in the selected date range.
            </p>
          )}
        </>
      )}
    </div>
  );
}

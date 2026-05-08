import type { ChannelSalesSummaryData } from "@/lib/reports/computeChannelSalesSummary";

interface Props {
  data: ChannelSalesSummaryData;
  branchLabel: string;
  dateRangeLabel: string;
}

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtPHP(n: number): string {
  if (n === 0) return "₱0";
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChannelSalesSummaryReport({ data, branchLabel, dateRangeLabel }: Props) {
  const { branches, overall } = data;

  return (
    <div className="p-8 bg-white font-sans text-sm min-w-[700px]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-600 mb-1">
          DOT Coffee Daily Ledger
        </p>
        <h1 className="text-2xl font-bold text-[#1e3a5f] leading-tight">
          Channel Sales Summary
        </h1>
        <p className="text-slate-500 text-xs mt-1">
          {branchLabel}&nbsp;•&nbsp;{dateRangeLabel}
        </p>
      </div>

      {branches.map((branch) => (
        <section key={branch.branchId} className="mb-8">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#1e3a5f] mb-3">
            Branch: {branch.branchName}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-sm min-w-[760px]">
              <thead>
                <tr className="bg-[#1e3a5f] text-white">
                  <th className="px-4 py-3 text-left font-semibold tracking-wide">Category</th>
                  <th className="px-4 py-3 text-right font-semibold tracking-wide">FoodPanda</th>
                  <th className="px-4 py-3 text-right font-semibold tracking-wide">Grab</th>
                  <th className="px-4 py-3 text-right font-semibold tracking-wide">Walk-in</th>
                  <th className="px-4 py-3 text-right font-semibold tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {branch.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                      No data for this branch in the selected filters.
                    </td>
                  </tr>
                ) : (
                  branch.rows.map((row, idx) => (
                    <tr key={`${branch.branchId}-${row.category}`} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-4 py-3 font-medium text-slate-700 border-b border-slate-100">{row.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">
                        {fmtPHP(row.foodpanda)}
                        <div className="text-[10px] text-slate-400">{fmtPct(row.foodpandaPct)}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">
                        {fmtPHP(row.grab)}
                        <div className="text-[10px] text-slate-400">{fmtPct(row.grabPct)}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">
                        {fmtPHP(row.walkIn)}
                        <div className="text-[10px] text-slate-400">{fmtPct(row.walkInPct)}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#1e3a5f] border-b border-slate-100">
                        {fmtPHP(row.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#1e3a5f] text-white font-bold">
                  <td className="px-4 py-3 tracking-wide">TOTAL</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(branch.totals.foodpanda)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(branch.totals.grab)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(branch.totals.walkIn)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(branch.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Branch Channel Mix: Walk-in {fmtPct(branch.channelMixPct.walkIn)} | Grab {fmtPct(branch.channelMixPct.grab)} | FoodPanda {fmtPct(branch.channelMixPct.foodpanda)}
          </p>
        </section>
      ))}

      <section className="mt-10">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#1e3a5f] mb-3">
          Overall Category Sales by Channel
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-sm min-w-[760px]">
            <thead>
              <tr className="bg-[#1e3a5f] text-white">
                <th className="px-4 py-3 text-left font-semibold tracking-wide">Category</th>
                <th className="px-4 py-3 text-right font-semibold tracking-wide">FoodPanda</th>
                <th className="px-4 py-3 text-right font-semibold tracking-wide">Grab</th>
                <th className="px-4 py-3 text-right font-semibold tracking-wide">Walk-in</th>
                <th className="px-4 py-3 text-right font-semibold tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {overall.rows.map((row, idx) => (
                <tr key={`overall-${row.category}`} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-4 py-3 font-medium text-slate-700 border-b border-slate-100">{row.category}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">{fmtPHP(row.foodpanda)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">{fmtPHP(row.grab)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">{fmtPHP(row.walkIn)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#1e3a5f] border-b border-slate-100">{fmtPHP(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#1e3a5f] text-white font-bold">
                <td className="px-4 py-3 tracking-wide">TOTAL</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(overall.totals.foodpanda)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(overall.totals.grab)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(overall.totals.walkIn)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(overall.totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Overall Channel Mix: Walk-in {fmtPct(overall.channelMixPct.walkIn)} | Grab {fmtPct(overall.channelMixPct.grab)} | FoodPanda {fmtPct(overall.channelMixPct.foodpanda)}
        </p>
      </section>

      {/* ── Footer note ─────────────────────────────────────────────────── */}
      <p className="mt-6 text-[10px] text-slate-400">
        Generated by DOT Coffee Daily Ledger&nbsp;•&nbsp;
        {new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
      </p>
    </div>
  );
}

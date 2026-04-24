import type { ChannelSalesSummaryData } from "@/lib/reports/computeChannelSalesSummary";

interface Props {
  data: ChannelSalesSummaryData;
  branchLabel: string;
  dateRangeLabel: string;
}

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtPHP(n: number): string {
  if (n === 0) return "—";
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChannelSalesSummaryReport({ data, branchLabel, dateRangeLabel }: Props) {
  const { rows, totals } = data;

  const hasEvent  = rows.some((r) => r.event  > 0) || totals.event  > 0;
  const hasDotapp = rows.some((r) => r.dotapp > 0) || totals.dotapp > 0;

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

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1e3a5f] text-white">
              <th className="px-4 py-3 text-left font-semibold tracking-wide">PERIOD</th>
              <th className="px-4 py-3 text-right font-semibold tracking-wide">FOODPANDA</th>
              <th className="px-4 py-3 text-right font-semibold tracking-wide">GRAB</th>
              <th className="px-4 py-3 text-right font-semibold tracking-wide">WALK-IN</th>
              {hasEvent  && <th className="px-4 py-3 text-right font-semibold tracking-wide">EVENT</th>}
              {hasDotapp && <th className="px-4 py-3 text-right font-semibold tracking-wide">DOT APP</th>}
              <th className="px-4 py-3 text-right font-semibold tracking-wide">TOTAL</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4 + (hasEvent ? 1 : 0) + (hasDotapp ? 1 : 0) + 1}
                  className="px-4 py-8 text-center text-slate-400 italic"
                >
                  No data found for the selected date range.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.periodKey}
                  className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                >
                  <td className="px-4 py-3 font-medium text-slate-700 border-b border-slate-100">
                    {row.periodLabel}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">
                    {fmtPHP(row.foodpanda)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">
                    {fmtPHP(row.grab)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">
                    {fmtPHP(row.walkIn)}
                  </td>
                  {hasEvent && (
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">
                      {fmtPHP(row.event)}
                    </td>
                  )}
                  {hasDotapp && (
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 border-b border-slate-100">
                      {fmtPHP(row.dotapp)}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#1e3a5f] border-b border-slate-100">
                    {fmtPHP(row.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* ── Totals footer ──────────────────────────────────────────── */}
          <tfoot>
            <tr className="bg-[#1e3a5f] text-white font-bold">
              <td className="px-4 py-3 tracking-wide">TOTAL</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(totals.foodpanda)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(totals.grab)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(totals.walkIn)}</td>
              {hasEvent  && <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(totals.event)}</td>}
              {hasDotapp && <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(totals.dotapp)}</td>}
              <td className="px-4 py-3 text-right tabular-nums">{fmtPHP(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Channel breakdown bar ──────────────────────────────────────── */}
      {totals.total > 0 && (
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Channel Mix
          </p>
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {[
              { value: totals.walkIn,    color: "bg-[#1e3a5f]",  label: "Walk-in" },
              { value: totals.grab,      color: "bg-emerald-500", label: "Grab" },
              { value: totals.foodpanda, color: "bg-orange-500",  label: "FoodPanda" },
              { value: totals.event,     color: "bg-violet-500",  label: "Event" },
              { value: totals.dotapp,    color: "bg-sky-500",     label: "Dot App" },
            ]
              .filter((s) => s.value > 0)
              .map((s) => (
                <div
                  key={s.label}
                  className={`${s.color} transition-all`}
                  style={{ width: `${(s.value / totals.total) * 100}%` }}
                  title={`${s.label}: ${((s.value / totals.total) * 100).toFixed(1)}%`}
                />
              ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {[
              { value: totals.walkIn,    color: "bg-[#1e3a5f]",  label: "Walk-in" },
              { value: totals.grab,      color: "bg-emerald-500", label: "Grab" },
              { value: totals.foodpanda, color: "bg-orange-500",  label: "FoodPanda" },
              ...(hasEvent  ? [{ value: totals.event,  color: "bg-violet-500", label: "Event" }]  : []),
              ...(hasDotapp ? [{ value: totals.dotapp, color: "bg-sky-500",    label: "Dot App" }] : []),
            ]
              .filter((s) => s.value > 0)
              .map((s) => (
                <span key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className={`inline-block w-2.5 h-2.5 rounded-sm ${s.color}`} />
                  {s.label}&nbsp;
                  <span className="font-semibold text-slate-700">
                    {((s.value / totals.total) * 100).toFixed(1)}%
                  </span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* ── Footer note ─────────────────────────────────────────────────── */}
      <p className="mt-6 text-[10px] text-slate-400">
        Generated by DOT Coffee Daily Ledger&nbsp;•&nbsp;
        {new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
      </p>
    </div>
  );
}

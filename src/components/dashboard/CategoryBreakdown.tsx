import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/brand";
import { formatCompactPHP } from "@/utils/format";

export type CategorySlice = {
  key: string;
  value: number;
  percent: number;
};

const DONUT_ORDER = ["ICED", "HOT", "SNACKS", "ADD-ONS", "MERCH", "PROMO", "LOYALTY CARD", "PACKAGING"];

export function CategoryBreakdown({
  slices,
  total,
}: {
  slices: CategorySlice[];
  total: number;
}) {
  const visible = DONUT_ORDER.map((key) => slices.find((s) => s.key === key))
    .filter((s): s is CategorySlice => !!s && s.value > 0);

  return (
    <section className="saas-card flex flex-col p-5 sm:p-6" aria-label="Category breakdown">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Category Breakdown
      </p>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No category sales in this period.</p>
      ) : (
        <>
          <div className="mx-auto h-[180px] w-[180px]" aria-hidden={false}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visible}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {visible.map((slice) => (
                    <Cell key={slice.key} fill={CATEGORY_COLORS[slice.key] ?? "#98A2B3"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCompactPHP(value),
                    CATEGORY_LABELS[name] ?? name,
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #E6E8EC",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-4 space-y-2.5">
            {visible.map((slice) => (
              <li key={slice.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[slice.key] }}
                    aria-hidden
                  />
                  <span className="truncate text-[#172B4D]">{CATEGORY_LABELS[slice.key] ?? slice.key}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="mr-3 tabular-nums text-muted-foreground">{slice.percent.toFixed(2)}%</span>
                  <span className="font-medium tabular-nums text-[#172B4D]">
                    {formatCompactPHP(slice.value)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="font-semibold text-[#172B4D]">Total</span>
            <span className="font-semibold tabular-nums text-[#172B4D]">
              100% · {formatCompactPHP(total)}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

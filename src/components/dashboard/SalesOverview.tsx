import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRAND } from "@/lib/brand";
import { formatCompactPHP } from "@/utils/format";

export type SalesPoint = {
  key: string;
  label: string;
  value: number;
};

export function SalesOverview({
  totalLabel,
  totalValue,
  trendLabel,
  trendPositive,
  granularity,
  onGranularityChange,
  points,
}: {
  totalLabel: string;
  totalValue: string;
  trendLabel?: string;
  trendPositive?: boolean;
  granularity: "weekly" | "daily" | "monthly";
  onGranularityChange: (value: "weekly" | "daily" | "monthly") => void;
  points: SalesPoint[];
}) {
  const highest = points.reduce<SalesPoint | null>(
    (best, point) => (!best || point.value > best.value ? point : best),
    null,
  );
  const lowest = points.reduce<SalesPoint | null>(
    (best, point) => (!best || point.value < best.value ? point : best),
    null,
  );

  return (
    <section className="saas-card flex flex-col p-5 sm:p-6" aria-label="Sales overview">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Sales Overview
          </p>
          <p className="mt-2 text-[28px] font-semibold leading-none text-[#172B4D]">{totalValue}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">{totalLabel}</span>
            {trendLabel && (
              <span className={trendPositive ? "font-medium text-emerald-600" : "font-medium text-red-500"}>
                {trendLabel}
              </span>
            )}
          </div>
        </div>
        <Select value={granularity} onValueChange={(v) => onGranularityChange(v as typeof granularity)}>
          <SelectTrigger className="h-9 w-[120px] rounded-xl border-border bg-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-[220px]">
        {points.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No sales in this period yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND.blue} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={BRAND.blue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#EEF0F3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#667085", fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: "#667085", fontSize: 11 }}
                tickFormatter={(v: number) => formatCompactPHP(v)}
              />
              <Tooltip
                cursor={{ stroke: BRAND.blue, strokeWidth: 1 }}
                formatter={(value: number) => [formatCompactPHP(value), "Sales"]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #E6E8EC",
                  boxShadow: "0 4px 20px rgba(23,43,77,0.08)",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={BRAND.blue}
                strokeWidth={2.5}
                fill="url(#salesFill)"
                dot={false}
                activeDot={{ r: 4, fill: BRAND.blue }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {highest && lowest && points.length > 1 && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Highest sales</p>
              <p className="text-sm font-medium text-[#172B4D]">{highest.label}</p>
              <p className="text-sm font-semibold text-emerald-600">{formatCompactPHP(highest.value)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-[#F7652B]">
              <ArrowDownRight className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Lowest sales</p>
              <p className="text-sm font-medium text-[#172B4D]">{lowest.label}</p>
              <p className="text-sm font-semibold text-[#F7652B]">{formatCompactPHP(lowest.value)}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

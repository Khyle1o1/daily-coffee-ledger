import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PctChangeTone } from "@/utils/percentChange";

export function StatCard({
  label,
  value,
  hint,
  trendLabel,
  trendTone,
  icon: Icon,
  iconClassName,
  iconWrapClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  trendLabel?: string;
  trendTone?: PctChangeTone;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  iconWrapClassName?: string;
}) {
  const TrendIcon =
    trendTone === "positive" ? ArrowUpRight : trendTone === "negative" ? ArrowDownRight : ArrowRight;

  return (
    <article className="saas-card p-5 transition-shadow hover:shadow-[0_8px_24px_rgba(23,43,77,0.08)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            iconWrapClassName ?? "bg-primary/10",
          )}
        >
          <Icon className={cn("h-4 w-4", iconClassName ?? "text-primary")} />
        </span>
      </div>
      <p className="text-[28px] font-semibold leading-none tracking-tight text-[#172B4D]">{value}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        {trendLabel && (
          <span
            className={cn(
              "inline-flex items-center font-medium",
              trendTone === "positive" && "text-emerald-600",
              trendTone === "negative" && "text-red-500",
              (!trendTone || trendTone === "neutral") && "text-muted-foreground",
            )}
          >
            <TrendIcon className="mr-0.5 h-3.5 w-3.5" aria-hidden />
            {trendLabel}
            <span className="sr-only"> versus previous period</span>
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </article>
  );
}

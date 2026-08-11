import { Link } from "react-router-dom";
import { formatCompactPHP } from "@/utils/format";
import { cn } from "@/lib/utils";

export type TopBranchRow = {
  id: string;
  name: string;
  sales: number;
  share: number;
};

export function TopBranches({ branches }: { branches: TopBranchRow[] }) {
  const max = branches[0]?.sales || 1;

  return (
    <section className="saas-card flex flex-col p-5 sm:p-6" aria-label="Top performing branches">
      <div className="mb-5 flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Top Performing Branches
        </p>
        <Link
          to="/app/reports"
          className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all →
        </Link>
      </div>

      {branches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No branch sales in this period.</p>
      ) : (
        <ol className="space-y-4">
          {branches.map((branch, index) => (
            <li key={branch.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("truncate text-sm", index === 0 ? "font-semibold text-[#172B4D]" : "font-medium text-[#172B4D]")}>
                    <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                    {branch.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-[#172B4D]">
                    {formatCompactPHP(branch.sales)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{branch.share.toFixed(1)}%</p>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#F0F2F5]">
                <div
                  className={cn("h-full rounded-full", index === 0 ? "bg-primary" : "bg-primary/55")}
                  style={{ width: `${Math.max(4, (branch.sales / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

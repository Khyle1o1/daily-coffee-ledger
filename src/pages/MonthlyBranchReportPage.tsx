import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  BarChart3,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  MapPin,
  Printer,
  RefreshCw,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GroupedBranchSelectItems } from "@/components/branch/GroupedBranchSelectItems";
import { getBranchCategory } from "@/lib/branchCategory";
import { useToast } from "@/hooks/use-toast";
import { useDailyReportsQuery } from "@/hooks/queries/useDailyReportsQuery";
import { useLiveBranches } from "@/hooks/useLiveBranches";
import { cn } from "@/lib/utils";
import {
  computeBranchDrillDown,
  computeMonthlyBranchReport,
  discoverMonthlyBranchOptions,
  monthsOverlappingRange,
  type MonthlyBranchFilters,
  type MonthlyBranchReportResult,
  type MonthlyBranchTableRow,
} from "@/lib/reports/computeMonthlyBranchReport";
import { CATEGORIES, type BranchId, type Category, type DailyReport } from "@/utils/types";
import { formatPHP } from "@/utils/format";
import {
  exportMonthlyBranchCsv,
  exportMonthlyBranchExcel,
  exportMonthlyBranchPdf,
} from "@/utils/exportMonthlyBranchReport";

const CHART_BLUE = "#0e2d49";
const CHART_ORANGE = "#C05A1F";
const CAT_SHORT: Record<Category, string> = {
  ICED: "Iced",
  HOT: "Hot",
  SNACKS: "Snacks",
  "ADD-ONS": "Add-ons",
  MERCH: "Merch",
  PROMO: "Promo",
  "LOYALTY CARD": "Loyalty",
  PACKAGING: "Packaging",
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-2xl bg-[#F4F0E5] border border-[#0e2d49]/10 shadow-md px-5 py-4 min-w-0"
      style={{ color: "#0e2d49" }}
    >
      <p
        className="text-[11px] font-semibold tracking-[0.14em] uppercase"
        style={{ color: "#4a5d73" }}
      >
        {label}
      </p>
      <p className="mt-1 text-xl font-bold truncate" style={{ color: "#0e2d49" }}>
        {value}
      </p>
      {sub && (
        <p className="text-sm font-semibold mt-0.5 truncate" style={{ color: "#C05A1F" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function MonthlyBranchReportPage() {
  const { toast } = useToast();
  const { getBranchLabel } = useLiveBranches();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: listPage, error: listError, isFetching } = useDailyReportsQuery({
    pageSize: 500,
  });

  const dailyReports: DailyReport[] = listPage?.reports ?? [];

  const discovered = useMemo(
    () => discoverMonthlyBranchOptions(dailyReports, getBranchLabel),
    [dailyReports, getBranchLabel],
  );

  const [year, setYear] = useState<number | "all">("all");
  const [monthKey, setMonthKey] = useState<string | "all">("all");
  const [branchId, setBranchId] = useState<BranchId | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [chartMonth, setChartMonth] = useState<string | "all">("all");

  const [generated, setGenerated] = useState<MonthlyBranchReportResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drillBranch, setDrillBranch] = useState<BranchId | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!listError) return;
    toast({
      variant: "destructive",
      title: "Could not load reports",
      description:
        listError instanceof Error ? listError.message : "Failed to load ledger data",
    });
  }, [listError, toast]);

  // Seed year from data once available
  useEffect(() => {
    if (year === "all" && discovered.years.length === 1) {
      setYear(discovered.years[0]);
    }
  }, [discovered.years, year]);

  const monthsForYear = useMemo(() => {
    if (year === "all") return discovered.months;
    return discovered.months.filter((m) => m.year === year);
  }, [discovered.months, year]);

  const branchesForFilters = useMemo(() => {
    return discovered.branches.filter((b) =>
      dailyReports.some((r) => {
        if (r.branch !== b.id) return false;
        const start = r.date.slice(0, 10);
        const end = (r.dateRangeEnd ?? r.date).slice(0, 10);
        const months = monthsOverlappingRange(start, end);
        if (monthKey !== "all" && !months.includes(monthKey)) return false;
        if (year !== "all" && !months.some((mk) => Number(mk.slice(0, 4)) === year)) {
          return false;
        }
        return true;
      }),
    );
  }, [discovered.branches, dailyReports, monthKey, year]);

  const buildFilters = useCallback((): MonthlyBranchFilters => {
    return {
      year,
      monthKey,
      branchId,
      category,
      dateFrom: dateRange.from ? toYmd(dateRange.from) : null,
      dateTo: dateRange.to
        ? toYmd(dateRange.to)
        : dateRange.from
          ? toYmd(dateRange.from)
          : null,
    };
  }, [year, monthKey, branchId, category, dateRange]);

  const handleGenerate = () => {
    if (dailyReports.length === 0) {
      toast({
        variant: "destructive",
        title: "No data available",
        description: "Upload daily reports on Summary before generating this report.",
      });
      setGenerated(null);
      return;
    }
    const result = computeMonthlyBranchReport(dailyReports, buildFilters(), getBranchLabel);
    setGenerated(result);
    setExpanded(new Set());
    if (result.hasData) {
      const firstMonth = result.monthlyTrend.find((m) => m.hasData)?.monthKey ?? "all";
      setChartMonth(result.filters.monthKey !== "all" ? result.filters.monthKey : firstMonth);
      toast({ title: "Report generated", description: filterLabel(result) });
    } else {
      toast({
        variant: "destructive",
        title: "No data available",
        description: "No ledger rows match the selected filters.",
      });
    }
  };

  const toggleRow = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const drillDown = useMemo(() => {
    if (!drillBranch || !generated) return null;
    return computeBranchDrillDown(
      dailyReports,
      drillBranch,
      getBranchLabel,
      generated.filters.monthKey,
    );
  }, [drillBranch, generated, dailyReports, getBranchLabel]);

  const branchChartData = useMemo(() => {
    if (!generated) return [];
    if (chartMonth === "all") return generated.branchPerformance;
    const block = generated.branchComparison.find((b) => b.monthKey === chartMonth);
    return (block?.branches ?? []).map((b) => ({
      id: b.id,
      label: b.label,
      sales: b.sales,
    }));
  }, [generated, chartMonth]);

  const handlePrint = () => {
    window.print();
  };

  const runExport = (kind: "csv" | "excel" | "pdf") => {
    if (!generated?.hasData) {
      toast({
        variant: "destructive",
        title: "Nothing to export",
        description: "Generate a report with data first.",
      });
      return;
    }
    if (kind === "csv") exportMonthlyBranchCsv(generated);
    if (kind === "excel") exportMonthlyBranchExcel(generated);
    if (kind === "pdf") exportMonthlyBranchPdf(generated);
    setExportOpen(false);
    toast({ title: "Export ready", description: `Downloaded ${kind.toUpperCase()} report.` });
  };

  return (
    <div className="pb-8">
      {/* Filters */}
      <div className="print:hidden">
        <div className="w-full px-5 sm:px-8 lg:px-10 pt-6">
          <div className="saas-card flex flex-wrap items-end gap-3 p-4">
            <FilterField label="Year">
              <Select
                value={year === "all" ? "all" : String(year)}
                onValueChange={(v) => {
                  setYear(v === "all" ? "all" : Number(v));
                  setMonthKey("all");
                }}
              >
                <SelectTrigger className="w-[130px] rounded-xl border-border bg-white">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {discovered.years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Month">
              <Select
                value={monthKey}
                onValueChange={(v) => setMonthKey(v as string | "all")}
              >
                <SelectTrigger className="w-[180px] rounded-xl border-border bg-white">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {monthsForYear.map((m) => (
                    <SelectItem key={m.monthKey} value={m.monthKey}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Branch">
              <Select
                value={branchId}
                onValueChange={(v) => setBranchId(v as BranchId | "all")}
              >
                <SelectTrigger className="w-[180px] rounded-xl border-border bg-white">
                  <MapPin className="mr-1 h-4 w-4" />
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  <GroupedBranchSelectItems
                    options={branchesForFilters.map((b) => ({
                      value: b.id,
                      label: b.label,
                      category: getBranchCategory(b.label, b.id),
                    }))}
                  />
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Category">
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as Category | "all")}
              >
                <SelectTrigger className="w-[170px] rounded-xl border-border bg-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CAT_SHORT[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Date Range">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[230px] justify-start rounded-xl border-border bg-white hover:bg-muted/70",
                      !dateRange.from && "text-[#667085]",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "MMM d")} — {format(dateRange.to, "MMM d")}
                        </>
                      ) : (
                        format(dateRange.from, "MMM d, yyyy")
                      )
                    ) : (
                      "Optional"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(r) => setDateRange(r ?? { from: undefined, to: undefined })}
                    numberOfMonths={2}
                  />
                  {dateRange.from && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setDateRange({ from: undefined, to: undefined })}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Clear dates
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </FilterField>

            <Button
              onClick={handleGenerate}
              disabled={isFetching}
              className="rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-6"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Generate Report
            </Button>

            <Popover open={exportOpen} onOpenChange={setExportOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!generated?.hasData}
                  className="rounded-[10px] border-[#172B4D]/35 bg-white font-semibold text-[#172B4D] hover:bg-[#F4F0E5] disabled:opacity-80 disabled:text-[#172B4D]/70"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => runExport("csv")}
                >
                  <FileText className="h-4 w-4" /> Export CSV
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => runExport("excel")}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Export Excel
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => runExport("pdf")}
                >
                  <FileText className="h-4 w-4" /> Export PDF
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => {
                    setExportOpen(false);
                    handlePrint();
                  }}
                >
                  <Printer className="h-4 w-4" /> Print
                </button>
              </PopoverContent>
            </Popover>
          </div>
          <p className="mt-3 text-sm font-medium text-[#667085]">
            Months and branches are detected from uploaded ledger data only — empty periods are omitted.
            {discovered.months.length > 0 && (
              <>
                {" "}
                Available: {discovered.months[0]?.label}
                {discovered.months.length > 1
                  ? ` → ${discovered.months[discovered.months.length - 1]?.label}`
                  : ""}
                , {discovered.branches.length} branch
                {discovered.branches.length === 1 ? "" : "es"}.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="w-full px-6 py-8 space-y-6 text-[#0e2d49]" ref={printRef}>
        {!generated && (
          <div className="rounded-3xl bg-card shadow-xl border border-border/50 px-8 py-16 text-center text-[#0e2d49]">
            <BarChart3 className="h-10 w-10 mx-auto text-[#0e2d49]/70" />
            <h2 className="mt-4 text-xl font-bold text-[#0e2d49]">Monthly Branch Report</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#667085]">
              Choose year, month, branch, and category, then click Generate Report to view
              sales performance from real ledger uploads.
            </p>
          </div>
        )}

        {generated && !generated.hasData && (
          <div className="rounded-3xl bg-card shadow-xl border border-border/50 px-8 py-16 text-center text-[#0e2d49]">
            <p className="text-lg font-semibold text-[#0e2d49]">No data available</p>
            <p className="mt-2 text-sm text-[#0e2d49]/70">
              No months or branches match the selected filters. Try All Months / All Branches,
              or upload missing CSVs on Summary.
            </p>
          </div>
        )}

        {generated?.hasData && (
          <>
            {/* Overview */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#172B4D]">
                Monthly Overview
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <StatCard label="Total Sales" value={formatPHP(generated.overview.totalSales)} />
                <StatCard
                  label="Branches with Data"
                  value={String(generated.overview.branchesWithData)}
                />
                <StatCard
                  label="Months with Data"
                  value={String(generated.overview.monthsWithData)}
                />
                <StatCard
                  label="Avg Monthly Sales"
                  value={formatPHP(generated.overview.averageMonthlySales)}
                />
                <StatCard
                  label="Highest Branch"
                  value={generated.overview.highestBranch?.label ?? "—"}
                  sub={
                    generated.overview.highestBranch
                      ? formatPHP(generated.overview.highestBranch.sales)
                      : undefined
                  }
                />
                <StatCard
                  label="Highest Month"
                  value={generated.overview.highestMonth?.label ?? "—"}
                  sub={
                    generated.overview.highestMonth
                      ? formatPHP(generated.overview.highestMonth.sales)
                      : undefined
                  }
                />
              </div>
              <p className="mt-3 text-sm font-medium text-[#667085]">
                Filters: {filterLabel(generated)} · Generated{" "}
                {new Date(generated.generatedAt).toLocaleString()}
              </p>
            </section>

            {/* Table */}
            <section className="rounded-3xl bg-card shadow-xl border border-border/50 overflow-hidden text-[#0e2d49]">
              <div className="px-6 py-4 border-b border-border/60">
                <h2 className="text-lg font-bold text-[#0e2d49]">Monthly Sales Table</h2>
                <p className="text-sm text-[#0e2d49]/70">
                  Expand a row for upload detail. Click a branch name for drill-down.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="px-3 py-2.5 text-left font-semibold">Month</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Branch</th>
                      {CATEGORIES.map((c) => (
                        <th key={c} className="px-2 py-2.5 text-right font-semibold whitespace-nowrap">
                          {CAT_SHORT[c]}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-right font-semibold">Total Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generated.tableRows.map((row, idx) => (
                      <TableRowBlock
                        key={`${row.monthKey}-${row.branchId}`}
                        row={row}
                        zebra={idx % 2 === 1}
                        expanded={expanded.has(`${row.monthKey}-${row.branchId}`)}
                        onToggle={() => toggleRow(`${row.monthKey}-${row.branchId}`)}
                        onBranchClick={() => setDrillBranch(row.branchId)}
                        category={generated.filters.category}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#0e2d49]/10 font-bold text-[#0e2d49]">
                      <td className="px-3 py-3" colSpan={2}>
                        Grand Total
                      </td>
                      {CATEGORIES.map((c) => {
                        const sum = generated.tableRows.reduce(
                          (s, r) => s + (r.totals[c] ?? 0),
                          0,
                        );
                        return (
                          <td key={c} className="px-2 py-3 text-right tabular-nums text-[#0e2d49]">
                            {formatPHP(sum)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-right tabular-nums text-[#C05A1F]">
                        {formatPHP(generated.overview.totalSales)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Branch comparison */}
            <section className="rounded-3xl bg-card shadow-xl border border-border/50 px-6 py-5 text-[#0e2d49]">
              <h2 className="text-lg font-bold text-[#0e2d49] mb-4">Branch Comparison</h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {generated.branchComparison.map((block) => (
                  <div
                    key={block.monthKey}
                    className="rounded-2xl border border-[#0e2d49]/15 bg-white p-4"
                  >
                    <h3 className="font-semibold text-[#0e2d49] mb-3">{block.monthLabel}</h3>
                    <ul className="space-y-2">
                      {block.branches.map((b, i) => (
                        <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                          <button
                            type="button"
                            className="text-left font-medium text-[#0e2d49] hover:underline truncate"
                            onClick={() => setDrillBranch(b.id)}
                          >
                            <span className="text-[#0e2d49]/55 mr-2">{i + 1}.</span>
                            {b.label}
                          </button>
                          <span className="tabular-nums font-bold whitespace-nowrap text-[#0e2d49]">
                            {formatPHP(b.sales)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Charts */}
            <div className="grid xl:grid-cols-2 gap-6">
              <section className="rounded-3xl bg-card shadow-xl border border-border/50 px-6 py-5 text-[#0e2d49]">
                <h2 className="text-lg font-bold text-[#0e2d49] mb-1">Monthly Trend</h2>
                <p className="text-sm text-[#0e2d49]/70 mb-4">
                  Months without uploads show as No Data (not ₱0).
                </p>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={generated.monthlyTrend.map((p) => ({
                        ...p,
                        display: p.hasData ? p.sales : null,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="monthLabel"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: string) => v.replace(/ .*/, "").slice(0, 3)}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1000
                              ? `${Math.round(v / 1000)}k`
                              : String(v)
                        }
                      />
                      <Tooltip
                        formatter={(value: number | null, _n, item) => {
                          const has = (item?.payload as { hasData?: boolean })?.hasData;
                          if (!has) return ["No Data", "Sales"];
                          return [formatPHP(Number(value ?? 0)), "Sales"];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="display"
                        stroke={CHART_ORANGE}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: CHART_ORANGE }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {generated.monthlyTrend
                    .filter((p) => !p.hasData)
                    .map((p) => (
                      <span
                        key={p.monthKey}
                        className="text-xs px-2 py-0.5 rounded-full bg-[#0e2d49]/10 text-[#0e2d49] font-medium"
                      >
                        {p.monthLabel}: No Data
                      </span>
                    ))}
                </div>
              </section>

              <section className="rounded-3xl bg-card shadow-xl border border-border/50 px-6 py-5 text-[#0e2d49]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#0e2d49]">Branch Performance</h2>
                    <p className="text-sm text-[#0e2d49]/70">Total sales per branch</p>
                  </div>
                  <Select
                    value={chartMonth}
                    onValueChange={(v) => setChartMonth(v as string | "all")}
                  >
                    <SelectTrigger className="w-[180px] rounded-full">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All months in report</SelectItem>
                      {generated.branchComparison.map((b) => (
                        <SelectItem key={b.monthKey} value={b.monthKey}>
                          {b.monthLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-[280px]">
                  {branchChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-[#0e2d49]/70">
                      No data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={branchChartData} margin={{ bottom: 48 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          interval={0}
                          angle={-30}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) =>
                            v >= 1_000_000
                              ? `${(v / 1_000_000).toFixed(1)}M`
                              : v >= 1000
                                ? `${Math.round(v / 1000)}k`
                                : String(v)
                          }
                        />
                        <Tooltip formatter={(v: number) => [formatPHP(v), "Sales"]} />
                        <Bar
                          dataKey="sales"
                          radius={[6, 6, 0, 0]}
                          cursor="pointer"
                          onClick={(data) => {
                            const id = (data as { id?: BranchId })?.id;
                            if (id) setDrillBranch(id);
                          }}
                        >
                          {branchChartData.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? CHART_ORANGE : CHART_BLUE} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      {/* Drill-down */}
      <Dialog open={!!drillBranch} onOpenChange={(o) => !o && setDrillBranch(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto text-[#0e2d49]">
          <DialogHeader>
            <DialogTitle className="text-[#0e2d49]">
              {drillDown?.branchLabel ?? "Branch"} — Detail
            </DialogTitle>
          </DialogHeader>
          {!drillDown ? (
            <p className="text-sm text-[#0e2d49]/70 py-8 text-center">No data available</p>
          ) : (
            <div className="space-y-6 text-[#0e2d49]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((c) => (
                  <div key={c} className="rounded-xl bg-[#F4F0E5] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[#0e2d49]/65">
                      {CAT_SHORT[c]}
                    </p>
                    <p className="font-semibold tabular-nums text-sm text-[#0e2d49]">
                      {formatPHP(drillDown.totals[c] ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-[#0e2d49]/15 px-4 py-3 flex justify-between">
                <span className="font-semibold text-[#0e2d49]">Total sales</span>
                <span className="font-bold text-[#C05A1F] tabular-nums">
                  {formatPHP(drillDown.grandTotal)}
                </span>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 text-[#0e2d49]">Monthly sales</h4>
                <table className="w-full text-sm text-[#0e2d49]">
                  <thead>
                    <tr className="text-left text-[#0e2d49]/65 border-b">
                      <th className="py-1">Month</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillDown.monthly.map((m) => (
                      <tr key={m.monthKey} className="border-b border-border/40">
                        <td className="py-1.5">{m.monthLabel}</td>
                        <td className="py-1.5 text-right tabular-nums font-medium">
                          {formatPHP(m.grandTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 text-[#0e2d49]">Calendar days</h4>
                <table className="w-full text-sm text-[#0e2d49]">
                  <thead>
                    <tr className="text-left text-[#0e2d49]/65 border-b">
                      <th className="py-1">Date</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillDown.daily.map((d, i) => (
                      <tr key={`${d.date}-${d.filename}-${i}`} className="border-b border-border/40">
                        <td className="py-1.5">
                          <div>
                            {d.date}
                            {d.dateRangeEnd !== d.date ? ` → ${d.dateRangeEnd}` : ""}
                          </div>
                          <div className="text-[11px] text-[#0e2d49]/60 truncate max-w-[420px]">
                            {d.filename}
                          </div>
                        </td>
                        <td className="py-1.5 text-right tabular-nums align-top font-medium">
                          {formatPHP(d.grandTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#172B4D]">
        {label}
      </Label>
      {children}
    </div>
  );
}

function filterLabel(result: MonthlyBranchReportResult): string {
  const f = result.filters;
  return [
    f.year === "all" ? "All years" : String(f.year),
    f.monthKey === "all" ? "All months" : f.monthKey,
    f.branchId === "all" ? "All branches" : f.branchId,
    f.category === "all" ? "All categories" : f.category,
  ].join(" · ");
}

function TableRowBlock({
  row,
  zebra,
  expanded,
  onToggle,
  onBranchClick,
  category,
}: {
  row: MonthlyBranchTableRow;
  zebra: boolean;
  expanded: boolean;
  onToggle: () => void;
  onBranchClick: () => void;
  category: Category | "all";
}) {
  return (
    <>
      <tr className={cn(zebra ? "bg-[#FDF6EE]" : "bg-white", "hover:bg-[#F5F0E8] text-[#0e2d49]")}>
        <td className="px-3 py-2">
          <button
            type="button"
            className="flex items-center gap-1 font-medium text-[#0e2d49]"
            onClick={onToggle}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {row.monthLabel}
          </button>
        </td>
        <td className="px-3 py-2">
          <button
            type="button"
            className="font-semibold text-[#0e2d49] hover:underline"
            onClick={onBranchClick}
          >
            {row.branchLabel}
          </button>
        </td>
        {CATEGORIES.map((c) => (
          <td
            key={c}
            className={cn(
              "px-2 py-2 text-right tabular-nums font-medium text-[#0e2d49]",
              category !== "all" && category !== c && "opacity-35",
            )}
          >
            {formatPHP(row.totals[c] ?? 0)}
          </td>
        ))}
        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#0e2d49]">
          {formatPHP(row.totalSales)}
        </td>
      </tr>
      {expanded &&
        row.reports.map((rep) => (
          <tr key={rep.id} className="bg-slate-100 text-xs text-[#0e2d49]/80">
            <td className="px-3 py-1.5 pl-10" colSpan={2}>
              {rep.date}
              {rep.dateRangeEnd !== rep.date ? ` → ${rep.dateRangeEnd}` : ""}
              <span className="ml-2 text-[#0e2d49]/60 truncate inline-block max-w-[280px] align-bottom">
                {rep.filename}
              </span>
            </td>
            {CATEGORIES.map((c) => (
              <td key={c} className="px-2 py-1.5 text-right tabular-nums text-[#0e2d49]">
                {formatPHP(rep.totals[c] ?? 0)}
              </td>
            ))}
            <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-[#0e2d49]">
              {formatPHP(rep.grandTotal)}
            </td>
          </tr>
        ))}
    </>
  );
}

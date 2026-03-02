import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import ReportCanvas, { type ReportCanvasData } from "@/components/reports/ReportCanvas";
import { exportReportPdf } from "@/utils/exportReportPdf";

import type { ReportType, GeneratedReportRow } from "@/lib/supabase-types";
import type { BranchId, Category, DailyReport } from "@/utils/types";
import { BRANCHES, CATEGORIES } from "@/utils/types";

import {
  listGeneratedReports,
  saveGeneratedReport,
  deleteGeneratedReport,
} from "@/services/generatedReportsService";
import {
  getBranches,
  listAllDailyReports,
  seedBranchesIfEmpty,
} from "@/services/reportsService";
import { dailyReportsFromRows } from "@/services/reportConverter";
import type { Branch } from "@/lib/supabase-types";

import {
  computeCategoryTotals,
  computeProductTotals,
  computeTopProducts,
  computeCategoryPerformance,
  type ReportFilters,
} from "@/lib/reports/compute";

// ============================================================================
// Constants
// ============================================================================

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string; desc: string }[] = [
  {
    value: "SALES_MIX_OVERVIEW",
    label: "Sales Mix Overview",
    desc: "Pie chart + category breakdown with optional comparison",
  },
  {
    value: "PRODUCT_MIX",
    label: "Product Mix",
    desc: "Full ranked menu item list for a category",
  },
  {
    value: "TOP_5_PRODUCTS",
    label: "Top 5 Products",
    desc: "Top 5 best sellers per selected category",
  },
  {
    value: "RUNNING_SALES_MIX_CATEGORY",
    label: "Running Sales Mix",
    desc: "Top 5 + full breakdown for one category",
  },
  {
    value: "CATEGORY_PERFORMANCE",
    label: "Category Performance",
    desc: "Ranked categories with contribution bars",
  },
];

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

// ============================================================================
// Main page
// ============================================================================

export default function ReportsPage() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [history, setHistory] = useState<GeneratedReportRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [reportType, setReportType] = useState<ReportType>("SALES_MIX_OVERVIEW");
  const [filterBranch, setFilterBranch] = useState<BranchId | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [compareMode, setCompareMode] = useState(false);
  const [compareDateRange, setCompareDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([
    ...CATEGORIES,
  ]);
  const [runningCategory, setRunningCategory] = useState<Category>("ICED");

  // ── Generation state ──────────────────────────────────────────────────────
  const [canvasData, setCanvasData] = useState<ReportCanvasData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoadingData(true);
        await seedBranchesIfEmpty();
        const [fetchedBranches, reportRows, historyRows] = await Promise.all([
          getBranches(),
          listAllDailyReports(),
          listGeneratedReports(),
        ]);
        setBranches(fetchedBranches);
        setDailyReports(dailyReportsFromRows(reportRows));
        setHistory(historyRows);
      } catch (err) {
        console.error("ReportsPage init error:", err);
        toast({
          variant: "destructive",
          title: "Failed to load data",
          description:
            err instanceof Error ? err.message : "Unexpected error loading data.",
        });
      } finally {
        setIsLoadingData(false);
      }
    };
    init();
  }, [toast]);

  // ── Derived labels ────────────────────────────────────────────────────────
  const branchLabel = useMemo(() => {
    if (filterBranch === "all") return "All Branches";
    return BRANCHES.find((b) => b.id === filterBranch)?.label ?? filterBranch;
  }, [filterBranch]);

  const dateRangeLabel = useMemo(() => {
    if (!dateRange.from) return "All dates";
    if (dateRange.to && dateRange.from.getTime() !== dateRange.to.getTime()) {
      return `${format(dateRange.from, "MMM dd, yyyy")} — ${format(dateRange.to, "MMM dd, yyyy")}`;
    }
    return format(dateRange.from, "MMM dd, yyyy");
  }, [dateRange]);

  const compareLabel = useMemo(() => {
    if (!compareMode || !compareDateRange.from) return undefined;
    if (
      compareDateRange.to &&
      compareDateRange.from.getTime() !== compareDateRange.to.getTime()
    ) {
      return `${format(compareDateRange.from, "MMM dd, yyyy")} — ${format(
        compareDateRange.to,
        "MMM dd, yyyy"
      )}`;
    }
    return format(compareDateRange.from, "MMM dd, yyyy");
  }, [compareMode, compareDateRange]);

  // ── Validate filters ──────────────────────────────────────────────────────
  const canGenerate = useMemo(() => {
    if (!dateRange.from) return false;
    if (compareMode && !compareDateRange.from) return false;
    if (
      reportType === "RUNNING_SALES_MIX_CATEGORY" &&
      !runningCategory
    )
      return false;
    return true;
  }, [dateRange, compareMode, compareDateRange, reportType, runningCategory]);

  // ── Build filters object ──────────────────────────────────────────────────
  const buildFilters = useCallback((): ReportFilters => {
    const from = dateRange.from
      ? format(dateRange.from, "yyyy-MM-dd")
      : "2000-01-01";
    const to = dateRange.to
      ? format(dateRange.to, "yyyy-MM-dd")
      : format(dateRange.from ?? new Date(), "yyyy-MM-dd");
    const compareFrom =
      compareMode && compareDateRange.from
        ? format(compareDateRange.from, "yyyy-MM-dd")
        : null;
    const compareTo =
      compareMode && compareDateRange.to
        ? format(compareDateRange.to, "yyyy-MM-dd")
        : compareFrom;

    return {
      branchId: filterBranch,
      dateFrom: from,
      dateTo: to,
      compareFrom,
      compareTo,
      selectedCategories: [...selectedCategories],
    };
  }, [
    dateRange,
    compareMode,
    compareDateRange,
    filterBranch,
    selectedCategories,
  ]);

  // ── Generate report ───────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    try {
      const filters = buildFilters();
      let canvas: ReportCanvasData | null = null;

      if (reportType === "SALES_MIX_OVERVIEW") {
        const salesMix = computeCategoryTotals(dailyReports, filters);
        canvas = {
          reportType,
          branchLabel,
          dateRangeLabel,
          compareLabel,
          selectedCategories,
          salesMix,
        };
      } else if (reportType === "PRODUCT_MIX") {
        const primaryCat =
          selectedCategories.length === 1 ? selectedCategories[0] : undefined;
        const productMix = computeProductTotals(
          dailyReports,
          filters,
          primaryCat
        );
        canvas = {
          reportType,
          branchLabel,
          dateRangeLabel,
          compareLabel,
          selectedCategories,
          productMix,
        };
      } else if (reportType === "TOP_5_PRODUCTS") {
        const top5 = computeTopProducts(dailyReports, filters);
        canvas = {
          reportType,
          branchLabel,
          dateRangeLabel,
          compareLabel,
          selectedCategories,
          top5,
        };
      } else if (reportType === "RUNNING_SALES_MIX_CATEGORY") {
        const catFilters: ReportFilters = {
          ...filters,
          selectedCategories: [runningCategory],
        };
        const runningSalesMixCategory = computeProductTotals(
          dailyReports,
          catFilters,
          runningCategory
        );
        canvas = {
          reportType,
          branchLabel,
          dateRangeLabel,
          compareLabel,
          selectedCategories,
          runningSalesMixCategory,
          runningSalesCategory: runningCategory,
        };
      } else if (reportType === "CATEGORY_PERFORMANCE") {
        const categoryPerformance = computeCategoryPerformance(
          dailyReports,
          filters
        );
        canvas = {
          reportType,
          branchLabel,
          dateRangeLabel,
          compareLabel,
          selectedCategories,
          categoryPerformance,
        };
      }

      if (!canvas) return;
      setCanvasData(canvas);

      // Auto-save to DB
      const typeOption = REPORT_TYPE_OPTIONS.find((o) => o.value === reportType);
      const title = `${typeOption?.label ?? reportType} • ${branchLabel} • ${dateRangeLabel}`;
      const branchEntry = branches.find(
        (b) => b.name === filterBranch || filterBranch === "all"
      );
      const branchId =
        filterBranch === "all" ? null : (branchEntry?.id ?? null);

      const saved = await saveGeneratedReport({
        title,
        reportType,
        branchId,
        branchName: branchLabel,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        compareFrom: filters.compareFrom ?? null,
        compareTo: filters.compareTo ?? null,
        selectedCategories: selectedCategories.map(String),
        filters: {
          branchId: filterBranch,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          compareFrom: filters.compareFrom,
          compareTo: filters.compareTo,
          selectedCategories,
        },
        computedData: canvas as unknown as Record<string, unknown>,
      });

      setHistory((prev) => [saved, ...prev]);
      toast({ title: "Report generated and saved." });
    } catch (err) {
      console.error("Generate error:", err);
      toast({
        variant: "destructive",
        title: "Failed to generate report",
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    canGenerate,
    buildFilters,
    reportType,
    dailyReports,
    branchLabel,
    dateRangeLabel,
    compareLabel,
    selectedCategories,
    runningCategory,
    branches,
    filterBranch,
    toast,
  ]);

  // ── Load from history ─────────────────────────────────────────────────────
  const handleLoadHistory = useCallback((row: GeneratedReportRow) => {
    const d = row.computed_data as unknown as ReportCanvasData;
    setCanvasData(d);
    toast({ title: "Report loaded from history." });
  }, [toast]);

  // ── Delete history item ───────────────────────────────────────────────────
  const handleDeleteHistory = useCallback(
    async (id: string) => {
      try {
        await deleteGeneratedReport(id);
        setHistory((prev) => prev.filter((r) => r.id !== id));
        toast({ title: "Report deleted." });
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Failed to delete report",
          description: err instanceof Error ? err.message : "Unexpected error.",
        });
      }
    },
    [toast]
  );

  // ── PDF export ────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    if (!canvasData) return;
    setIsExporting(true);
    try {
      const branchSlug = filterBranch === "all" ? "all-branches" : filterBranch;
      const fromStr = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "all";
      const toStr = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : fromStr;
      const filename = `DOTCoffee_${canvasData.reportType}_${branchSlug}_${fromStr}_${toStr}.pdf`;
      await exportReportPdf(canvasData, filename);
    } finally {
      setIsExporting(false);
    }
  }, [canvasData, filterBranch, dateRange]);

  // ── Reset filters ─────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setReportType("SALES_MIX_OVERVIEW");
    setFilterBranch("all");
    setDateRange({ from: undefined, to: undefined });
    setCompareMode(false);
    setCompareDateRange({ from: undefined, to: undefined });
    setSelectedCategories([...CATEGORIES]);
    setRunningCategory("ICED");
    setCanvasData(null);
  }, []);

  // ── Toggle category ───────────────────────────────────────────────────────
  const toggleCategory = useCallback((cat: Category) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="bg-primary shadow-md px-4 sm:px-8 py-4 sm:py-5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
            <div>
              <h1 className="text-xl font-bold text-primary-foreground leading-tight">
                Reports
              </h1>
              <p className="text-xs text-primary-foreground/70 mt-0.5">
                Generate HQ-style reports for branch performance and product mix.
              </p>
            </div>
          </div>

          {/* Mobile filters toggle */}
          <div className="flex items-center gap-2 lg:hidden">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-primary-foreground/60 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/20"
              onClick={() => setShowFiltersMobile((prev) => !prev)}
            >
              Filters
            </Button>
          </div>
        </div>
      </div>

      {isLoadingData && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-slate-500">Loading data…</span>
        </div>
      )}

      {!isLoadingData && (
        <div className="flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 h-[calc(100vh-80px)]">
          <div className="h-full grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 overflow-hidden">
            {/* ── Left panel ─────────────────────────────────────────────── */}
            <div
              className={cn(
                "flex flex-col gap-4 h-full",
                "lg:block",
                showFiltersMobile ? "block" : "hidden lg:block",
              )}
            >
              {/* Filter card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full max-h-full overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-slate-200 sticky top-0 z-10 bg-white">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">
                    Filters
                  </h2>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 min-h-0 px-5 pb-4 pt-2 space-y-4 overflow-y-auto">
                  {/* Report type */}
                  <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">
                    Report Type
                  </Label>
                  <Select
                    value={reportType}
                    onValueChange={(v) => setReportType(v as ReportType)}
                  >
                    <SelectTrigger className="w-full rounded-xl text-sm border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div>
                            <div className="font-medium text-sm">{opt.label}</div>
                            <div className="text-xs text-slate-400 leading-tight">
                              {opt.desc}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                  {/* Branch */}
                  <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">
                    Branch
                  </Label>
                  <Select
                    value={filterBranch}
                    onValueChange={(v) => setFilterBranch(v as BranchId | "all")}
                  >
                    <SelectTrigger className="w-full rounded-xl text-sm border-slate-200">
                      <MapPin className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                      <SelectValue placeholder="All branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {BRANCHES.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </div>

                  {/* Date range */}
                  <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">
                    Date Range <span className="text-red-400">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left text-sm rounded-xl border-slate-200 font-normal",
                          !dateRange.from && "text-slate-400"
                        )}
                      >
                        <Calendar className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {dateRange.from ? (
                          dateRange.to &&
                          dateRange.from.getTime() !==
                            dateRange.to.getTime() ? (
                            `${format(dateRange.from, "MMM dd")} — ${format(
                              dateRange.to,
                              "MMM dd, yyyy"
                            )}`
                          ) : (
                            format(dateRange.from, "MMM dd, yyyy")
                          )
                        ) : (
                          "Pick date range"
                        )}
                        {dateRange.from && (
                          <X
                            className="ml-auto h-3.5 w-3.5 text-slate-400 hover:text-slate-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDateRange({ from: undefined, to: undefined });
                            }}
                          />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarUI
                        mode="range"
                        selected={dateRange}
                        onSelect={(r) =>
                          setDateRange(r || { from: undefined, to: undefined })
                        }
                        numberOfMonths={2}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  </div>

                  {/* Compare mode toggle */}
                  <div className="flex items-center gap-3">
                  <Switch
                    id="compare-mode"
                    checked={compareMode}
                    onCheckedChange={setCompareMode}
                  />
                  <Label
                    htmlFor="compare-mode"
                    className="text-sm text-slate-700 cursor-pointer"
                  >
                    Compare period
                  </Label>
                  </div>

                  {compareMode && (
                    <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">
                      Compare Date Range <span className="text-red-400">*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left text-sm rounded-xl border-slate-200 font-normal",
                            !compareDateRange.from && "text-slate-400"
                          )}
                        >
                          <Calendar className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {compareDateRange.from ? (
                            compareDateRange.to &&
                            compareDateRange.from.getTime() !==
                              compareDateRange.to.getTime() ? (
                              `${format(compareDateRange.from, "MMM dd")} — ${format(
                                compareDateRange.to,
                                "MMM dd, yyyy"
                              )}`
                            ) : (
                              format(compareDateRange.from, "MMM dd, yyyy")
                            )
                          ) : (
                            "Pick compare range"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarUI
                          mode="range"
                          selected={compareDateRange}
                          onSelect={(r) =>
                            setCompareDateRange(
                              r || { from: undefined, to: undefined }
                            )
                          }
                          numberOfMonths={2}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    </div>
                  )}

                  {/* Running category picker (only for RUNNING_SALES_MIX_CATEGORY) */}
                  {reportType === "RUNNING_SALES_MIX_CATEGORY" && (
                    <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">
                      Category
                    </Label>
                    <Select
                      value={runningCategory}
                      onValueChange={(v) => setRunningCategory(v as Category)}
                    >
                      <SelectTrigger className="w-full rounded-xl text-sm border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    </div>
                  )}

                  {/* Categories multi-select */}
                  {reportType !== "RUNNING_SALES_MIX_CATEGORY" && (
                    <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">
                        Categories
                      </Label>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCategories(
                            selectedCategories.length === CATEGORIES.length
                              ? []
                              : [...CATEGORIES]
                          )
                        }
                        className="text-[10px] text-blue-500 hover:underline"
                      >
                        {selectedCategories.length === CATEGORIES.length
                          ? "Clear all"
                          : "Select all"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((cat) => {
                        const active = selectedCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => toggleCategory(cat)}
                            className={cn(
                              "text-[11px] px-2.5 py-1 rounded-full font-semibold transition-colors border",
                              active
                                ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                                : "bg-white text-slate-600 border-slate-200 hover:border-[#1e3a5f]/40"
                            )}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  )}
                </div>

                {/* Sticky footer actions */}
                <div className="px-5 py-3 border-t border-slate-200 bg-white sticky bottom-0 mt-auto">
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 rounded-xl bg-[#1e3a5f] hover:bg-[#0e2d49] text-white font-semibold"
                      disabled={!canGenerate || isGenerating}
                      onClick={handleGenerate}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating…
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Generate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl border-slate-200 text-slate-500 hover:text-slate-800"
                      onClick={handleReset}
                      title="Reset filters"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Report History */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 h-[260px] overflow-hidden">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-3">
                  History
                </h2>
                {history.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No generated reports yet.
                  </p>
                ) : (
                  <div className="space-y-2 h-full overflow-y-auto pr-1">
                    {history.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3 hover:border-[#1e3a5f]/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                              {row.title}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {format(new Date(row.created_at), "MMM dd, yyyy HH:mm")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteHistory(row.id)}
                            className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex gap-1.5 mt-2">
                          <button
                            type="button"
                            onClick={() => handleLoadHistory(row)}
                            className="text-[10px] px-2.5 py-1 rounded-full bg-[#1e3a5f] text-white font-semibold hover:bg-[#0e2d49] transition-colors flex items-center gap-1"
                          >
                            <FileText className="h-2.5 w-2.5" />
                            View
                          </button>
                          <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-medium">
                            {row.report_type.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right: Canvas area ──────────────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
              {/* Export bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  {canvasData ? (
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-[#1e3a5f]">
                        {REPORT_TYPE_OPTIONS.find(
                          (o) => o.value === canvasData.reportType
                        )?.label}
                      </span>
                      {" · "}
                      {canvasData.branchLabel}
                      {" · "}
                      {canvasData.dateRangeLabel}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Select filters and click Generate to preview a report.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canvasData || isExporting}
                    onClick={handleExportPdf}
                    className="rounded-xl border-[#1e3a5f]/30 text-[#1e3a5f] hover:bg-[#1e3a5f]/5 font-semibold"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Exporting…
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="rounded-xl border-slate-200 text-slate-400 font-semibold"
                    title="Excel export coming soon"
                  >
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Excel
                  </Button>
                </div>
              </div>

              {/* Paper canvas */}
              <div className="flex-1 min-h-0 overflow-auto">
                {canvasData ? (
                  <div className="overflow-x-auto">
                    <ReportCanvas ref={canvasRef} data={canvasData} />
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[400px] text-slate-400">
                    <BarChart3 className="h-16 w-16 mb-4 text-slate-200" />
                    <p className="text-lg font-semibold text-slate-300">
                      No report generated yet
                    </p>
                    <p className="text-sm text-slate-300 mt-1">
                      Choose filters on the left and click Generate Report.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

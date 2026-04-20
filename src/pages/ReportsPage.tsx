import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  BarChart3,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Square,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import ReportCanvas, { type ReportCanvasData } from "@/components/reports/ReportCanvas";
import { exportReportPdf } from "@/utils/exportReportPdf";
import { exportReportExcel } from "@/utils/exportReportExcel";
import { exportRenderedReportPdf } from "@/utils/exportRenderedReportPdf";

import type { ReportType, GeneratedReportRow } from "@/lib/supabase-types";
import type { BranchId, Category, DailyReport } from "@/utils/types";
import { CATEGORIES } from "@/utils/types";

import {
  listGeneratedReports,
  saveGeneratedReport,
  deleteGeneratedReport,
  deleteManyGeneratedReports,
} from "@/services/generatedReportsService";
import {
  listAllDailyReports,
  seedBranchesIfEmpty,
} from "@/services/reportsService";
import { dailyReportsFromRows } from "@/services/reportConverter";
import { useLiveBranches } from "@/hooks/useLiveBranches";
import { useAuth } from "@/auth/useAuth";
import { canDeleteData } from "@/lib/permissions";
import { logEvent } from "@/services/auditService";

import {
  computeCategoryTotals,
  computeProductTotals,
  computeProductTotalsByCategory,
  computeTopProducts,
  computeCategoryPerformance,
  type ReportFilters,
} from "@/lib/reports/compute";
import { computeProductMixChannel } from "@/lib/reports/computeProductMixChannel";
import { computePourItForward } from "@/lib/reports/computePourItForward";
import { computeHQSyncPack } from "@/lib/reports/computeHQSyncPack";

// ============================================================================
// Constants
// ============================================================================

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string; desc: string }[] = [
  {
    value: "HQ_SYNC_PACK",
    label: "HQ Sync Report Pack",
    desc: "Full 8-page executive pack: overview, ICED/HOT/Pastries/Add-Ons detail, Top 5 by channel",
  },
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
    value: "PRODUCT_MIX_CHANNEL",
    label: "Product Mix (Channel)",
    desc: "Ranked items with quantity by channel",
  },
  {
    value: "POUR_IT_FORWARD",
    label: "Pour-it-Forward (Cups Sold)",
    desc: "Cups sold per branch by channel (Foodpanda/Grab/Walk-in)",
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
  const { role } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);
  const { branchOptions, getBranchLabel, getBranchUuid } = useLiveBranches();

  // ── Data loading ──────────────────────────────────────────────────────────
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [history, setHistory] = useState<GeneratedReportRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [reportType, setReportType] = useState<ReportType>("HQ_SYNC_PACK");
  const [filterBranches, setFilterBranches] = useState<BranchId[]>([]);
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
  const [rankProductMixPerCategory, setRankProductMixPerCategory] = useState(false);
  const [runningCategory, setRunningCategory] = useState<Category>("ICED");
  const [channelCategory, setChannelCategory] = useState<Category | "ALL">("ALL");

  // ── Generation state ──────────────────────────────────────────────────────
  const [canvasData, setCanvasData] = useState<ReportCanvasData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySelectMode, setHistorySelectMode] = useState(false);
  const [historySelectedIds, setHistorySelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [isDeletingMany, setIsDeletingMany] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoadingData(true);
        // Run seed first, then load data — avoids 3-way concurrent auth-lock
        // contention that was causing NavigatorLockAcquireTimeoutError at startup.
        await seedBranchesIfEmpty().catch((err) => {
          console.warn("seedBranchesIfEmpty warning (non-fatal):", err);
        });
        const [reportRows, historyRows] = await Promise.all([
          listAllDailyReports(),
          listGeneratedReports(),
        ]);
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
  const selectedBranchNamesLabel = useMemo(() => {
    if (filterBranches.length === 0) return "All Branches";
    const names = filterBranches
      .map((b) => getBranchLabel(b))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (names.length <= 3) return names.join(", ");
    const shown = names.slice(0, 3).join(", ");
    return `${shown} +${names.length - 3}`;
  }, [filterBranches, getBranchLabel]);

  const branchLabel = useMemo(() => selectedBranchNamesLabel, [selectedBranchNamesLabel]);

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

    const branchFilter: ReportFilters["branchId"] =
      filterBranches.length === 0
        ? "all"
        : filterBranches.length === 1
          ? filterBranches[0]
          : [...filterBranches];

    return {
      branchId: branchFilter,
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
    filterBranches,
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
        if (rankProductMixPerCategory) {
          const productMixByCategory = computeProductTotalsByCategory(dailyReports, filters);
          canvas = {
            reportType,
            branchLabel,
            dateRangeLabel,
            compareLabel,
            selectedCategories,
            productMixByCategory,
          };
        } else {
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
        }
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
      } else if (reportType === "PRODUCT_MIX_CHANNEL") {
        const channelFilters =
          channelCategory === "ALL"
            ? filters
            : {
                ...filters,
                selectedCategories: [channelCategory],
              };
        const productMixChannel = computeProductMixChannel(
          dailyReports,
          channelFilters,
          dateRangeLabel,
          channelCategory,
        );
        canvas = {
          reportType,
          branchLabel,
          dateRangeLabel,
          compareLabel,
          selectedCategories,
          productMixChannel,
        };
      } else if (reportType === "POUR_IT_FORWARD") {
        const title = `CUPS SOLD ${dateRangeLabel}`;
        const pourItForward = computePourItForward(
          dailyReports,
          filters,
          title,
          getBranchLabel,
        );
        canvas = {
          reportType,
          branchLabel,
          dateRangeLabel,
          compareLabel,
          selectedCategories,
          pourItForward,
        };
      } else if (reportType === "HQ_SYNC_PACK") {
        const hqSyncPack = computeHQSyncPack(dailyReports, filters);
        canvas = {
          reportType,
          branchLabel,
          dateRangeLabel,
          compareLabel,
          selectedCategories,
          hqSyncPack,
        };
      }

      if (!canvas) return;
      setCanvasData(canvas);

      // Auto-save to DB
      const typeOption = REPORT_TYPE_OPTIONS.find((o) => o.value === reportType);
      const typeLabel =
        reportType === "PRODUCT_MIX" && rankProductMixPerCategory
          ? "Product Mix (Ranked per Category)"
          : typeOption?.label ?? reportType;
      const title = `${typeLabel} • ${branchLabel} • ${dateRangeLabel}`;
      const branchId =
        filterBranches.length === 1 ? (getBranchUuid(filterBranches[0]) ?? null) : null;

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
          branchId:
            filterBranches.length === 0
              ? "all"
              : filterBranches.length === 1
                ? filterBranches[0]
                : [...filterBranches],
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          compareFrom: filters.compareFrom,
          compareTo: filters.compareTo,
          selectedCategories,
        },
        computedData: canvas as unknown as Record<string, unknown>,
      });

      setHistory((prev) => [saved, ...prev]);

      void logEvent({
        action: 'generate_report',
        module: 'reports',
        targetId: saved.id,
        targetName: title,
        details: `Generated ${REPORT_TYPE_OPTIONS.find(o => o.value === reportType)?.label ?? reportType} for ${branchLabel}`,
        reportType,
        branchId: branchId ?? undefined,
        metadata: {
          reportType,
          branch: branchLabel,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          compareFrom: filters.compareFrom ?? null,
          compareTo: filters.compareTo ?? null,
        },
      });

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
    channelCategory,
    getBranchUuid,
    filterBranches,
    toast,
  ]);

  // ── Load from history ─────────────────────────────────────────────────────
  const handleLoadHistory = useCallback((row: GeneratedReportRow) => {
    const d = row.computed_data as unknown as ReportCanvasData;
    setCanvasData(d);
    toast({ title: "Report loaded from history." });
  }, [toast]);

  // ── Delete history item (after confirmation) ─────────────────────────────
  const handleDeleteHistory = useCallback(
    async (id: string) => {
      try {
        await deleteGeneratedReport(id);
        setHistory((prev) => prev.filter((r) => r.id !== id));
        setHistorySelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        toast({ title: "Report deleted." });
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Failed to delete report",
          description: err instanceof Error ? err.message : "Unexpected error.",
        });
      } finally {
        setDeleteConfirmId(null);
      }
    },
    [toast]
  );

  // ── Delete many / all ─────────────────────────────────────────────────────
  const handleDeleteMany = useCallback(
    async (ids: string[]) => {
      setIsDeletingMany(true);
      try {
        await deleteManyGeneratedReports(ids);
        setHistory((prev) => prev.filter((r) => !ids.includes(r.id)));
        setHistorySelectedIds(new Set());
        setHistorySelectMode(false);
        setDeleteAllConfirm(false);
        toast({ title: `${ids.length} report${ids.length !== 1 ? "s" : ""} deleted.` });
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Failed to delete reports",
          description: err instanceof Error ? err.message : "Unexpected error.",
        });
      } finally {
        setIsDeletingMany(false);
      }
    },
    [toast]
  );

  // ── PDF export ────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    if (!canvasData) return;
    setIsExporting(true);
    try {
      const slug = (value: string) =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

      const reportSlug = slug(
        canvasData.reportType === "SALES_MIX_OVERVIEW"
          ? "product-mix"
          : canvasData.reportType === "HQ_SYNC_PACK"
            ? "hq-sync-pack"
            : canvasData.reportType.replace(/_/g, " "),
      );
      const branchSlug =
        filterBranches.length === 0
          ? "all-branches"
          : filterBranches.length === 1
            ? slug(getBranchLabel(filterBranches[0]))
            : "multi-branches";
      const fromStr = dateRange.from ? format(dateRange.from, "MMM-dd-yyyy") : "all";
      const toStr = dateRange.to ? format(dateRange.to, "MMM-dd-yyyy") : fromStr;
      const filename = `${reportSlug}-${branchSlug}-${slug(fromStr)}-to-${slug(toStr)}.pdf`;

      if (canvasRef.current) {
        const isPackReport = canvasData.reportType === "HQ_SYNC_PACK";
        await exportRenderedReportPdf(canvasRef.current, {
          filename,
          backgroundColor: isPackReport ? "#EDE7D6" : "#F4F0E5",
          contentWidthPx: isPackReport ? 1500 : 1400,
          marginPt: isPackReport ? 16 : 20,
        });
      } else {
        // Fallback for safety if canvas ref is unavailable.
        await exportReportPdf(canvasData, filename);
      }
      void logEvent({
        action: 'export_report',
        module: 'reports',
        targetName: filename,
        details: `Exported PDF: ${REPORT_TYPE_OPTIONS.find(o => o.value === canvasData.reportType)?.label ?? canvasData.reportType} for ${branchLabel}`,
        reportType: canvasData.reportType,
        metadata: { format: 'pdf', branch: branchLabel, dateFrom: fromStr, dateTo: toStr, mode: 'rendered' },
      });
    } finally {
      setIsExporting(false);
    }
  }, [canvasData, filterBranches, dateRange, branchLabel, getBranchLabel]);

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExportExcel = useCallback(() => {
    if (!canvasData) return;
    setIsExportingExcel(true);
    try {
      const branchSlug =
        filterBranches.length === 0
          ? "all-branches"
          : filterBranches.length === 1
            ? filterBranches[0]
            : "multi-branches";
      const fromStr = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "all";
      const toStr = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : fromStr;
      const filename = `DOTCoffee_${canvasData.reportType}_${branchSlug}_${fromStr}_${toStr}.xlsx`;
      exportReportExcel(canvasData, filename);
      void logEvent({
        action: 'export_report',
        module: 'reports',
        targetName: filename,
        details: `Exported Excel: ${REPORT_TYPE_OPTIONS.find(o => o.value === canvasData.reportType)?.label ?? canvasData.reportType} for ${branchLabel}`,
        reportType: canvasData.reportType,
        metadata: { format: 'excel', branch: branchLabel, dateFrom: fromStr, dateTo: toStr },
      });
    } finally {
      setIsExportingExcel(false);
    }
  }, [canvasData, filterBranches, dateRange, branchLabel]);

  // ── Reset filters ─────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setReportType("HQ_SYNC_PACK");
    setFilterBranches([]);
    setDateRange({ from: undefined, to: undefined });
    setCompareMode(false);
    setCompareDateRange({ from: undefined, to: undefined });
    setSelectedCategories([...CATEGORIES]);
    setRankProductMixPerCategory(false);
    setRunningCategory("ICED");
    setChannelCategory("ALL");
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

          {/* History button */}
          <Button
            variant="outline"
            size="sm"
            className="relative rounded-full border-primary-foreground/60 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/20 flex items-center gap-2"
            onClick={() => setIsHistoryOpen(true)}
          >
            <Clock className="h-3.5 w-3.5" />
            History
            {history.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary-foreground text-primary text-[10px] font-bold">
                {history.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {isLoadingData && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-slate-500">Loading data…</span>
        </div>
      )}

      {!isLoadingData && (
        <div className="flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Top filters bar */}
          <div className="mb-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">
                Filters
              </h2>
            </div>
            <div className="px-5 pb-3 pt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left text-sm rounded-xl border-slate-200 font-normal bg-white text-slate-900"
                    >
                      <MapPin className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
                      <span className={cn("truncate", filterBranches.length === 0 && "text-slate-400")}>
                        {filterBranches.length === 0
                          ? "All branches"
                          : filterBranches.length === 1
                            ? getBranchLabel(filterBranches[0])
                            : `${filterBranches.length} branches`}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-3 rounded-2xl" align="start">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-slate-900">Branches</p>
                      {filterBranches.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setFilterBranches([])}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-slate-50">
                      <Checkbox
                        checked={filterBranches.length === 0}
                        onCheckedChange={(checked) => {
                          if (checked) setFilterBranches([]);
                        }}
                      />
                      <button
                        type="button"
                        className="flex-1 text-left text-sm text-slate-900"
                        onClick={() => setFilterBranches([])}
                      >
                        All branches
                      </button>
                    </div>

                    <div className="mt-2 max-h-[260px] overflow-auto pr-1">
                      {branchOptions.map((b) => {
                        const id = b.slug as BranchId;
                        const isChecked = filterBranches.includes(id);
                        return (
                          <div
                            key={b.slug}
                            className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-slate-50"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                setFilterBranches((prev) => {
                                  if (checked) return prev.includes(id) ? prev : [...prev, id];
                                  return prev.filter((x) => x !== id);
                                });
                              }}
                            />
                            <button
                              type="button"
                              className="flex-1 text-left text-sm text-slate-900"
                              onClick={() => {
                                setFilterBranches((prev) =>
                                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                                );
                              }}
                            >
                              {b.label}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
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
                        dateRange.from.getTime() !== dateRange.to.getTime() ? (
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
                        setDateRange((r as any) || { from: undefined, to: undefined })
                      }
                      numberOfMonths={2}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Category / compare section */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Switch
                    id="compare-mode-top"
                    checked={compareMode}
                    onCheckedChange={setCompareMode}
                  />
                  <Label
                    htmlFor="compare-mode-top"
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
                              `${format(
                                compareDateRange.from,
                                "MMM dd"
                              )} — ${format(
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
                              (r as any) || { from: undefined, to: undefined }
                            )
                          }
                          numberOfMonths={2}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 pb-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
              {/* Category controls depending on report type */}
              <div className="flex flex-wrap items-center gap-3">
                {reportType === "RUNNING_SALES_MIX_CATEGORY" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">
                      Category
                    </Label>
                    <Select
                      value={runningCategory}
                      onValueChange={(v) => setRunningCategory(v as Category)}
                    >
                      <SelectTrigger className="w-[180px] rounded-xl text-sm border-slate-200">
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

                {reportType === "PRODUCT_MIX_CHANNEL" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">
                      Category
                    </Label>
                    <Select
                      value={channelCategory}
                      onValueChange={(v) =>
                        setChannelCategory(v as Category | "ALL")
                      }
                    >
                      <SelectTrigger className="w-[200px] rounded-xl text-sm border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">ALL CATEGORIES</SelectItem>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {reportType !== "RUNNING_SALES_MIX_CATEGORY" &&
                  reportType !== "PRODUCT_MIX_CHANNEL" &&
                  reportType !== "HQ_SYNC_PACK" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">
                        Categories
                      </Label>
                      <div className="flex flex-wrap gap-1.5 max-w-[520px]">
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

                {reportType === "HQ_SYNC_PACK" && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#1e3a5f]/20 bg-[#1e3a5f]/5">
                    <div className="h-2 w-2 rounded-full bg-[#C05A1F]" />
                    <p className="text-xs text-[#1e3a5f] font-semibold">
                      Generates 8 pages: Overview · ICED · HOT · Pastries · Add-Ons · Top 5 Drinks · Pastry · Add-On by channel
                    </p>
                  </div>
                )}

                {reportType === "PRODUCT_MIX" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">
                      Product Mix Options
                    </Label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <Switch
                        id="pm-per-category"
                        checked={rankProductMixPerCategory}
                        onCheckedChange={setRankProductMixPerCategory}
                      />
                      <Label
                        htmlFor="pm-per-category"
                        className="text-sm text-slate-700 cursor-pointer select-none"
                      >
                        Rank items per category
                      </Label>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  className="rounded-xl bg-[#1e3a5f] hover:bg-[#0e2d49] text-white font-semibold"
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

          {/* ── Canvas area (full width) ──────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {/* Export bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
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
                  size="sm"
                  disabled={!canvasData || isExporting}
                  onClick={handleExportPdf}
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
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
                  size="sm"
                  disabled={!canvasData || isExportingExcel}
                  onClick={handleExportExcel}
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
                >
                  {isExportingExcel ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting…
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Excel
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Paper canvas */}
            <div className="overflow-auto">
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
                    Select filters above and click Generate.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── History drawer ────────────────────────────────────────────────── */}
      <Sheet
        open={isHistoryOpen}
        onOpenChange={(open) => {
          setIsHistoryOpen(open);
          if (!open) {
            setHistorySelectMode(false);
            setHistorySelectedIds(new Set());
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-[420px] p-0 flex flex-col bg-white"
        >
          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0 bg-white">
            <SheetTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Clock className="h-4 w-4 text-[#1e3a5f]" />
              Report History
              {history.length > 0 && (
                <span className="ml-1 text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {history.length}
                </span>
              )}
            </SheetTitle>

            {/* Action toolbar */}
            {canDeleteData(role) && history.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                {/* Select / Cancel toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setHistorySelectMode((v) => !v);
                    setHistorySelectedIds(new Set());
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors flex items-center gap-1.5 ${
                    historySelectMode
                      ? "bg-slate-100 border-slate-300 text-slate-700"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  {historySelectMode ? (
                    <><X className="h-3 w-3" /> Cancel</>
                  ) : (
                    <><CheckSquare className="h-3 w-3" /> Select</>
                  )}
                </button>

                {/* Select-all toggle (only in select mode) */}
                {historySelectMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (historySelectedIds.size === history.length) {
                        setHistorySelectedIds(new Set());
                      } else {
                        setHistorySelectedIds(new Set(history.map((r) => r.id)));
                      }
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                  >
                    {historySelectedIds.size === history.length ? (
                      <><Square className="h-3 w-3" /> None</>
                    ) : (
                      <><CheckSquare className="h-3 w-3" /> All</>
                    )}
                  </button>
                )}

                <div className="flex-1" />

                {/* Delete selected (select mode) */}
                {historySelectMode && historySelectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeleteAllConfirm(true)}
                    disabled={isDeletingMany}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete ({historySelectedIds.size})
                  </button>
                )}

                {/* Delete all (normal mode) */}
                {!historySelectMode && (
                  <button
                    type="button"
                    onClick={() => setDeleteAllConfirm(true)}
                    disabled={isDeletingMany}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete All
                  </button>
                )}
              </div>
            )}
          </SheetHeader>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FileText className="h-10 w-10 mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No generated reports yet</p>
                <p className="text-xs text-slate-400 mt-1">Generate a report to see it here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((row) => {
                  const isSelected = historySelectedIds.has(row.id);
                  return (
                    <div
                      key={row.id}
                      onClick={() => {
                        if (!historySelectMode) return;
                        setHistorySelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        });
                      }}
                      className={`rounded-xl border p-3 transition-colors ${
                        historySelectMode ? "cursor-pointer" : ""
                      } ${
                        isSelected
                          ? "border-red-300 bg-red-50"
                          : "border-slate-100 bg-slate-50 hover:border-[#1e3a5f]/30"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/* Checkbox in select mode */}
                        {historySelectMode && (
                          <div className="mt-0.5 shrink-0">
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-red-500" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-300" />
                            )}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                            {row.title}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {format(new Date(row.created_at), "MMM dd, yyyy HH:mm")}
                          </p>
                        </div>

                        {/* Single-delete button (normal mode only) */}
                        {!historySelectMode && canDeleteData(role) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(row.id); }}
                            className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* View + badge (hidden in select mode) */}
                      {!historySelectMode && (
                        <div className="flex gap-1.5 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleLoadHistory(row);
                              setIsHistoryOpen(false);
                            }}
                            className="text-[10px] px-2.5 py-1 rounded-full bg-[#1e3a5f] text-white font-semibold hover:bg-[#0e2d49] transition-colors flex items-center gap-1"
                          >
                            <FileText className="h-2.5 w-2.5" />
                            View
                          </button>
                          <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-medium">
                            {row.report_type.replace(/_/g, " ")}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Confirm single delete ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the report from history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => { if (deleteConfirmId) handleDeleteHistory(deleteConfirmId); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm bulk / delete-all ──────────────────────────────────────── */}
      <AlertDialog open={deleteAllConfirm} onOpenChange={(o) => { if (!o) setDeleteAllConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {historySelectMode && historySelectedIds.size > 0
                ? `Delete ${historySelectedIds.size} selected report${historySelectedIds.size !== 1 ? "s" : ""}?`
                : `Delete all ${history.length} reports?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {historySelectMode && historySelectedIds.size > 0
                ? "The selected reports will be permanently removed from history."
                : "All reports in your history will be permanently removed."}
              {" "}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingMany}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingMany}
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                const ids =
                  historySelectMode && historySelectedIds.size > 0
                    ? [...historySelectedIds]
                    : history.map((r) => r.id);
                handleDeleteMany(ids);
              }}
            >
              {isDeletingMany ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Deleting…</>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

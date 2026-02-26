import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar, MapPin, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import SummaryTable from "@/components/SummaryTable";
import DetailsTable from "@/components/DetailsTable";
import UnmappedList from "@/components/UnmappedList";
import DailyHistoryList from "@/components/DailyHistoryList";

import { parseCsvFile, autoDetectColumns } from "@/utils/parseCsv";
import { normalizeText } from "@/utils/normalize";
import { mapRow } from "@/utils/mapRow";
import { aggregateByCategory, getUnmappedSummary } from "@/utils/aggregate";
import { formatNumber } from "@/utils/format";
import { DEFAULT_MAPPING } from "@/utils/defaultMapping";
import type {
  BranchId,
  ColumnMapping,
  DailyReport,
  MappingEntry,
  RawRow,
} from "@/utils/types";
import { BRANCHES, CATEGORIES, type Category } from "@/utils/types";

import {
  getBranches,
  listAllDailyReports,
  saveDailyReport,
  seedBranchesIfEmpty,
} from "@/services/reportsService";
import { dailyReportToJSON, dailyReportsFromRows, getBranchId } from "@/services/reportConverter";
import type { Branch } from "@/lib/supabase-types";
import { exportCategoryRankingPdf, type RankedCategory } from "@/utils/exportCategoryRankingPdf";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

type Step = 1 | 2 | 3;
type SortOrder = "desc" | "asc";
type CategoryScope = "all" | "selected";

export default function SummaryPage() {
  const { toast } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Filters for the main summary view
  const [filterDateRange, setFilterDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [filterBranch, setFilterBranch] = useState<BranchId | "all">("all");
  const [categoryScope, setCategoryScope] = useState<CategoryScope>("all");
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([...CATEGORIES]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isExporting, setIsExporting] = useState(false);

  // Mapping table (kept internal, no manual upload in UI)
  const [mappingTable] = useState<MappingEntry[]>(DEFAULT_MAPPING);

  // ADD REPORT modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [modalBranch, setModalBranch] = useState<BranchId | "">("");
  const [modalDateRange, setModalDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalCsvHeaders, setModalCsvHeaders] = useState<string[]>([]);
  const [modalCsvData, setModalCsvData] = useState<Record<string, string>[]>([]);
  const [modalAutoMapping, setModalAutoMapping] = useState<Partial<Record<keyof ColumnMapping, string>>>({});

  // Preview modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<DailyReport | null>(null);

  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoadingBranches(true);

        await seedBranchesIfEmpty();
        const fetchedBranches = await getBranches();
        setBranches(fetchedBranches);

        setIsLoadingReports(true);
        const reportRows = await listAllDailyReports();
        const reports = dailyReportsFromRows(reportRows);
        setDailyReports(reports);
      } catch (error) {
        console.error("Failed to initialize data:", error);
        toast({
          variant: "destructive",
          title: "Supabase Connection Error",
          description: error instanceof Error ? error.message : "Failed to connect to Supabase",
        });
      } finally {
        setIsLoadingBranches(false);
        setIsLoadingReports(false);
      }
    };

    initializeData();
  }, [toast]);

  const resetAddModal = () => {
    setCurrentStep(1);
    setModalBranch("");
    setModalDateRange({ from: undefined, to: undefined });
    setModalFile(null);
    setModalCsvHeaders([]);
    setModalCsvData([]);
    setModalAutoMapping({});
  };

  const handleOpenAddModal = () => {
    resetAddModal();
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleModalFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload a CSV file.",
        });
        e.target.value = "";
        return;
      }

      try {
        const { headers, data } = await parseCsvFile(file);
        setModalFile(file);
        setModalCsvHeaders(headers);
        setModalCsvData(data);

        const detected = autoDetectColumns(headers);
        setModalAutoMapping(detected);

        const required: (keyof ColumnMapping)[] = ["rawCategory", "rawItemName", "quantity", "unitPrice"];
        const allDetected = required.every((field) => detected[field]);

        if (!allDetected) {
          toast({
            variant: "destructive",
            title: "CSV format not recognized",
            description: "Required columns could not be detected automatically.",
          });
        }
      } catch (error) {
        console.error("Failed to parse CSV file:", error);
        toast({
          variant: "destructive",
          title: "Upload error",
          description: "Failed to read the CSV file. Please try again.",
        });
      } finally {
        e.target.value = "";
      }
    },
    [toast],
  );

  const canGoNextFromStep = (step: Step) => {
    if (step === 1) return !!modalBranch;
    if (step === 2) return !!modalDateRange.from;
    if (step === 3) return !!modalFile;
    return false;
  };

  const buildReportForPreview = useCallback((): DailyReport | null => {
    if (!modalDateRange.from || !modalCsvData.length || !modalBranch || !modalFile) return null;

    const endDate = modalDateRange.to || modalDateRange.from;
    const dateStr = format(modalDateRange.from, "yyyy-MM-dd");
    const dateEndStr = format(endDate, "yyyy-MM-dd");

    const mapping: ColumnMapping = {
      rawCategory: modalAutoMapping.rawCategory || "",
      rawItemName: modalAutoMapping.rawItemName || "",
      option: modalAutoMapping.option || "",
      quantity: modalAutoMapping.quantity || "",
      unitPrice: modalAutoMapping.unitPrice || "",
    };

    const required: (keyof ColumnMapping)[] = ["rawCategory", "rawItemName", "quantity", "unitPrice"];
    const allMapped = required.every((field) => mapping[field]);

    if (!allMapped) {
      toast({
        variant: "destructive",
        title: "Missing column mapping",
        description: "The uploaded CSV file is missing required columns.",
      });
      return null;
    }

    const rawRows: RawRow[] = modalCsvData.map((row) => ({
      rawCategory: row[mapping.rawCategory] || "",
      rawItemName: row[mapping.rawItemName] || "",
      option: mapping.option ? row[mapping.option] || "" : "",
      quantity: parseFloat(row[mapping.quantity]) || 0,
      unitPrice: parseFloat(row[mapping.unitPrice]) || 0,
    }));

    const processed = rawRows.map((r) => mapRow(r, mappingTable));
    const { totals, quantities, grandTotal, grandQuantity, percents } = aggregateByCategory(processed);
    const unmappedSummary = getUnmappedSummary(processed);

    const report: DailyReport = {
      id: "",
      date: dateStr,
      branch: modalBranch,
      filename: modalFile.name,
      uploadedAt: Date.now(),
      totalRows: processed.length,
      mappedRows: processed.filter((r) => r.status === "MAPPED").length,
      unmappedRows: processed.filter((r) => r.status === "UNMAPPED").length,
      skippedRows: processed.filter((r) => r.status === "SKIPPED").length,
      summaryTotalsByCat: totals,
      summaryQuantitiesByCat: quantities,
      grandTotal,
      grandQuantity,
      percentByCat: percents,
      rowDetails: processed,
      unmappedSummary,
    };

    // Attach date range information using normalizeText to ensure stability (optional metadata)
    void normalizeText(dateEndStr);

    return report;
  }, [modalDateRange, modalCsvData, modalBranch, modalFile, modalAutoMapping, mappingTable, toast]);

  const handleSubmitReport = () => {
    const report = buildReportForPreview();
    if (!report) return;

    setPreviewReport(report);
    setIsAddModalOpen(false);
    setIsPreviewOpen(true);
  };

  const handleConfirmAndSave = async () => {
    if (!previewReport || !modalDateRange.from) return;

    try {
      setIsSaving(true);

      const endDate = modalDateRange.to || modalDateRange.from;
      const dateStr = format(modalDateRange.from, "yyyy-MM-dd");
      const dateEndStr = format(endDate, "yyyy-MM-dd");

      const branchUuid = getBranchId(branches, previewReport.branch);
      if (!branchUuid) {
        throw new Error(`Branch not found: ${previewReport.branch}`);
      }

      const summaryJson = dailyReportToJSON(previewReport);
      const savedReport = await saveDailyReport({
        branchId: branchUuid,
        reportDate: dateStr,
        dateRangeStart: dateStr,
        dateRangeEnd: dateEndStr,
        transactionsFileName: previewReport.filename,
        summaryJson,
      });

      const savedReportWithId: DailyReport = {
        ...previewReport,
        id: savedReport.id,
      };

      setDailyReports((prev) => {
        const without = prev.filter((r) => r.id !== savedReportWithId.id);
        return [savedReportWithId, ...without].sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          return a.branch.localeCompare(b.branch);
        });
      });

      setActiveReportId(savedReportWithId.id);
      setIsPreviewOpen(false);
      resetAddModal();

      toast({
        title: "Report successfully added.",
        description: `Summary for ${BRANCHES.find((b) => b.id === savedReportWithId.branch)?.label ?? savedReportWithId.branch} on ${savedReportWithId.date} has been saved.`,
      });
    } catch (error) {
      console.error("Failed to save report:", error);
      toast({
        variant: "destructive",
        title: "Failed to save report",
        description: error instanceof Error ? error.message : "An error occurred while saving.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredReports = useMemo(() => {
    if (!dailyReports.length) return [];

    return dailyReports.filter((report) => {
      if (filterBranch !== "all" && report.branch !== filterBranch) return false;

      if (filterDateRange.from) {
        const from = filterDateRange.from;
        const to = filterDateRange.to || filterDateRange.from;
        const reportDate = new Date(report.date);
        if (reportDate < from || reportDate > to) return false;
      }

      return true;
    });
  }, [dailyReports, filterBranch, filterDateRange]);

  const activeReport = useMemo(
    () => filteredReports.find((r) => r.id === activeReportId) || null,
    [filteredReports, activeReportId],
  );

  const combinedSummaryForFilters = useMemo(() => {
    if (!filteredReports.length) return null;

    const combinedTotals: Record<string, number> = {};
    const combinedQuantities: Record<string, number> = {};
    let grandTotal = 0;
    let grandQuantity = 0;

    filteredReports.forEach((report) => {
      CATEGORIES.forEach((cat) => {
        combinedTotals[cat] = (combinedTotals[cat] || 0) + (report.summaryTotalsByCat[cat] || 0);
        combinedQuantities[cat] = (combinedQuantities[cat] || 0) + (report.summaryQuantitiesByCat[cat] || 0);
      });
      grandTotal += report.grandTotal;
      grandQuantity += report.grandQuantity;
    });

    const percents: Record<string, number> = {};
    CATEGORIES.forEach((cat) => {
      percents[cat] = grandTotal > 0 ? (combinedTotals[cat] / grandTotal) * 100 : 0;
    });

    return {
      totals: combinedTotals,
      quantities: combinedQuantities,
      grandTotal,
      grandQuantity,
      percents,
    };
  }, [filteredReports]);

  const rankedCategories: RankedCategory[] = useMemo(() => {
    if (!combinedSummaryForFilters) return [];

    const totalSales = combinedSummaryForFilters.grandTotal || 0;

    const baseCategories =
      categoryScope === "all"
        ? CATEGORIES
        : CATEGORIES.filter((c) => selectedCategories.includes(c));

    const rows = baseCategories.map((cat) => {
      const total = combinedSummaryForFilters.totals[cat] || 0;
      const percentOfTotal = totalSales > 0 ? (total / totalSales) * 100 : 0;
      return { category: cat, total, percentOfTotal };
    });

    rows.sort((a, b) =>
      sortOrder === "desc" ? b.total - a.total : a.total - b.total,
    );

    return rows.map((row, index) => ({
      rank: index + 1,
      category: row.category,
      total: row.total,
      percentOfTotal: row.percentOfTotal,
    }));
  }, [combinedSummaryForFilters, categoryScope, selectedCategories, sortOrder]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Controls + Primary Action */}
      <div className="bg-primary shadow-md">
        <div className="max-w-[1600px] mx-auto px-8 py-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-4">
              {/* Date Range Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "px-5 py-2.5 h-auto rounded-full bg-transparent border-2 border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground transition-all",
                      !filterDateRange.from && "text-primary-foreground/70",
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {filterDateRange.from ? (
                      filterDateRange.to ? (
                        <>
                          {format(filterDateRange.from, "MMM dd, yyyy")} —{" "}
                          {format(filterDateRange.to, "MMM dd, yyyy")}
                        </>
                      ) : (
                        format(filterDateRange.from, "MMM dd, yyyy")
                      )
                    ) : (
                      "Filter by date range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI
                    mode="range"
                    selected={filterDateRange}
                    onSelect={(range) => setFilterDateRange(range || { from: undefined, to: undefined })}
                    className="p-3 pointer-events-auto rounded-2xl"
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              {/* Branch Filter */}
              <Select
                value={filterBranch}
                onValueChange={(value) => setFilterBranch(value as BranchId | "all")}
                disabled={isLoadingBranches}
              >
                <SelectTrigger className="w-[220px] px-5 py-2.5 h-auto rounded-full bg-transparent border-2 border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10 transition-all">
                  <MapPin className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {BRANCHES.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Spacer */}
              <div className="ml-auto flex items-center gap-3">
                <Button
                  size="lg"
                  className="rounded-full px-6 py-2.5 h-auto bg-primary-foreground text-primary font-semibold hover:bg-primary-foreground/90 shadow-lg flex items-center gap-2"
                  onClick={handleOpenAddModal}
                >
                  <PlusCircle className="h-5 w-5" />
                  ADD REPORT
                </Button>
              </div>
            </div>

            {/* Category Ranking Bar */}
            <div className="mt-1 flex flex-wrap items-center gap-3 bg-primary/20 border border-primary/30 rounded-2xl px-4 py-3">
              <span className="text-xs font-semibold tracking-[0.16em] uppercase text-primary-foreground/80">
                Category Ranking
              </span>

              {/* Sort by (future-safe) */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-primary-foreground/80">Sort by</span>
                <div className="px-3 py-1.5 rounded-full bg-primary-foreground/10 text-primary-foreground text-[11px] font-semibold">
                  Category Total Sales
                </div>
              </div>

              {/* Order */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-primary-foreground/80">Order</span>
                <div className="inline-flex rounded-full bg-primary-foreground/10 p-1">
                  <button
                    type="button"
                    onClick={() => setSortOrder("desc")}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] font-semibold",
                      sortOrder === "desc"
                        ? "bg-primary-foreground text-primary"
                        : "text-primary-foreground/80",
                    )}
                  >
                    Highest → Lowest
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder("asc")}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] font-semibold",
                      sortOrder === "asc"
                        ? "bg-primary-foreground text-primary"
                        : "text-primary-foreground/80",
                    )}
                  >
                    Lowest → Highest
                  </button>
                </div>
              </div>

              {/* Scope */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-primary-foreground/80">Scope</span>
                <div className="inline-flex rounded-full bg-primary-foreground/10 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryScope("all");
                      setSelectedCategories([...CATEGORIES]);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] font-semibold",
                      categoryScope === "all"
                        ? "bg-primary-foreground text-primary"
                        : "text-primary-foreground/80",
                    )}
                  >
                    All Categories
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryScope("selected")}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] font-semibold",
                      categoryScope === "selected"
                        ? "bg-primary-foreground text-primary"
                        : "text-primary-foreground/80",
                    )}
                  >
                    Selected Categories
                  </button>
                </div>
              </div>

              {/* Category Multi-select */}
              <div className="flex-1 min-w-[220px]">
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {CATEGORIES.map((cat) => {
                    const isActive = selectedCategories.includes(cat);
                    const disabled = categoryScope === "all";
                    return (
                      <button
                        key={cat}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (!isActive) {
                            setSelectedCategories((prev) => [...prev, cat]);
                          } else {
                            setSelectedCategories((prev) =>
                              prev.filter((c) => c !== cat),
                            );
                          }
                        }}
                        className={cn(
                          "text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors",
                          disabled && "opacity-40 cursor-not-allowed",
                          !disabled &&
                            (isActive
                              ? "bg-primary-foreground text-primary shadow-sm"
                              : "bg-primary-foreground/5 text-primary-foreground/90 hover:bg-primary-foreground/15"),
                        )}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Download PDF */}
              <Button
                variant="outline"
                size="sm"
                disabled={!rankedCategories.length || isExporting || !combinedSummaryForFilters}
                onClick={async () => {
                  if (!combinedSummaryForFilters || !rankedCategories.length) return;
                  setIsExporting(true);
                  try {
                    const totalSales = combinedSummaryForFilters.grandTotal || 0;
                    const branchLabel =
                      filterBranch === "all"
                        ? "All branches"
                        : BRANCHES.find((b) => b.id === filterBranch)?.label || "Branch";

                    const dateRangeLabel = filterDateRange.from
                      ? filterDateRange.to &&
                        filterDateRange.from.getTime() !== filterDateRange.to.getTime()
                        ? `${format(filterDateRange.from, "MMM dd, yyyy")} — ${format(
                            filterDateRange.to,
                            "MMM dd, yyyy",
                          )}`
                        : format(filterDateRange.from, "MMM dd, yyyy")
                      : "All dates";

                    await exportCategoryRankingPdf({
                      rankedCategories,
                      branchLabel,
                      dateRangeLabel,
                      totalSales,
                    });
                  } finally {
                    setIsExporting(false);
                  }
                }}
                className="ml-auto rounded-full border-white/70 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/20"
              >
                {isExporting ? "Generating..." : "Download PDF"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left: List of uploaded reports */}
          <aside>
            <DailyHistoryList
              reports={filteredReports}
              activeReportId={activeReportId}
              onSelect={setActiveReportId}
              viewMode="daily"
              selectedMonth=""
              onMonthSelect={() => {}}
            />
          </aside>

          {/* Right: Aggregated + Active Report Preview */}
          <main className="min-w-0 space-y-6">
            {/* Aggregated summary for filters */}
            <div className="bg-card rounded-3xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase mb-1">
                    Summary
                  </p>
                  <h2 className="text-xl font-bold text-card-foreground">
                    Filtered totals
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total sales</p>
                  <p className="text-2xl font-bold text-primary">
                    ₱{formatNumber(combinedSummaryForFilters?.grandTotal || 0)}
                  </p>
                </div>
              </div>
              {combinedSummaryForFilters && filteredReports.length > 0 ? (
                <SummaryTable
                  mode="single"
                  totals={combinedSummaryForFilters.totals as any}
                  quantities={combinedSummaryForFilters.quantities as any}
                  grandTotal={combinedSummaryForFilters.grandTotal}
                  grandQuantity={combinedSummaryForFilters.grandQuantity}
                  percents={combinedSummaryForFilters.percents as any}
                  branchLabel={filterBranch === "all" ? "All Branches" : (BRANCHES.find((b) => b.id === filterBranch)?.label || "Branch")}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No reports match the current filters yet.
                </p>
              )}
            </div>

            {/* Top Categories (Ranked) */}
            <div className="bg-card rounded-3xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase mb-1">
                    Top Categories (Ranked)
                  </p>
                  <h2 className="text-xl font-bold text-card-foreground">
                    Category ranking by sales
                  </h2>
                </div>
              </div>

              {rankedCategories.length ? (
                <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#2B67B2] text-white">
                        <th className="px-4 py-3 text-left w-[70px]">Rank</th>
                        <th className="px-4 py-3 text-left">Category</th>
                        <th className="px-4 py-3 text-right w-[160px]">Total Sales</th>
                        <th className="px-4 py-3 text-right w-[120px]">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedCategories.map((row) => (
                        <tr key={row.category} className="border-t border-[#E2E8F0] even:bg-[#F7F9FC]">
                          <td className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                            {row.rank}
                          </td>
                          <td className="px-4 py-2.5 text-card-foreground text-sm font-medium">
                            {row.category}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-sm font-semibold text-slate-900">
                            ₱{formatNumber(row.total)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold text-[#2B67B2]">
                            {combinedSummaryForFilters?.grandTotal
                              ? `${((row.total / combinedSummaryForFilters.grandTotal) * 100).toFixed(1)}%`
                              : "0.0%"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No category data available for the current filters.
                </p>
              )}
            </div>

            {/* Active report detail */}
            {activeReport ? (
              <div className="bg-card rounded-3xl shadow-xl p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-card-foreground mb-2">
                    Report preview — {activeReport.date}
                  </h2>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-primary">
                        {BRANCHES.find((b) => b.id === activeReport.branch)?.label}
                      </span>
                    </span>
                    <span>
                      File:{" "}
                      <span className="font-medium text-card-foreground">
                        {activeReport.filename}
                      </span>
                    </span>
                    <span>
                      Rows:{" "}
                      <span className="font-semibold text-card-foreground">
                        {activeReport.totalRows}
                      </span>
                    </span>
                    <span className="text-emerald-600 font-medium">
                      ✓ Mapped: {activeReport.mappedRows}
                    </span>
                    <span className="text-amber-600 font-medium">
                      ⚠ Unmapped: {activeReport.unmappedRows}
                    </span>
                    <span>Skipped: {activeReport.skippedRows}</span>
                    <span className="font-bold text-primary text-lg">
                      Total: ₱{formatNumber(activeReport.grandTotal)}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <SummaryTable
                    mode="single"
                    totals={activeReport.summaryTotalsByCat}
                    quantities={activeReport.summaryQuantitiesByCat}
                    grandTotal={activeReport.grandTotal}
                    grandQuantity={activeReport.grandQuantity}
                    percents={activeReport.percentByCat}
                    branchLabel={
                      BRANCHES.find((b) => b.id === activeReport.branch)?.label || activeReport.branch
                    }
                  />

                  <DetailsTable rows={activeReport.rowDetails} />
                  <UnmappedList items={activeReport.unmappedSummary} />
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>

      {/* ADD REPORT Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={(open) => (open ? handleOpenAddModal() : handleCloseAddModal())}>
        <DialogContent className="w-full max-w-2xl sm:max-w-3xl rounded-3xl bg-primary text-primary-foreground border border-white/15 shadow-2xl px-8 py-7">
          <DialogHeader className="pb-4 border-b border-white/10 mb-3">
            <DialogTitle className="text-2xl font-bold tracking-tight">Add new report</DialogTitle>
          </DialogHeader>

          <div className="space-y-7">
            {/* Step indicator */}
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.16em] uppercase">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px]",
                    currentStep === 1
                      ? "bg-white text-primary border-white shadow-sm"
                      : "border-white/30 text-primary-foreground/70",
                  )}
                >
                  1
                </span>
                <span className={cn("transition-colors", currentStep === 1 ? "text-white" : "text-primary-foreground/70")}>
                  Select branch
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px]",
                    currentStep === 2
                      ? "bg-white text-primary border-white shadow-sm"
                      : "border-white/30 text-primary-foreground/70",
                  )}
                >
                  2
                </span>
                <span className={cn("transition-colors", currentStep === 2 ? "text-white" : "text-primary-foreground/70")}>
                  Select date range
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px]",
                    currentStep === 3
                      ? "bg-white text-primary border-white shadow-sm"
                      : "border-white/30 text-primary-foreground/70",
                  )}
                >
                  3
                </span>
                <span className={cn("transition-colors", currentStep === 3 ? "text-white" : "text-primary-foreground/70")}>
                  Upload CSV
                </span>
              </div>
            </div>

            {/* Step content */}
            {currentStep === 1 && (
              <div className="space-y-3 pb-1">
                <p className="text-sm font-medium text-primary-foreground/90">Select branch</p>
                <Select
                  value={modalBranch}
                  onValueChange={(value) => setModalBranch(value as BranchId)}
                >
                  <SelectTrigger className="w-full rounded-full px-5 py-2.5 h-auto bg-primary-foreground text-primary border-none shadow-inner">
                    <SelectValue placeholder="Choose a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-3 pb-1">
                <p className="text-sm font-medium text-primary-foreground/90">Select date range</p>
                <div className="rounded-2xl bg-primary/40 p-3 border border-white/10">
                  <CalendarUI
                    mode="range"
                    selected={modalDateRange}
                    onSelect={(range) => setModalDateRange(range || { from: undefined, to: undefined })}
                    className="rounded-xl bg-primary-foreground text-primary shadow-sm"
                    numberOfMonths={2}
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-3 pb-1">
                <p className="text-sm font-medium text-primary-foreground/90">Upload transactions CSV</p>
                <label className="flex items-center justify-between px-5 py-3 rounded-full border border-dashed border-white/40 cursor-pointer bg-primary-foreground text-primary hover:bg-primary-foreground/95 transition-colors shadow-sm">
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium truncate max-w-[260px]">
                      {modalFile ? modalFile.name : "Choose CSV file"}
                    </span>
                    <span className="text-xs text-primary/80">
                      Only .csv files are supported
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-primary uppercase tracking-[0.16em]">
                    Browse
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleModalFileChange}
                  />
                </label>
                {modalCsvHeaders.length > 0 && (
                  <p className="text-xs text-primary-foreground/80">
                    Detected {modalCsvHeaders.length} columns from the uploaded file.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-7 gap-2">
            <Button
              variant="outline"
              onClick={handleCloseAddModal}
              disabled={isSaving}
              className="rounded-full border-white/70 text-primary-foreground bg-transparent hover:bg-white/10"
            >
              Cancel
            </Button>
            {currentStep > 1 && (
              <Button
                variant="ghost"
                onClick={() => setCurrentStep((prev) => (prev - 1) as Step)}
                disabled={isSaving}
                className="rounded-full text-primary-foreground hover:bg-white/10"
              >
                Back
              </Button>
            )}
            {currentStep < 3 && (
              <Button
                disabled={!canGoNextFromStep(currentStep) || isSaving}
                onClick={() => {
                  if (canGoNextFromStep(currentStep)) {
                    setCurrentStep((prev) => (prev + 1) as Step);
                  }
                }}
                className="rounded-full bg-white text-primary font-semibold hover:bg-blue-50 shadow-md"
              >
                Next
              </Button>
            )}
            {currentStep === 3 && (
              <Button
                onClick={handleSubmitReport}
                disabled={!canGoNextFromStep(3) || isSaving}
                className="rounded-full bg-white text-primary font-semibold hover:bg-blue-50 shadow-md"
              >
                Submit Report
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-full max-w-[1200px] max-h-[90vh] rounded-2xl bg-white text-slate-900 border border-[#E2E8F0] shadow-2xl px-6 py-5 flex flex-col">
          <DialogHeader className="pb-3 border-b border-border/60 mb-4">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Preview report
            </DialogTitle>
            {previewReport && (
              <p className="text-sm text-muted-foreground mt-1">
                {BRANCHES.find((b) => b.id === previewReport.branch)?.label} •{" "}
                {modalDateRange.from &&
                modalDateRange.to &&
                modalDateRange.from.getTime() !== modalDateRange.to.getTime()
                  ? `${format(modalDateRange.from, "MMM dd, yyyy")} — ${format(
                      modalDateRange.to,
                      "MMM dd, yyyy",
                    )}`
                  : modalDateRange.from
                    ? format(modalDateRange.from, "MMM dd, yyyy")
                    : previewReport.date}
              </p>
            )}
          </DialogHeader>

          {previewReport && (
            <div className="flex-1 overflow-y-auto pr-1 space-y-5">
              {/* Top summary strip */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-1">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                    Branch
                  </p>
                  <p className="text-base font-semibold">
                    {BRANCHES.find((b) => b.id === previewReport.branch)?.label}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                    Date range
                  </p>
                  <p className="text-base font-semibold">
                    {modalDateRange.from &&
                    modalDateRange.to &&
                    modalDateRange.from.getTime() !== modalDateRange.to.getTime()
                      ? `${format(modalDateRange.from, "MMM dd, yyyy")} — ${format(
                          modalDateRange.to,
                          "MMM dd, yyyy",
                        )}`
                      : modalDateRange.from
                        ? format(modalDateRange.from, "MMM dd, yyyy")
                        : previewReport.date}
                  </p>
                </div>
                <div className="ml-auto">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm text-right min-w-[180px]">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#64748B]">
                      Total sales
                    </p>
                    <p className="text-2xl font-extrabold text-[#2B67B2]">
                      ₱{formatNumber(previewReport.grandTotal)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary table card */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#E2E8F0]">
                <SummaryTable
                  mode="single"
                  totals={previewReport.summaryTotalsByCat}
                  quantities={previewReport.summaryQuantitiesByCat}
                  grandTotal={previewReport.grandTotal}
                  grandQuantity={previewReport.grandQuantity}
                  percents={previewReport.percentByCat}
                  branchLabel={
                    BRANCHES.find((b) => b.id === previewReport.branch)?.label || previewReport.branch
                  }
                />
              </div>

              {/* Details table card */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#E2E8F0]">
                <DetailsTable rows={previewReport.rowDetails} />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 pt-4 border-t border-[#E2E8F0] flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsPreviewOpen(false)}
              disabled={isSaving}
              className="border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]"
            >
              Cancel / Reject
            </Button>
            <Button
              onClick={handleConfirmAndSave}
              disabled={isSaving}
              className="bg-[#2B67B2] hover:bg-[#1F4E8C] text-white"
            >
              Confirm &amp; Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


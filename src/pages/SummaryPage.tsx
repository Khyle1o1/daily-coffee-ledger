import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
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
  Category,
} from "@/utils/types";
import { BRANCHES, CATEGORIES } from "@/utils/types";
import {
  detectDateRangeFromFilename,
  detectDateRangeFromRows,
} from "@/lib/reports/detectDateRange";
import { findTransactionDateKey } from "@/lib/csv/findTransactionDateKey";
import { parseTransactionDate } from "@/lib/csv/parseTransactionDate";
import { formatMonthDisplay, getMonthRange } from "@/utils/aggregateMonthly";
import type { DateRange } from "react-day-picker";

import {
  getBranches,
  listAllDailyReports,
  saveDailyReport,
  seedBranchesIfEmpty,
  deleteDailyReport,
} from "@/services/reportsService";
import { dailyReportToJSON, dailyReportsFromRows, getBranchId } from "@/services/reportConverter";
import type { Branch } from "@/lib/supabase-types";

export default function SummaryPage() {
  const { toast } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [previousDateRange, setPreviousDateRange] = useState<DateRange | null>(null);

  // Filters for the main summary view
  const [filterDateRange, setFilterDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [filterBranch, setFilterBranch] = useState<BranchId | "all">("all");

  // Mapping table (kept internal, no manual upload in UI)
  const [mappingTable] = useState<MappingEntry[]>(DEFAULT_MAPPING);

  // ADD REPORT modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalBranch, setModalBranch] = useState<BranchId | "">("");
  const [detectedDateRange, setDetectedDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalCsvHeaders, setModalCsvHeaders] = useState<string[]>([]);
  const [modalCsvData, setModalCsvData] = useState<Record<string, string>[]>([]);
  const [modalAutoMapping, setModalAutoMapping] = useState<Partial<Record<keyof ColumnMapping, string>>>({});
  const [dateDetectionError, setDateDetectionError] = useState<string | null>(null);

  // Preview modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<DailyReport | null>(null);

  // Delete confirmation state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reportPendingDelete, setReportPendingDelete] = useState<DailyReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredTotalsRef = useRef<HTMLDivElement | null>(null);

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
    setModalBranch("");
    setDetectedDateRange({ from: undefined, to: undefined });
    setModalFile(null);
    setModalCsvHeaders([]);
    setModalCsvData([]);
    setModalAutoMapping({});
    setDateDetectionError(null);
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
        setDateDetectionError(null);
        setDetectedDateRange({ from: undefined, to: undefined });

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

        // Date range detection: filename first, then rows
        const fromFilename = detectDateRangeFromFilename(file.name);
        const fromRows = !fromFilename ? detectDateRangeFromRows(data) : null;
        const range: DetectedDateRange | null = fromFilename || fromRows;

        if (!range) {
          setDateDetectionError(
            "Could not detect date range from file. Please upload a valid DOT Coffee transactions CSV.",
          );
          setDetectedDateRange({ from: undefined, to: undefined });
        } else {
          if (range.start.getTime() > range.end.getTime()) {
            setDateDetectionError(
              "Detected date range is invalid (start is after end). Please check the file.",
            );
            setDetectedDateRange({ from: undefined, to: undefined });
          } else {
            const days = differenceInCalendarDays(range.end, range.start) + 1;
            if (days > 90) {
              const proceed = window.confirm(
                "This file covers more than 90 days. Continue?",
              );
              if (!proceed) {
                setDateDetectionError(
                  "Upload cancelled because the file covers more than 90 days.",
                );
                setDetectedDateRange({ from: undefined, to: undefined });
                setModalFile(null);
                return;
              }
            }

            setDetectedDateRange({ from: range.start, to: range.end });
            setDateDetectionError(null);
          }
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

  const canGenerate =
    !!modalBranch && !!modalFile && !!detectedDateRange.from && !dateDetectionError;

  const buildReportForPreview = useCallback((): DailyReport | null => {
    if (!detectedDateRange.from || !modalCsvData.length || !modalBranch || !modalFile) return null;

    const endDate = detectedDateRange.to || detectedDateRange.from;
    const dateStr = format(detectedDateRange.from, "yyyy-MM-dd");
    const dateEndStr = format(endDate, "yyyy-MM-dd");

    const mapping: ColumnMapping = {
      rawCategory: modalAutoMapping.rawCategory || "",
      rawItemName: modalAutoMapping.rawItemName || "",
      option: modalAutoMapping.option || "",
      quantity: modalAutoMapping.quantity || "",
      unitPrice: modalAutoMapping.unitPrice || "",
      paymentType: modalAutoMapping.paymentType || "",
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

    const dateKey = findTransactionDateKey(modalCsvHeaders);

    const debugDates: Date[] = [];

    const rawRows: RawRow[] = [];
    for (const r of modalCsvData) {
      const d = dateKey ? parseTransactionDate(r[dateKey]) : null;
      if (!d) continue;
      debugDates.push(d);
      rawRows.push({
        rawCategory: r[mapping.rawCategory] || "",
        rawItemName: r[mapping.rawItemName] || "",
        option: mapping.option ? r[mapping.option] || "" : "",
        quantity: parseFloat(r[mapping.quantity]) || 0,
        unitPrice: parseFloat(r[mapping.unitPrice]) || 0,
        paymentType: mapping.paymentType ? r[mapping.paymentType] || "" : undefined,
        transactionDate: d,
      });
    }

    if (debugDates.length === 0) {
      console.warn("[DateDebug] No valid transaction dates parsed", {
        dateKeyUsed: dateKey,
        sampleRaw: modalCsvData.slice(0, 5),
      });
      toast({
        variant: "destructive",
        title: "Could not read dates from CSV",
        description:
          "0 valid dates were detected. Please check that the date column uses a supported format.",
      });
      return null;
    }

    const sortedDebug = [...debugDates].sort((a, b) => a.getTime() - b.getTime());
    console.log("[DateDebug] Parsed transaction dates summary", {
      dateKeyUsed: dateKey,
      first5: sortedDebug.slice(0, 5).map((d) => d.toISOString()),
      min: sortedDebug[0].toISOString(),
      max: sortedDebug[sortedDebug.length - 1].toISOString(),
      validDateCount: sortedDebug.length,
    });

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
  }, [detectedDateRange, modalCsvData, modalBranch, modalFile, modalAutoMapping, mappingTable, toast]);

  const handleSubmitReport = () => {
    const report = buildReportForPreview();
    if (!report) return;

    setPreviewReport(report);
    setIsAddModalOpen(false);
    setIsPreviewOpen(true);
  };

  const handleConfirmAndSave = async () => {
    if (!previewReport || !detectedDateRange.from) return;

    try {
      setIsSaving(true);

      const endDate = detectedDateRange.to || detectedDateRange.from;
      const dateStr = format(detectedDateRange.from, "yyyy-MM-dd");
      const dateEndStr = format(endDate, "yyyy-MM-dd");

      const branchUuid = getBranchId(branches, previewReport.branch);
      if (!branchUuid) {
        toast({
          variant: "destructive",
          title: "Branch not configured in Supabase",
          description:
            `The branch "${previewReport.branch}" does not exist in the Supabase "branches" table. ` +
            `Please add it there (name="${previewReport.branch}") or run the latest database migration, then try again.`,
        });
        return;
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

  const handleRequestDeleteReport = useCallback(
    (reportId: string) => {
      const target = dailyReports.find((r) => r.id === reportId);
      if (!target) return;
      setReportPendingDelete(target);
      setIsDeleteModalOpen(true);
    },
    [dailyReports],
  );

  const handleConfirmDeleteReport = useCallback(async () => {
    if (!reportPendingDelete) return;
    try {
      setIsDeleting(true);
      await deleteDailyReport(reportPendingDelete.id);

      setDailyReports((prev) =>
        prev.filter((r) => r.id !== reportPendingDelete.id),
      );

      if (activeReportId === reportPendingDelete.id) {
        setActiveReportId(null);
      }

      setReportPendingDelete(null);
      setIsDeleteModalOpen(false);

      toast({
        title: "Data deleted",
        description: "The selected dataset has been removed.",
      });
    } catch (error) {
      console.error("Failed to delete report:", error);
      toast({
        variant: "destructive",
        title: "Failed to delete data",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [reportPendingDelete, activeReportId, toast]);

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

  const allBranchesBreakdown = useMemo(() => {
    if (!filteredReports.length || filterBranch !== "all") return null;

    const byBranch = new Map<BranchId, {
      branchId: BranchId;
      branchName: string;
      totals: Record<Category, number>;
      quantities: Record<Category, number>;
      grandTotal: number;
      grandQuantity: number;
    }>();

    filteredReports.forEach((report) => {
      const existing = byBranch.get(report.branch);
      const branchName =
        BRANCHES.find((b) => b.id === report.branch)?.label ?? report.branch;

      if (!existing) {
        const totalsInit = {} as Record<Category, number>;
        const quantitiesInit = {} as Record<Category, number>;
        CATEGORIES.forEach((cat) => {
          totalsInit[cat] = report.summaryTotalsByCat[cat] || 0;
          quantitiesInit[cat] = report.summaryQuantitiesByCat[cat] || 0;
        });
        byBranch.set(report.branch, {
          branchId: report.branch,
          branchName,
          totals: totalsInit,
          quantities: quantitiesInit,
          grandTotal: report.grandTotal,
          grandQuantity: report.grandQuantity,
        });
      } else {
        CATEGORIES.forEach((cat) => {
          existing.totals[cat] =
            (existing.totals[cat] || 0) +
            (report.summaryTotalsByCat[cat] || 0);
          existing.quantities[cat] =
            (existing.quantities[cat] || 0) +
            (report.summaryQuantitiesByCat[cat] || 0);
        });
        existing.grandTotal += report.grandTotal;
        existing.grandQuantity += report.grandQuantity;
      }
    });

    return Array.from(byBranch.values()).sort((a, b) =>
      a.branchName.localeCompare(b.branchName),
    );
  }, [filteredReports, filterBranch]);

  const handleMonthSelect = useCallback(
    (monthKey: string) => {
      // Toggle off if the same month is clicked again
      if (selectedMonthKey === monthKey) {
        setSelectedMonthKey(null);
        setFilterDateRange(previousDateRange || { from: undefined, to: undefined });
        setPreviousDateRange(null);
        return;
      }

      // Preserve the previous range only once so we can restore it
      if (!previousDateRange) {
        setPreviousDateRange(filterDateRange);
      }

      const [yearStr, monthStr] = monthKey.split("-");
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1; // 0-based
      const { start, end } = getMonthRange(year, monthIndex);

      setSelectedMonthKey(monthKey);
      setFilterDateRange({ from: start, to: end });

      // Scroll to the filtered totals card for instant feedback
      if (filteredTotalsRef.current) {
        filteredTotalsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [selectedMonthKey, previousDateRange, filterDateRange],
  );

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

              {selectedMonthKey && (
                <div className="flex items-center gap-2 text-xs bg-primary-foreground/10 text-primary-foreground px-3 py-1.5 rounded-full">
                  <span className="font-semibold tracking-wide">
                    Month selected: {formatMonthDisplay(selectedMonthKey)}
                  </span>
                  <button
                    type="button"
                    className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30"
                    onClick={() => handleMonthSelect(selectedMonthKey)}
                  >
                    ×
                  </button>
                </div>
              )}

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
                  ADD DATA
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-6">
          {/* Left: Aggregated + Active Report Preview */}
          <main className="min-w-0 space-y-6">
            {/* Aggregated summary for filters */}
            <div ref={filteredTotalsRef} className="bg-card rounded-3xl shadow-xl p-6">
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
                branchBreakdown={allBranchesBreakdown ?? undefined}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No reports match the current filters yet.
                </p>
              )}
            </div>

            {/* Active report detail */}
            {activeReport ? (
              <div className="bg-card rounded-3xl shadow-xl p-8">
                <div className="mb-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
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
                    <div className="flex flex-col items-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRequestDeleteReport(activeReport.id)}
                        className="rounded-full border-red-200 text-red-600 hover:bg-red-50"
                      >
                        Delete data
                      </Button>
                    </div>
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

          {/* Right: Daily / Monthly history (slightly narrower) */}
          <aside className="lg:max-w-[260px]">
            <DailyHistoryList
              reports={filteredReports}
              activeReportId={activeReportId}
              onSelect={setActiveReportId}
              viewMode="daily"
              selectedMonth={selectedMonthKey ?? ""}
              onMonthSelect={handleMonthSelect}
              onDelete={handleRequestDeleteReport}
            />
          </aside>
        </div>
      </div>

      {/* ADD REPORT Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={(open) => (open ? handleOpenAddModal() : handleCloseAddModal())}>
        <DialogContent className="w-full max-w-2xl sm:max-w-3xl rounded-3xl bg-primary text-primary-foreground border border-white/15 shadow-2xl px-8 py-7">
          <DialogHeader className="pb-4 border-b border-white/10 mb-3">
            <DialogTitle className="text-2xl font-bold tracking-tight">Add new report</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Select Branch */}
            <div className="space-y-3">
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

            {/* Upload CSV */}
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
              {detectedDateRange.from && !dateDetectionError && (
                <p className="text-xs text-primary-foreground/80">
                  Detected date range:{" "}
                  {detectedDateRange.to &&
                  detectedDateRange.from.getTime() !== detectedDateRange.to.getTime()
                    ? `${format(detectedDateRange.from, "MMM dd, yyyy")} — ${format(
                        detectedDateRange.to,
                        "MMM dd, yyyy",
                      )}`
                    : format(detectedDateRange.from, "MMM dd, yyyy")}
                </p>
              )}
              {dateDetectionError && (
                <p className="text-xs text-red-200">
                  {dateDetectionError}
                </p>
              )}
            </div>
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
            <Button
              onClick={handleSubmitReport}
              disabled={!canGenerate || isSaving}
              className="rounded-full bg-white text-primary font-semibold hover:bg-blue-50 shadow-md"
            >
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete data confirmation */}
      <Dialog
        open={isDeleteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDeleteModalOpen(false);
            setReportPendingDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl bg-primary text-primary-foreground border border-white/15 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Delete this data?
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-primary-foreground/80">
              This will permanently remove the uploaded dataset and recomputed results for:
            </p>
            {reportPendingDelete && (
              <div className="rounded-2xl bg-primary-foreground/10 px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold tracking-[0.16em] uppercase text-primary-foreground/70">
                  Summary
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Branch:</span>{" "}
                  {BRANCHES.find((b) => b.id === reportPendingDelete.branch)?.label ??
                    reportPendingDelete.branch}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Date:</span>{" "}
                  {reportPendingDelete.date}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">File:</span>{" "}
                  <span className="break-all opacity-90">
                    {reportPendingDelete.filename}
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="mt-5 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setReportPendingDelete(null);
              }}
              disabled={isDeleting}
              className="rounded-full border-white/70 text-primary-foreground bg-transparent hover:bg-white/10 px-6"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteReport}
              disabled={isDeleting}
              className="rounded-full px-6 font-semibold"
            >
              {isDeleting ? "Deleting…" : "Delete data"}
            </Button>
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
                {detectedDateRange.from &&
                detectedDateRange.to &&
                detectedDateRange.from.getTime() !== detectedDateRange.to.getTime()
                  ? `${format(detectedDateRange.from, "MMM dd, yyyy")} — ${format(
                      detectedDateRange.to,
                      "MMM dd, yyyy",
                    )}`
                  : detectedDateRange.from
                    ? format(detectedDateRange.from, "MMM dd, yyyy")
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
                    {detectedDateRange.from &&
                    detectedDateRange.to &&
                    detectedDateRange.from.getTime() !== detectedDateRange.to.getTime()
                      ? `${format(detectedDateRange.from, "MMM dd, yyyy")} — ${format(
                          detectedDateRange.to,
                          "MMM dd, yyyy",
                        )}`
                      : detectedDateRange.from
                        ? format(detectedDateRange.from, "MMM dd, yyyy")
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


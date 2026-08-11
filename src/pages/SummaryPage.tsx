import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, startOfMonth, startOfWeek } from "date-fns";
import {
  Building2,
  Calendar,
  Clock,
  FileText,
  Flame,
  ShoppingBag,
  Snowflake,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GroupedBranchCheckboxList } from "@/components/branch/GroupedBranchCheckboxList";
import { GroupedBranchOptGroups } from "@/components/branch/GroupedBranchSelectItems";
import { mergeSelectedIds } from "@/lib/branchCategory";

import SummaryTable from "@/components/SummaryTable";
import DetailsTable from "@/components/DetailsTable";
import UnmappedList from "@/components/UnmappedList";
import DailyHistoryList from "@/components/DailyHistoryList";

import { parseCsvFile, autoDetectColumns } from "@/utils/parseCsv";
import { normalizeText } from "@/utils/normalize";
import { mapRow } from "@/utils/mapRow";
import { useManualMappings } from "@/hooks/useManualMappings";
import { aggregateByCategory, getUnmappedSummary } from "@/utils/aggregate";
import { formatCompactPHP, formatNumber } from "@/utils/format";
import { getPercentChange } from "@/utils/percentChange";
import { DEFAULT_MAPPING } from "@/utils/defaultMapping";
import { loadValidationMappingFromPublic } from "@/utils/loadValidationMapping";
import { preloadMenuReference } from "@/utils/menuReference";
import type {
  BranchId,
  ColumnMapping,
  DailyReport,
  MappingEntry,
  RawRow,
  Category,
} from "@/utils/types";
import { CATEGORIES } from "@/utils/types";
import {
  detectDateRangeFromFilename,
  detectDateRangeFromRows,
  type DetectedDateRange,
} from "@/lib/reports/detectDateRange";
import { listBranches } from "@/lib/api/branches";
import { FilterBar, FilterTriggerButton } from "@/components/dashboard/FilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { SalesOverview } from "@/components/dashboard/SalesOverview";
import { TopBranches } from "@/components/dashboard/TopBranches";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { BranchPerformanceTable } from "@/components/dashboard/BranchPerformanceTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { findTransactionDateKey } from "@/lib/csv/findTransactionDateKey";
import { parseTransactionDate } from "@/lib/csv/parseTransactionDate";
import { formatMonthDisplay, getMonthRange } from "@/utils/aggregateMonthly";
import type { DateRange } from "react-day-picker";

import { saveDailyReport, deleteDailyReport } from "@/services/reportsService";
import { dailyReportToJSON } from "@/services/reportConverter";
import { useLiveBranches } from "@/hooks/useLiveBranches";
import { useAuth } from "@/auth/useAuth";
import { canAddData, canEditData, canDeleteData } from "@/lib/permissions";
import { logEvent } from "@/services/auditService";
import { useDailyReportsQuery } from "@/hooks/queries/useDailyReportsQuery";
import { useReportDetailQuery } from "@/hooks/queries/useReportDetailQuery";
import { queryKeys } from "@/hooks/queries/queryKeys";

export default function SummaryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { branchOptions, isLoading: isLoadingBranches, getBranchLabel, getBranchUuid } = useLiveBranches();

  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [previousDateRange, setPreviousDateRange] = useState<DateRange | null>(null);

  // Filters for the main summary view
  const [filterDateRange, setFilterDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [filterBranches, setFilterBranches] = useState<BranchId[]>([]);
  const [compareMode, setCompareMode] = useState<"previous" | "none">("previous");
  const [chartGranularity, setChartGranularity] = useState<"weekly" | "daily" | "monthly">("weekly");

  // Mapping table (loaded from public/VALIDATION DATA.xlsx, fallback to bundled default)
  const [mappingTable, setMappingTable] = useState<MappingEntry[]>(DEFAULT_MAPPING);
  const { manualEntries } = useManualMappings();

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

  /**
   * Derive plain YYYY-MM-DD filter bounds from the calendar-picker Dates.
   * Using local date components (getFullYear/getMonth/getDate) avoids the
   * UTC-midnight vs. local-midnight mismatch that makes new Date("YYYY-MM-DD")
   * land on the wrong calendar day in UTC+8 timezones.
   */
  const { fromKey, toKey } = useMemo(() => {
    const toKey_ = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const from = filterDateRange.from ? toKey_(filterDateRange.from) : null;
    const to   = filterDateRange.to   ? toKey_(filterDateRange.to)   : from;
    return { fromKey: from, toKey: to };
  }, [filterDateRange]);

  // Meta list is light — use a high page size so older months (e.g. January)
  // are not hidden behind the default newest-50 page. When a date filter is
  // set, push it to Supabase as an overlap query.
  const { data: cachedDailyReportsPage, error: dailyReportsError, isFetching: isRefreshingReports } = useDailyReportsQuery({
    dateFrom: fromKey ?? undefined,
    dateTo:   toKey ?? undefined,
    pageSize: 500,
  });

  const previousPeriodKeys = useMemo(() => {
    if (!filterDateRange.from) return null;
    const from = filterDateRange.from;
    const to = filterDateRange.to ?? from;
    const days = differenceInCalendarDays(to, from) + 1;
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - (days - 1));
    const toKey_ = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { fromKey: toKey_(prevFrom), toKey: toKey_(prevTo) };
  }, [filterDateRange]);

  const { data: previousReportsPage } = useDailyReportsQuery({
    dateFrom: previousPeriodKeys?.fromKey,
    dateTo: previousPeriodKeys?.toKey,
    pageSize: 500,
    enabled: compareMode === "previous" && !!previousPeriodKeys,
  });

  const { data: directoryBranches } = useQuery({
    queryKey: queryKeys.branches.adminList({}),
    queryFn: () => listBranches({}),
  });

  // Fetch the full report (rowDetails + unmappedSummary) only when the user
  // opens the detail panel.  The list query returns lightweight metadata from
  // the reports_daily_meta view; this query loads the heavy blob on demand.
  const {
    data: activeReportDetail,
    isLoading: isLoadingDetail,
  } = useReportDetailQuery(activeReportId);

  useEffect(() => {
    void preloadMenuReference();
  }, []);

  useEffect(() => {
    if (cachedDailyReportsPage) {
      setDailyReports(cachedDailyReportsPage.reports);
    }
  }, [cachedDailyReportsPage]);

  useEffect(() => {
    if (!dailyReportsError) return;
    toast({
      variant: "destructive",
      title: "Supabase Connection Error",
      description:
        dailyReportsError instanceof Error
          ? dailyReportsError.message
          : "Failed to connect to Supabase",
    });
  }, [dailyReportsError, toast]);

  useEffect(() => {
    const loadValidation = async () => {
      try {
        void preloadMenuReference();
        const liveTable = await loadValidationMappingFromPublic();
        setMappingTable(liveTable);
      } catch (error) {
        console.warn("Failed to load validation mapping from workbook; using bundled default.", error);
      }
    };
    void loadValidation();
  }, []);

  // Ensure the page stays interactive if a nested overlay left body pointer-events stuck.
  useEffect(() => {
    if (isAddModalOpen) return;
    document.body.style.pointerEvents = "";
  }, [isAddModalOpen]);

  const resetAddModal = () => {
    setModalBranch("");
    setDetectedDateRange({ from: undefined, to: undefined });
    setModalFile(null);
    setModalCsvHeaders([]);
    setModalCsvData([]);
    setModalAutoMapping({});
    setDateDetectionError(null);
    setIsGenerating(false);
  };

  const handleOpenAddModal = () => {
    resetAddModal();
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    if (isGenerating) return;
    setIsAddModalOpen(false);
    // Radix Select/Dialog can leave body non-interactive after dismiss.
    document.body.style.pointerEvents = "";
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

  const requiredColumnsMapped = (
    ["rawCategory", "rawItemName", "quantity", "unitPrice"] as const
  ).every((field) => !!modalAutoMapping[field]);

  const canGenerate =
    !!modalBranch &&
    !!modalFile &&
    modalCsvData.length > 0 &&
    !!detectedDateRange.from &&
    !dateDetectionError &&
    requiredColumnsMapped;

  const generateBlockedReason = !modalBranch
    ? "Select a branch to continue."
    : !modalFile
      ? "Upload a transactions CSV to continue."
      : modalCsvData.length === 0
        ? "The CSV has headers but no transaction rows were read."
        : !detectedDateRange.from || dateDetectionError
          ? dateDetectionError || "Could not detect a date range from the file."
          : !requiredColumnsMapped
            ? "Required columns could not be detected (category, item, quantity, unit price)."
            : null;

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
      transactionId: modalAutoMapping.transactionId || "",
      receiptNo: modalAutoMapping.receiptNo || "",
      grossPrice: modalAutoMapping.grossPrice || "",
      discountedPrice: modalAutoMapping.discountedPrice || "",
      regularDiscount: modalAutoMapping.regularDiscount || "",
      seniorDiscount: modalAutoMapping.seniorDiscount || "",
      pwdDiscount: modalAutoMapping.pwdDiscount || "",
      vatExemption: modalAutoMapping.vatExemption || "",
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
    const parseOptMoney = (raw: string | undefined) => {
      if (raw == null || raw === "") return undefined;
      const n = parseFloat(String(raw).replace(/[,₱\s]/g, ""));
      return Number.isFinite(n) ? n : undefined;
    };

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
        transactionId: mapping.transactionId ? r[mapping.transactionId] || undefined : undefined,
        receiptNo: mapping.receiptNo ? r[mapping.receiptNo] || undefined : undefined,
        grossPrice: mapping.grossPrice ? parseOptMoney(r[mapping.grossPrice]) : undefined,
        discountedPrice: mapping.discountedPrice
          ? parseOptMoney(r[mapping.discountedPrice])
          : undefined,
        regularDiscount: mapping.regularDiscount
          ? parseOptMoney(r[mapping.regularDiscount])
          : undefined,
        seniorDiscount: mapping.seniorDiscount
          ? parseOptMoney(r[mapping.seniorDiscount])
          : undefined,
        pwdDiscount: mapping.pwdDiscount ? parseOptMoney(r[mapping.pwdDiscount]) : undefined,
        vatExemption: mapping.vatExemption ? parseOptMoney(r[mapping.vatExemption]) : undefined,
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

    const effectiveMappingTable = [...manualEntries, ...mappingTable];
    const processed = rawRows.map((r) => mapRow(r, effectiveMappingTable));
    const { totals, quantities, grandTotal, grandQuantity, percents } = aggregateByCategory(processed);
    const unmappedSummary = getUnmappedSummary(processed);

    const report: DailyReport = {
      id: "",
      date: dateStr,
      dateRangeEnd: dateEndStr,
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
  }, [detectedDateRange, modalCsvData, modalBranch, modalFile, modalAutoMapping, mappingTable, manualEntries, toast]);

  const handleSubmitReport = async () => {
    if (!canGenerate || isGenerating || isSaving) return;

    setIsGenerating(true);
    try {
      // Yield so the button can paint "Generating..." before heavy sync work.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const report = buildReportForPreview();
      if (!report) return;

      setPreviewReport(report);
      setIsAddModalOpen(false);
      setIsPreviewOpen(true);
    } catch (error) {
      console.error("Failed to generate report preview:", error);
      toast({
        variant: "destructive",
        title: "Failed to generate report",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong while processing the CSV. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!previewReport || !detectedDateRange.from) return;

    try {
      setIsSaving(true);

      const endDate = detectedDateRange.to || detectedDateRange.from;
      const dateStr = format(detectedDateRange.from, "yyyy-MM-dd");
      const dateEndStr = format(endDate, "yyyy-MM-dd");

      const branchUuid = getBranchUuid(previewReport.branch);
      if (!branchUuid) {
        toast({
          variant: "destructive",
          title: "Branch not configured",
          description:
            `The branch "${previewReport.branch}" does not exist or is inactive. ` +
            `Please add it in Settings > Branch Management, then try again.`,
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
        dateRangeEnd: dateEndStr,
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.dailyRoot });

      void logEvent({
        action: 'add_data',
        module: 'summary',
        targetId: savedReport.id,
        targetName: `${getBranchLabel(savedReportWithId.branch)} — ${savedReportWithId.date}`,
        details: `Uploaded data for ${getBranchLabel(savedReportWithId.branch)} on ${savedReportWithId.date}`,
        metadata: {
          branch: savedReportWithId.branch,
          date: savedReportWithId.date,
          filename: previewReport.filename,
          totalRows: previewReport.totalRows,
        },
      });

      toast({
        title: "Report successfully added.",
        description: `Summary for ${getBranchLabel(savedReportWithId.branch)} on ${savedReportWithId.date} has been saved.`,
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

      void logEvent({
        action: 'delete_data',
        module: 'summary',
        targetId: reportPendingDelete.id,
        targetName: `${getBranchLabel(reportPendingDelete.branch)} — ${reportPendingDelete.date}`,
        details: `Deleted daily report for ${getBranchLabel(reportPendingDelete.branch)} on ${reportPendingDelete.date}`,
        metadata: { branch: reportPendingDelete.branch, date: reportPendingDelete.date },
      });

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
  }, [reportPendingDelete, activeReportId, getBranchLabel, queryClient, toast]);

  /**
   * For a single report, aggregate only the rowDetails whose transactionDate
   * falls within [fromKey, toKey].  Falls back to the pre-computed totals when
   * rows carry no transactionDate (legacy uploads) so those are never silently
   * zeroed out.
   */
  const getEffectiveTotals = useCallback(
    (report: DailyReport) => {
      // If no date filter is active, always use the pre-computed totals.
      if (!fromKey) {
        return {
          totals: report.summaryTotalsByCat,
          quantities: report.summaryQuantitiesByCat,
          grandTotal: report.grandTotal,
          grandQuantity: report.grandQuantity,
        };
      }

      const reportStart = report.date.slice(0, 10);
      const reportEnd   = (report.dateRangeEnd ?? report.date).slice(0, 10);

      // Report is entirely within the selected range — pre-computed totals are exact.
      if (reportStart >= fromKey && reportEnd <= toKey!) {
        return {
          totals: report.summaryTotalsByCat,
          quantities: report.summaryQuantitiesByCat,
          grandTotal: report.grandTotal,
          grandQuantity: report.grandQuantity,
        };
      }

      // Report partially overlaps — re-aggregate from row-level transaction dates.
      const rowsWithDate = report.rowDetails.filter((r) => r.transactionDate != null);
      if (rowsWithDate.length === 0) {
        // Legacy report: no per-row dates stored — use pre-computed totals as fallback.
        return {
          totals: report.summaryTotalsByCat,
          quantities: report.summaryQuantitiesByCat,
          grandTotal: report.grandTotal,
          grandQuantity: report.grandQuantity,
        };
      }

      const filteredRows = rowsWithDate.filter((row) => {
        const d = row.transactionDate!;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return key >= fromKey && key <= toKey!;
      });

      const agg = aggregateByCategory(filteredRows);
      return {
        totals: agg.totals,
        quantities: agg.quantities,
        grandTotal: agg.grandTotal,
        grandQuantity: agg.grandQuantity,
      };
    },
    [fromKey, toKey],
  );

  /**
   * Filtered report list — includes any report whose date range OVERLAPS the
   * selected filter range (not just the start date).
   *
   * Before: only `report.date` (start) was compared, so a Mar 1–31 report
   *         always passed a "Mar 1–11" filter and carried its full-month totals.
   * After:  overlap is checked using both `report.date` and `report.dateRangeEnd`,
   *         and totals are re-aggregated from row-level transaction dates.
   */
  const filteredReports = useMemo(() => {
    console.log("[DateFilter] selected from:", fromKey ?? "(none)", " to:", toKey ?? "(none)");
    console.log("[DateFilter] total records before filter:", dailyReports.length);

    const result = dailyReports.filter((report) => {
      if (filterBranches.length > 0 && !filterBranches.includes(report.branch)) return false;
      if (!fromKey) return true;

      const reportStart = report.date.slice(0, 10);
      const reportEnd   = (report.dateRangeEnd ?? report.date).slice(0, 10);

      // Keep the report if its date range overlaps with the selected filter range.
      // Overlap condition: reportStart <= toKey  AND  reportEnd >= fromKey
      return reportStart <= toKey! && reportEnd >= fromKey;
    });

    console.log(
      "[DateFilter] records after filter:", result.length,
      result.map((r) => `${r.date}→${r.dateRangeEnd ?? r.date} (${r.branch})`),
    );

    return result;
  }, [dailyReports, filterBranches, fromKey, toKey]);

  // Prefer the full detail (rowDetails + unmappedSummary loaded on demand).
  // Fall back to the lightweight list entry while the detail query is in flight
  // so the header, stats, and summary table render immediately on click.
  const activeReportMeta = useMemo(
    () => filteredReports.find((r) => r.id === activeReportId) || null,
    [filteredReports, activeReportId],
  );
  const activeReport = activeReportDetail ?? activeReportMeta;

  /**
   * Combined totals across all filtered reports.
   * Each report's contribution is limited to rows within the selected date
   * range via `getEffectiveTotals`, so narrowing the date range immediately
   * recalculates every KPI card and the Filtered Totals table.
   */
  const combinedSummaryForFilters = useMemo(() => {
    if (!filteredReports.length) return null;

    const combinedTotals: Record<string, number> = {};
    const combinedQuantities: Record<string, number> = {};
    let grandTotal = 0;
    let grandQuantity = 0;
    CATEGORIES.forEach((cat) => { combinedTotals[cat] = 0; combinedQuantities[cat] = 0; });

    for (const report of filteredReports) {
      const eff = getEffectiveTotals(report);
      CATEGORIES.forEach((cat) => {
        combinedTotals[cat]    += (eff.totals[cat]    || 0);
        combinedQuantities[cat]+= (eff.quantities[cat]|| 0);
      });
      grandTotal    += eff.grandTotal;
      grandQuantity += eff.grandQuantity;
    }

    const percents: Record<string, number> = {};
    CATEGORIES.forEach((cat) => {
      percents[cat] = grandTotal > 0 ? (combinedTotals[cat] / grandTotal) * 100 : 0;
    });

    console.log("[DateFilter] filtered total sales:", grandTotal);

    return { totals: combinedTotals, quantities: combinedQuantities, grandTotal, grandQuantity, percents };
  }, [filteredReports, getEffectiveTotals]);

  const allBranchesBreakdown = useMemo(() => {
    if (!filteredReports.length) return null;
    if (filterBranches.length === 1) return null;

    const byBranch = new Map<BranchId, {
      branchId: BranchId;
      branchName: string;
      totals: Record<Category, number>;
      quantities: Record<Category, number>;
      grandTotal: number;
      grandQuantity: number;
    }>();

    filteredReports.forEach((report) => {
      const eff = getEffectiveTotals(report);
      const existing = byBranch.get(report.branch);
      const branchName = getBranchLabel(report.branch);

      if (!existing) {
        const totalsInit = {} as Record<Category, number>;
        const quantitiesInit = {} as Record<Category, number>;
        CATEGORIES.forEach((cat) => {
          totalsInit[cat]    = eff.totals[cat]    || 0;
          quantitiesInit[cat]= eff.quantities[cat]|| 0;
        });
        byBranch.set(report.branch, {
          branchId: report.branch,
          branchName,
          totals: totalsInit,
          quantities: quantitiesInit,
          grandTotal: eff.grandTotal,
          grandQuantity: eff.grandQuantity,
        });
      } else {
        CATEGORIES.forEach((cat) => {
          existing.totals[cat]    = (existing.totals[cat]    || 0) + (eff.totals[cat]    || 0);
          existing.quantities[cat]= (existing.quantities[cat]|| 0) + (eff.quantities[cat]|| 0);
        });
        existing.grandTotal    += eff.grandTotal;
        existing.grandQuantity += eff.grandQuantity;
      }
    });

    return Array.from(byBranch.values()).sort((a, b) =>
      a.branchName.localeCompare(b.branchName),
    );
  }, [filteredReports, filterBranches, getEffectiveTotals, getBranchLabel]);

  const branchFilterLabel = useMemo(() => {
    if (filterBranches.length === 0) return "All branches";
    if (filterBranches.length === 1) return getBranchLabel(filterBranches[0]);
    return `${filterBranches.length} branches`;
  }, [filterBranches, getBranchLabel]);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const kpiData = useMemo(() => ({
    totalSales: combinedSummaryForFilters?.grandTotal ?? 0,
    reportCount: filteredReports.length,
    icedSales: (combinedSummaryForFilters?.totals["ICED"] ?? 0) as number,
    hotSales: (combinedSummaryForFilters?.totals["HOT"] ?? 0) as number,
    snacksSales: (combinedSummaryForFilters?.totals["SNACKS"] ?? 0) as number,
    uniqueBranches: new Set(filteredReports.map((r) => r.branch)).size,
  }), [combinedSummaryForFilters, filteredReports]);

  const previousCombined = useMemo(() => {
    if (compareMode !== "previous") return null;
    const reports = previousReportsPage?.reports ?? [];
    if (!reports.length || !previousPeriodKeys) return null;

    const totals: Record<string, number> = {};
    CATEGORIES.forEach((cat) => { totals[cat] = 0; });
    let grandTotal = 0;
    const byBranch = new Map<string, number>();

    for (const report of reports) {
      if (filterBranches.length > 0 && !filterBranches.includes(report.branch)) continue;
      grandTotal += report.grandTotal;
      CATEGORIES.forEach((cat) => {
        totals[cat] = (totals[cat] || 0) + (report.summaryTotalsByCat[cat] || 0);
      });
      byBranch.set(report.branch, (byBranch.get(report.branch) || 0) + report.grandTotal);
    }

    return { totals, grandTotal, byBranch };
  }, [compareMode, previousReportsPage, previousPeriodKeys, filterBranches]);

  const reportStatus = useMemo(() => {
    let complete = 0;
    let pending = 0;
    let review = 0;
    for (const report of filteredReports) {
      if ((report.unmappedRows ?? 0) > 0) review += 1;
      else if ((report.skippedRows ?? 0) > 0) pending += 1;
      else complete += 1;
    }
    return { complete, pending, review };
  }, [filteredReports]);

  const branchDirectoryStats = useMemo(() => {
    const items = directoryBranches?.items ?? [];
    const inactive = items.filter((b) => !b.isActive).length;
    const withSales = kpiData.uniqueBranches;
    return {
      total: items.length || withSales,
      activeToday: withSales,
      inactive,
    };
  }, [directoryBranches, kpiData.uniqueBranches]);

  const lastUpdatedLabel = useMemo(() => {
    const stamps = dailyReports
      .map((r) => r.updatedAt ?? r.uploadedAt)
      .filter((n): n is number => typeof n === "number" && n > 0);
    if (!stamps.length) return null;
    return format(new Date(Math.max(...stamps)), "MMM d, yyyy • h:mm a");
  }, [dailyReports]);

  const salesPoints = useMemo(() => {
    const buckets = new Map<string, { label: string; value: number }>();
    for (const report of filteredReports) {
      const dateStr = report.date.slice(0, 10);
      const date = new Date(`${dateStr}T00:00:00`);
      if (Number.isNaN(date.getTime())) continue;
      const eff = getEffectiveTotals(report);
      let key = dateStr;
      let label = format(date, "MMM d");
      if (chartGranularity === "weekly") {
        const start = startOfWeek(date, { weekStartsOn: 1 });
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        key = format(start, "yyyy-MM-dd");
        label = `${format(start, "MMM d")}–${format(end, "d")}`;
      } else if (chartGranularity === "monthly") {
        const start = startOfMonth(date);
        key = format(start, "yyyy-MM");
        label = format(start, "MMM yyyy");
      }
      const existing = buckets.get(key);
      if (existing) existing.value += eff.grandTotal;
      else buckets.set(key, { label, value: eff.grandTotal });
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, bucket]) => ({ key, ...bucket }));
  }, [filteredReports, chartGranularity, getEffectiveTotals]);

  const topBranchRows = useMemo(() => {
    if (!allBranchesBreakdown) return [];
    const total = combinedSummaryForFilters?.grandTotal || 0;
    return [...allBranchesBreakdown]
      .sort((a, b) => b.grandTotal - a.grandTotal)
      .slice(0, 5)
      .map((row) => ({
        id: row.branchId,
        name: row.branchName,
        sales: row.grandTotal,
        share: total > 0 ? (row.grandTotal / total) * 100 : 0,
      }));
  }, [allBranchesBreakdown, combinedSummaryForFilters]);

  const categorySlices = useMemo(() => {
    if (!combinedSummaryForFilters) return [];
    return CATEGORIES.map((cat) => ({
      key: cat,
      value: (combinedSummaryForFilters.totals[cat] || 0) as number,
      percent: (combinedSummaryForFilters.percents[cat] || 0) as number,
    }));
  }, [combinedSummaryForFilters]);

  const branchTableRows = useMemo(() => {
    if (!allBranchesBreakdown) return [];
    const total = combinedSummaryForFilters?.grandTotal || 0;
    return [...allBranchesBreakdown]
      .sort((a, b) => b.grandTotal - a.grandTotal)
      .map((row) => {
        const prev = previousCombined?.byBranch.get(row.branchId) ?? null;
        const change = compareMode === "previous" && prev != null
          ? getPercentChange(prev, row.grandTotal)
          : getPercentChange(null, row.grandTotal);
        return {
          id: row.branchId,
          name: row.branchName,
          totals: row.totals,
          grandTotal: row.grandTotal,
          share: total > 0 ? (row.grandTotal / total) * 100 : 0,
          trendTone: change.tone,
          trendLabel: change.label,
        };
      });
  }, [allBranchesBreakdown, combinedSummaryForFilters, previousCombined, compareMode]);

  const salesTrend = getPercentChange(
    compareMode === "previous" ? previousCombined?.grandTotal ?? null : null,
    kpiData.totalSales,
  );
  const icedTrend = getPercentChange(
    compareMode === "previous" ? previousCombined?.totals["ICED"] ?? null : null,
    kpiData.icedSales,
  );
  const hotTrend = getPercentChange(
    compareMode === "previous" ? previousCombined?.totals["HOT"] ?? null : null,
    kpiData.hotSales,
  );
  const snacksTrend = getPercentChange(
    compareMode === "previous" ? previousCombined?.totals["SNACKS"] ?? null : null,
    kpiData.snacksSales,
  );

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
        filteredTotalsRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    },
    [selectedMonthKey, previousDateRange, filterDateRange],
  );

  const dateFilterLabel = filterDateRange.from
    ? filterDateRange.to
      ? `${format(filterDateRange.from, "MMM d")} – ${format(filterDateRange.to, "MMM d, yyyy")}`
      : format(filterDateRange.from, "MMM d, yyyy")
    : "All dates";

  const icedShare = kpiData.totalSales > 0 ? (kpiData.icedSales / kpiData.totalSales) * 100 : 0;
  const hotShare = kpiData.totalSales > 0 ? (kpiData.hotSales / kpiData.totalSales) * 100 : 0;
  const snacksShare = kpiData.totalSales > 0 ? (kpiData.snacksSales / kpiData.totalSales) * 100 : 0;

  return (
    <div className="overflow-x-hidden pb-8">
      <div className="mx-auto max-w-[1600px] space-y-6 px-5 py-6 sm:px-8 lg:px-10">
        <FilterBar
          dateControl={
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <FilterTriggerButton icon={Calendar} className="min-w-[200px]">
                    {dateFilterLabel}
                  </FilterTriggerButton>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 max-w-[95vw]" align="start">
                  <CalendarUI
                    mode="range"
                    selected={filterDateRange}
                    onSelect={(range) =>
                      setFilterDateRange(range || { from: undefined, to: undefined })
                    }
                    className="p-2 sm:p-3 pointer-events-auto rounded-2xl"
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
              {selectedMonthKey && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-[#F4F0E5] px-3 py-1 text-xs font-medium text-[#172B4D]"
                  onClick={() => handleMonthSelect(selectedMonthKey)}
                >
                  Month: {formatMonthDisplay(selectedMonthKey)}
                  <span aria-hidden>×</span>
                </button>
              )}
            </div>
          }
          branchControl={
            <Popover>
              <PopoverTrigger asChild>
                <FilterTriggerButton icon={Building2} className="min-w-[160px]" disabled={isLoadingBranches}>
                  {filterBranches.length === 0 ? "All Branches" : branchFilterLabel}
                </FilterTriggerButton>
              </PopoverTrigger>
              <PopoverContent className="w-[92vw] sm:w-[280px] p-3 rounded-2xl" align="start">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-card-foreground">Branches</p>
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
                <div className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/40">
                  <Checkbox
                    checked={filterBranches.length === 0}
                    onCheckedChange={(checked) => {
                      if (checked) setFilterBranches([]);
                    }}
                  />
                  <button
                    type="button"
                    className="flex-1 text-left text-sm text-card-foreground"
                    onClick={() => setFilterBranches([])}
                  >
                    All branches
                  </button>
                </div>
                <div className="mt-2 max-h-[260px] overflow-auto pr-1">
                  <GroupedBranchCheckboxList
                    options={branchOptions}
                    selectedIds={filterBranches}
                    getItemId={(branch) => branch.slug}
                    onToggleGroup={(ids, select) => {
                      setFilterBranches(mergeSelectedIds(filterBranches, ids, select) as BranchId[]);
                    }}
                    renderItem={(branch) => {
                      const id = branch.slug as BranchId;
                      const isChecked = filterBranches.includes(id);
                      return (
                        <div key={branch.slug} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/40">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              setFilterBranches((prev) => {
                                if (checked) return prev.includes(id) ? prev : [...prev, id];
                                return prev.filter((b) => b !== id);
                              });
                            }}
                          />
                          <button
                            type="button"
                            className="flex-1 text-left text-sm text-card-foreground"
                            onClick={() => {
                              setFilterBranches((prev) =>
                                prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
                              );
                            }}
                          >
                            {branch.label}
                          </button>
                        </div>
                      );
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          }
          compareControl={
            <Select value={compareMode} onValueChange={(v) => setCompareMode(v as "previous" | "none")}>
              <SelectTrigger className="h-10 w-[210px] rounded-xl border-border bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="previous">Compare: Previous Period</SelectItem>
                <SelectItem value="none">Compare: Off</SelectItem>
              </SelectContent>
            </Select>
          }
          lastUpdatedLabel={lastUpdatedLabel}
          onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.reports.dailyRoot })}
          isRefreshing={isRefreshingReports}
          onAddData={handleOpenAddModal}
          canAddData={canAddData(role)}
          extraActions={
            <Button
              variant="outline"
              className="relative h-10 rounded-xl border-border bg-white px-3.5"
              onClick={() => setIsHistoryOpen(true)}
            >
              <Clock className="h-4 w-4" />
              History
              {dailyReports.length > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                  {dailyReports.length}
                </span>
              )}
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <StatCard
            label="Total Sales"
            value={formatCompactPHP(kpiData.totalSales)}
            hint={`Across ${kpiData.uniqueBranches} branch${kpiData.uniqueBranches === 1 ? "" : "es"}`}
            trendLabel={compareMode === "previous" ? `${salesTrend.label} vs previous period` : undefined}
            trendTone={salesTrend.tone}
            icon={TrendingUp}
          />
          <StatCard
            label="Reports"
            value={String(kpiData.reportCount)}
            hint={`${reportStatus.complete} complete · ${reportStatus.pending} pending · ${reportStatus.review} review`}
            icon={FileText}
            iconClassName="text-[#A67C52]"
            iconWrapClassName="bg-[#F4EDE3]"
          />
          <StatCard
            label="Iced Sales"
            value={formatCompactPHP(kpiData.icedSales)}
            hint={`${icedShare.toFixed(2)}% of total sales`}
            trendLabel={compareMode === "previous" ? icedTrend.label : undefined}
            trendTone={icedTrend.tone}
            icon={Snowflake}
          />
          <StatCard
            label="Hot Sales"
            value={formatCompactPHP(kpiData.hotSales)}
            hint={`${hotShare.toFixed(2)}% of total sales`}
            trendLabel={compareMode === "previous" ? hotTrend.label : undefined}
            trendTone={hotTrend.tone}
            icon={Flame}
            iconClassName="text-[#F7652B]"
            iconWrapClassName="bg-orange-50"
          />
          <StatCard
            label="Snacks Sales"
            value={formatCompactPHP(kpiData.snacksSales)}
            hint={`${snacksShare.toFixed(2)}% of total sales`}
            trendLabel={compareMode === "previous" ? snacksTrend.label : undefined}
            trendTone={snacksTrend.tone}
            icon={ShoppingBag}
            iconClassName="text-[#7450C8]"
            iconWrapClassName="bg-violet-50"
          />
          <StatCard
            label="Branches"
            value={String(branchDirectoryStats.total)}
            hint={`${branchDirectoryStats.activeToday} active today · ${branchDirectoryStats.inactive} inactive`}
            icon={Building2}
            iconClassName="text-[#2997A8]"
            iconWrapClassName="bg-teal-50"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-6">
            <SalesOverview
              totalLabel="Total Sales"
              totalValue={formatCompactPHP(kpiData.totalSales)}
              trendLabel={compareMode === "previous" ? salesTrend.label : undefined}
              trendPositive={salesTrend.tone === "positive"}
              granularity={chartGranularity}
              onGranularityChange={setChartGranularity}
              points={salesPoints}
            />
          </div>
          <div className="xl:col-span-3">
            <TopBranches branches={topBranchRows} />
          </div>
          <div className="xl:col-span-3">
            <CategoryBreakdown slices={categorySlices} total={kpiData.totalSales} />
          </div>
        </div>

        <div ref={filteredTotalsRef}>
          <BranchPerformanceTable rows={branchTableRows} />
        </div>

        {combinedSummaryForFilters && filteredReports.length > 0 && (
          <div className="saas-card p-4 sm:p-6">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Detailed breakdown
            </p>
            <SummaryTable
              mode="single"
              totals={combinedSummaryForFilters.totals as any}
              quantities={combinedSummaryForFilters.quantities as any}
              grandTotal={combinedSummaryForFilters.grandTotal}
              grandQuantity={combinedSummaryForFilters.grandQuantity}
              percents={combinedSummaryForFilters.percents as any}
              branchLabel={
                filterBranches.length === 0
                  ? "All Branches"
                  : filterBranches.length === 1
                    ? getBranchLabel(filterBranches[0])
                    : `${filterBranches.length} Branches`
              }
              branchBreakdown={allBranchesBreakdown ?? undefined}
            />
          </div>
        )}

        {activeReport && (
          <div className="saas-card p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="mb-2 text-xl font-semibold text-[#172B4D]">
                  Report preview — {activeReport.date}
                </h2>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-primary">{getBranchLabel(activeReport.branch)}</span>
                  <span>File: <span className="font-medium text-foreground">{activeReport.filename}</span></span>
                  <span>Rows: <span className="font-medium text-foreground">{activeReport.totalRows}</span></span>
                  <span className="text-emerald-600">Mapped: {activeReport.mappedRows}</span>
                  <span className="text-amber-600">Unmapped: {activeReport.unmappedRows}</span>
                  <span>Skipped: {activeReport.skippedRows}</span>
                  <span className="font-semibold text-primary">Total: ₱{formatNumber(activeReport.grandTotal)}</span>
                </div>
              </div>
              {canDeleteData(role) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRequestDeleteReport(activeReport.id)}
                  className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                >
                  Delete data
                </Button>
              )}
            </div>
            <div className="space-y-6">
              <SummaryTable
                mode="single"
                totals={activeReport.summaryTotalsByCat}
                quantities={activeReport.summaryQuantitiesByCat}
                grandTotal={activeReport.grandTotal}
                grandQuantity={activeReport.grandQuantity}
                percents={activeReport.percentByCat}
                branchLabel={getBranchLabel(activeReport.branch)}
              />
              {isLoadingDetail ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  Loading transaction details…
                </div>
              ) : (
                <>
                  <DetailsTable rows={activeReport.rowDetails} />
                  <UnmappedList items={activeReport.unmappedSummary} />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── History drawer ────────────────────────────────────────────────── */}
      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[420px] p-0 flex flex-col bg-white"
        >
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base font-bold">
              <Clock className="h-4 w-4 text-primary" />
              Daily History
              {dailyReports.length > 0 && (
                <span className="ml-auto text-xs font-semibold text-muted-foreground">
                  {dailyReports.length} report{dailyReports.length !== 1 ? "s" : ""}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <DailyHistoryList
              reports={filteredReports}
              activeReportId={activeReportId}
              onSelect={(id) => {
                setActiveReportId(id);
                setIsHistoryOpen(false);
              }}
              viewMode="daily"
              selectedMonth={selectedMonthKey ?? ""}
              onMonthSelect={(key) => {
                handleMonthSelect(key);
                setIsHistoryOpen(false);
              }}
              onDelete={canDeleteData(role) ? handleRequestDeleteReport : undefined}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ADD REPORT Modal */}
      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseAddModal();
        }}
      >
        <DialogContent
          className="w-[95vw] max-w-2xl sm:max-w-3xl rounded-[20px] border border-border bg-white px-4 py-5 text-[#172B4D] shadow-card sm:px-6 lg:px-8 sm:py-7 pointer-events-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.body.style.pointerEvents = "";
          }}
          onPointerDownOutside={(event) => {
            if (isGenerating) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (isGenerating) event.preventDefault();
          }}
        >
          <DialogHeader className="mb-3 border-b border-border pb-4">
            <DialogTitle className="text-2xl font-semibold tracking-tight">Add new report</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Select Branch — native <select> avoids Radix Select+Dialog pointer-events bugs */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#172B4D]">Select branch</p>
              <select
                value={modalBranch}
                disabled={isGenerating || isLoadingBranches}
                onChange={(e) => setModalBranch(e.target.value as BranchId)}
                className="h-11 w-full rounded-[10px] border border-border bg-white px-4 text-sm font-medium text-[#172B4D] outline-none focus:ring-2 focus:ring-ring disabled:opacity-70"
              >
                <option value="" disabled>
                  {isLoadingBranches ? "Loading branches…" : "Choose a branch"}
                </option>
                <GroupedBranchOptGroups
                  options={branchOptions.map((branch) => ({
                    value: branch.slug,
                    label: branch.label,
                    category: branch.category,
                  }))}
                />
              </select>
            </div>

            {/* Upload CSV */}
            <div className="space-y-3 pb-1">
              <p className="text-sm font-medium text-[#172B4D]">Upload transactions CSV</p>
              <label
                className={cn(
                  "flex items-center justify-between rounded-[12px] border border-dashed border-border bg-[#F7F4EE] px-5 py-3 text-[#172B4D] transition-colors",
                  isGenerating
                    ? "cursor-not-allowed opacity-70"
                    : "cursor-pointer hover:bg-[#F0EBE3]",
                )}
              >
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium truncate max-w-[260px]">
                    {modalFile ? modalFile.name : "Choose CSV file"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Only .csv files are supported
                  </span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Browse
                </span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  disabled={isGenerating}
                  onChange={handleModalFileChange}
                />
              </label>
              {modalCsvHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Detected {modalCsvHeaders.length} columns
                  {modalFile ? ` · ${modalCsvData.length.toLocaleString()} rows` : ""} from the
                  uploaded file.
                </p>
              )}
              {generateBlockedReason && modalFile && (
                <p className="text-xs text-red-600">{generateBlockedReason}</p>
              )}
              {detectedDateRange.from && !dateDetectionError && (
                <p className="text-xs text-muted-foreground">
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
                <p className="text-xs text-red-600">
                  {dateDetectionError}
                </p>
              )}
              {isGenerating && (
                <p className="text-xs text-muted-foreground">
                  Processing transactions… large month files can take a few seconds.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-7 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseAddModal}
              disabled={isSaving || isGenerating}
              className="rounded-[10px] border-border bg-white text-[#172B4D] hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmitReport()}
              disabled={!canGenerate || isSaving || isGenerating}
              title={generateBlockedReason ?? undefined}
              className="rounded-[10px] bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {isGenerating ? "Generating…" : "Generate Report"}
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
        <DialogContent className="max-w-md rounded-[20px] border border-border bg-white text-[#172B4D] shadow-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Delete this data?
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-muted-foreground">
              This will permanently remove the uploaded dataset and recomputed results for:
            </p>
            {reportPendingDelete && (
              <div className="space-y-1.5 rounded-[14px] bg-[#F7F4EE] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Summary
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Branch:</span>{" "}
                  {getBranchLabel(reportPendingDelete.branch)}
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
              className="rounded-[10px] border-border bg-white px-6 text-[#172B4D] hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteReport}
              disabled={isDeleting}
              className="rounded-[10px] px-6 font-semibold"
            >
              {isDeleting ? "Deleting…" : "Delete data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[96vw] max-w-[1200px] max-h-[90vh] rounded-2xl bg-white text-slate-900 border border-[#E2E8F0] shadow-2xl px-3 sm:px-5 lg:px-6 py-4 sm:py-5 flex flex-col">
          <DialogHeader className="pb-3 border-b border-border/60 mb-4">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Preview report
            </DialogTitle>
            {previewReport && (
              <p className="text-sm text-muted-foreground mt-1">
                {getBranchLabel(previewReport.branch)} •{" "}
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
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 sm:space-y-5 min-w-0">
              {/* Top summary strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 px-1">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-[0.16em] uppercase text-muted-foreground">
                    Branch
                  </p>
                  <p className="text-base font-semibold">
                    {getBranchLabel(previewReport.branch)}
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
                <div className="w-full sm:w-auto sm:ml-auto">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm text-left sm:text-right min-w-0 sm:min-w-[180px]">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#64748B]">
                      Total sales
                    </p>
                    <p className="text-xl sm:text-2xl font-extrabold text-[#2B67B2]">
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
                  branchLabel={getBranchLabel(previewReport.branch)}
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


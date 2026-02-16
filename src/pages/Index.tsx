import { useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { Calendar, Upload, FileSpreadsheet, Trash2, Coffee, MapPin, AlertCircle, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import SummaryTable from "@/components/SummaryTable";
import DailyHistoryList from "@/components/DailyHistoryList";
import DetailsTable from "@/components/DetailsTable";
import UnmappedList from "@/components/UnmappedList";
import ColumnMapperModal from "@/components/ColumnMapperModal";
import MonthPicker from "@/components/MonthPicker";
import MonthlySummaryTable from "@/components/MonthlySummaryTable";
import DailyBreakdownTable from "@/components/DailyBreakdownTable";
import MonthlyUnmappedList from "@/components/MonthlyUnmappedList";

import { parseCsvFile, autoDetectColumns } from "@/utils/parseCsv";
import { normalizeText } from "@/utils/normalize";
import { mapRow } from "@/utils/mapRow";
import { aggregateByCategory, getUnmappedSummary } from "@/utils/aggregate";
import { formatNumber } from "@/utils/format";
import { DEFAULT_MAPPING } from "@/utils/defaultMapping";
import { computeMonthlyReport, getMonthKey } from "@/utils/aggregateMonthly";
import type { DailyReport, MappingEntry, ColumnMapping, RawRow, BranchId, ViewMode } from "@/utils/types";
import { CATEGORIES, BRANCHES } from "@/utils/types";

const Index = () => {
  // Main view mode: Daily or Monthly
  const [mainViewMode, setMainViewMode] = useState<ViewMode>("daily");
  
  // Daily mode state
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [selectedBranch, setSelectedBranch] = useState<BranchId | "">("");
  const [mappingTable, setMappingTable] = useState<MappingEntry[]>(DEFAULT_MAPPING);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"single" | "combined">("single"); // single branch or all branches
  const [branchError, setBranchError] = useState(false);
  
  // Monthly mode state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthlyBranchFilter, setMonthlyBranchFilter] = useState<BranchId | "all">("all");

  // CSV file state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [showMapper, setShowMapper] = useState(false);
  const [autoMapping, setAutoMapping] = useState<Partial<Record<string, string>>>({});

  const activeReport = dailyReports.find(r => r.id === activeReportId) || null;

  const handleCsvUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check if branch is selected
    if (!selectedBranch) {
      setBranchError(true);
      e.target.value = "";
      return;
    }
    
    setBranchError(false);
    setCsvFile(file);
    try {
      const { headers, data } = await parseCsvFile(file);
      setCsvHeaders(headers);
      setCsvData(data);
      const detected = autoDetectColumns(headers);
      setAutoMapping(detected);
      // If all required fields detected, don't show mapper
      const required = ["rawCategory", "rawItemName", "quantity", "unitPrice"];
      const allDetected = required.every(f => detected[f]);
      if (!allDetected) setShowMapper(true);
    } catch {
      alert("Failed to parse CSV file");
    }
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  }, [selectedBranch]);

  const handleMappingUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data } = await parseCsvFile(file);
      const entries: MappingEntry[] = data
        .filter(r => r.CAT && r.UTAK)
        .map(r => ({
          CAT: r.CAT?.trim() || "",
          ITEM_NAME: r.ITEM_NAME?.trim() || r.CAT?.trim() || "",
          UTAK: r.UTAK?.trim() || "",
          utakNorm: normalizeText(r.UTAK),
        }));
      if (entries.length > 0) setMappingTable(entries);
    } catch {
      alert("Failed to parse mapping CSV");
    }
    e.target.value = "";
  }, []);

  const compute = useCallback((colMapping?: ColumnMapping) => {
    if (!dateRange.from || csvData.length === 0 || !selectedBranch) return;

    // If no end date, use start date as end date
    const endDate = dateRange.to || dateRange.from;
    
    const dateStr = format(dateRange.from, "yyyy-MM-dd");
    const mapping = colMapping || {
      rawCategory: autoMapping.rawCategory || "",
      rawItemName: autoMapping.rawItemName || "",
      option: autoMapping.option || "",
      quantity: autoMapping.quantity || "",
      unitPrice: autoMapping.unitPrice || "",
    };

    const rawRows: RawRow[] = csvData.map(row => ({
      rawCategory: row[mapping.rawCategory] || "",
      rawItemName: row[mapping.rawItemName] || "",
      option: mapping.option ? (row[mapping.option] || "") : "",
      quantity: parseFloat(row[mapping.quantity]) || 0,
      unitPrice: parseFloat(row[mapping.unitPrice]) || 0,
    }));

    const processed = rawRows.map(r => mapRow(r, mappingTable));
    const { totals, quantities, grandTotal, grandQuantity, percents } = aggregateByCategory(processed);
    const unmappedSummary = getUnmappedSummary(processed);

    const reportId = `${dateStr}-${selectedBranch}`;
    const report: DailyReport = {
      id: reportId,
      date: dateStr,
      branch: selectedBranch,
      filename: csvFile?.name || "unknown.csv",
      uploadedAt: Date.now(),
      totalRows: processed.length,
      mappedRows: processed.filter(r => r.status === "MAPPED").length,
      unmappedRows: processed.filter(r => r.status === "UNMAPPED").length,
      skippedRows: processed.filter(r => r.status === "SKIPPED").length,
      summaryTotalsByCat: totals,
      summaryQuantitiesByCat: quantities,
      grandTotal,
      grandQuantity,
      percentByCat: percents,
      rowDetails: processed,
      unmappedSummary,
    };

    setDailyReports(prev => {
      // Replace if same date + branch exists
      const without = prev.filter(r => r.id !== reportId);
      return [report, ...without].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return a.branch.localeCompare(b.branch);
      });
    });
    setActiveReportId(reportId);
    setViewMode("single");
    setShowMapper(false);
  }, [dateRange, selectedBranch, csvData, csvFile, autoMapping, mappingTable]);

  const handleColumnConfirm = useCallback((colMapping: ColumnMapping) => {
    setAutoMapping({
      rawCategory: colMapping.rawCategory,
      rawItemName: colMapping.rawItemName,
      option: colMapping.option,
      quantity: colMapping.quantity,
      unitPrice: colMapping.unitPrice,
    });
    compute(colMapping);
  }, [compute]);

  const canCompute = dateRange.from && csvData.length > 0 && selectedBranch;

  const clearSession = () => {
    setDailyReports([]);
    setActiveReportId(null);
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setDateRange({ from: undefined, to: undefined });
    setSelectedBranch("");
    setBranchError(false);
    setViewMode("single");
  };

  // Get combined report for a specific date (all branches)
  const getCombinedReport = useCallback((date: string): DailyReport | null => {
    const reportsForDate = dailyReports.filter(r => r.date === date);
    if (reportsForDate.length === 0) return null;
    if (reportsForDate.length === 1) return reportsForDate[0];

    // Merge all reports for this date
    const combinedTotals = { ...reportsForDate[0].summaryTotalsByCat };
    const combinedQuantities = { ...reportsForDate[0].summaryQuantitiesByCat };
    let grandTotal = 0;
    let grandQuantity = 0;
    let totalRows = 0;
    let mappedRows = 0;
    let unmappedRows = 0;
    let skippedRows = 0;
    const allRows: typeof reportsForDate[0]["rowDetails"] = [];
    const unmappedMap = new Map<string, { count: number; totalSales: number }>();

    reportsForDate.forEach(report => {
      CATEGORIES.forEach(cat => {
        combinedTotals[cat] = (combinedTotals[cat] || 0) + (report.summaryTotalsByCat[cat] || 0);
        combinedQuantities[cat] = (combinedQuantities[cat] || 0) + (report.summaryQuantitiesByCat[cat] || 0);
      });
      grandTotal += report.grandTotal;
      grandQuantity += report.grandQuantity;
      totalRows += report.totalRows;
      mappedRows += report.mappedRows;
      unmappedRows += report.unmappedRows;
      skippedRows += report.skippedRows;
      allRows.push(...report.rowDetails);
      
      report.unmappedSummary.forEach(item => {
        const existing = unmappedMap.get(item.rawItemName);
        if (existing) {
          existing.count += item.count;
          existing.totalSales += item.totalSales;
        } else {
          unmappedMap.set(item.rawItemName, { count: item.count, totalSales: item.totalSales });
        }
      });
    });

    const combinedPercents = { ...reportsForDate[0].percentByCat };
    CATEGORIES.forEach(cat => {
      combinedPercents[cat] = grandTotal > 0 ? (combinedTotals[cat] / grandTotal) * 100 : 0;
    });

    const unmappedSummary = Array.from(unmappedMap.entries()).map(([rawItemName, data]) => ({
      rawItemName,
      count: data.count,
      totalSales: data.totalSales,
    }));

    return {
      id: `${date}-combined`,
      date,
      branch: "greenbelt" as BranchId, // placeholder
      filename: `Combined (${reportsForDate.length} branches)`,
      uploadedAt: Math.max(...reportsForDate.map(r => r.uploadedAt)),
      totalRows,
      mappedRows,
      unmappedRows,
      skippedRows,
      summaryTotalsByCat: combinedTotals,
      summaryQuantitiesByCat: combinedQuantities,
      grandTotal,
      grandQuantity,
      percentByCat: combinedPercents,
      rowDetails: allRows,
      unmappedSummary,
    };
  }, [dailyReports]);

  // Get the display report based on view mode
  const displayReport = activeReport && viewMode === "combined" 
    ? getCombinedReport(activeReport.date) 
    : activeReport;

  // Compute monthly report
  const monthlyReport = useMemo(() => {
    if (mainViewMode !== "monthly") return null;
    return computeMonthlyReport(dailyReports, selectedMonth, monthlyBranchFilter);
  }, [mainViewMode, dailyReports, selectedMonth, monthlyBranchFilter]);

  // Handle month selection from history
  const handleMonthSelect = useCallback((monthKey: string) => {
    setSelectedMonth(monthKey);
    setMainViewMode("monthly");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER - Royal Blue with White Text */}
      <header className="bg-primary sticky top-0 z-20 shadow-md">
        <div className="max-w-[1600px] mx-auto px-8 py-5">
          <div className="flex items-center gap-4 mb-5">
            <Coffee className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
            <h1 className="text-2xl font-bold tracking-tight text-primary-foreground">DOT Coffee Daily Summary</h1>
            <span className="text-xs px-3 py-1 rounded-full border-2 border-primary-foreground/70 text-primary-foreground font-semibold">
              MVP
            </span>
            
            {/* View Mode Toggle */}
            <ToggleGroup 
              type="single" 
              value={mainViewMode} 
              onValueChange={(value) => value && setMainViewMode(value as ViewMode)}
              className="ml-4"
            >
              <ToggleGroupItem 
                value="daily" 
                className="px-4 py-2 rounded-full border-2 border-primary-foreground/70 data-[state=on]:bg-primary-foreground data-[state=on]:text-primary text-primary-foreground"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Daily Summary
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="monthly" 
                className="px-4 py-2 rounded-full border-2 border-primary-foreground/70 data-[state=on]:bg-primary-foreground data-[state=on]:text-primary text-primary-foreground"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Monthly Summary
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* DAILY MODE CONTROLS */}
            {mainViewMode === "daily" && (
              <>
                {/* Date Range Picker - Pill Style */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "px-5 py-2.5 h-auto rounded-full bg-transparent border-2 border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground transition-all",
                        !dateRange.from && "text-primary-foreground/70"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "MMM dd, yyyy")} — {format(dateRange.to, "MMM dd, yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "MMM dd, yyyy")
                        )
                      ) : (
                        "Select date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                      className="p-3 pointer-events-auto rounded-2xl"
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>

                {/* Branch Selector - Pill Style */}
                <Select value={selectedBranch} onValueChange={(value) => {
                  setSelectedBranch(value as BranchId);
                  setBranchError(false);
                }}>
                  <SelectTrigger className={cn(
                    "w-[200px] px-5 py-2.5 h-auto rounded-full bg-transparent border-2 text-primary-foreground hover:bg-primary-foreground/10 transition-all",
                    branchError ? "border-red-400" : "border-primary-foreground/70",
                    !selectedBranch && "text-primary-foreground/70"
                  )}>
                    <MapPin className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Branch Error Message */}
                {branchError && (
                  <span className="flex items-center gap-1 text-red-300 text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Select branch first
                  </span>
                )}

                {/* CSV Upload - Pill Style */}
                <label className="flex items-center gap-3 px-5 py-2.5 rounded-full border-2 border-primary-foreground/70 bg-transparent text-primary-foreground cursor-pointer hover:bg-primary-foreground/10 transition-all">
                  <Upload className="h-4 w-4" />
                  {csvFile ? (
                    <span className="max-w-[180px] truncate font-medium">{csvFile.name}</span>
                  ) : (
                    <span className="font-medium">Transactions CSV</span>
                  )}
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                </label>

                {/* Mapping Upload - Pill Style Dashed */}
                <label className="flex items-center gap-3 px-5 py-2.5 rounded-full border-2 border-dashed border-primary-foreground/50 bg-transparent text-primary-foreground/80 cursor-pointer hover:bg-primary-foreground/10 transition-all">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="font-medium text-sm">Mapping CSV</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleMappingUpload} />
                </label>

                {/* Compute Button - Solid White */}
                <Button
                  size="sm"
                  className="px-6 py-2.5 h-auto rounded-full bg-primary-foreground text-primary font-semibold hover:bg-primary-foreground/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canCompute}
                  onClick={() => {
                    const required = ["rawCategory", "rawItemName", "quantity", "unitPrice"];
                    const allDetected = required.every(f => autoMapping[f]);
                    if (allDetected) {
                      compute();
                    } else {
                      setShowMapper(true);
                    }
                  }}
                >
                  Compute
                </Button>
              </>
            )}

            {/* MONTHLY MODE CONTROLS */}
            {mainViewMode === "monthly" && (
              <>
                {/* Month Picker */}
                <MonthPicker
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                />

                {/* Branch Filter for Monthly */}
                <Select value={monthlyBranchFilter} onValueChange={(value) => setMonthlyBranchFilter(value as BranchId | "all")}>
                  <SelectTrigger className="w-[200px] px-5 py-2.5 h-auto rounded-full bg-transparent border-2 border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10 transition-all">
                    <MapPin className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {BRANCHES.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Mapping Upload - also available in monthly mode */}
                <label className="flex items-center gap-3 px-5 py-2.5 rounded-full border-2 border-dashed border-primary-foreground/50 bg-transparent text-primary-foreground/80 cursor-pointer hover:bg-primary-foreground/10 transition-all">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="font-medium text-sm">Mapping CSV</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleMappingUpload} />
                </label>
              </>
            )}

            {/* Clear Button */}
            {dailyReports.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="px-5 py-2.5 h-auto rounded-full ml-auto border-2 border-primary-foreground/70 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 transition-all"
                onClick={clearSession}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Session
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Blue Background with White Cards */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          {/* Left: History Sidebar - Compact */}
          <aside>
            <DailyHistoryList
              reports={dailyReports}
              activeReportId={activeReportId}
              onSelect={(id) => {
                setActiveReportId(id);
                setMainViewMode("daily");
              }}
              viewMode={mainViewMode}
              selectedMonth={selectedMonth}
              onMonthSelect={handleMonthSelect}
            />
          </aside>

          {/* Right: Report Panel - White Card */}
          <main className="min-w-0">
            {/* DAILY MODE VIEW */}
            {mainViewMode === "daily" && displayReport ? (
              <div className="bg-card rounded-3xl shadow-xl p-8">
                {/* Report header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-card-foreground mb-2">
                    Report for {dateRange.from && dateRange.to && dateRange.from.getTime() !== dateRange.to.getTime() ? (
                      <>
                        {format(dateRange.from, "MMM dd, yyyy")} — {format(dateRange.to, "MMM dd, yyyy")}
                      </>
                    ) : dateRange.from ? (
                      format(dateRange.from, "MMM dd, yyyy")
                    ) : (
                      displayReport.date
                    )}
                  </h2>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-primary">
                        {viewMode === "combined" 
                          ? "All Branches" 
                          : BRANCHES.find(b => b.id === displayReport.branch)?.label}
                      </span>
                    </span>
                    <span>File: <span className="font-medium text-card-foreground">{displayReport.filename}</span></span>
                    <span>Rows: <span className="font-semibold text-card-foreground">{displayReport.totalRows}</span></span>
                    <span className="text-emerald-600 font-medium">✓ Mapped: {displayReport.mappedRows}</span>
                    <span className="text-amber-600 font-medium">⚠ Unmapped: {displayReport.unmappedRows}</span>
                    <span>Skipped: {displayReport.skippedRows}</span>
                    <span className="font-bold text-primary text-lg">
                      Total: ₱{formatNumber(displayReport.grandTotal)}
                    </span>
                  </div>
                  
                  {/* View Mode Toggle */}
                  {dailyReports.filter(r => r.date === displayReport.date).length > 1 && (
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant={viewMode === "single" ? "default" : "outline"}
                        onClick={() => setViewMode("single")}
                        className="rounded-full"
                      >
                        This Branch
                      </Button>
                      <Button
                        size="sm"
                        variant={viewMode === "combined" ? "default" : "outline"}
                        onClick={() => setViewMode("combined")}
                        className="rounded-full"
                      >
                        All Branches (This Date)
                      </Button>
                    </div>
                  )}
                </div>

                {/* Branch Breakdown for Combined View */}
                {viewMode === "combined" && (
                  <div className="mb-6 p-4 bg-muted/50 rounded-2xl">
                    <h3 className="text-sm font-semibold text-card-foreground mb-3">Branch Breakdown</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dailyReports.filter(r => r.date === displayReport.date).map(report => (
                        <div key={report.id} className="flex items-center justify-between p-3 bg-card rounded-xl">
                          <span className="font-medium text-sm">
                            {BRANCHES.find(b => b.id === report.branch)?.label}
                          </span>
                          <span className="font-bold text-primary">
                            ₱{formatNumber(report.grandTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabs - Pill Style */}
                <Tabs defaultValue="summary">
                  <TabsList className="mb-6 bg-muted p-1.5 rounded-2xl">
                    <TabsTrigger value="summary" className="rounded-xl px-6 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      Summary
                    </TabsTrigger>
                    <TabsTrigger value="details" className="rounded-xl px-6 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="unmapped" className="rounded-xl px-6 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      Unmapped ({displayReport.unmappedSummary.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary">
                    {viewMode === "combined" ? (
                      <SummaryTable
                        mode="multi"
                        reports={dailyReports.filter(r => r.date === displayReport.date)}
                      />
                    ) : (
                      <SummaryTable
                        mode="single"
                        totals={displayReport.summaryTotalsByCat}
                        quantities={displayReport.summaryQuantitiesByCat}
                        grandTotal={displayReport.grandTotal}
                        grandQuantity={displayReport.grandQuantity}
                        percents={displayReport.percentByCat}
                        branchLabel={BRANCHES.find(b => b.id === displayReport.branch)?.label || displayReport.branch}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="details">
                    <DetailsTable rows={displayReport.rowDetails} />
                  </TabsContent>

                  <TabsContent value="unmapped">
                    <UnmappedList items={displayReport.unmappedSummary} />
                  </TabsContent>
                </Tabs>
              </div>
            ) : mainViewMode === "daily" ? (
              <div className="bg-card rounded-3xl shadow-xl p-16 flex flex-col items-center justify-center text-center">
                <div className="bg-primary/5 rounded-full p-8 mb-6">
                  <Coffee className="h-20 w-20 text-primary/30" strokeWidth={1.5} />
                </div>
                <p className="text-2xl font-bold text-card-foreground mb-2">No report selected</p>
                <p className="text-base text-muted-foreground max-w-md">
                  Select a date, choose a branch, upload a CSV file, and hit Compute to generate your daily summary
                </p>
              </div>
            ) : null}

            {/* MONTHLY MODE VIEW */}
            {mainViewMode === "monthly" && (
              <div className="bg-card rounded-3xl shadow-xl p-8">
                {monthlyReport ? (
                  <>
                    {/* Monthly Report Header */}
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-card-foreground mb-2">
                        Monthly Report — {monthlyReport.displayMonth}
                      </h2>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-primary">
                            {monthlyBranchFilter === "all" 
                              ? "All Branches" 
                              : BRANCHES.find(b => b.id === monthlyBranchFilter)?.label}
                          </span>
                        </span>
                        <span>Files: <span className="font-medium text-card-foreground">{monthlyReport.totalFiles}</span></span>
                        <span>Rows: <span className="font-semibold text-card-foreground">{monthlyReport.totalRows}</span></span>
                        <span className="text-emerald-600 font-medium">✓ Mapped: {monthlyReport.mappedRows}</span>
                        <span className="text-amber-600 font-medium">⚠ Unmapped: {monthlyReport.unmappedRows}</span>
                        <span>Skipped: {monthlyReport.skippedRows}</span>
                        <span className="font-bold text-primary text-lg">
                          Total: ₱{formatNumber(monthlyReport.grandTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Monthly Tabs */}
                    <Tabs defaultValue="summary">
                      <TabsList className="mb-6 bg-muted p-1.5 rounded-2xl">
                        <TabsTrigger value="summary" className="rounded-xl px-6 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                          Summary
                        </TabsTrigger>
                        <TabsTrigger value="daily-breakdown" className="rounded-xl px-6 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                          Daily Breakdown
                        </TabsTrigger>
                        <TabsTrigger value="unmapped" className="rounded-xl px-6 py-2.5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                          Unmapped ({monthlyReport.unmappedSummary.length})
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="summary">
                        <MonthlySummaryTable monthlyReport={monthlyReport} />
                      </TabsContent>

                      <TabsContent value="daily-breakdown">
                        <DailyBreakdownTable monthlyReport={monthlyReport} />
                      </TabsContent>

                      <TabsContent value="unmapped">
                        <MonthlyUnmappedList 
                          items={monthlyReport.unmappedSummary} 
                          monthDisplay={monthlyReport.displayMonth}
                        />
                      </TabsContent>
                    </Tabs>
                  </>
                ) : (
                  <div className="p-16 flex flex-col items-center justify-center text-center">
                    <div className="bg-primary/5 rounded-full p-8 mb-6">
                      <CalendarDays className="h-20 w-20 text-primary/30" strokeWidth={1.5} />
                    </div>
                    <p className="text-2xl font-bold text-card-foreground mb-2">No data for this month</p>
                    <p className="text-base text-muted-foreground max-w-md">
                      Upload daily reports for {monthlyReport?.displayMonth || "this month"} to see the monthly summary
                    </p>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Column Mapper Modal */}
      <ColumnMapperModal
        open={showMapper}
        headers={csvHeaders}
        autoDetected={autoMapping}
        onConfirm={handleColumnConfirm}
        onCancel={() => setShowMapper(false)}
      />
    </div>
  );
};

export default Index;

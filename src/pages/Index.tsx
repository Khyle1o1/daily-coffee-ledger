import { useState, useCallback } from "react";
import { format } from "date-fns";
import { Calendar, Upload, FileSpreadsheet, Trash2, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import SummaryTable from "@/components/SummaryTable";
import DailyHistoryList from "@/components/DailyHistoryList";
import DetailsTable from "@/components/DetailsTable";
import UnmappedList from "@/components/UnmappedList";
import ColumnMapperModal from "@/components/ColumnMapperModal";

import { parseCsvFile, autoDetectColumns } from "@/utils/parseCsv";
import { normalizeText } from "@/utils/normalize";
import { mapRow } from "@/utils/mapRow";
import { aggregateByCategory, getUnmappedSummary } from "@/utils/aggregate";
import { formatNumber } from "@/utils/format";
import { DEFAULT_MAPPING } from "@/utils/defaultMapping";
import type { DailyReport, MappingEntry, ColumnMapping, RawRow } from "@/utils/types";
import { CATEGORIES } from "@/utils/types";

const Index = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [mappingTable, setMappingTable] = useState<MappingEntry[]>(DEFAULT_MAPPING);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [activeReportDate, setActiveReportDate] = useState<string | null>(null);

  // CSV file state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [showMapper, setShowMapper] = useState(false);
  const [autoMapping, setAutoMapping] = useState<Partial<Record<string, string>>>({});

  const activeReport = dailyReports.find(r => r.date === activeReportDate) || null;

  const handleCsvUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
  }, []);

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
    if (!selectedDate || csvData.length === 0) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");
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

    const report: DailyReport = {
      date: dateStr,
      filename: csvFile?.name || "unknown.csv",
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
      const without = prev.filter(r => r.date !== dateStr);
      return [report, ...without].sort((a, b) => b.date.localeCompare(a.date));
    });
    setActiveReportDate(dateStr);
    setShowMapper(false);
  }, [selectedDate, csvData, csvFile, autoMapping, mappingTable]);

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

  const canCompute = selectedDate && csvData.length > 0;

  const clearSession = () => {
    setDailyReports([]);
    setActiveReportDate(null);
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setSelectedDate(undefined);
  };

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
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Picker - Pill Style */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "px-5 py-2.5 h-auto rounded-full bg-transparent border-2 border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground transition-all",
                    !selectedDate && "text-primary-foreground/70"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "yyyy-MM-dd") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarUI
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="p-3 pointer-events-auto rounded-2xl"
                />
              </PopoverContent>
            </Popover>

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
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
          {/* Left: History Sidebar */}
          <aside>
            <DailyHistoryList
              reports={dailyReports}
              activeDate={activeReportDate}
              onSelect={setActiveReportDate}
            />
          </aside>

          {/* Right: Report Panel - White Card */}
          <main className="min-w-0">
            {activeReport ? (
              <div className="bg-card rounded-3xl shadow-xl p-8">
                {/* Report header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-card-foreground mb-2">
                    Report for {activeReport.date}
                  </h2>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <span>File: <span className="font-medium text-card-foreground">{activeReport.filename}</span></span>
                    <span>Rows: <span className="font-semibold text-card-foreground">{activeReport.totalRows}</span></span>
                    <span className="text-emerald-600 font-medium">✓ Mapped: {activeReport.mappedRows}</span>
                    <span className="text-amber-600 font-medium">⚠ Unmapped: {activeReport.unmappedRows}</span>
                    <span>Skipped: {activeReport.skippedRows}</span>
                    <span className="font-bold text-primary text-lg">
                      Total: ₱{formatNumber(activeReport.grandTotal)}
                    </span>
                  </div>
                </div>

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
                      Unmapped ({activeReport.unmappedSummary.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary">
                    <SummaryTable
                      totals={activeReport.summaryTotalsByCat}
                      quantities={activeReport.summaryQuantitiesByCat}
                      grandTotal={activeReport.grandTotal}
                      grandQuantity={activeReport.grandQuantity}
                      percents={activeReport.percentByCat}
                    />
                  </TabsContent>

                  <TabsContent value="details">
                    <DetailsTable rows={activeReport.rowDetails} />
                  </TabsContent>

                  <TabsContent value="unmapped">
                    <UnmappedList items={activeReport.unmappedSummary} />
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="bg-card rounded-3xl shadow-xl p-16 flex flex-col items-center justify-center text-center">
                <div className="bg-primary/5 rounded-full p-8 mb-6">
                  <Coffee className="h-20 w-20 text-primary/30" strokeWidth={1.5} />
                </div>
                <p className="text-2xl font-bold text-card-foreground mb-2">No report selected</p>
                <p className="text-base text-muted-foreground max-w-md">
                  Select a date, upload a CSV file, and hit Compute to generate your daily summary
                </p>
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

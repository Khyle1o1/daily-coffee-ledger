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
    const { totals, grandTotal, percents } = aggregateByCategory(processed);
    const unmappedSummary = getUnmappedSummary(processed);

    const report: DailyReport = {
      date: dateStr,
      filename: csvFile?.name || "unknown.csv",
      totalRows: processed.length,
      mappedRows: processed.filter(r => r.status === "MAPPED").length,
      unmappedRows: processed.filter(r => r.status === "UNMAPPED").length,
      skippedRows: processed.filter(r => r.status === "SKIPPED").length,
      summaryTotalsByCat: totals,
      grandTotal,
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
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Coffee className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">DOT Coffee Daily Summary</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">MVP</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-[180px] justify-start text-left text-xs h-9", !selectedDate && "text-muted-foreground")}
                >
                  <Calendar className="mr-2 h-3.5 w-3.5" />
                  {selectedDate ? format(selectedDate, "yyyy-MM-dd") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarUI
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* CSV Upload */}
            <label className="flex items-center gap-2 px-3 py-2 h-9 rounded-md border border-border bg-card text-xs cursor-pointer hover:bg-muted transition-colors">
              <Upload className="h-3.5 w-3.5 text-primary" />
              {csvFile ? (
                <span className="max-w-[140px] truncate">{csvFile.name}</span>
              ) : (
                <span className="text-muted-foreground">Transactions CSV</span>
              )}
              <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
            </label>

            {/* Mapping Upload */}
            <label className="flex items-center gap-2 px-3 py-2 h-9 rounded-md border border-dashed border-border bg-card text-xs cursor-pointer hover:bg-muted transition-colors">
              <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Mapping CSV (optional)</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleMappingUpload} />
            </label>

            {/* Compute */}
            <Button size="sm" className="h-9 text-xs" disabled={!canCompute} onClick={() => {
              const required = ["rawCategory", "rawItemName", "quantity", "unitPrice"];
              const allDetected = required.every(f => autoMapping[f]);
              if (allDetected) {
                compute();
              } else {
                setShowMapper(true);
              }
            }}>
              Compute
            </Button>

            {/* Clear */}
            {dailyReports.length > 0 && (
              <Button variant="outline" size="sm" className="h-9 text-xs ml-auto" onClick={clearSession}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear Session
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Left: History */}
          <aside className="lg:border-r lg:pr-4 border-border">
            <DailyHistoryList
              reports={dailyReports}
              activeDate={activeReportDate}
              onSelect={setActiveReportDate}
            />
          </aside>

          {/* Right: Report Panel */}
          <main className="min-w-0">
            {activeReport ? (
              <div>
                {/* Report header */}
                <div className="mb-4">
                  <h2 className="text-base font-bold">Report for {activeReport.date}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                    <span>File: {activeReport.filename}</span>
                    <span>Rows: {activeReport.totalRows}</span>
                    <span className="text-emerald-600">Mapped: {activeReport.mappedRows}</span>
                    <span className="text-primary">Unmapped: {activeReport.unmappedRows}</span>
                    <span>Skipped: {activeReport.skippedRows}</span>
                    <span className="font-bold text-foreground">
                      Total: ₱{formatNumber(activeReport.grandTotal)}
                    </span>
                  </div>
                </div>

                <Tabs defaultValue="summary">
                  <TabsList className="mb-3">
                    <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
                    <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                    <TabsTrigger value="unmapped" className="text-xs">
                      Unmapped ({activeReport.unmappedSummary.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary">
                    <SummaryTable
                      totals={activeReport.summaryTotalsByCat}
                      grandTotal={activeReport.grandTotal}
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
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Coffee className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-1">No report selected</p>
                <p className="text-sm">Select a date, upload a CSV, and hit Compute</p>
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

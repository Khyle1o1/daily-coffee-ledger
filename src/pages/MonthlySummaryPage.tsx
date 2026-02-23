import { useState, useCallback, useMemo, useEffect } from "react";
import { FileSpreadsheet, CalendarDays, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

import DailyHistoryList from "@/components/DailyHistoryList";
import MonthPicker from "@/components/MonthPicker";
import MonthlySummaryTable from "@/components/MonthlySummaryTable";
import DailyBreakdownTable from "@/components/DailyBreakdownTable";
import MonthlyUnmappedList from "@/components/MonthlyUnmappedList";

import { normalizeText } from "@/utils/normalize";
import { parseCsvFile } from "@/utils/parseCsv";
import { DEFAULT_MAPPING } from "@/utils/defaultMapping";
import { computeMonthlyReport } from "@/utils/aggregateMonthly";
import { formatNumber } from "@/utils/format";
import type { DailyReport, MappingEntry, BranchId } from "@/utils/types";
import { BRANCHES } from "@/utils/types";

import { 
  getBranches, 
  seedBranchesIfEmpty, 
  listAllDailyReports 
} from "@/services/reportsService";
import { dailyReportsFromRows } from "@/services/reportConverter";
import type { Branch } from "@/lib/supabase-types";

export default function MonthlySummaryPage() {
  const { toast } = useToast();
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [mappingTable, setMappingTable] = useState<MappingEntry[]>(DEFAULT_MAPPING);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthlyBranchFilter, setMonthlyBranchFilter] = useState<BranchId | "all">("all");

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
        
        toast({
          title: "Connected to Supabase",
          description: `Loaded ${fetchedBranches.length} branches and ${reports.length} reports`,
        });
      } catch (error) {
        console.error('Failed to initialize data:', error);
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

  const monthlyReport = useMemo(() => {
    return computeMonthlyReport(dailyReports, selectedMonth, monthlyBranchFilter);
  }, [dailyReports, selectedMonth, monthlyBranchFilter]);

  const handleMonthSelect = useCallback((monthKey: string) => {
    setSelectedMonth(monthKey);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Controls Bar */}
      <div className="bg-primary shadow-md">
        <div className="max-w-[1600px] mx-auto px-8 py-5">
          <div className="flex flex-wrap items-center gap-4">
            {/* Month Picker */}
            <MonthPicker
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
            />

            {/* Branch Filter */}
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

            {/* Mapping Upload */}
            <label className="flex items-center gap-3 px-5 py-2.5 rounded-full border-2 border-dashed border-primary-foreground/50 bg-transparent text-primary-foreground/80 cursor-pointer hover:bg-primary-foreground/10 transition-all">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="font-medium text-sm">Mapping CSV</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleMappingUpload} />
            </label>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left: History Sidebar */}
          <aside>
            <DailyHistoryList
              reports={dailyReports}
              activeReportId={null}
              onSelect={() => {}}
              viewMode="monthly"
              selectedMonth={selectedMonth}
              onMonthSelect={handleMonthSelect}
            />
          </aside>

          {/* Right: Report Panel */}
          <main className="min-w-0">
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
          </main>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Calendar as CalendarIcon,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  MapPin,
  Printer,
  RefreshCw,
  Upload,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { useToast } from "@/hooks/use-toast";
import { useLiveBranches } from "@/hooks/useLiveBranches";
import { useAuth } from "@/auth/useAuth";
import { cn } from "@/lib/utils";
import { formatPHP } from "@/utils/format";
import { parseCsvFile } from "@/utils/parseCsv";
import {
  isDailyLedgerSheetFormat,
  parseDailyLedgerSheetRows,
} from "@/utils/parseDailyLedgerSheet";
import {
  listDailyLedgerEntries,
  upsertDailyLedgerEntries,
  ledgerNetSales,
  type UpsertDailyLedgerPayload,
} from "@/services/dailyLedgerService";
import { fetchDailyReportsForComputeRange } from "@/services/reportsService";
import { dailyReportsFromRows } from "@/services/reportConverter";
import {
  mergeCashLedgerReport,
  type CashLedgerReportResult,
} from "@/lib/reports/mergeCashLedgerReport";
import {
  exportCashLedgerCsv,
  exportCashLedgerExcel,
  exportCashLedgerPdf,
} from "@/utils/exportCashLedgerReport";
import type { BranchId } from "@/utils/types";

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sourceLabel(s: string) {
  if (s === "sheet") return "Sheet";
  if (s === "pos_derived") return "POS";
  return "POS (partial)";
}

export default function DailyCashLedgerReportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    branchOptions,
    getBranchUuid,
    isLoading: branchesLoading,
  } = useLiveBranches();

  const slugToUuid = useCallback(
    (slug: string) => getBranchUuid(slug as BranchId) ?? undefined,
    [getBranchUuid],
  );
  const uuidToLabel = useCallback(
    (uuid: string) => {
      const opt = branchOptions.find((b) => b.uuid === uuid);
      return opt?.label ?? uuid.slice(0, 8);
    },
    [branchOptions],
  );

  const yearsWithData = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1];
  }, []);

  const [year, setYear] = useState<number | "all">(new Date().getFullYear());
  const [monthKey, setMonthKey] = useState<string | "all">("all");
  const [branchId, setBranchId] = useState<string | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [uploadBranch, setUploadBranch] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CashLedgerReportResult | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const monthsForYear = useMemo(() => {
    const y = year === "all" ? new Date().getFullYear() : year;
    return Array.from({ length: 12 }, (_, i) => {
      const mk = `${y}-${String(i + 1).padStart(2, "0")}`;
      const label = new Date(y, i, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      return { monthKey: mk, label };
    });
  }, [year]);

  const resolveBounds = useCallback(() => {
    if (dateRange.from) {
      return {
        dateFrom: toYmd(dateRange.from),
        dateTo: toYmd(dateRange.to ?? dateRange.from),
      };
    }
    if (monthKey !== "all") {
      const [y, m] = monthKey.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      return {
        dateFrom: `${monthKey}-01`,
        dateTo: `${monthKey}-${String(last).padStart(2, "0")}`,
      };
    }
    if (year !== "all") {
      return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
    }
    const y = new Date().getFullYear();
    return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
  }, [dateRange, monthKey, year]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { dateFrom, dateTo } = resolveBounds();
      const branchFilter = branchId === "all" ? undefined : branchId;

      const sheetEntries = await listDailyLedgerEntries({
        dateFrom,
        dateTo,
        branchId: branchFilter,
      });

      const posRows = await fetchDailyReportsForComputeRange({
        dateFrom,
        dateTo,
        branchIds: branchFilter ? [branchFilter] : undefined,
      });
      const posReports = dailyReportsFromRows(posRows);

      const merged = mergeCashLedgerReport({
        sheetEntries,
        posReports,
        branchSlugToUuid: slugToUuid,
        branchUuidToLabel: uuidToLabel,
        dateFrom,
        dateTo,
        branchId,
      });

      setResult(merged);
      if (!merged.hasData) {
        toast({
          variant: "destructive",
          title: "No data available",
          description:
            "No sheet ledger rows or POS transactions matched. Upload a Daily Ledger sheet or POS CSV.",
        });
      } else {
        toast({
          title: "Ledger report ready",
          description: `${merged.rows.length} day×branch rows · Sheet preferred when present`,
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Generate failed",
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!uploadBranch) {
      toast({
        variant: "destructive",
        title: "Select a branch",
        description: "Choose which branch this Daily Ledger sheet belongs to.",
      });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Not signed in" });
      return;
    }

    setIsUploading(true);
    try {
      const { headers, data } = await parseCsvFile(file);
      if (!isDailyLedgerSheetFormat(headers)) {
        throw new Error(
          "This file does not look like a Daily Ledger sheet (need Date + Cash Sales columns).",
        );
      }
      const parsed = parseDailyLedgerSheetRows(headers, data);
      if (parsed.length === 0) {
        throw new Error("No valid dated rows found in the sheet.");
      }

      const payloads: UpsertDailyLedgerPayload[] = parsed.map((r) => ({
        branchId: uploadBranch,
        ledgerDate: r.ledgerDate,
        cash: r.cash,
        maya: r.maya,
        grab: r.grab,
        paymongo: r.paymongo,
        gcash: r.gcash,
        foodpanda: r.foodpanda,
        giftCard: r.giftCard,
        regularDiscount: r.regularDiscount,
        seniorDiscount: r.seniorDiscount,
        pwdDiscount: r.pwdDiscount,
        vatExemption: r.vatExemption,
        grossSalesNet: r.grossSales,
        transactionCount: r.transactionCount,
        grossSales: r.grossSales,
        source: "sheet",
        sourceFileName: file.name,
      }));

      await upsertDailyLedgerEntries(payloads);
      toast({
        title: "Ledger sheet saved",
        description: `${payloads.length} day(s) upserted for the selected branch.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not parse sheet",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const runExport = (kind: "csv" | "excel" | "pdf") => {
    if (!result?.hasData) {
      toast({
        variant: "destructive",
        title: "Nothing to export",
        description: "Generate a report with data first.",
      });
      return;
    }
    try {
      if (kind === "csv") exportCashLedgerCsv(result);
      if (kind === "excel") exportCashLedgerExcel(result);
      if (kind === "pdf") exportCashLedgerPdf(result);
      setExportOpen(false);
      toast({
        title: "Export ready",
        description: `Downloaded ${kind.toUpperCase()} report.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not download file",
      });
    }
  };

  useEffect(() => {
    if (!uploadBranch && branchOptions[0]) {
      setUploadBranch(branchOptions[0].uuid);
    }
  }, [branchOptions, uploadBranch]);

  return (
    <div className="pb-8">
      <div className="print:hidden">
        <div className="w-full px-5 sm:px-8 lg:px-10 pt-6 space-y-4">
          <div className="saas-card flex flex-wrap items-end gap-3 p-4">
            <FilterField label="Year">
              <Select
                value={year === "all" ? "all" : String(year)}
                onValueChange={(v) => {
                  setYear(v === "all" ? "all" : Number(v));
                  setMonthKey("all");
                }}
              >
                <SelectTrigger className="w-[120px] rounded-xl border-border bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {yearsWithData.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Month">
              <Select value={monthKey} onValueChange={(v) => setMonthKey(v as string | "all")}>
                <SelectTrigger className="w-[180px] rounded-xl border-border bg-white">
                  <SelectValue />
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
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="w-[180px] rounded-xl border-border bg-white">
                  <MapPin className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  <GroupedBranchSelectItems
                    options={branchOptions.map((b) => ({
                      value: b.uuid,
                      label: b.label,
                      category: b.category,
                    }))}
                  />
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Date Range">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[220px] justify-start rounded-xl border-border bg-white hover:bg-muted/70",
                      !dateRange.from && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from
                      ? dateRange.to
                        ? `${format(dateRange.from, "MMM d")} — ${format(dateRange.to, "MMM d")}`
                        : format(dateRange.from, "MMM d, yyyy")
                      : "Optional"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={dateRange}
                    onSelect={(r) => setDateRange(r ?? { from: undefined, to: undefined })}
                  />
                  {dateRange.from && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setDateRange({ from: undefined, to: undefined })}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Clear
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </FilterField>

            <Button
              onClick={() => void handleGenerate()}
              disabled={isGenerating || branchesLoading}
              className="rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-6"
            >
              {isGenerating ? (
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
                  disabled={!result?.hasData}
                  className="rounded-[10px] border-border bg-white text-[#172B4D] hover:bg-muted"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted" onClick={() => runExport("csv")}>
                  <FileText className="h-4 w-4" /> Export CSV
                </button>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted" onClick={() => runExport("excel")}>
                  <FileSpreadsheet className="h-4 w-4" /> Export Excel
                </button>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted" onClick={() => runExport("pdf")}>
                  <FileText className="h-4 w-4" /> Export PDF
                </button>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted" onClick={() => { setExportOpen(false); window.print(); }}>
                  <Printer className="h-4 w-4" /> Print
                </button>
              </PopoverContent>
            </Popover>
          </div>

          <div className="saas-card flex flex-wrap items-end gap-3 p-4">
            <FilterField label="Upload sheet for branch">
              <Select value={uploadBranch} onValueChange={setUploadBranch}>
                <SelectTrigger className="w-[180px] rounded-xl border-border bg-white">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <GroupedBranchSelectItems
                    options={branchOptions.map((b) => ({
                      value: b.uuid,
                      label: b.label,
                      category: b.category,
                    }))}
                  />
                </SelectContent>
              </Select>
            </FilterField>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:bg-primary/90">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Daily Ledger CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(ev) => void handleSheetUpload(ev)} />
            </label>
            <p className="text-sm text-muted-foreground max-w-xl">
              Sheet uploads win over POS for the same branch+day. Without a sheet, tender totals are derived from POS Payment Type (re-upload POS for full discounts/VAT/txn IDs).
            </p>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8 space-y-6 text-[#0e2d49]">
        {!result && (
          <div className="rounded-3xl bg-[#F4F0E5] shadow-xl px-8 py-16 text-center">
            <Wallet className="h-10 w-10 mx-auto text-[#0e2d49]/70" />
            <h2 className="mt-4 text-xl font-bold">Daily Cash Ledger</h2>
            <p className="mt-2 text-sm text-[#0e2d49]/70 max-w-lg mx-auto">
              Cash / Maya / Grab / Paymongo / discounts / GROSS SALES by day and branch.
              Upload the Google Sheets export or generate from POS.
            </p>
          </div>
        )}

        {result && !result.hasData && (
          <div className="rounded-3xl bg-[#F4F0E5] shadow-xl px-8 py-16 text-center">
            <p className="text-lg font-semibold">No data available</p>
          </div>
        )}

        {result?.hasData && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="GROSS SALES" value={formatPHP(result.totals.grossSales)} />
              <Stat label="Net Sales" value={formatPHP(ledgerNetSales(result.totals))} />
              <Stat label="Txn Count" value={String(result.totals.transactionCount)} />
              <Stat label="Cash" value={formatPHP(result.totals.cash)} />
              <Stat label="Paymongo" value={formatPHP(result.totals.paymongo)} />
            </div>

            <section className="rounded-3xl bg-[#F4F0E5] shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#0e2d49]/10 flex flex-wrap items-center justify-between gap-3 print:block">
                <div>
                  <h2 className="text-lg font-bold">Daily Ledger Table</h2>
                  <p className="text-sm text-[#0e2d49]/70">
                    {result.rows.length} rows · Generated {new Date(result.generatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-[#0e2d49]/25 text-[#0e2d49] hover:bg-white"
                    onClick={() => runExport("csv")}
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    Download CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-[#0e2d49]/25 text-[#0e2d49] hover:bg-white"
                    onClick={() => runExport("excel")}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                    Download Excel
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[1500px]">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      {[
                        "Date", "Day", "Branch", "Cash", "Maya", "Grab", "Paymongo", "GCash",
                        "FoodPanda", "Gift Card", "Regular Disc.", "Senior", "PWD", "VAT Ex.",
                        "Gross Net", "Net Sales", "Txn", "GROSS SALES", "Source",
                      ].map((h) => (
                        <th key={h} className="px-2 py-2.5 text-right first:text-left font-semibold whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r, idx) => (
                      <tr
                        key={`${r.ledgerDate}-${r.branchId}`}
                        className={idx % 2 ? "bg-[#FDF6EE]" : "bg-white"}
                      >
                        <td className="px-2 py-1.5 text-left font-medium">{r.ledgerDate}</td>
                        <td className="px-2 py-1.5 text-left">{r.dayLabel}</td>
                        <td className="px-2 py-1.5 text-left font-semibold">{r.branchLabel}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.cash)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.maya)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.grab)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.paymongo)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.gcash)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.foodpanda)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.giftCard)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.regularDiscount)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.seniorDiscount)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.pwdDiscount)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.vatExemption)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(r.grossSales)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatPHP(ledgerNetSales(r))}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.transactionCount}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-bold">{formatPHP(r.grossSales)}</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold",
                              r.source === "sheet"
                                ? "bg-emerald-100 text-emerald-800"
                                : r.source === "pos_derived"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-amber-100 text-amber-900",
                            )}
                          >
                            {sourceLabel(r.source)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#0e2d49]/10 font-bold">
                      <td className="px-2 py-2" colSpan={3}>
                        Totals
                      </td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.cash)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.maya)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.grab)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.paymongo)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.gcash)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.foodpanda)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.giftCard)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.regularDiscount)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.seniorDiscount)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.pwdDiscount)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.vatExemption)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(result.totals.grossSales)}</td>
                      <td className="px-2 py-2 text-right">{formatPHP(ledgerNetSales(result.totals))}</td>
                      <td className="px-2 py-2 text-right">{result.totals.transactionCount}</td>
                      <td className="px-2 py-2 text-right text-[#C05A1F]">{formatPHP(result.totals.grossSales)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F4F0E5] shadow-md px-5 py-4" style={{ color: "#0e2d49" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#4a5d73" }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

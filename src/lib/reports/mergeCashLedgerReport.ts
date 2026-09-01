import type { DailyReport } from "@/utils/types";
import { deriveDailyLedgerFromPos } from "@/lib/reports/deriveDailyLedgerFromPos";
import type {
  DailyLedgerAmounts,
  DailyLedgerEntry,
  DailyLedgerSource,
} from "@/services/dailyLedgerService";
import { emptyLedgerAmounts } from "@/services/dailyLedgerService";

export interface CashLedgerReportRow extends DailyLedgerAmounts {
  ledgerDate: string;
  dayLabel: string;
  branchId: string;
  branchLabel: string;
  source: DailyLedgerSource;
  sourceFileName: string | null;
}

export interface CashLedgerReportResult {
  rows: CashLedgerReportRow[];
  totals: DailyLedgerAmounts;
  generatedAt: string;
  hasData: boolean;
}

function dayName(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * Merge sheet ledger entries (preferred) with POS-derived days for gaps.
 */
export function mergeCashLedgerReport(params: {
  sheetEntries: DailyLedgerEntry[];
  posReports: DailyReport[];
  branchSlugToUuid: (slug: string) => string | undefined;
  branchUuidToLabel: (uuid: string) => string;
  branchUuidToSlug?: (uuid: string) => string | undefined;
  dateFrom?: string | null;
  dateTo?: string | null;
  branchId?: string | "all";
}): CashLedgerReportResult {
  const {
    sheetEntries,
    posReports,
    branchSlugToUuid,
    branchUuidToLabel,
    dateFrom,
    dateTo,
    branchId = "all",
  } = params;

  const sheetByKey = new Map<string, DailyLedgerEntry>();
  for (const e of sheetEntries) {
    if (branchId !== "all" && e.branchId !== branchId) continue;
    if (dateFrom && e.ledgerDate < dateFrom) continue;
    if (dateTo && e.ledgerDate > dateTo) continue;
    // Prefer explicit sheet source; also keep any stored entry as preferred over live POS
    sheetByKey.set(`${e.ledgerDate}::${e.branchId}`, e);
  }

  const derived = deriveDailyLedgerFromPos(posReports, branchSlugToUuid);
  const rowMap = new Map<string, CashLedgerReportRow>();

  for (const d of derived) {
    if (branchId !== "all" && d.branchId !== branchId) continue;
    if (dateFrom && d.ledgerDate < dateFrom) continue;
    if (dateTo && d.ledgerDate > dateTo) continue;
    const key = `${d.ledgerDate}::${d.branchId}`;
    if (sheetByKey.has(key)) continue; // sheet wins
    rowMap.set(key, {
      ledgerDate: d.ledgerDate,
      dayLabel: dayName(d.ledgerDate),
      branchId: d.branchId,
      branchLabel: branchUuidToLabel(d.branchId),
      cash: d.cash,
      maya: d.maya,
      grab: d.grab,
      paymongo: d.paymongo,
      gcash: d.gcash,
      foodpanda: d.foodpanda,
      giftCard: d.giftCard,
      regularDiscount: d.regularDiscount,
      seniorDiscount: d.seniorDiscount,
      pwdDiscount: d.pwdDiscount,
      vatExemption: d.vatExemption,
      // Gross Net is the same figure as GROSS SALES (tender total).
      grossSalesNet: d.grossSales,
      transactionCount: d.transactionCount,
      grossSales: d.grossSales,
      source: d.source,
      sourceFileName: null,
    });
  }

  for (const e of sheetByKey.values()) {
    const key = `${e.ledgerDate}::${e.branchId}`;
    rowMap.set(key, {
      ledgerDate: e.ledgerDate,
      dayLabel: dayName(e.ledgerDate),
      branchId: e.branchId,
      branchLabel: e.branch?.label ?? branchUuidToLabel(e.branchId),
      cash: e.cash,
      maya: e.maya,
      grab: e.grab,
      paymongo: e.paymongo,
      gcash: e.gcash,
      foodpanda: e.foodpanda,
      giftCard: e.giftCard,
      regularDiscount: e.regularDiscount,
      seniorDiscount: e.seniorDiscount,
      pwdDiscount: e.pwdDiscount,
      vatExemption: e.vatExemption,
      // Force Gross Net = GROSS SALES even on older sheet rows that stored them apart.
      grossSalesNet: e.grossSales,
      transactionCount: e.transactionCount,
      grossSales: e.grossSales,
      source: e.source === "sheet" ? "sheet" : e.source,
      sourceFileName: e.sourceFileName,
    });
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    const d = a.ledgerDate.localeCompare(b.ledgerDate);
    if (d !== 0) return d;
    return a.branchLabel.localeCompare(b.branchLabel);
  });

  const totals = emptyLedgerAmounts();
  for (const r of rows) {
    totals.cash += r.cash;
    totals.maya += r.maya;
    totals.grab += r.grab;
    totals.paymongo += r.paymongo;
    totals.gcash += r.gcash;
    totals.foodpanda += r.foodpanda;
    totals.giftCard += r.giftCard;
    totals.regularDiscount += r.regularDiscount;
    totals.seniorDiscount += r.seniorDiscount;
    totals.pwdDiscount += r.pwdDiscount;
    totals.vatExemption += r.vatExemption;
    totals.grossSalesNet += r.grossSalesNet;
    totals.transactionCount += r.transactionCount;
    totals.grossSales += r.grossSales;
  }

  return {
    rows,
    totals,
    generatedAt: new Date().toISOString(),
    hasData: rows.length > 0,
  };
}

import type { DailyReport, ProcessedRow } from "@/utils/types";
import {
  emptyLedgerAmounts,
  type DailyLedgerAmounts,
  type DailyLedgerSource,
} from "@/services/dailyLedgerService";

export interface DerivedDailyLedgerDay extends DailyLedgerAmounts {
  ledgerDate: string;
  branchId: string;
  source: Extract<DailyLedgerSource, "pos_derived" | "pos_partial">;
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdPrefix(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = String(value).slice(0, 10).match(/^(\d{4}-\d{2}-\d{2})$/);
  return m ? m[1] : null;
}

function rangeSpanDays(report: DailyReport): number {
  const start = ymdPrefix(report.date);
  const end = ymdPrefix(report.dateRangeEnd) ?? start;
  if (!start || !end) return Number.POSITIVE_INFINITY;
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(ye, me - 1, de);
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function reportRecencyMs(report: DailyReport): number {
  return report.updatedAt ?? report.createdAt ?? report.uploadedAt ?? 0;
}

/**
 * Prefer newest upload; then narrower date range; then higher id.
 * Returns > 0 if `a` should win over `b`.
 */
export function compareReportOwnership(a: DailyReport, b: DailyReport): number {
  const recency = reportRecencyMs(a) - reportRecencyMs(b);
  if (recency !== 0) return recency;
  const span = rangeSpanDays(b) - rangeSpanDays(a); // narrower wins
  if (span !== 0) return span;
  return a.id.localeCompare(b.id);
}

/**
 * For each local calendar day × branch, pick a single winning report so overlapping
 * uploads (e.g. Jun–Jul dual-month + Jul-only) do not double-count amounts.
 */
export function pickDayReportOwners(reports: DailyReport[]): Map<string, string> {
  const ownerByDayBranch = new Map<string, DailyReport>(); // `${ymd}::${branchSlug}` → report

  for (const report of reports) {
    for (const row of report.rowDetails) {
      if (!(row.transactionDate instanceof Date) || Number.isNaN(row.transactionDate.getTime())) {
        continue;
      }
      const day = toLocalYmd(row.transactionDate);
      const key = `${day}::${report.branch}`;
      const current = ownerByDayBranch.get(key);
      if (!current || compareReportOwnership(report, current) > 0) {
        ownerByDayBranch.set(key, report);
      }
    }
  }

  const ids = new Map<string, string>();
  for (const [key, report] of ownerByDayBranch) {
    ids.set(key, report.id);
  }
  return ids;
}

function tenderBucket(paymentType?: string | null): keyof DailyLedgerAmounts | "other" {
  const v = (paymentType ?? "").toLowerCase().trim();
  if (!v) return "other";
  if (v.includes("gift")) return "giftCard";
  if (v.includes("foodpanda") || v.includes("food panda")) return "foodpanda";
  if (v.startsWith("grab")) return "grab";
  if (v.includes("paymongo")) return "paymongo";
  if (v.includes("gcash") || v.includes("g-cash") || v.includes("g cash")) return "gcash";
  if (v.includes("maya")) return "maya";
  if (v.includes("cash")) return "cash";
  return "other";
}

function lineAmount(row: ProcessedRow): number {
  if (typeof row.discountedPrice === "number" && Number.isFinite(row.discountedPrice)) {
    return row.discountedPrice;
  }
  return Number.isFinite(row.rowSales) ? row.rowSales : 0;
}

function hasEnrichedFields(row: ProcessedRow): boolean {
  return (
    row.transactionId != null ||
    row.discountedPrice != null ||
    row.grossPrice != null ||
    row.regularDiscount != null ||
    row.seniorDiscount != null ||
    row.pwdDiscount != null ||
    row.vatExemption != null
  );
}

/**
 * Derive day×branch cash-ledger rows from POS DailyReport rowDetails.
 * Prefers enriched fields when present; otherwise partial (paymentType + rowSales).
 *
 * When multiple reports overlap on the same branch×day, only the winning report
 * (newest upload, then narrower range) contributes amounts for that day.
 */
export function deriveDailyLedgerFromPos(
  reports: DailyReport[],
  branchSlugToUuid: (slug: string) => string | undefined,
): DerivedDailyLedgerDay[] {
  type Cell = DailyLedgerAmounts & {
    txnIds: Set<string>;
    enriched: boolean;
    otherTender: number;
  };

  const owners = pickDayReportOwners(reports);
  const cells = new Map<string, Cell>(); // `${date}::${branchSlug}`

  for (const report of reports) {
    for (const row of report.rowDetails) {
      if (!(row.transactionDate instanceof Date) || Number.isNaN(row.transactionDate.getTime())) {
        continue;
      }
      const day = toLocalYmd(row.transactionDate);
      const key = `${day}::${report.branch}`;
      if (owners.get(key) !== report.id) continue;

      let cell = cells.get(key);
      if (!cell) {
        cell = {
          ...emptyLedgerAmounts(),
          txnIds: new Set(),
          enriched: false,
          otherTender: 0,
        };
        cells.set(key, cell);
      }

      if (hasEnrichedFields(row)) cell.enriched = true;

      const amt = lineAmount(row);
      const bucket = tenderBucket(row.paymentType);
      if (bucket === "other") cell.otherTender += amt;
      else cell[bucket] += amt;

      cell.regularDiscount += Number(row.regularDiscount ?? 0) || 0;
      cell.seniorDiscount += Number(row.seniorDiscount ?? 0) || 0;
      cell.pwdDiscount += Number(row.pwdDiscount ?? 0) || 0;
      cell.vatExemption += Number(row.vatExemption ?? 0) || 0;

      const txnKey =
        row.transactionId?.trim() ||
        row.receiptNo?.trim() ||
        `${day}|${row.paymentType ?? ""}|${row.transactionDate.toISOString()}`;
      cell.txnIds.add(txnKey);
    }
  }

  const out: DerivedDailyLedgerDay[] = [];
  for (const [key, cell] of cells) {
    const [ledgerDate, branchSlug] = key.split("::");
    const branchId = branchSlugToUuid(branchSlug);
    if (!branchId) continue;

    // Unmapped tenders (e.g. unknown payment types) fold into cash for sheet parity
    const cash = cell.cash + cell.otherTender;
    const tenderSum =
      cash + cell.maya + cell.grab + cell.paymongo + cell.gcash + cell.foodpanda + cell.giftCard;
    const grossSales = tenderSum;
    const discounts = cell.regularDiscount + cell.seniorDiscount + cell.pwdDiscount;
    const grossSalesNet = Math.max(0, grossSales - discounts);

    out.push({
      ledgerDate,
      branchId,
      cash,
      maya: cell.maya,
      grab: cell.grab,
      paymongo: cell.paymongo,
      gcash: cell.gcash,
      foodpanda: cell.foodpanda,
      giftCard: cell.giftCard,
      regularDiscount: cell.regularDiscount,
      seniorDiscount: cell.seniorDiscount,
      pwdDiscount: cell.pwdDiscount,
      vatExemption: cell.vatExemption,
      grossSalesNet,
      transactionCount: cell.txnIds.size,
      grossSales,
      source: cell.enriched ? "pos_derived" : "pos_partial",
    });
  }

  return out.sort((a, b) => {
    const d = a.ledgerDate.localeCompare(b.ledgerDate);
    if (d !== 0) return d;
    return a.branchId.localeCompare(b.branchId);
  });
}

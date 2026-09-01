import type { DailyReport, ProcessedRow } from "@/utils/types";
import {
  emptyLedgerAmounts,
  ledgerGrossSales,
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
    row.vatExemption != null ||
    row.itemDiscountType != null ||
    row.totalDiscountType != null ||
    row.itemDiscountAmount != null ||
    row.totalDiscountAmount != null
  );
}

export type PosDiscountKind = "regular" | "senior" | "pwd";

function moneyOrZero(n: unknown): number {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/** Gross − discounted, or POS Item/Total Discount Amount when the price gap is empty. */
export function impliedLineDiscount(row: ProcessedRow): number {
  const gross = moneyOrZero(row.grossPrice);
  const discounted = moneyOrZero(row.discountedPrice);
  if (gross > 0 && discounted > 0 && gross > discounted + 0.005) {
    return gross - discounted;
  }
  const named =
    moneyOrZero(row.itemDiscountAmount) + moneyOrZero(row.totalDiscountAmount);
  if (named > 0.005) return named;
  return (
    moneyOrZero(row.regularDiscount) +
    moneyOrZero(row.seniorDiscount) +
    moneyOrZero(row.pwdDiscount)
  );
}

export function kindFromDiscountType(value: string | undefined | null): PosDiscountKind | null {
  const t = (value ?? "").toLowerCase().trim();
  if (!t) return null;
  if (/\bpwd\b/.test(t) || t.includes("person with")) return "pwd";
  if (t.includes("senior")) return "senior";
  if (
    t.includes("regular") ||
    t.includes("promo") ||
    t.includes("employee") ||
    t.includes("naac") ||
    t.includes("solo parent") ||
    t.includes("diplomat")
  ) {
    return "regular";
  }
  return null;
}

export function explicitDiscountKind(row: ProcessedRow): PosDiscountKind | null {
  if (moneyOrZero(row.pwdDiscount) > 0.005) return "pwd";
  if (moneyOrZero(row.seniorDiscount) > 0.005) return "senior";
  if (moneyOrZero(row.regularDiscount) > 0.005) return "regular";
  return kindFromDiscountType(row.itemDiscountType) ?? kindFromDiscountType(row.totalDiscountType);
}

/** Copy Item/Total Discount Type onto other lines of the same ticket. */
export function inheritTxnDiscountTypes(rows: ProcessedRow[]): void {
  const kindByTxn = new Map<string, PosDiscountKind>();
  for (const row of rows) {
    const id = row.transactionId?.trim() || row.receiptNo?.trim();
    if (!id) continue;
    const kind = kindFromDiscountType(row.itemDiscountType) ?? kindFromDiscountType(row.totalDiscountType);
    if (kind && !kindByTxn.has(id)) kindByTxn.set(id, kind);
  }
  for (const row of rows) {
    if (kindFromDiscountType(row.itemDiscountType) ?? kindFromDiscountType(row.totalDiscountType)) continue;
    const id = row.transactionId?.trim() || row.receiptNo?.trim();
    const kind = id ? kindByTxn.get(id) : undefined;
    if (kind && !row.itemDiscountType) row.itemDiscountType = kind;
  }
}

/**
 * POS Pax Discount Amount columns are often 0. Classify implied Gross−Discounted
 * using Item Discount Type. VAT-exempt lines without a type are PWD (POS uses
 * that type ~10× more often than senior on DOT files).
 */
export function assignedLineDiscounts(row: ProcessedRow): {
  regular: number;
  senior: number;
  pwd: number;
} {
  const regular = moneyOrZero(row.regularDiscount);
  const senior = moneyOrZero(row.seniorDiscount);
  const pwd = moneyOrZero(row.pwdDiscount);
  if (regular + senior + pwd > 0.005) return { regular, senior, pwd };

  const implied = impliedLineDiscount(row);
  if (implied <= 0.005) return { regular: 0, senior: 0, pwd: 0 };

  const kind = explicitDiscountKind(row);
  if (kind === "senior") return { regular: 0, senior: implied, pwd: 0 };
  if (kind === "regular") return { regular: implied, senior: 0, pwd: 0 };
  if (kind === "pwd" || moneyOrZero(row.vatExemption) > 0.005) {
    return { regular: 0, senior: 0, pwd: implied };
  }
  return { regular: implied, senior: 0, pwd: 0 };
}

function txnDiscountKey(day: string, branchSlug: string, row: ProcessedRow): string {
  const id = row.transactionId?.trim() || row.receiptNo?.trim();
  return id ? `${day}::${branchSlug}::${id}` : "";
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
  const txnKind = new Map<string, PosDiscountKind>();

  for (const report of reports) {
    for (const row of report.rowDetails) {
      if (!(row.transactionDate instanceof Date) || Number.isNaN(row.transactionDate.getTime())) {
        continue;
      }
      const day = toLocalYmd(row.transactionDate);
      const ownerKey = `${day}::${report.branch}`;
      if (owners.get(ownerKey) !== report.id) continue;
      const kind = explicitDiscountKind(row);
      const tk = txnDiscountKey(day, report.branch, row);
      if (kind && tk && !txnKind.has(tk)) txnKind.set(tk, kind);
    }
  }

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

      const explicitReg = moneyOrZero(row.regularDiscount);
      const explicitSen = moneyOrZero(row.seniorDiscount);
      const explicitPwd = moneyOrZero(row.pwdDiscount);
      const explicitSum = explicitReg + explicitSen + explicitPwd;
      if (explicitSum > 0.005) {
        cell.regularDiscount += explicitReg;
        cell.seniorDiscount += explicitSen;
        cell.pwdDiscount += explicitPwd;
      } else {
        const implied = impliedLineDiscount(row);
        const tk = txnDiscountKey(day, report.branch, row);
        const kind =
          explicitDiscountKind(row) ??
          (tk ? txnKind.get(tk) ?? null : null) ??
          (moneyOrZero(row.vatExemption) > 0.005 ? "pwd" : implied > 0.005 ? "regular" : null);
        if (implied > 0.005 && kind === "senior") cell.seniorDiscount += implied;
        else if (implied > 0.005 && kind === "regular") cell.regularDiscount += implied;
        else if (implied > 0.005) cell.pwdDiscount += implied;
      }

      cell.vatExemption += moneyOrZero(row.vatExemption);

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
    const amounts = {
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
    };
    const grossSales = ledgerGrossSales(amounts);
    const grossSalesNet = grossSales;

    out.push({
      ledgerDate,
      branchId,
      ...amounts,
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

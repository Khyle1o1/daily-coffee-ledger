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

  const cells = new Map<string, Cell>(); // `${date}::${branchSlug}`

  for (const report of reports) {
    for (const row of report.rowDetails) {
      if (!(row.transactionDate instanceof Date) || Number.isNaN(row.transactionDate.getTime())) {
        continue;
      }
      const day = toLocalYmd(row.transactionDate);
      const key = `${day}::${report.branch}`;
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

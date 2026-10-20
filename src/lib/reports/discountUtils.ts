/**
 * Utility functions for processing POS discounts.
 *
 * Extracted from deriveDailyLedgerFromPos.ts to avoid the Supabase dependency
 * chain when used in shared processing modules.
 */

import type { ProcessedRow, RawRow } from '@/utils/types';

export type PosDiscountKind = 'regular' | 'senior' | 'pwd';

function moneyOrZero(n: unknown): number {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/** Gross − discounted, or POS Item/Total Discount Amount when the price gap is empty. */
export function impliedLineDiscount(row: ProcessedRow | RawRow): number {
  const gross = moneyOrZero((row as ProcessedRow).grossPrice);
  const discounted = moneyOrZero((row as ProcessedRow).discountedPrice);
  if (gross > 0 && discounted > 0 && gross > discounted + 0.005) {
    return gross - discounted;
  }
  const named =
    moneyOrZero((row as ProcessedRow).itemDiscountAmount) +
    moneyOrZero((row as ProcessedRow).totalDiscountAmount);
  if (named > 0.005) return named;
  return (
    moneyOrZero(row.regularDiscount) +
    moneyOrZero(row.seniorDiscount) +
    moneyOrZero(row.pwdDiscount)
  );
}

export function kindFromDiscountType(value: string | undefined | null): PosDiscountKind | null {
  const t = (value ?? '').toLowerCase().trim();
  if (!t) return null;
  if (/\bpwd\b/.test(t) || t.includes('person with')) return 'pwd';
  if (t.includes('senior')) return 'senior';
  if (
    t.includes('regular') ||
    t.includes('promo') ||
    t.includes('employee') ||
    t.includes('naac') ||
    t.includes('solo parent') ||
    t.includes('diplomat')
  ) {
    return 'regular';
  }
  return null;
}

export function explicitDiscountKind(row: ProcessedRow | RawRow): PosDiscountKind | null {
  if (moneyOrZero(row.pwdDiscount) > 0.005) return 'pwd';
  if (moneyOrZero(row.seniorDiscount) > 0.005) return 'senior';
  if (moneyOrZero(row.regularDiscount) > 0.005) return 'regular';
  return (
    kindFromDiscountType((row as ProcessedRow).itemDiscountType) ??
    kindFromDiscountType((row as ProcessedRow).totalDiscountType)
  );
}

/** Copy Item/Total Discount Type onto other lines of the same ticket. */
export function inheritTxnDiscountTypes(rows: Array<ProcessedRow | RawRow>): void {
  const kindByTxn = new Map<string, PosDiscountKind>();
  for (const row of rows) {
    const typedRow = row as ProcessedRow;
    const id = typedRow.transactionId?.trim() || typedRow.receiptNo?.trim();
    if (!id) continue;
    const kind =
      kindFromDiscountType(typedRow.itemDiscountType) ??
      kindFromDiscountType(typedRow.totalDiscountType);
    if (kind && !kindByTxn.has(id)) kindByTxn.set(id, kind);
  }
  for (const row of rows) {
    const typedRow = row as ProcessedRow;
    if (
      kindFromDiscountType(typedRow.itemDiscountType) ??
      kindFromDiscountType(typedRow.totalDiscountType)
    )
      continue;
    const id = typedRow.transactionId?.trim() || typedRow.receiptNo?.trim();
    const kind = id ? kindByTxn.get(id) : undefined;
    if (kind && !typedRow.itemDiscountType) typedRow.itemDiscountType = kind;
  }
}

/**
 * POS Pax Discount Amount columns are often 0. Classify implied Gross−Discounted
 * using Item Discount Type. VAT-exempt lines without a type are PWD (POS uses
 * that type ~10× more often than senior on DOT files).
 */
export function assignedLineDiscounts(row: ProcessedRow | RawRow): {
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
  if (kind === 'senior') return { regular: 0, senior: implied, pwd: 0 };
  if (kind === 'regular') return { regular: implied, senior: 0, pwd: 0 };
  if (kind === 'pwd' || moneyOrZero((row as ProcessedRow).vatExemption) > 0.005) {
    return { regular: 0, senior: 0, pwd: implied };
  }
  return { regular: implied, senior: 0, pwd: 0 };
}

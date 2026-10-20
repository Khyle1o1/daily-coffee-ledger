/**
 * Shared CSV processing pipeline for transaction imports.
 *
 * This module contains the same processing logic used by SummaryPage.tsx's
 * Add-data dialog. It can be used by both the browser UI and the Node.js
 * UTAK sync script (via tsx).
 *
 * The pipeline:
 * 1. Parse CSV content
 * 2. Auto-detect column mappings
 * 3. Parse transaction dates
 * 4. Build raw rows with enriched fields
 * 5. Inherit transaction-level discount types
 * 6. Assign line discounts from implied amounts
 * 7. Map rows using the real mapRow function with full validation table
 * 8. Aggregate by category
 * 9. Build daily breakdown and date bounds
 */

import { format } from 'date-fns';
import type {
  BranchId,
  ColumnMapping,
  DailyReport,
  MappingEntry,
  ProcessedRow,
  RawRow,
} from '@/utils/types';
import { mapRow } from '@/utils/mapRow';
import { aggregateByCategory, getUnmappedSummary } from '@/utils/aggregate';
import { buildDailyBreakdown } from '@/lib/reports/dailyBreakdown';
import { contentDateBoundsFromRowDetails } from '@/lib/reports/posReportCoverage';
import { assignedLineDiscounts, inheritTxnDiscountTypes } from '@/lib/reports/discountUtils';
import { findTransactionDateKey } from '@/lib/csv/findTransactionDateKey';
import { parseTransactionDate } from '@/lib/csv/parseTransactionDate';

export interface ProcessTransactionsCsvOptions {
  /** Raw CSV content as a string */
  csvContent: string;
  /** Branch slug/identifier */
  branch: BranchId;
  /** Original filename (for metadata) */
  filename: string;
  /** Combined mapping table: manual entries first, then Validation.xlsx, then defaults */
  mappingTable: MappingEntry[];
  /** Optional: filter to specific date (YYYY-MM-DD). If null, includes all dates. */
  targetDate?: string | null;
}

export interface ProcessTransactionsCsvResult {
  /** The fully processed report, or null if processing failed */
  report: DailyReport | null;
  /** Error message if processing failed */
  error: string | null;
  /** Number of rows skipped due to invalid dates */
  skippedDates: number;
}

/**
 * Parse optional money value from CSV cell.
 */
function parseOptMoney(raw: string | undefined): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = parseFloat(String(raw).replace(/[,₱\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Get the first non-empty discount type from multiple candidates.
 */
function firstDiscountType(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    const t = String(v ?? '').trim();
    if (t) return t;
  }
  return undefined;
}

/**
 * Parse CSV content into headers and data rows.
 * Uses papaparse via dynamic import to support both browser and Node.
 */
async function parseCsvContent(
  csvContent: string
): Promise<{ headers: string[]; data: Record<string, string>[] }> {
  const Papa = await import('papaparse');
  const result = Papa.default.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
  });

  const headers = result.meta.fields || [];
  const data = result.data.filter((row) =>
    Object.values(row).some((v) => String(v ?? '').trim() !== '')
  );

  return { headers, data };
}

/**
 * Auto-detect column mappings from CSV headers.
 */
function autoDetectColumns(headers: string[]): Partial<Record<keyof ColumnMapping, string>> {
  const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
    itemDiscountType: ['item discount type', 'pax discount type', 'discount type'],
    totalDiscountType: ['total discount type'],
    itemDiscountAmount: ['item discount amount'],
    totalDiscountAmount: ['total discount amount'],
    rawCategory: ['category', 'cat', 'rawcategory', 'type'],
    rawItemName: ['item', 'item_name', 'itemname', 'name', 'product', 'description'],
    option: ['option', 'modifier', 'variant', 'size'],
    quantity: ['quantity', 'qty', 'num'],
    unitPrice: ['unit_price', 'unitprice', 'price', 'unit price', 'price per unit'],
    paymentType: ['payment_type', 'payment type', 'channel'],
    transactionId: ['transaction id', 'transaction_id', 'txn id'],
    receiptNo: ['receipt no', 'receipt_no'],
    grossPrice: ['gross price', 'gross_price'],
    discountedPrice: ['discounted price', 'discounted_price'],
    regularDiscount: [
      'pax discount amount regular',
      'pax discount amount - regular',
      'regular discount',
    ],
    seniorDiscount: [
      'pax discount amount senior',
      'pax discount amount - senior',
      'senior discount',
    ],
    pwdDiscount: ['pax discount amount pwd', 'pax discount amount - pwd', 'pwd discount'],
    vatExemption: ['vat exemption', 'pax vat exemption'],
  };

  const normalizeHeader = (h: string) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const result: Partial<Record<keyof ColumnMapping, string>> = {};
  const lowerHeaders = headers.map(normalizeHeader);

  for (const [field, hints] of Object.entries(HEADER_HINTS) as [keyof ColumnMapping, string[]][]) {
    for (const hint of hints) {
      const normHint = normalizeHeader(hint);
      const idx = lowerHeaders.findIndex((h) => h === normHint || h.includes(normHint));
      if (idx !== -1 && !Object.values(result).includes(headers[idx])) {
        result[field] = headers[idx];
        break;
      }
    }
  }

  return result;
}

/**
 * Process a transactions CSV using the exact same pipeline as SummaryPage.tsx.
 *
 * This function produces the same DailyReport structure that the Add-data dialog
 * builds, including:
 * - Full rowDetails with all enriched fields
 * - Proper category mapping via Validation.xlsx + manual_mappings + defaultMapping
 * - Discount/VAT handling via inheritTxnDiscountTypes and assignedLineDiscounts
 * - dailyBreakdown per calendar day
 * - Correct date bounds from actual transaction dates
 *
 * @param options Processing options including CSV content, branch, and mapping table
 * @returns Processed report or error
 */
export async function processTransactionsCsv(
  options: ProcessTransactionsCsvOptions
): Promise<ProcessTransactionsCsvResult> {
  const { csvContent, branch, filename, mappingTable, targetDate } = options;

  // Parse CSV
  const { headers, data } = await parseCsvContent(csvContent);

  if (data.length === 0) {
    return { report: null, error: 'Empty CSV file', skippedDates: 0 };
  }

  // Auto-detect columns
  const autoMapping = autoDetectColumns(headers);

  const mapping: ColumnMapping = {
    rawCategory: autoMapping.rawCategory || '',
    rawItemName: autoMapping.rawItemName || '',
    option: autoMapping.option || '',
    quantity: autoMapping.quantity || '',
    unitPrice: autoMapping.unitPrice || '',
    paymentType: autoMapping.paymentType || '',
    transactionId: autoMapping.transactionId || '',
    receiptNo: autoMapping.receiptNo || '',
    grossPrice: autoMapping.grossPrice || '',
    discountedPrice: autoMapping.discountedPrice || '',
    regularDiscount: autoMapping.regularDiscount || '',
    seniorDiscount: autoMapping.seniorDiscount || '',
    pwdDiscount: autoMapping.pwdDiscount || '',
    vatExemption: autoMapping.vatExemption || '',
    itemDiscountType: autoMapping.itemDiscountType || '',
    totalDiscountType: autoMapping.totalDiscountType || '',
    itemDiscountAmount: autoMapping.itemDiscountAmount || '',
    totalDiscountAmount: autoMapping.totalDiscountAmount || '',
  };

  const required: (keyof ColumnMapping)[] = ['rawCategory', 'rawItemName', 'quantity', 'unitPrice'];
  const allMapped = required.every((field) => mapping[field]);

  if (!allMapped) {
    return {
      report: null,
      error: 'Missing required columns (category, item, quantity, unitPrice)',
      skippedDates: 0,
    };
  }

  const dateKey = findTransactionDateKey(headers);

  // Build raw rows
  const rawRows: RawRow[] = [];
  let skippedDates = 0;

  for (const r of data) {
    const d = dateKey ? parseTransactionDate(r[dateKey]) : null;
    if (!d) {
      skippedDates += 1;
      continue;
    }

    // Filter to target date if specified
    if (targetDate) {
      const rowDateStr = format(d, 'yyyy-MM-dd');
      if (rowDateStr !== targetDate) continue;
    }

    const raw: RawRow = {
      rawCategory: r[mapping.rawCategory] || '',
      rawItemName: r[mapping.rawItemName] || '',
      option: mapping.option ? r[mapping.option] || '' : '',
      quantity: parseFloat(r[mapping.quantity]) || 0,
      unitPrice: parseFloat(r[mapping.unitPrice]) || 0,
      paymentType: mapping.paymentType ? r[mapping.paymentType] || '' : undefined,
      transactionDate: d,
      transactionId: mapping.transactionId ? r[mapping.transactionId] || undefined : undefined,
      receiptNo: mapping.receiptNo ? r[mapping.receiptNo] || undefined : undefined,
      grossPrice: mapping.grossPrice ? parseOptMoney(r[mapping.grossPrice]) : undefined,
      discountedPrice: mapping.discountedPrice
        ? parseOptMoney(r[mapping.discountedPrice])
        : undefined,
      regularDiscount: mapping.regularDiscount
        ? parseOptMoney(r[mapping.regularDiscount])
        : undefined,
      seniorDiscount: mapping.seniorDiscount ? parseOptMoney(r[mapping.seniorDiscount]) : undefined,
      pwdDiscount: mapping.pwdDiscount ? parseOptMoney(r[mapping.pwdDiscount]) : undefined,
      vatExemption: mapping.vatExemption ? parseOptMoney(r[mapping.vatExemption]) : undefined,
      itemDiscountType: firstDiscountType(
        mapping.itemDiscountType ? r[mapping.itemDiscountType] : undefined,
        mapping.totalDiscountType ? r[mapping.totalDiscountType] : undefined
      ),
      totalDiscountType: mapping.totalDiscountType
        ? r[mapping.totalDiscountType] || undefined
        : undefined,
      itemDiscountAmount: mapping.itemDiscountAmount
        ? parseOptMoney(r[mapping.itemDiscountAmount])
        : undefined,
      totalDiscountAmount: mapping.totalDiscountAmount
        ? parseOptMoney(r[mapping.totalDiscountAmount])
        : undefined,
    };
    rawRows.push(raw);
  }

  if (rawRows.length === 0) {
    return {
      report: null,
      error: targetDate ? `No transactions for ${targetDate}` : 'No valid rows with dates',
      skippedDates,
    };
  }

  // Apply discount type inheritance across transaction lines
  inheritTxnDiscountTypes(rawRows as ProcessedRow[]);

  // Assign line discounts from implied amounts
  for (const row of rawRows) {
    const stamped = assignedLineDiscounts(row as ProcessedRow);
    if (stamped.regular) row.regularDiscount = stamped.regular;
    if (stamped.senior) row.seniorDiscount = stamped.senior;
    if (stamped.pwd) row.pwdDiscount = stamped.pwd;
  }

  // Map rows using the real mapRow function
  const processed = rawRows.map((r) => mapRow(r, mappingTable));

  // Aggregate results
  const { totals, quantities, grandTotal, grandQuantity, percents } = aggregateByCategory(processed);
  const unmappedSummary = getUnmappedSummary(processed);
  const dailyBreakdown = buildDailyBreakdown(processed);

  // Detect date bounds from actual row data
  const bounds = contentDateBoundsFromRowDetails(processed);
  const dateStr = bounds?.start ?? format(new Date(), 'yyyy-MM-dd');
  const dateEndStr = bounds?.end ?? dateStr;

  // Build the report in the same format as SummaryPage.tsx
  const report: DailyReport = {
    id: '', // Will be set by database on save
    date: dateStr,
    dateRangeEnd: dateEndStr,
    branch,
    filename,
    uploadedAt: Date.now(),
    totalRows: processed.length,
    mappedRows: processed.filter((r) => r.status === 'MAPPED').length,
    unmappedRows: processed.filter((r) => r.status === 'UNMAPPED').length,
    skippedRows: processed.filter((r) => r.status === 'SKIPPED').length,
    summaryTotalsByCat: totals,
    summaryQuantitiesByCat: quantities,
    grandTotal,
    grandQuantity,
    percentByCat: percents,
    rowDetails: processed,
    unmappedSummary,
    dailyBreakdown,
  };

  return { report, error: null, skippedDates };
}

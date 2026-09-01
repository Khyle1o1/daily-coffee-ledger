// Reports Service - Supabase Integration
// Handles all database operations for branches and reports

import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import type { BranchId, ProcessedRow } from '@/utils/types';
import { BRANCHES } from '@/utils/types';
import type {
  Branch,
  DailyReportRow,
  DailyReportListRow,
  DailySummaryJSON,
  ListDailyReportsParams,
  ListDailyReportsResult,
  MonthlyReportRow,
  SaveDailyReportPayload,
  SaveMonthlyReportPayload,
} from '@/lib/supabase-types';
import {
  collectLocalDaysFromRowDetails,
  contentDateBoundsFromRowDetails,
  localYmdFromUnknown,
  rebuildSummaryJsonFromRowDetails,
} from '@/lib/reports/posReportCoverage';

/** Default page size for paginated list queries. */
export const PAGE_SIZE = 50;

/** Reports per request when falling back to table select (RPC prefers whole-range). */
export const COMPUTE_CHUNK_SIZE = 25;

/** Hard cap on overlapping report rows for a single RPC / month-window fetch. */
export const MAX_COMPUTE_REPORTS = 40;

/**
 * Soft ceiling per HTTP/RPC request (one month or one branch batch).
 * Long generates split into multiple requests and merge client-side.
 */
export const MAX_COMPUTE_PAYLOAD_BYTES = 48 * 1024 * 1024;

/** Hard ceiling on merged in-memory payload after all windows/batches. */
export const MAX_COMPUTE_MERGED_PAYLOAD_BYTES = 384 * 1024 * 1024;

/** Max branches per RPC when a single month window exceeds MAX_COMPUTE_PAYLOAD_BYTES. */
const COMPUTE_BRANCH_BATCH_SIZE = 3;

/** Max calendar days for a single generate (primary or fetch-bounds span). */
export const MAX_GENERATE_SPAN_DAYS = 366;

/** Max unique reports after merging all month windows for a long-range generate. */
export const MAX_COMPUTE_RANGE_REPORTS = 150;

/** Parallel month-window fetches when RPC is unavailable or over the row cap. */
const COMPUTE_WINDOW_CONCURRENCY = 3;

/** Fields compute paths need from each rowDetail (drops verbose mapping debug). */
const COMPUTE_ROW_DETAIL_KEYS = [
  "transactionDate",
  "quantity",
  "unitPrice",
  "rowSales",
  "mappedCat",
  "mappedItemName",
  "rawItemName",
  "rawCategory",
  "option",
  "paymentType",
  "status",
  "transactionId",
  "receiptNo",
  "grossPrice",
  "discountedPrice",
  "regularDiscount",
  "seniorDiscount",
  "pwdDiscount",
  "vatExemption",
] as const;

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toLocalDateKey(value: unknown): number | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Split an inclusive YYYY-MM-DD span into calendar-month windows,
 * clamping the first/last month to the selected bounds.
 */
export function iterMonthWindows(
  dateFrom: string,
  dateTo: string,
): Array<{ dateFrom: string; dateTo: string }> {
  const end = parseYmdLocal(dateTo);
  let cursor = parseYmdLocal(dateFrom);
  if (cursor > end) return [];

  const windows: Array<{ dateFrom: string; dateTo: string }> = [];
  while (cursor <= end) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const wFrom = cursor > monthStart ? cursor : monthStart;
    const wTo = end < monthEnd ? end : monthEnd;
    windows.push({ dateFrom: formatYmdLocal(wFrom), dateTo: formatYmdLocal(wTo) });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return windows;
}

/** Drop unmappedSummary and keep only compute-needed rowDetail fields. */
function slimSummaryJsonForCompute(row: DailyReportRow): DailyReportRow {
  const json = row.summary_json as DailySummaryJSON | null | undefined;
  if (!json) return row;

  const rowDetails = Array.isArray(json.rowDetails)
    ? json.rowDetails.map((r) => {
        const slim: Record<string, unknown> = {};
        for (const key of COMPUTE_ROW_DETAIL_KEYS) {
          if (r != null && r[key] !== undefined) slim[key] = r[key];
        }
        return slim;
      })
    : [];

  return {
    ...row,
    summary_json: {
      ...json,
      rowDetails,
      unmappedSummary: [],
    },
  };
}

/**
 * Slim for compute, then keep only rowDetails whose transaction date falls
 * within [dateFrom, dateTo].
 */
function pruneSummaryJsonRowDetails(
  row: DailyReportRow,
  dateFrom: string,
  dateTo: string,
): DailyReportRow {
  const slimmed = slimSummaryJsonForCompute(row);
  const json = slimmed.summary_json as DailySummaryJSON | null | undefined;
  if (!json || !Array.isArray(json.rowDetails) || json.rowDetails.length === 0) {
    return slimmed;
  }

  const startKey = toLocalDateKey(parseYmdLocal(dateFrom));
  const endKey = toLocalDateKey(parseYmdLocal(dateTo));
  if (startKey == null || endKey == null) return slimmed;

  const pruned = json.rowDetails.filter((r) => {
    const key = toLocalDateKey(r?.transactionDate);
    if (key == null) return false;
    return key >= startKey && key <= endKey;
  });

  if (pruned.length === json.rowDetails.length) return slimmed;

  return {
    ...slimmed,
    summary_json: {
      ...json,
      rowDetails: pruned,
      unmappedSummary: [],
    },
  };
}

// ============================================================================
// BRANCH OPERATIONS
// ============================================================================

/**
 * Fetch all branches from the database
 */
export async function getBranches(): Promise<Branch[]> {
  try {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, label, created_at, updated_at')
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('getBranches error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Get a branch by its name (BranchId)
 */
export async function getBranchByName(name: BranchId): Promise<Branch | null> {
  try {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, label, created_at, updated_at')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to fetch branch: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('getBranchByName error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Ensure a branch exists for the given name (BranchId).
 * If it does not exist yet, it will be created.
 */
export async function ensureBranchExists(name: BranchId): Promise<Branch> {
  const existing = await getBranchByName(name);
  if (existing) return existing;

  try {
    const label = BRANCHES.find((b) => b.name === name)?.label ?? name;

    const { data, error } = await supabase
      .from("branches")
      .insert({ name, label })
      .select('id, name, label, created_at, updated_at')
      .single();

    if (error) {
      throw new Error(`Failed to create branch "${name}": ${error.message}`);
    }

    return data as Branch;
  } catch (error) {
    console.error("ensureBranchExists error:", error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Seed branches if the table is empty
 * This runs automatically on app load
 */
export async function seedBranchesIfEmpty(): Promise<void> {
  try {
    // Check if branches exist
    const { data: existing, error: checkError } = await supabase
      .from('branches')
      .select('id')
      .limit(1);

    if (checkError) {
      throw new Error(`Failed to check branches: ${checkError.message}`);
    }

    // If branches already exist, skip seeding
    if (existing && existing.length > 0) {
      return;
    }

    // Seed the branches (must match branches.name CHECK constraint)
    const branches = [
      { name: 'greenbelt', label: 'Greenbelt' },
      { name: 'greenhills', label: 'Greenhills' },
      { name: 'podium', label: 'Podium' },
      { name: 'mind_museum', label: 'The Mind Museum' },
      { name: 'trinoma', label: 'Trinoma' },
      { name: 'uptown', label: 'Uptown' },
      { name: 'wgc', label: 'WGC' },
      { name: 'wcc', label: 'WCC' },
      { name: 'events', label: 'Events' },
    ];

    const { error: insertError } = await supabase
      .from('branches')
      .insert(branches);

    if (insertError) {
      throw new Error(`Failed to seed branches: ${insertError.message}`);
    }

    console.log('✅ Branches seeded successfully');
  } catch (error) {
    console.error('seedBranchesIfEmpty error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

// ============================================================================
// DAILY REPORT OPERATIONS
// ============================================================================

/**
 * After saving a report, remove any calendar days it covers from other uploads
 * for the same branch (trim or delete siblings). Prevents double-counting on generate.
 */
export async function reconcileOverlappingSiblingReports(params: {
  branchId: string;
  keepReportId: string;
  keepDays: Set<string>;
  dateFrom: string;
  dateTo: string;
}): Promise<{ trimmed: number; deleted: number }> {
  const { branchId, keepReportId, keepDays, dateFrom, dateTo } = params;
  if (keepDays.size === 0) return { trimmed: 0, deleted: 0 };

  const { data: siblings, error } = await supabase
    .from('reports_daily')
    .select('id, date_range_start, date_range_end, summary_json')
    .eq('branch_id', branchId)
    .neq('id', keepReportId)
    .lte('date_range_start', dateTo)
    .gte('date_range_end', dateFrom);

  if (error) {
    throw new Error(`Failed to load overlapping reports: ${error.message}`);
  }

  let trimmed = 0;
  let deleted = 0;

  for (const sibling of siblings ?? []) {
    const details = Array.isArray(sibling.summary_json?.rowDetails)
      ? (sibling.summary_json.rowDetails as ProcessedRow[])
      : [];
    const kept = details.filter((row) => {
      const day = localYmdFromUnknown(row.transactionDate);
      return !day || !keepDays.has(day);
    });
    if (kept.length === details.length) continue;

    if (kept.length === 0) {
      const { error: delErr } = await supabase
        .from('reports_daily')
        .delete()
        .eq('id', sibling.id);
      if (delErr) {
        throw new Error(`Failed to delete overlapping report: ${delErr.message}`);
      }
      deleted += 1;
      continue;
    }

    const bounds = contentDateBoundsFromRowDetails(kept);
    if (!bounds) continue;
    const nextJson = rebuildSummaryJsonFromRowDetails(
      (sibling.summary_json ?? {}) as Record<string, unknown>,
      kept,
    );

    const { error: updErr } = await supabase
      .from('reports_daily')
      .update({
        summary_json: nextJson as any,
        date_range_start: bounds.start,
        date_range_end: bounds.end,
        report_date: bounds.start,
      })
      .eq('id', sibling.id);

    if (updErr) {
      throw new Error(`Failed to trim overlapping report: ${updErr.message}`);
    }
    trimmed += 1;
  }

  return { trimmed, deleted };
}

/**
 * Save a daily report (upsert - insert or update if exists).
 * Normalizes date ranges from rowDetails and strips overlapping days from
 * other uploads for the same branch so Cash Ledger / reports never double-count.
 */
export async function saveDailyReport(
  payload: SaveDailyReportPayload
): Promise<DailyReportRow> {
  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User must be authenticated to save reports');
    }

    const rowDetails = Array.isArray(payload.summaryJson?.rowDetails)
      ? payload.summaryJson.rowDetails
      : [];
    const bounds = contentDateBoundsFromRowDetails(rowDetails);
    const dateRangeStart = bounds?.start ?? payload.dateRangeStart;
    const dateRangeEnd = bounds?.end ?? payload.dateRangeEnd;
    const reportDate = bounds?.start ?? payload.reportDate;
    const keepDays = collectLocalDaysFromRowDetails(rowDetails);

    const { data, error } = await supabase
      .from('reports_daily')
      .upsert(
        {
          branch_id: payload.branchId,
          report_date: reportDate,
          date_range_start: dateRangeStart,
          date_range_end: dateRangeEnd,
          transactions_file_name: payload.transactionsFileName,
          mapping_file_name: payload.mappingFileName || null,
          summary_json: payload.summaryJson as any,
          user_id: user.id,
        },
        {
          onConflict: 'branch_id,report_date',
        }
      )
      .select('id, branch_id, report_date, date_range_start, date_range_end, transactions_file_name, mapping_file_name, summary_json, user_id, created_at, updated_at, branch:branches(id, name, label, created_at, updated_at)')
      .single();

    if (error) {
      throw new Error(`Failed to save daily report: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to save daily report: No data returned');
    }

    const saved = data as DailyReportRow;

    try {
      const result = await reconcileOverlappingSiblingReports({
        branchId: payload.branchId,
        keepReportId: saved.id,
        keepDays,
        dateFrom: dateRangeStart,
        dateTo: dateRangeEnd,
      });
      if (result.trimmed || result.deleted) {
        console.log(
          `[saveDailyReport] reconciled overlaps — trimmed=${result.trimmed} deleted=${result.deleted}`,
        );
      }
    } catch (reconcileError) {
      console.error('saveDailyReport reconcile error:', reconcileError);
      // Save succeeded; overlap reconcile failure should not hide the primary save.
      // Derive-time ownership remains a safety net.
    }

    return saved;
  } catch (error) {
    console.error('saveDailyReport error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * List daily reports for a branch within a date range.
 *
 * @deprecated Prefer `listAllDailyReports` (meta view + pagination). This path
 * still exists for compatibility but uses the lightweight meta view so it cannot
 * overload PostgREST with full rowDetails blobs.
 */
export async function listDailyReports(
  branchId: string,
  startDate?: string,
  endDate?: string
): Promise<DailyReportListRow[]> {
  try {
    const { data, total } = await listAllDailyReports({
      branchId,
      dateFrom: startDate,
      dateTo: endDate,
      page: 1,
      pageSize: PAGE_SIZE,
    });
    void total;
    return data;
  } catch (error) {
    console.error('listDailyReports error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Paginated list of daily reports across all branches — LIGHTWEIGHT.
 *
 * Queries the `reports_daily_meta` view which strips `rowDetails` and
 * `unmappedSummary` from `summary_json`.  This reduces the payload from
 * ~192 KB/row to ~5–10 KB/row, eliminating the PostgREST statement timeout.
 *
 * All lightweight aggregate fields (grandTotal, summaryTotalsByCat,
 * grandQuantity, percentByCat, row stats, filename, uploadedAt) are preserved
 * so the history sidebar and KPI cards continue to work without changes.
 *
 * For full summary_json (rowDetails + unmappedSummary) use:
 *   • getDailyReport(id)              — single report detail
 *   • fetchDailyReportsForCompute()   — batch for report generation
 *
 * @param params.page      1-based page number (default: 1)
 * @param params.pageSize  rows per page (default: PAGE_SIZE = 50)
 * @param params.branchId  filter to a single branch UUID
 * @param params.dateFrom  inclusive lower bound — filters by date-range *overlap*
 * @param params.dateTo    inclusive upper bound — filters by date-range *overlap*
 */
export async function listAllDailyReports(
  params: ListDailyReportsParams = {},
): Promise<ListDailyReportsResult> {
  const { page = 1, pageSize = PAGE_SIZE, branchId, dateFrom, dateTo } = params;
  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  const t0 = performance.now();

  try {
    // reports_daily_meta is a view that strips rowDetails + unmappedSummary.
    // PostgREST resolves the branch:branches(...) relationship via the
    // branch_id FK that the view inherits from reports_daily.
    let query = supabase
      .from('reports_daily_meta' as any)
      .select(
        'id, branch_id, report_date, date_range_start, date_range_end, ' +
        'transactions_file_name, mapping_file_name, summary_json, ' +
        'created_at, updated_at, ' +
        'branch:branches(id, name, label, created_at, updated_at)',
      )
      .order('report_date', { ascending: false })
      .order('branch_id',   { ascending: true  })
      .range(from, to);

    if (branchId) query = query.eq('branch_id', branchId);

    // Overlap (not report_date alone) so dual-month uploads still appear when
    // the selected filter only covers the second month (e.g. Jul inside Jun–Jul).
    if (dateFrom && dateTo) {
      query = query.lte('date_range_start', dateTo).gte('date_range_end', dateFrom);
    } else if (dateFrom) {
      query = query.gte('date_range_end', dateFrom);
    } else if (dateTo) {
      query = query.lte('date_range_start', dateTo);
    }

    const { data, error } = await query;

    const elapsed = Math.round(performance.now() - t0);

    if (error) {
      console.error(`[listAllDailyReports] ❌ ${elapsed}ms — ${error.message}`);
      throw new Error(`Failed to list daily reports: ${error.message}`);
    }

    const rows = (data as DailyReportListRow[]) ?? [];
    const approxKb = Math.round(JSON.stringify(rows).length / 1024);
    console.log(
      `[listAllDailyReports] ✅ ${rows.length} rows in ${elapsed}ms (~${approxKb} KB) — page ${page}` +
        (dateFrom || dateTo ? ` overlap ${dateFrom ?? "…"}→${dateTo ?? "…"}` : ""),
    );

    return { data: rows, total: rows.length };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(handleSupabaseError(error));
  }
}

type ComputeFetchParams = {
  dateFrom: string;
  dateTo: string;
  branchIds?: string[];
  /** When false, RPC omits rowDetails (aggregate-only reports). Default true. */
  includeRowDetails?: boolean;
};

type ComputeSlimRpcRow = {
  id: string;
  branch_id: string;
  report_date: string;
  date_range_start: string;
  date_range_end: string;
  transactions_file_name: string | null;
  mapping_file_name: string | null;
  summary_json: DailySummaryJSON | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  branch_name: string | null;
  branch_label: string | null;
};

function mapComputeSlimRpcRow(row: ComputeSlimRpcRow): DailyReportRow {
  return {
    id: row.id,
    branch_id: row.branch_id,
    report_date: row.report_date,
    date_range_start: row.date_range_start,
    date_range_end: row.date_range_end,
    transactions_file_name: row.transactions_file_name,
    mapping_file_name: row.mapping_file_name,
    summary_json: row.summary_json as any,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    branch: {
      id: row.branch_id,
      name: row.branch_name || "greenbelt",
      label: row.branch_label || row.branch_name || "Greenbelt",
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function payloadTooLargeMessage(approxBytes: number, scope: string): string {
  return (
    `Report payload too large (~${Math.round(approxBytes / (1024 * 1024))} MB) ${scope}. ` +
    `Try fewer branches or a shorter range (max ~${Math.round(MAX_COMPUTE_PAYLOAD_BYTES / (1024 * 1024))} MB per request).`
  );
}

/**
 * Prefer server-side slim RPC (migration 025): overlap filter + prune/project
 * rowDetails before the payload crosses Kong.
 *
 * Returns null when RPC is missing or the slimmed payload exceeds the per-request
 * cap (caller should split by month and/or branch batch).
 */
export async function fetchDailyReportsForComputeSlim(
  params: ComputeFetchParams,
): Promise<DailyReportRow[] | null> {
  const { dateFrom, dateTo, branchIds, includeRowDetails = true } = params;
  const t0 = performance.now();

  const { data, error } = await supabase.rpc("reports_daily_compute_slim", {
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_branch_ids: branchIds && branchIds.length > 0 ? branchIds : null,
    p_include_row_details: includeRowDetails,
  });

  if (error) {
    console.warn(
      `[fetchDailyReportsForComputeSlim] RPC unavailable (${error.message}); will split or use table fallback`,
    );
    return null;
  }

  const rows = ((data as ComputeSlimRpcRow[]) ?? []).map((row) => {
    const mapped = mapComputeSlimRpcRow(row);
    return includeRowDetails
      ? slimSummaryJsonForCompute(mapped)
      : {
          ...mapped,
          summary_json: {
            ...(mapped.summary_json as DailySummaryJSON),
            rowDetails: [],
            unmappedSummary: [],
          },
        };
  });
  if (rows.length > MAX_COMPUTE_RANGE_REPORTS) {
    throw new Error(
      `Too many overlapping reports (${rows.length}) across the selected range. ` +
        `Narrow the date range or select fewer branches (max ${MAX_COMPUTE_RANGE_REPORTS}).`,
    );
  }

  let approxBytes = 0;
  for (const row of rows) approxBytes += estimateRowBytes(row);
  if (approxBytes > MAX_COMPUTE_PAYLOAD_BYTES) {
    console.warn(
      `[fetchDailyReportsForComputeSlim] payload ~${Math.round(approxBytes / (1024 * 1024))} MB exceeds per-request cap; splitting`,
    );
    return null;
  }

  const elapsed = Math.round(performance.now() - t0);
  if (import.meta.env.DEV) {
    console.log(
      `[fetchDailyReportsForComputeSlim] ✅ ${rows.length} rows in ${elapsed}ms ` +
        `(~${Math.round(approxBytes / 1024)} KB) — overlap ${dateFrom} → ${dateTo}` +
        (includeRowDetails ? "" : " (no rowDetails)"),
    );
  } else {
    console.log(
      `[fetchDailyReportsForComputeSlim] ✅ ${rows.length} rows in ${elapsed}ms — ${dateFrom} → ${dateTo}`,
    );
  }

  return rows;
}

function estimateRowBytes(row: DailyReportRow): number {
  try {
    return JSON.stringify(row.summary_json ?? {}).length + 256;
  } catch {
    return 256;
  }
}

/**
 * One overlap slice: RPC → table chunks → branch batches (when payload is huge).
 */
async function fetchComputeSlice(params: ComputeFetchParams): Promise<DailyReportRow[]> {
  const viaRpc = await fetchDailyReportsForComputeSlim(params);
  if (viaRpc) return viaRpc;

  try {
    const viaTable = await fetchDailyReportsForCompute(params);
    return viaTable;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("payload too large")) throw err;
    console.warn(`[fetchComputeSlice] table fetch oversized for ${params.dateFrom} → ${params.dateTo}`);
  }

  let branchIdList = params.branchIds?.filter(Boolean) ?? [];
  if (branchIdList.length === 0) {
    const branches = await getBranches();
    branchIdList = branches.map((b) => b.id);
  }

  if (branchIdList.length <= 1) {
    throw new Error(
      payloadTooLargeMessage(MAX_COMPUTE_PAYLOAD_BYTES + 1, "for one branch in this date range"),
    );
  }

  console.log(
    `[fetchComputeSlice] branch batches (${COMPUTE_BRANCH_BATCH_SIZE} per request) — ${params.dateFrom} → ${params.dateTo}`,
  );

  const byId = new Map<string, DailyReportRow>();
  for (const batch of chunkArray(branchIdList, COMPUTE_BRANCH_BATCH_SIZE)) {
    const batchRows = await fetchComputeSlice({
      ...params,
      branchIds: batch,
    });
    for (const row of batchRows) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    if (byId.size > MAX_COMPUTE_RANGE_REPORTS) {
      throw new Error(
        `Too many overlapping reports (${byId.size}). Narrow the date range (max ${MAX_COMPUTE_RANGE_REPORTS}).`,
      );
    }
  }

  return Array.from(byId.values());
}

/**
 * Table-select fallback for one date window (used when RPC is missing or
 * when splitting a large range into month windows).
 */
export async function fetchDailyReportsForCompute(params: ComputeFetchParams): Promise<DailyReportRow[]> {
  const { dateFrom, dateTo, branchIds, includeRowDetails = true } = params;
  const t0 = performance.now();

  try {
    const selectCols =
      "id, branch_id, report_date, date_range_start, date_range_end, " +
      "transactions_file_name, mapping_file_name, summary_json, user_id, " +
      "created_at, updated_at, " +
      "branch:branches(id, name, label, created_at, updated_at)";

    const all: DailyReportRow[] = [];
    let offset = 0;
    let approxBytes = 0;

    while (true) {
      const from = offset;
      const to = offset + COMPUTE_CHUNK_SIZE - 1;

      let query = supabase
        .from("reports_daily")
        .select(selectCols)
        .lte("date_range_start", dateTo)
        .gte("date_range_end", dateFrom)
        .order("date_range_start", { ascending: true })
        .order("branch_id", { ascending: true })
        .range(from, to);

      if (branchIds && branchIds.length > 0) {
        query = query.in("branch_id", branchIds);
      }

      const { data, error } = await query;
      if (error) {
        console.error(`[fetchDailyReportsForCompute] ❌ chunk ${from}-${to}: ${error.message}`);
        throw new Error(`Failed to fetch reports for compute: ${error.message}`);
      }

      const raw = (data as DailyReportRow[]) ?? [];
      if (raw.length === 0) break;

      for (const row of raw) {
        const slimmed = slimSummaryJsonForCompute(row);
        const prepared = includeRowDetails
          ? pruneSummaryJsonRowDetails(slimmed, dateFrom, dateTo)
          : {
              ...slimmed,
              summary_json: {
                ...(slimmed.summary_json as DailySummaryJSON),
                rowDetails: [],
                unmappedSummary: [],
              },
            };
        all.push(prepared);
        approxBytes += estimateRowBytes(prepared);
      }

      if (all.length > MAX_COMPUTE_REPORTS) {
        throw new Error(
          `Too many overlapping reports (${all.length}). Narrow the date range or select fewer branches (max ${MAX_COMPUTE_REPORTS}).`,
        );
      }
      if (approxBytes > MAX_COMPUTE_PAYLOAD_BYTES) {
        throw new Error(payloadTooLargeMessage(approxBytes, "for one month window"));
      }

      console.log(
        `[fetchDailyReportsForCompute] chunk ${from}-${to}: ${raw.length} rows ` +
          `(~${Math.round(approxBytes / 1024)} KB cumulative, slimmed)`,
      );

      offset += COMPUTE_CHUNK_SIZE;
      if (raw.length < COMPUTE_CHUNK_SIZE) break;
    }

    const elapsed = Math.round(performance.now() - t0);
    console.log(
      `[fetchDailyReportsForCompute] ✅ ${all.length} rows in ${elapsed}ms (~${Math.round(approxBytes / 1024)} KB) — overlap ${dateFrom} → ${dateTo}`,
    );

    return all;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(handleSupabaseError(error));
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await mapper(items[idx]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Long-range compute fetch.
 *
 * Tries one whole-range RPC, then month windows, then branch batches per window
 * when a single request would exceed the per-request payload cap.
 */
export async function fetchDailyReportsForComputeRange(
  params: ComputeFetchParams,
): Promise<DailyReportRow[]> {
  const { dateFrom, dateTo, branchIds, includeRowDetails = true } = params;
  const t0 = performance.now();

  const wholeRange = await fetchDailyReportsForComputeSlim(params);
  if (wholeRange) {
    const elapsed = Math.round(performance.now() - t0);
    console.log(
      `[fetchDailyReportsForComputeRange] ✅ ${wholeRange.length} reports via RPC in ${elapsed}ms — ${dateFrom} → ${dateTo}`,
    );
    return wholeRange;
  }

  const windows = iterMonthWindows(dateFrom, dateTo);
  if (windows.length === 0) return [];

  const byId = new Map<string, DailyReportRow>();

  const windowResults = await mapPool(
    windows,
    COMPUTE_WINDOW_CONCURRENCY,
    async (window) => {
      console.log(
        `[fetchDailyReportsForComputeRange] window ${window.dateFrom} → ${window.dateTo}`,
      );
      return fetchComputeSlice({
        dateFrom: window.dateFrom,
        dateTo: window.dateTo,
        branchIds,
        includeRowDetails,
      });
    },
  );

  for (const rows of windowResults) {
    for (const row of rows) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    if (byId.size > MAX_COMPUTE_RANGE_REPORTS) {
      throw new Error(
        `Too many overlapping reports (${byId.size}) across the selected range. ` +
          `Narrow the date range (max ${MAX_COMPUTE_RANGE_REPORTS}).`,
      );
    }
  }

  const merged = Array.from(byId.values()).map((row) =>
    includeRowDetails
      ? pruneSummaryJsonRowDetails(row, dateFrom, dateTo)
      : {
          ...row,
          summary_json: {
            ...(row.summary_json as DailySummaryJSON),
            rowDetails: [],
            unmappedSummary: [],
          },
        },
  );

  let mergedBytes = 0;
  for (const row of merged) mergedBytes += estimateRowBytes(row);
  if (mergedBytes > MAX_COMPUTE_MERGED_PAYLOAD_BYTES) {
    throw new Error(
      `Merged report data too large (~${Math.round(mergedBytes / (1024 * 1024))} MB). ` +
        `Narrow the date range or select fewer branches (browser limit ~${Math.round(MAX_COMPUTE_MERGED_PAYLOAD_BYTES / (1024 * 1024))} MB).`,
    );
  }

  const elapsed = Math.round(performance.now() - t0);
  const approxKb = import.meta.env.DEV
    ? Math.round(JSON.stringify(merged).length / 1024)
    : Math.round(mergedBytes / 1024);
  console.log(
    `[fetchDailyReportsForComputeRange] ✅ ${merged.length} unique reports ` +
      `in ${elapsed}ms (~${approxKb} KB)` +
      (windows.length > 1 ? ` across ${windows.length} month window(s)` : " (split fetch)") +
      ` — ${dateFrom} → ${dateTo}`,
  );

  return merged;
}

/**
 * Get a single daily report by ID
 */
export async function getDailyReport(id: string): Promise<DailyReportRow | null> {
  try {
    const { data, error } = await supabase
      .from('reports_daily')
      .select('id, branch_id, report_date, date_range_start, date_range_end, transactions_file_name, mapping_file_name, summary_json, user_id, created_at, updated_at, branch:branches(id, name, label, created_at, updated_at)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch daily report: ${error.message}`);
    }

    return data as DailyReportRow;
  } catch (error) {
    console.error('getDailyReport error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Delete a daily report by ID
 */
export async function deleteDailyReport(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('reports_daily')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete daily report: ${error.message}`);
    }
  } catch (error) {
    console.error('deleteDailyReport error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

// ============================================================================
// MONTHLY REPORT OPERATIONS
// ============================================================================

/**
 * Save a monthly report (upsert - insert or update if exists)
 */
export async function saveMonthlyReport(
  payload: SaveMonthlyReportPayload
): Promise<MonthlyReportRow> {
  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User must be authenticated to save reports');
    }

    const { data, error } = await supabase
      .from('reports_monthly')
      .upsert(
        {
          branch_id: payload.branchId,
          month_key: payload.monthKey,
          date_range_start: payload.dateRangeStart,
          date_range_end: payload.dateRangeEnd,
          summary_json: payload.summaryJson as any,
          user_id: user.id,
        },
        {
          onConflict: 'branch_id,month_key',
        }
      )
      .select('id, branch_id, month_key, date_range_start, date_range_end, summary_json, user_id, created_at, updated_at, branch:branches(id, name, label, created_at, updated_at)')
      .single();

    if (error) {
      throw new Error(`Failed to save monthly report: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to save monthly report: No data returned');
    }

    return data as MonthlyReportRow;
  } catch (error) {
    console.error('saveMonthlyReport error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * List monthly reports for a branch within a date range
 */
export async function listMonthlyReports(
  branchId: string | null,
  monthStart?: string,
  monthEnd?: string
): Promise<MonthlyReportRow[]> {
  try {
    let query = supabase
      .from('reports_monthly')
      .select('id, branch_id, month_key, date_range_start, date_range_end, summary_json, user_id, created_at, updated_at, branch:branches(id, name, label, created_at, updated_at)')
      .order('month_key', { ascending: false });

    if (branchId !== null) {
      query = query.eq('branch_id', branchId);
    } else {
      query = query.is('branch_id', null);
    }

    if (monthStart) {
      query = query.gte('month_key', monthStart);
    }
    if (monthEnd) {
      query = query.lte('month_key', monthEnd);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list monthly reports: ${error.message}`);
    }

    return (data as MonthlyReportRow[]) || [];
  } catch (error) {
    console.error('listMonthlyReports error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Get a single monthly report by ID
 */
export async function getMonthlyReport(id: string): Promise<MonthlyReportRow | null> {
  try {
    const { data, error } = await supabase
      .from('reports_monthly')
      .select('id, branch_id, month_key, date_range_start, date_range_end, summary_json, user_id, created_at, updated_at, branch:branches(id, name, label, created_at, updated_at)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch monthly report: ${error.message}`);
    }

    return data as MonthlyReportRow;
  } catch (error) {
    console.error('getMonthlyReport error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Delete a monthly report by ID
 */
export async function deleteMonthlyReport(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('reports_monthly')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete monthly report: ${error.message}`);
    }
  } catch (error) {
    console.error('deleteMonthlyReport error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

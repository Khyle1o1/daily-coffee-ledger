// Reports Service - Supabase Integration
// Handles all database operations for branches and reports

import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import type { BranchId } from '@/utils/types';
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

/** Default page size for paginated list queries. */
export const PAGE_SIZE = 50;

/** Reports per request when loading full summary_json for compute. */
export const COMPUTE_CHUNK_SIZE = 8;

/** Hard cap on overlapping report rows per month window (protects Supabase CPU/RAM). */
export const MAX_COMPUTE_REPORTS = 40;

/**
 * Soft ceiling on slimmed compute payload per month window.
 * Month windows already bound PostgREST load; this only stops extreme single-month blobs.
 * Raw multi-branch months often exceed 15 MB before slimming — not a date-range issue.
 */
export const MAX_COMPUTE_PAYLOAD_BYTES = 48 * 1024 * 1024;

/** Max calendar days for a single generate (primary or fetch-bounds span). */
export const MAX_GENERATE_SPAN_DAYS = 366;

/** Max unique reports after merging all month windows for a long-range generate. */
export const MAX_COMPUTE_RANGE_REPORTS = 150;

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
 * Save a daily report (upsert - insert or update if exists)
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

    const { data, error } = await supabase
      .from('reports_daily')
      .upsert(
        {
          branch_id: payload.branchId,
          report_date: payload.reportDate,
          date_range_start: payload.dateRangeStart,
          date_range_end: payload.dateRangeEnd,
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

    return data as DailyReportRow;
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

/**
 * Fetch full daily reports (including rowDetails + unmappedSummary) for a
 * specific date range and optional branch filter.
 *
 * Use this ONLY when compute functions need row-level transaction data
 * (product mix, pour-it-forward, HQ sync pack, channel sales summary, etc.).
 * Do NOT call this for list rendering — use listAllDailyReports() instead.
 *
 * IMPORTANT: filter by date-range *overlap*, not report_date alone.
 * Dual-month uploads (e.g. report_date=2026-06-01, range Jun 1–Jul 31) must
 * still be loaded when generating a July-only HQ report — compute then filters
 * rowDetails by transactionDate.
 *
 * Health: results are fetched in chunks, slimmed for compute, and soft-capped
 * by row count + payload size per month window so a wide generate cannot tip
 * Supabase via one unbounded multi-month select.
 *
 * @param dateFrom   inclusive lower bound for the selected period (YYYY-MM-DD)
 * @param dateTo     inclusive upper bound for the selected period (YYYY-MM-DD)
 * @param branchIds  optional list of branch UUIDs to restrict the query
 */
export async function fetchDailyReportsForCompute(params: {
  dateFrom: string;
  dateTo: string;
  branchIds?: string[];
}): Promise<DailyReportRow[]> {
  const { dateFrom, dateTo, branchIds } = params;
  const t0 = performance.now();

  try {
    let countQuery = supabase
      .from('reports_daily')
      .select('id', { count: 'exact', head: true })
      .lte('date_range_start', dateTo)
      .gte('date_range_end', dateFrom);

    if (branchIds && branchIds.length > 0) {
      countQuery = countQuery.in('branch_id', branchIds);
    }

    const { count, error: countError } = await countQuery;
    if (countError) {
      throw new Error(`Failed to count reports for compute: ${countError.message}`);
    }

    const total = count ?? 0;
    if (total > MAX_COMPUTE_REPORTS) {
      throw new Error(
        `Too many overlapping reports (${total}). Narrow the date range or select fewer branches (max ${MAX_COMPUTE_REPORTS}).`,
      );
    }

    const selectCols =
      'id, branch_id, report_date, date_range_start, date_range_end, ' +
      'transactions_file_name, mapping_file_name, summary_json, user_id, ' +
      'created_at, updated_at, ' +
      'branch:branches(id, name, label, created_at, updated_at)';

    const all: DailyReportRow[] = [];
    let offset = 0;

    while (offset < total || (total === 0 && offset === 0)) {
      if (total === 0) break;

      const from = offset;
      const to = Math.min(offset + COMPUTE_CHUNK_SIZE - 1, total - 1);

      let query = supabase
        .from('reports_daily')
        .select(selectCols)
        .lte('date_range_start', dateTo)
        .gte('date_range_end', dateFrom)
        .order('date_range_start', { ascending: true })
        .order('branch_id', { ascending: true })
        .range(from, to);

      if (branchIds && branchIds.length > 0) {
        query = query.in('branch_id', branchIds);
      }

      const { data, error } = await query;
      if (error) {
        console.error(`[fetchDailyReportsForCompute] ❌ chunk ${from}-${to}: ${error.message}`);
        throw new Error(`Failed to fetch reports for compute: ${error.message}`);
      }

      const rows = ((data as DailyReportRow[]) ?? []).map(slimSummaryJsonForCompute);
      all.push(...rows);

      // Measure after slim — raw summary_json often looks "too big" before dropping
      // unmappedSummary / unused rowDetail fields; date span is handled by month windows.
      const approxBytes = JSON.stringify(all).length;
      if (approxBytes > MAX_COMPUTE_PAYLOAD_BYTES) {
        throw new Error(
          `Report payload too large (~${Math.round(approxBytes / (1024 * 1024))} MB) for one month window. ` +
            `Select fewer branches (max ~${Math.round(MAX_COMPUTE_PAYLOAD_BYTES / (1024 * 1024))} MB per month).`,
        );
      }

      console.log(
        `[fetchDailyReportsForCompute] chunk ${from}-${to}: ${rows.length} rows ` +
          `(~${Math.round(approxBytes / 1024)} KB cumulative, slimmed)`,
      );

      offset += COMPUTE_CHUNK_SIZE;
      if (rows.length === 0) break;
    }

    const elapsed = Math.round(performance.now() - t0);
    const approxKb = Math.round(JSON.stringify(all).length / 1024);
    console.log(
      `[fetchDailyReportsForCompute] ✅ ${all.length} rows in ${elapsed}ms (~${approxKb} KB) — overlap ${dateFrom} → ${dateTo}`,
    );

    return all;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(handleSupabaseError(error));
  }
}

/**
 * Long-range compute fetch: load overlapping reports month-by-month, dedupe by id,
 * then prune out-of-range rowDetails so year-long generates stay client-safe.
 *
 * Per-window caps (40 rows / ~15 MB) still protect PostgREST; the merge ceiling
 * is MAX_COMPUTE_RANGE_REPORTS unique reports.
 */
export async function fetchDailyReportsForComputeRange(params: {
  dateFrom: string;
  dateTo: string;
  branchIds?: string[];
}): Promise<DailyReportRow[]> {
  const { dateFrom, dateTo, branchIds } = params;
  const t0 = performance.now();
  const windows = iterMonthWindows(dateFrom, dateTo);

  if (windows.length === 0) return [];

  const byId = new Map<string, DailyReportRow>();

  for (const window of windows) {
    console.log(
      `[fetchDailyReportsForComputeRange] window ${window.dateFrom} → ${window.dateTo}`,
    );
    const rows = await fetchDailyReportsForCompute({
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      branchIds,
    });

    for (const row of rows) {
      // Keep the first slimmed copy — dual-month uploads appear in adjacent windows.
      if (!byId.has(row.id)) byId.set(row.id, row);
    }

    if (byId.size > MAX_COMPUTE_RANGE_REPORTS) {
      throw new Error(
        `Too many overlapping reports (${byId.size}) across the selected range. ` +
          `Narrow the date range or select fewer branches (max ${MAX_COMPUTE_RANGE_REPORTS}).`,
      );
    }
  }

  const merged = Array.from(byId.values()).map((row) =>
    pruneSummaryJsonRowDetails(row, dateFrom, dateTo),
  );

  const elapsed = Math.round(performance.now() - t0);
  const approxKb = Math.round(JSON.stringify(merged).length / 1024);
  console.log(
    `[fetchDailyReportsForComputeRange] ✅ ${merged.length} unique reports ` +
      `in ${elapsed}ms (~${approxKb} KB) across ${windows.length} month window(s) — ${dateFrom} → ${dateTo}`,
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

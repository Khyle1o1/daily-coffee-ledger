// Reports Service - Supabase Integration
// Handles all database operations for branches and reports

import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import type { BranchId } from '@/utils/types';
import { BRANCHES } from '@/utils/types';
import type {
  Branch,
  DailyReportRow,
  DailyReportListRow,
  ListDailyReportsParams,
  ListDailyReportsResult,
  MonthlyReportRow,
  SaveDailyReportPayload,
  SaveMonthlyReportPayload,
} from '@/lib/supabase-types';

/** Default page size for paginated list queries. */
export const PAGE_SIZE = 50;

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
 * List daily reports for a branch within a date range
 */
export async function listDailyReports(
  branchId: string,
  startDate?: string,
  endDate?: string
): Promise<DailyReportRow[]> {
  try {
    let query = supabase
      .from('reports_daily')
      .select('id, branch_id, report_date, date_range_start, date_range_end, transactions_file_name, mapping_file_name, summary_json, user_id, created_at, updated_at, branch:branches(id, name, label, created_at, updated_at)')
      .eq('branch_id', branchId)
      .order('report_date', { ascending: false });

    if (startDate) {
      query = query.gte('report_date', startDate);
    }
    if (endDate) {
      query = query.lte('report_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list daily reports: ${error.message}`);
    }

    return (data as DailyReportRow[]) || [];
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
 * @param params.dateFrom  inclusive lower bound for report_date (YYYY-MM-DD)
 * @param params.dateTo    inclusive upper bound for report_date (YYYY-MM-DD)
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
    if (dateFrom) query = query.gte('report_date', dateFrom);
    if (dateTo)   query = query.lte('report_date', dateTo);

    const { data, error } = await query;

    const elapsed = Math.round(performance.now() - t0);

    if (error) {
      console.error(`[listAllDailyReports] ❌ ${elapsed}ms — ${error.message}`);
      throw new Error(`Failed to list daily reports: ${error.message}`);
    }

    const rows = (data as DailyReportListRow[]) ?? [];
    const approxKb = Math.round(JSON.stringify(rows).length / 1024);
    console.log(
      `[listAllDailyReports] ✅ ${rows.length} rows in ${elapsed}ms (~${approxKb} KB) — page ${page}`,
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
 * Results are intentionally not paginated: the caller (ReportsPage) needs the
 * complete dataset for the selected period to produce accurate aggregations.
 * Date filters keep the payload bounded — a typical month is 30–60 rows.
 *
 * @param dateFrom   inclusive lower bound for report_date (YYYY-MM-DD)
 * @param dateTo     inclusive upper bound for report_date (YYYY-MM-DD)
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
    let query = supabase
      .from('reports_daily')
      .select(
        'id, branch_id, report_date, date_range_start, date_range_end, ' +
        'transactions_file_name, mapping_file_name, summary_json, user_id, ' +
        'created_at, updated_at, ' +
        'branch:branches(id, name, label, created_at, updated_at)',
      )
      .gte('report_date', dateFrom)
      .lte('report_date', dateTo)
      .order('report_date', { ascending: true })
      .order('branch_id',   { ascending: true });

    if (branchIds && branchIds.length > 0) {
      query = query.in('branch_id', branchIds);
    }

    const { data, error } = await query;

    const elapsed = Math.round(performance.now() - t0);

    if (error) {
      console.error(`[fetchDailyReportsForCompute] ❌ ${elapsed}ms — ${error.message}`);
      throw new Error(`Failed to fetch reports for compute: ${error.message}`);
    }

    const rows = (data as DailyReportRow[]) ?? [];
    const approxKb = Math.round(JSON.stringify(rows).length / 1024);
    console.log(
      `[fetchDailyReportsForCompute] ✅ ${rows.length} rows in ${elapsed}ms (~${approxKb} KB) — ${dateFrom} → ${dateTo}`,
    );

    return rows;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(handleSupabaseError(error));
  }
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

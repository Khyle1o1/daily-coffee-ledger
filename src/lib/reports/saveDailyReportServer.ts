/**
 * Server-side daily report saving with injectable Supabase client.
 *
 * This module provides the same functionality as reportsService.ts's saveDailyReport,
 * but accepts a Supabase client as a parameter instead of using the browser singleton.
 * This allows it to be used by:
 * - The browser UI (passing the regular Supabase client)
 * - The Node.js UTAK sync script (passing a service-role client)
 *
 * The processing is identical to ensure synced data produces the exact same
 * reports_daily rows as manual uploads.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyReport, ProcessedRow } from '@/utils/types';
import { dailyReportToJSON } from '@/services/reportConverter';
import {
  collectLocalDaysFromRowDetails,
  contentDateBoundsFromRowDetails,
  localYmdFromUnknown,
  rebuildSummaryJsonFromRowDetails,
} from '@/lib/reports/posReportCoverage';

export interface SaveDailyReportServerOptions {
  /** Supabase client (browser client or service-role client for Node.js) */
  supabase: SupabaseClient;
  /** Branch UUID */
  branchId: string;
  /** The processed report to save */
  report: DailyReport;
  /** User ID for audit (optional - service accounts may not have a user) */
  userId?: string | null;
}

export interface SaveDailyReportServerResult {
  /** The saved report ID */
  id: string;
  /** Whether overlapping reports were modified */
  reconciled: { trimmed: number; deleted: number };
}

/**
 * Reconcile overlapping sibling reports after saving.
 *
 * When a new report covers certain calendar days, remove those days from
 * other uploads for the same branch to prevent double-counting.
 */
async function reconcileOverlappingSiblingReports(
  supabase: SupabaseClient,
  params: {
    branchId: string;
    keepReportId: string;
    keepDays: Set<string>;
    dateFrom: string;
    dateTo: string;
  }
): Promise<{ trimmed: number; deleted: number }> {
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
      kept
    );

    const { error: updErr } = await supabase
      .from('reports_daily')
      .update({
        summary_json: nextJson,
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
 * Save a daily report to the database.
 *
 * This function:
 * 1. Normalizes date ranges from rowDetails
 * 2. Upserts the report (on branch_id + report_date conflict)
 * 3. Reconciles overlapping sibling reports
 *
 * The behavior is identical to reportsService.ts's saveDailyReport to ensure
 * synced data produces the exact same database rows as manual uploads.
 *
 * @param options Save options including Supabase client, branch ID, and report
 * @returns The saved report ID and reconciliation results
 */
export async function saveDailyReportServer(
  options: SaveDailyReportServerOptions
): Promise<SaveDailyReportServerResult> {
  const { supabase, branchId, report, userId } = options;

  const rowDetails = report.rowDetails ?? [];
  const bounds = contentDateBoundsFromRowDetails(rowDetails);
  const dateRangeStart = bounds?.start ?? report.date;
  const dateRangeEnd = bounds?.end ?? (report.dateRangeEnd ?? report.date);
  const reportDate = bounds?.start ?? report.date;
  const keepDays = collectLocalDaysFromRowDetails(rowDetails);

  const summaryJson = dailyReportToJSON(report);

  const { data, error } = await supabase
    .from('reports_daily')
    .upsert(
      {
        branch_id: branchId,
        report_date: reportDate,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        transactions_file_name: report.filename,
        mapping_file_name: null,
        summary_json: summaryJson,
        user_id: userId ?? null,
      },
      {
        onConflict: 'branch_id,report_date',
      }
    )
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to save daily report: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to save daily report: No data returned');
  }

  const savedId = data.id;

  // Reconcile overlapping reports
  let reconciled = { trimmed: 0, deleted: 0 };
  try {
    reconciled = await reconcileOverlappingSiblingReports(supabase, {
      branchId,
      keepReportId: savedId,
      keepDays,
      dateFrom: dateRangeStart,
      dateTo: dateRangeEnd,
    });
  } catch {
    // Save succeeded; overlap reconcile failure should not hide the primary save.
    // Derive-time ownership remains a safety net.
  }

  return { id: savedId, reconciled };
}

/**
 * Look up a branch UUID by its slug/name.
 *
 * @param supabase Supabase client
 * @param slug Branch slug (e.g., "greenbelt", "podium")
 * @returns Branch UUID or null if not found
 */
export async function getBranchUuidBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('name', slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to lookup branch ${slug}: ${error.message}`);
  }

  return data?.id ?? null;
}

/**
 * List all branches from the database.
 *
 * @param supabase Supabase client
 * @returns Array of branch records with id, name, and label
 */
export async function listBranchesServer(
  supabase: SupabaseClient
): Promise<Array<{ id: string; name: string; label: string }>> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, label')
    .order('name');

  if (error) {
    throw new Error(`Failed to list branches: ${error.message}`);
  }

  return data ?? [];
}

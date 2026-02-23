// Reports Service - Supabase Integration
// Handles all database operations for branches and reports

import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import type { BranchId } from '@/utils/types';
import type {
  Branch,
  DailyReportRow,
  MonthlyReportRow,
  SaveDailyReportPayload,
  SaveMonthlyReportPayload,
} from '@/lib/supabase-types';

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
      .select('*')
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
      .select('*')
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

    // Seed the branches
    const branches = [
      { name: 'greenbelt', label: 'Greenbelt' },
      { name: 'podium', label: 'Podium' },
      { name: 'mind_museum', label: 'The Mind Museum' },
      { name: 'trinoma', label: 'Trinoma' },
      { name: 'uptown', label: 'Uptown' },
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
          onConflict: 'user_id,branch_id,report_date',
        }
      )
      .select('*, branch:branches(*)')
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
      .select('*, branch:branches(*)')
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
 * List all daily reports across all branches within a date range
 */
export async function listAllDailyReports(
  startDate?: string,
  endDate?: string
): Promise<DailyReportRow[]> {
  try {
    let query = supabase
      .from('reports_daily')
      .select('*, branch:branches(*)')
      .order('report_date', { ascending: false })
      .order('branch_id', { ascending: true });

    if (startDate) {
      query = query.gte('report_date', startDate);
    }
    if (endDate) {
      query = query.lte('report_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list all daily reports: ${error.message}`);
    }

    return (data as DailyReportRow[]) || [];
  } catch (error) {
    console.error('listAllDailyReports error:', error);
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
      .select('*, branch:branches(*)')
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
          onConflict: 'user_id,branch_id,month_key',
        }
      )
      .select('*, branch:branches(*)')
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
      .select('*, branch:branches(*)')
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
      .select('*, branch:branches(*)')
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

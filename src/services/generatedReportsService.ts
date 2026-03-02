import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import type {
  GeneratedReportRow,
  SaveGeneratedReportPayload,
} from '@/lib/supabase-types';

export async function listGeneratedReports(): Promise<GeneratedReportRow[]> {
  try {
    const { data, error } = await supabase
      .from('generated_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list generated reports: ${error.message}`);
    return (data as GeneratedReportRow[]) || [];
  } catch (error) {
    console.error('listGeneratedReports error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

export async function getGeneratedReport(id: string): Promise<GeneratedReportRow | null> {
  try {
    const { data, error } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch generated report: ${error.message}`);
    }
    return data as GeneratedReportRow;
  } catch (error) {
    console.error('getGeneratedReport error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

export async function saveGeneratedReport(
  payload: SaveGeneratedReportPayload
): Promise<GeneratedReportRow> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User must be authenticated');

    const { data, error } = await supabase
      .from('generated_reports')
      .insert({
        user_id: user.id,
        title: payload.title,
        report_type: payload.reportType,
        branch_id: payload.branchId || null,
        branch_name: payload.branchName,
        date_from: payload.dateFrom,
        date_to: payload.dateTo,
        compare_from: payload.compareFrom || null,
        compare_to: payload.compareTo || null,
        selected_categories: payload.selectedCategories,
        filters: payload.filters,
        computed_data: payload.computedData,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to save generated report: ${error.message}`);
    if (!data) throw new Error('No data returned after save');
    return data as GeneratedReportRow;
  } catch (error) {
    console.error('saveGeneratedReport error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

export async function deleteGeneratedReport(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('generated_reports')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete generated report: ${error.message}`);
  } catch (error) {
    console.error('deleteGeneratedReport error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

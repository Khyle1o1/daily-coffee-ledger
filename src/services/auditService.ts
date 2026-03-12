// Audit Service — writes and reads from the audit_logs table.
// logEvent() is fire-and-forget: errors are swallowed so they never break
// the main user action that triggered them.

import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  AuditLog,
  LogAuditEventPayload,
  ListAuditLogsParams,
} from '@/lib/supabase-types';

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Log a user action.  Call this fire-and-forget — `void logEvent(...)`.
 * Any error is caught and printed to the console so it never disrupts UX.
 */
export async function logEvent(payload: LogAuditEventPayload): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch the user's profile to get role + email (profile email is canonical)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email, role')
      .eq('user_id', user.id)
      .maybeSingle();

    const row = {
      user_id:     user.id,
      user_email:  profile?.email ?? user.email ?? '',
      user_role:   profile?.role  ?? 'user',
      action:      payload.action,
      module:      payload.module,
      target_type: payload.targetType  ?? null,
      target_id:   payload.targetId   ?? null,
      target_name: payload.targetName ?? null,
      details:     payload.details    ?? null,
      metadata:    payload.metadata   ?? {},
      branch_id:   payload.branchId   ?? null,
      report_type: payload.reportType ?? null,
    };

    const { error } = await supabase.from('audit_logs').insert(row);
    if (error) console.error('[auditService] Failed to write log:', error.message);
  } catch (err) {
    console.error('[auditService] Exception writing log:', err);
  }
}

// ---------------------------------------------------------------------------
// Read (admin only — uses the regular client; RLS enforces admin-only read)
// ---------------------------------------------------------------------------

export interface AuditLogsResult {
  logs: AuditLog[];
  total: number;
}

export async function listAuditLogs(
  params: ListAuditLogsParams = {}
): Promise<AuditLogsResult> {
  const {
    userId,
    action,
    module,
    branchId,
    dateFrom,
    dateTo,
    search,
    page     = 1,
    pageSize = 50,
  } = params;

  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  let query = supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (userId)   query = query.eq('user_id', userId);
  if (action)   query = query.eq('action', action);
  if (module)   query = query.eq('module', module);
  if (branchId) query = query.eq('branch_id', branchId);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo)   query = query.lte('created_at', dateTo + 'T23:59:59Z');

  if (search) {
    query = query.or(
      `user_email.ilike.%${search}%,details.ilike.%${search}%,target_name.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`);

  return {
    logs:  (data as AuditLog[]) ?? [],
    total: count ?? 0,
  };
}

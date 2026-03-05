import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import { isCurrentUserAdmin } from '@/services/userService';
import type { Database } from '@/lib/supabase.types';
import type { Branch } from '@/types/branch';

type BranchRow = Database['public']['Tables']['branches']['Row'] & {
  code?: string | null;
  address?: string | null;
  is_active?: boolean | null;
};

function mapBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    code: (row.code ?? '').toString(),
    // Use label as the human-friendly branch name in the admin UI
    name: row.label,
    address: (row as any).address ?? null,
    isActive: (row as any).is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListBranchesParams {
  q?: string;
  active?: boolean;
}

export interface SaveBranchPayload {
  code: string;
  name: string;
  address?: string;
  isActive?: boolean;
}

export async function listBranches(
  params: ListBranchesParams = {},
): Promise<{ items: Branch[]; total: number }> {
  try {
    const { q, active } = params;

    // Require authenticated user (any role). RLS will enforce per-row rules.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('You must be signed in to view branches');
    }

    let query: any = supabase
      .from('branches')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (typeof active === 'boolean') {
      query = query.eq('is_active', active);
    }

    if (q && q.trim() !== '') {
      const term = q.trim();
      query = query.or(
        `code.ilike.%${term}%,label.ilike.%${term}%,name.ilike.%${term}%`,
      );
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list branches: ${error.message}`);
    }

    const rows = (data as BranchRow[]) ?? [];

    return {
      items: rows.map(mapBranch),
      total: count ?? rows.length,
    };
  } catch (error) {
    console.error('listBranches error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

export async function createBranch(payload: SaveBranchPayload): Promise<Branch> {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Only admins can create branches');
    }

    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();
    const address = payload.address?.trim() || null;
    const isActive = payload.isActive ?? true;

    if (!code) {
      throw new Error('Branch code is required');
    }
    if (!name) {
      throw new Error('Branch name is required');
    }

    // Check for duplicate code
    const existingByCode = await (supabase.from('branches') as any)
      .select('id, code')
      .eq('code', code)
      .maybeSingle();

    if (existingByCode.error && existingByCode.error.code !== 'PGRST116') {
      throw new Error(`Failed to validate branch code: ${existingByCode.error.message}`);
    }

    if (existingByCode.data) {
      throw new Error('A branch with this code already exists');
    }

    // Insert new branch. Keep the internal "name" as a slug (for reporting),
    // and store the human-friendly name in "label".
    const slug =
      name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '') || code.toLowerCase();

    const { data, error } = await (supabase.from('branches') as any)
      .insert({
        name: slug,
        label: name,
        code,
        address,
        is_active: isActive,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }

    return mapBranch(data as BranchRow);
  } catch (error) {
    console.error('createBranch error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

export async function updateBranch(
  id: string,
  payload: SaveBranchPayload,
): Promise<Branch> {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Only admins can update branches');
    }

    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();
    const address = payload.address?.trim() || null;
    const isActive = payload.isActive ?? true;

    if (!code) {
      throw new Error('Branch code is required');
    }
    if (!name) {
      throw new Error('Branch name is required');
    }

    // Ensure branch exists
    const existing = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existing.error) {
      if (existing.error.code === 'PGRST116') {
        throw new Error('Branch not found');
      }
      throw new Error(`Failed to load branch: ${existing.error.message}`);
    }

    // If code changed, validate uniqueness
    const current = existing.data as BranchRow | null;

    if (current && current.code !== code) {
      const dup = await (supabase.from('branches') as any)
        .select('id, code')
        .eq('code', code)
        .neq('id', id)
        .maybeSingle();

      if (dup.error && dup.error.code !== 'PGRST116') {
        throw new Error(`Failed to validate branch code: ${dup.error.message}`);
      }

      if (dup.data) {
        throw new Error('A branch with this code already exists');
      }
    }

    const slug =
      name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '') || code.toLowerCase();

    const updates: Record<string, unknown> = {
      code,
      label: name,
      address,
      is_active: isActive,
    };

    // Only update slug/name if it changed
    if (!current || current.name !== slug) {
      updates.name = slug;
    }

    const { data, error } = await (supabase.from('branches') as any)
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update branch: ${error.message}`);
    }

    return mapBranch(data as BranchRow);
  } catch (error) {
    console.error('updateBranch error:', error);
    throw new Error(handleSupabaseError(error));
  }
}


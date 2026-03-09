import { supabase, handleSupabaseError } from '@/lib/supabaseClient';
import { requireAdminUser } from '@/lib/api/authGuards';
import type {
  DirectoryLink,
  CreateDirectoryLinkPayload,
  UpdateDirectoryLinkPayload,
  ListDirectoryLinksParams,
} from '@/lib/supabase-types';

// ============================================================================
// HELPERS
// ============================================================================

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================================================
// LIST
// ============================================================================

export async function listDirectoryLinks(
  params: ListDirectoryLinksParams = {}
): Promise<{ items: DirectoryLink[]; total: number }> {
  try {
    const { q, category, active, sort = 'updatedAt', order = 'desc' } = params;

    const columnMap: Record<string, string> = {
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      name: 'name',
    };
    const orderColumn = columnMap[sort] ?? 'updated_at';

    let query = supabase
      .from('directory_links')
      .select('*', { count: 'exact' })
      .order(orderColumn, { ascending: order === 'asc' });

    if (typeof active === 'boolean') {
      query = query.eq('is_active', active);
    }

    if (category && category !== '') {
      query = query.eq('category', category);
    }

    if (q && q.trim() !== '') {
      const term = q.trim();
      query = query.or(
        `name.ilike.%${term}%,url.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list directory links: ${error.message}`);
    }

    return {
      items: (data as DirectoryLink[]) ?? [],
      total: count ?? 0,
    };
  } catch (error) {
    console.error('listDirectoryLinks error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

// ============================================================================
// GET BY ID (for redirect page — accessible to all authenticated users)
// ============================================================================

export async function getDirectoryLinkById(
  id: string
): Promise<DirectoryLink | null> {
  try {
    const { data, error } = await supabase
      .from('directory_links')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch directory link: ${error.message}`);
    }

    return data as DirectoryLink | null;
  } catch (error) {
    console.error('getDirectoryLinkById error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

// ============================================================================
// CREATE (admin only)
// ============================================================================

export async function createDirectoryLink(
  payload: CreateDirectoryLinkPayload
): Promise<DirectoryLink> {
  try {
    await requireAdminUser();

    if (!payload.name?.trim()) {
      throw new Error('Name is required');
    }
    if (!payload.url?.trim()) {
      throw new Error('URL is required');
    }

    const normalizedUrl = normalizeUrl(payload.url);
    if (!isValidUrl(normalizedUrl)) {
      throw new Error('URL must start with http:// or https://');
    }

    const { data, error } = await supabase
      .from('directory_links')
      .insert({
        name: payload.name.trim(),
        url: normalizedUrl,
        description: payload.description?.trim() || null,
        category: payload.category?.trim() || null,
        is_active: payload.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create directory link: ${error.message}`);
    }

    return data as DirectoryLink;
  } catch (error) {
    console.error('createDirectoryLink error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

// ============================================================================
// UPDATE (admin only)
// ============================================================================

export async function updateDirectoryLink(
  id: string,
  payload: UpdateDirectoryLinkPayload
): Promise<DirectoryLink> {
  try {
    await requireAdminUser();

    const updates: Record<string, unknown> = {};

    if (payload.name !== undefined) {
      if (!payload.name.trim()) throw new Error('Name cannot be empty');
      updates.name = payload.name.trim();
    }

    if (payload.url !== undefined) {
      const normalizedUrl = normalizeUrl(payload.url);
      if (!isValidUrl(normalizedUrl)) {
        throw new Error('URL must start with http:// or https://');
      }
      updates.url = normalizedUrl;
    }

    if (payload.description !== undefined) {
      updates.description = payload.description?.trim() || null;
    }

    if (payload.category !== undefined) {
      updates.category = payload.category?.trim() || null;
    }

    if (payload.is_active !== undefined) {
      updates.is_active = payload.is_active;
    }

    const { data, error } = await supabase
      .from('directory_links')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Directory link not found');
      }
      throw new Error(`Failed to update directory link: ${error.message}`);
    }

    return data as DirectoryLink;
  } catch (error) {
    console.error('updateDirectoryLink error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

// ============================================================================
// DELETE (admin only)
// ============================================================================

export async function deleteDirectoryLink(id: string): Promise<void> {
  try {
    await requireAdminUser();

    const { error } = await supabase
      .from('directory_links')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete directory link: ${error.message}`);
    }
  } catch (error) {
    console.error('deleteDirectoryLink error:', error);
    throw new Error(handleSupabaseError(error));
  }
}

// ============================================================================
// GET UNIQUE CATEGORIES
// ============================================================================

export async function getDirectoryCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('directory_links')
      .select('category')
      .not('category', 'is', null)
      .order('category', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    const unique = Array.from(
      new Set((data ?? []).map((r: { category: string | null }) => r.category).filter(Boolean))
    ) as string[];

    return unique;
  } catch (error) {
    console.error('getDirectoryCategories error:', error);
    return [];
  }
}

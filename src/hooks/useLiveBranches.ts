import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export const LIVE_BRANCHES_QUERY_KEY = ['live-branches'] as const;

/**
 * A branch option as exposed to the UI layer.
 * - uuid  : the database primary key (UUID) – used as FK when saving reports
 * - slug  : the database `name` field (e.g. "greenbelt") – stored in DailyReport.branch
 * - label : the human-readable display name (e.g. "Greenbelt")
 * - code  : the short branch code (e.g. "GBT")
 */
export interface BranchOption {
  uuid: string;
  slug: string;
  label: string;
  code: string;
}

async function fetchActiveBranches(): Promise<BranchOption[]> {
  const { data, error } = await (supabase
    .from('branches') as any)
    .select('id, name, label, code, is_active')
    .eq('is_active', true)
    .order('label');

  if (error) {
    throw new Error(`Failed to fetch branches: ${error.message}`);
  }

  return ((data as any[]) ?? []).map((row) => ({
    uuid: row.id as string,
    slug: row.name as string,
    label: ((row.label || row.name) as string),
    code: ((row.code || '') as string),
  }));
}

/**
 * Shared hook used by every page and component that needs branch data.
 *
 * All callers share the same React-Query cache so there is only one
 * network request per 5-minute window regardless of how many consumers
 * are mounted at the same time.
 */
export function useLiveBranches() {
  const { data: branchOptions = [], isLoading, error } = useQuery({
    queryKey: LIVE_BRANCHES_QUERY_KEY,
    queryFn: fetchActiveBranches,
    staleTime: 5 * 60 * 1000,
  });

  /** Returns the display label for a branch slug, falling back to the slug itself. */
  const getBranchLabel = (slug: string): string =>
    branchOptions.find((b) => b.slug === slug)?.label ?? slug;

  /** Returns the UUID for a branch slug, or null if not found. */
  const getBranchUuid = (slug: string): string | null =>
    branchOptions.find((b) => b.slug === slug)?.uuid ?? null;

  return { branchOptions, isLoading, error, getBranchLabel, getBranchUuid };
}

/**
 * Returns a callback that invalidates the shared branches cache.
 * Call this after any create / update / delete operation in Settings
 * so all pages immediately reflect the change.
 */
export function useInvalidateBranches() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: LIVE_BRANCHES_QUERY_KEY });
}

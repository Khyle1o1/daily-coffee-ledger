import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  listAllDailyReports,
  seedBranchesIfEmpty,
  PAGE_SIZE,
} from "@/services/reportsService";
import { dailyReportsMetaFromRows } from "@/services/reportConverter";
import type { ListDailyReportsParams } from "@/lib/supabase-types";
import type { DailyReport } from "@/utils/types";
import { queryKeys } from "./queryKeys";
import { useAuth } from "@/auth/useAuth";

export interface DailyReportsPage {
  reports: DailyReport[];
  /** Row count for the current page (≤ pageSize). */
  total: number;
  /** True when there may be more pages (data.length === pageSize). */
  hasNextPage: boolean;
}

export interface UseDailyReportsQueryParams extends ListDailyReportsParams {}

/** Seed empty branches at most once per browser session. */
let branchesSeedAttempted = false;

/**
 * Paginated, filtered query for the daily-reports list (meta view).
 *
 * - Uses reports_daily_meta so list payloads stay small.
 * - staleTime 60s + refetch when stale (not on every remount) to avoid API storms.
 * - Mutations still invalidate via queryClient.invalidateQueries.
 */
export function useDailyReportsQuery(params: UseDailyReportsQueryParams = {}) {
  const { user, loading } = useAuth();
  const pageSize = params.pageSize ?? PAGE_SIZE;

  return useQuery<DailyReportsPage>({
    queryKey: queryKeys.reports.dailyList({
      userId:   user?.id,
      page:     params.page,
      pageSize: params.pageSize,
      branchId: params.branchId,
      dateFrom: params.dateFrom,
      dateTo:   params.dateTo,
    }),
    queryFn: async () => {
      if (!branchesSeedAttempted) {
        branchesSeedAttempted = true;
        await seedBranchesIfEmpty().catch(() => undefined);
      }
      const { data, total } = await listAllDailyReports(params);
      return {
        reports:     dailyReportsMetaFromRows(data),
        total,
        hasNextPage: data.length === pageSize,
      };
    },
    enabled:         !loading && !!user,
    staleTime:       60 * 1000,
    gcTime:          24 * 60 * 60 * 1000,
    // Default: refetch only when stale (not "always" on every remount).
    placeholderData: keepPreviousData,
  });
}

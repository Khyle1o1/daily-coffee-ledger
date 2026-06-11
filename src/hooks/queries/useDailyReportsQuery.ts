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
  /** Lightweight report objects for the current page. rowDetails is [] until the
   *  full report is fetched via getDailyReport(id). */
  reports: DailyReport[];
  /** Total number of rows matching the current filters (across all pages). */
  total: number;
  /** Total pages given the current pageSize. */
  pageCount: number;
}

export interface UseDailyReportsQueryParams extends ListDailyReportsParams {}

/**
 * Paginated, filtered query for the daily-reports list.
 *
 * Changes vs. the previous version:
 *  - summary_json is no longer fetched — avoids transferring heavy per-report
 *    transaction blobs and eliminates the statement-timeout on large datasets.
 *  - .range() limits each request to `pageSize` rows (default 50).
 *  - staleTime: 60 s — background-refetches at most once per minute.
 *  - placeholderData: keepPreviousData — navigating between pages shows the
 *    previous page instead of a loading spinner (TanStack Query v5 API).
 *  - Each unique (page, pageSize, branchId, dateFrom, dateTo) combination gets
 *    its own cache entry so prefetching adjacent pages is straightforward.
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
      await seedBranchesIfEmpty().catch(() => undefined);
      const { data, total } = await listAllDailyReports(params);
      return {
        reports:   dailyReportsMetaFromRows(data),
        total,
        pageCount: Math.ceil(total / pageSize),
      };
    },
    enabled:         !loading && !!user,
    // Treat cached data as always fresh — prevents a background refetch from
    // wiping visible data while a token refresh is in progress.
    // The query is explicitly invalidated (queryClient.invalidateQueries) after
    // mutations (save / delete) so freshness is still enforced when it matters.
    staleTime:       Infinity,
    gcTime:          24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

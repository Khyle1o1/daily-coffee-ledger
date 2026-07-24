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
        reports:     dailyReportsMetaFromRows(data),
        total,
        hasNextPage: data.length === pageSize,
      };
    },
    enabled:         !loading && !!user,
    // Keep list reasonably fresh across devices/tabs. Infinity + localStorage
    // persist left production stuck on an empty snapshot after local uploads.
    staleTime:       60 * 1000,
    gcTime:          24 * 60 * 60 * 1000,
    refetchOnMount:  "always",
    placeholderData: keepPreviousData,
  });
}

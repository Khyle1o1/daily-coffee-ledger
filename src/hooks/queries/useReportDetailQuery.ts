import { useQuery } from "@tanstack/react-query";
import { getDailyReport } from "@/services/reportsService";
import { dailyReportFromRow } from "@/services/reportConverter";
import type { DailyReport } from "@/utils/types";
import { queryKeys } from "./queryKeys";
import { useAuth } from "@/auth/useAuth";

/**
 * Fetches a single daily report by ID with the FULL summary_json
 * (including rowDetails + unmappedSummary).
 *
 * Use this when the user opens the detail panel for a specific report.
 * The list query (useDailyReportsQuery) returns lightweight rows from the
 * reports_daily_meta view; this hook fetches the heavy payload on demand.
 *
 * The result is cached for 5 minutes so switching between reports is fast
 * and repeated opens don't hit the network.
 */
export function useReportDetailQuery(reportId: string | null) {
  const { user, loading } = useAuth();

  return useQuery<DailyReport | null>({
    queryKey: queryKeys.reports.detail(reportId ?? "__none__"),
    queryFn: async (): Promise<DailyReport | null> => {
      if (!reportId) return null;

      const row = await getDailyReport(reportId);

      if (!row) {
        return null;
      }

      return dailyReportFromRow(row);
    },
    enabled: !loading && !!user && !!reportId,
    staleTime: 5 * 60 * 1000,   // 5 minutes — detail data rarely changes
    gcTime:    30 * 60 * 1000,  // 30 minutes in garbage-collection window
  });
}

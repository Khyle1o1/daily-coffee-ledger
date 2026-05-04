import { useQuery } from "@tanstack/react-query";
import { listAllDailyReports, seedBranchesIfEmpty } from "@/services/reportsService";
import { dailyReportsFromRows } from "@/services/reportConverter";
import type { DailyReport } from "@/utils/types";
import { queryKeys } from "./queryKeys";
import { useAuth } from "@/auth/useAuth";

export function useDailyReportsQuery() {
  const { user, loading } = useAuth();

  return useQuery<DailyReport[]>({
    queryKey: queryKeys.reports.dailyAll,
    queryFn: async () => {
      await seedBranchesIfEmpty().catch(() => undefined);
      const rows = await listAllDailyReports();
      return dailyReportsFromRows(rows);
    },
    enabled: !loading && !!user,
    // Keep report data stable across refresh/navigation and refresh only on invalidation.
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

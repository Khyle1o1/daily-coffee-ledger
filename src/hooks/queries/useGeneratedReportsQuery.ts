import { useQuery } from "@tanstack/react-query";
import { listGeneratedReports } from "@/services/generatedReportsService";
import type { GeneratedReportRow } from "@/lib/supabase-types";
import { queryKeys } from "./queryKeys";
import { useAuth } from "@/auth/useAuth";

export function useGeneratedReportsQuery() {
  const { user, loading } = useAuth();

  return useQuery<GeneratedReportRow[]>({
    queryKey: queryKeys.reports.generated,
    queryFn: listGeneratedReports,
    enabled: !loading && !!user,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

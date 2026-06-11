export const queryKeys = {
  dashboard: ["dashboard"] as const,
  reports: {
    dailyRoot:      ["reports", "daily"] as const,
    generatedRoot:  ["reports", "generated"] as const,
    /** @deprecated Use dailyList for paginated queries. */
    dailyAll: (userId?: string) =>
      ["reports", "daily", "all", userId ?? "anon"] as const,
    /**
     * Paginated, filtered list of daily reports (no summary_json).
     * Each unique combination of params produces a distinct cache entry so
     * TanStack Query can keep previous page data while the next page loads.
     */
    dailyList: (params: {
      userId?:   string;
      page?:     number;
      pageSize?: number;
      branchId?: string;
      dateFrom?: string;
      dateTo?:   string;
    }) =>
      [
        "reports", "daily", "list",
        params.userId   ?? "anon",
        params.page     ?? 1,
        params.pageSize ?? 50,
        params.branchId ?? "",
        params.dateFrom ?? "",
        params.dateTo   ?? "",
      ] as const,
    generated: (userId?: string) =>
      ["reports", "generated", userId ?? "anon"] as const,
  },
  branches: {
    live: ["branches", "live"] as const,
    adminList: (params: { q?: string; active?: boolean }) =>
      ["branches", "admin", params.q ?? "", params.active ?? "all"] as const,
  },
  directory: {
    links: (params: {
      q?: string;
      category?: string;
      active?: boolean;
      sort?: string;
      order?: string;
    }) =>
      [
        "directory",
        "links",
        params.q ?? "",
        params.category ?? "",
        params.active ?? "all",
        params.sort ?? "updatedAt",
        params.order ?? "desc",
      ] as const,
    categories: ["directory", "categories"] as const,
  },
  audit: {
    logs: (params: {
      search?: string;
      action?: string;
      module?: string;
      branchId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    }) =>
      [
        "audit",
        "logs",
        params.search ?? "",
        params.action ?? "all",
        params.module ?? "all",
        params.branchId ?? "all",
        params.dateFrom ?? "",
        params.dateTo ?? "",
        params.page ?? 1,
        params.pageSize ?? 50,
      ] as const,
  },
} as const;

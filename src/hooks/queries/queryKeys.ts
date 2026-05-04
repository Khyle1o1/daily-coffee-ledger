export const queryKeys = {
  dashboard: ["dashboard"] as const,
  reports: {
    dailyRoot: ["reports", "daily"] as const,
    generatedRoot: ["reports", "generated"] as const,
    dailyAll: (userId?: string) =>
      ["reports", "daily", "all", userId ?? "anon"] as const,
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

import { describe, expect, it } from "vitest";
import { computeChannelSalesSummary } from "@/lib/reports/computeChannelSalesSummary";
import type { DailyReport } from "@/utils/types";

function makeReport(branch: string, rows: DailyReport["rowDetails"]): DailyReport {
  return {
    id: `r-${branch}`,
    date: "2026-03-01",
    dateRangeEnd: "2026-03-31",
    branch,
    filename: "test.csv",
    uploadedAt: Date.now(),
    totalRows: rows.length,
    mappedRows: rows.length,
    unmappedRows: 0,
    skippedRows: 0,
    summaryTotalsByCat: {} as DailyReport["summaryTotalsByCat"],
    summaryQuantitiesByCat: {} as DailyReport["summaryQuantitiesByCat"],
    grandTotal: 0,
    grandQuantity: 0,
    percentByCat: {} as DailyReport["percentByCat"],
    rowDetails: rows,
    unmappedSummary: [],
  };
}

describe("computeChannelSalesSummary", () => {
  it("groups by branch, category, and channel with overall totals", () => {
    const greenbelt = makeReport("greenbelt", [
      {
        status: "MAPPED" as const,
        mappedCat: "ICED",
        rowSales: 1000,
        paymentType: "Walk In",
        transactionDate: new Date("2026-03-01T10:00:00+08:00"),
      },
      {
        status: "MAPPED" as const,
        mappedCat: "ICED",
        rowSales: 500,
        paymentType: "GrabFood",
        transactionDate: new Date("2026-03-02T10:00:00+08:00"),
      },
      {
        status: "MAPPED" as const,
        mappedCat: "SNACKS",
        rowSales: 200,
        paymentType: "food panda",
        transactionDate: new Date("2026-03-03T10:00:00+08:00"),
      },
    ] as any);
    const podium = makeReport("podium", [
      {
        status: "MAPPED" as const,
        mappedCat: "HOT",
        rowSales: 800,
        paymentType: "walk-in",
        transactionDate: new Date("2026-03-02T10:00:00+08:00"),
      },
    ] as any);

    const result = computeChannelSalesSummary(
      [greenbelt, podium],
      {
        branchId: ["greenbelt", "podium"],
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
        selectedCategories: [],
      },
    );

    expect(result.branches).toHaveLength(2);
    const gb = result.branches.find((b) => b.branchId === "greenbelt");
    expect(gb?.totals.total).toBe(1700);
    expect(gb?.totals.walkIn).toBe(1000);
    expect(gb?.totals.grab).toBe(500);
    expect(gb?.totals.foodpanda).toBe(200);

    const overallCoffee = result.overall.rows.find((r) => r.category === "COFFEE");
    expect(overallCoffee?.total).toBe(2300);
    expect(result.overall.totals.total).toBe(2500);
  });
});

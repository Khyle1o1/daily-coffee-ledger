import { describe, expect, it } from "vitest";
import { computePourItForward } from "@/lib/reports/computePourItForward";
import type { DailyReport } from "@/utils/types";

function makeReport(rowDetails: DailyReport["rowDetails"]): DailyReport {
  return {
    id: "r1",
    date: "2026-04-01",
    dateRangeEnd: "2026-04-30",
    branch: "mind_museum",
    filename: "test.csv",
    uploadedAt: Date.now(),
    totalRows: rowDetails.length,
    mappedRows: rowDetails.length,
    unmappedRows: 0,
    skippedRows: 0,
    summaryTotalsByCat: {} as DailyReport["summaryTotalsByCat"],
    summaryQuantitiesByCat: {} as DailyReport["summaryQuantitiesByCat"],
    grandTotal: 0,
    grandQuantity: 0,
    percentByCat: {} as DailyReport["percentByCat"],
    rowDetails,
    unmappedSummary: [],
  };
}

describe("computePourItForward local date filtering", () => {
  it("keeps Apr 1 local rows and excludes Mar 31 rows", () => {
    const rows = [
      {
        status: "MAPPED" as const,
        mappedItemName: "12oz Paper Cup",
        rawItemName: "12oz Paper Cup",
        quantity: 2,
        paymentType: "Grab",
        transactionDate: new Date("2026-04-01T00:30:00+08:00"),
      },
      {
        status: "MAPPED" as const,
        mappedItemName: "16oz Iced Dabba Cup",
        rawItemName: "16oz Iced Dabba Cup",
        quantity: 3,
        paymentType: "Walk-in",
        transactionDate: new Date("2026-03-31T20:00:00+08:00"),
      },
    ] as DailyReport["rowDetails"];

    const report = makeReport(rows);
    const result = computePourItForward(
      [report],
      {
        branchId: "mind_museum",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        compareFrom: null,
        compareTo: null,
        selectedCategories: [],
      },
      "CUPS SOLD Apr 01, 2026 — Apr 30, 2026",
    );

    expect(result.dailyBreakdown).toBeDefined();
    expect(result.dailyBreakdown?.map((d) => d.date)).toEqual(["2026-04-01"]);
    expect(result.dailyBreakdown?.every((d) => d.date >= "2026-04-01" && d.date <= "2026-04-30")).toBe(true);
  });

  it("builds itemized cup breakdown with fixed cup types and zero-fill", () => {
    const rows = [
      {
        status: "MAPPED" as const,
        mappedItemName: "12oz Bamboo Cup",
        rawItemName: "12oz Bamboo Cup",
        quantity: 4,
        paymentType: "Grab",
        transactionDate: new Date("2026-04-10T10:00:00+08:00"),
      },
      {
        status: "MAPPED" as const,
        mappedItemName: "16oz Paper Cup",
        rawItemName: "16oz Paper Cup",
        quantity: 6,
        paymentType: "Walk-in",
        transactionDate: new Date("2026-04-11T11:00:00+08:00"),
      },
    ] as DailyReport["rowDetails"];

    const report = makeReport(rows);
    const result = computePourItForward(
      [report],
      {
        branchId: "mind_museum",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        compareFrom: null,
        compareTo: null,
        selectedCategories: [],
      },
      "CUPS SOLD Apr 01, 2026 — Apr 30, 2026",
    );

    expect(result.itemizedCupBreakdown).toEqual([
      { cupType: "12oz Bamboo Cup", totalCups: 4 },
      { cupType: "12oz Iced Dabba Cup", totalCups: 0 },
      { cupType: "12oz Paper Cup", totalCups: 0 },
      { cupType: "16oz Iced Dabba Cup", totalCups: 0 },
      { cupType: "16oz Paper Cup", totalCups: 6 },
    ]);
    expect(result.itemizedCupGrandTotal).toBe(10);
    expect(result.totals.grandTotal).toBe(10);
  });
});

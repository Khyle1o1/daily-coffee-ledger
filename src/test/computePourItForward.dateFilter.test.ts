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

function makeReportForBranch(
  branch: DailyReport["branch"],
  rowDetails: DailyReport["rowDetails"],
): DailyReport {
  return { ...makeReport(rowDetails), id: `r-${branch}`, branch };
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

  it("builds itemized pivot for multi-branch filters", () => {
    const reportA = makeReportForBranch("mind_museum", [
      {
        status: "MAPPED" as const,
        mappedItemName: "12 OZ PAPER CUP",
        rawItemName: "12 OZ PAPER CUP",
        quantity: 5,
        paymentType: "Grab",
        transactionDate: new Date("2026-04-02T09:00:00+08:00"),
      },
    ] as DailyReport["rowDetails"]);
    const reportB = makeReportForBranch("uptown", [
      {
        status: "MAPPED" as const,
        mappedItemName: "16OZ DABBA CUP",
        rawItemName: "16OZ DABBA CUP",
        quantity: 8,
        paymentType: "Walk-in",
        transactionDate: new Date("2026-04-03T09:00:00+08:00"),
      },
    ] as DailyReport["rowDetails"]);

    const result = computePourItForward(
      [reportA, reportB],
      {
        branchId: ["mind_museum", "uptown", "greenbelt"],
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        compareFrom: null,
        compareTo: null,
        selectedCategories: [],
      },
      "CUPS SOLD Apr 01, 2026 — Apr 30, 2026",
    );

    expect(result.itemizedCupPivot.branches.map((b) => b.branchId)).toEqual([
      "uptown",
      "mind_museum",
      "greenbelt",
    ]);
    const paperRow = result.itemizedCupPivot.rows.find((r) => r.cupType === "12oz Paper Cup");
    expect(paperRow?.byBranch.mind_museum).toBe(5);
    expect(paperRow?.byBranch.greenbelt).toBe(0);
    expect(result.itemizedCupGrandTotal).toBe(13);
    expect(result.itemizedCupPivot.grandTotal).toBe(13);
  });

  it("shows itemized pivot branches when branch filter is all", () => {
    const reportA = makeReportForBranch("mind_museum", [
      {
        status: "MAPPED" as const,
        mappedItemName: "12oz Paper Cup",
        rawItemName: "12oz Paper Cup",
        quantity: 4,
        paymentType: "Grab",
        transactionDate: new Date("2026-04-02T09:00:00+08:00"),
      },
    ] as DailyReport["rowDetails"]);
    const reportB = makeReportForBranch("uptown", [
      {
        status: "MAPPED" as const,
        mappedItemName: "16oz Paper Cup",
        rawItemName: "16oz Paper Cup",
        quantity: 6,
        paymentType: "Walk-in",
        transactionDate: new Date("2026-04-03T09:00:00+08:00"),
      },
    ] as DailyReport["rowDetails"]);

    const result = computePourItForward(
      [reportA, reportB],
      {
        branchId: "all",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
        compareFrom: null,
        compareTo: null,
        selectedCategories: [],
      },
      "CUPS SOLD Apr 01, 2026 — Apr 30, 2026",
    );

    expect((result.itemizedCupPivot.branches.length ?? 0) > 1).toBe(true);
    expect(result.itemizedCupPivot.branches.some((b) => b.branchId === "mind_museum")).toBe(true);
    expect(result.itemizedCupPivot.branches.some((b) => b.branchId === "uptown")).toBe(true);
    expect(result.itemizedCupGrandTotal).toBe(10);
    expect(result.itemizedCupPivot.grandTotal).toBe(10);
  });

  it("shows monthly summary only when 2 or more months are included", () => {
    const report = makeReportForBranch("mind_museum", [
      {
        status: "MAPPED" as const,
        mappedItemName: "12oz Paper Cup",
        rawItemName: "12oz Paper Cup",
        quantity: 5,
        paymentType: "Grab",
        transactionDate: new Date("2026-02-28T10:00:00+08:00"),
      },
      {
        status: "MAPPED" as const,
        mappedItemName: "16oz Paper Cup",
        rawItemName: "16oz Paper Cup",
        quantity: 7,
        paymentType: "Walk-in",
        transactionDate: new Date("2026-03-01T10:00:00+08:00"),
      },
    ] as DailyReport["rowDetails"]);

    const multiMonth = computePourItForward(
      [report],
      {
        branchId: "mind_museum",
        dateFrom: "2026-02-01",
        dateTo: "2026-03-31",
        compareFrom: null,
        compareTo: null,
        selectedCategories: [],
      },
      "CUPS SOLD Feb 01, 2026 — Mar 31, 2026",
    );
    expect(multiMonth.monthlySummary?.length).toBe(2);

    const singleMonth = computePourItForward(
      [report],
      {
        branchId: "mind_museum",
        dateFrom: "2026-02-01",
        dateTo: "2026-02-28",
        compareFrom: null,
        compareTo: null,
        selectedCategories: [],
      },
      "CUPS SOLD Feb 01, 2026 — Feb 28, 2026",
    );
    expect(singleMonth.monthlySummary).toBeUndefined();
  });
});

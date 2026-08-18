import { describe, expect, it } from "vitest";
import {
  computeMonthlyBranchReport,
  computeBranchDrillDown,
} from "@/lib/reports/computeMonthlyBranchReport";
import { buildDailyBreakdown } from "@/lib/reports/dailyBreakdown";
import type { DailyReport, ProcessedRow } from "@/utils/types";

function row(day: string, mappedCat: ProcessedRow["mappedCat"], sales: number): ProcessedRow {
  const [y, m, d] = day.split("-").map(Number);
  return {
    status: "MAPPED",
    mappedCat,
    mappedItemName: "Latte",
    rawCategory: "DOT SIGNATURES",
    rawItemName: "Latte",
    option: "",
    quantity: 1,
    unitPrice: sales,
    rowSales: sales,
    transactionDate: new Date(y, m - 1, d, 12, 0, 0),
  };
}

function dualMonthReport(): DailyReport {
  const rowDetails = [
    row("2026-06-15", "ICED", 200),
    row("2026-07-20", "HOT", 300),
  ];
  const dailyBreakdown = buildDailyBreakdown(rowDetails);
  return {
    id: "r-dual",
    date: "2026-06-01",
    dateRangeEnd: "2026-07-31",
    branch: "greenbelt",
    filename: "jun-jul.csv",
    uploadedAt: 1,
    totalRows: 2,
    mappedRows: 2,
    unmappedRows: 0,
    skippedRows: 0,
    summaryTotalsByCat: {
      ICED: 200,
      HOT: 300,
      SNACKS: 0,
      "ADD-ONS": 0,
      MERCH: 0,
      PROMO: 0,
      "LOYALTY CARD": 0,
      PACKAGING: 0,
    },
    summaryQuantitiesByCat: {
      ICED: 1,
      HOT: 1,
      SNACKS: 0,
      "ADD-ONS": 0,
      MERCH: 0,
      PROMO: 0,
      "LOYALTY CARD": 0,
      PACKAGING: 0,
    },
    grandTotal: 500,
    grandQuantity: 2,
    percentByCat: {
      ICED: 40,
      HOT: 60,
      SNACKS: 0,
      "ADD-ONS": 0,
      MERCH: 0,
      PROMO: 0,
      "LOYALTY CARD": 0,
      PACKAGING: 0,
    },
    rowDetails: [],
    unmappedSummary: [],
    dailyBreakdown,
  };
}

describe("computeMonthlyBranchReport dual-month slice", () => {
  const report = dualMonthReport();
  const filters = {
    year: 2026 as const,
    monthKey: "all" as const,
    branchId: "all" as const,
    category: "all" as const,
  };

  it("puts June days only in the June cell and July days only in July", () => {
    const result = computeMonthlyBranchReport([report], filters, (id) => id);
    const june = result.tableRows.find((r) => r.monthKey === "2026-06");
    const july = result.tableRows.find((r) => r.monthKey === "2026-07");
    expect(june?.grandTotal).toBe(200);
    expect(june?.totals.ICED).toBe(200);
    expect(june?.totals.HOT).toBe(0);
    expect(july?.grandTotal).toBe(300);
    expect(july?.totals.HOT).toBe(300);
    expect(july?.totals.ICED).toBe(0);
  });

  it("drill-down lists calendar days not the full upload range", () => {
    const drill = computeBranchDrillDown([report], "greenbelt", (id) => id, "2026-06");
    expect(drill?.daily.map((d) => d.date)).toEqual(["2026-06-15"]);
    expect(drill?.daily[0].grandTotal).toBe(200);
    expect(drill?.monthly.find((m) => m.monthKey === "2026-06")?.grandTotal).toBe(200);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildDailyBreakdown,
  sliceDailyBreakdown,
} from "@/lib/reports/dailyBreakdown";
import type { ProcessedRow } from "@/utils/types";

function row(day: string, mappedCat: ProcessedRow["mappedCat"], sales: number, qty = 1): ProcessedRow {
  const [y, m, d] = day.split("-").map(Number);
  return {
    status: "MAPPED",
    mappedCat,
    mappedItemName: "Latte",
    rawCategory: "DOT SIGNATURES",
    rawItemName: "Latte",
    option: "",
    quantity: qty,
    unitPrice: sales,
    rowSales: sales,
    transactionDate: new Date(y, m - 1, d, 12, 0, 0),
  };
}

describe("buildDailyBreakdown / sliceDailyBreakdown", () => {
  const rows = [
    row("2026-01-15", "ICED", 100, 2),
    row("2026-01-31", "HOT", 50, 1),
    row("2026-02-01", "HOT", 200, 4),
    row("2026-02-28", "SNACKS", 25, 1),
  ];

  it("groups Jan 1–Feb 28 rows by calendar day", () => {
    const map = buildDailyBreakdown(rows);
    expect(Object.keys(map)).toEqual([
      "2026-01-15",
      "2026-01-31",
      "2026-02-01",
      "2026-02-28",
    ]);
    expect(map["2026-01-15"].grandTotal).toBe(100);
    expect(map["2026-01-15"].quantities.ICED).toBe(2);
    expect(map["2026-02-01"].grandTotal).toBe(200);
  });

  it("January filter is only January days", () => {
    const map = buildDailyBreakdown(rows);
    const jan = sliceDailyBreakdown(map, "2026-01-01", "2026-01-31");
    expect(jan.grandTotal).toBe(150);
    expect(jan.totals.ICED).toBe(100);
    expect(jan.totals.HOT).toBe(50);
    expect(jan.totals.SNACKS).toBe(0);

    const feb = sliceDailyBreakdown(map, "2026-02-01", "2026-02-28");
    expect(feb.grandTotal).toBe(225);
    expect(feb.totals.HOT).toBe(200);
    expect(feb.totals.SNACKS).toBe(25);
  });
});

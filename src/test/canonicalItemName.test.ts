import { describe, expect, it } from "vitest";
import { canonicalItemName, itemKey } from "@/utils/canonicalItemName";
import { mapRow } from "@/utils/mapRow";
import { DEFAULT_MAPPING } from "@/utils/defaultMapping";
import { computeProductTotals } from "@/lib/reports/compute";
import { computeTop5ByChannelFromRows } from "@/lib/reports/computeTop5ByChannel";
import type { DailyReport, ProcessedRow, RawRow } from "@/utils/types";

function snackRow(rawItemName: string): RawRow {
  return {
    rawCategory: "DOT SNACKS",
    rawItemName,
    option: "",
    quantity: 1,
    unitPrice: 135,
  };
}

function makeReport(rows: ProcessedRow[]): DailyReport {
  return {
    id: "r1",
    date: "2026-08-01",
    dateRangeEnd: "2026-08-31",
    branch: "greenbelt",
    filename: "t.csv",
    uploadedAt: 1,
    totalRows: rows.length,
    mappedRows: rows.length,
    unmappedRows: 0,
    skippedRows: 0,
    summaryTotalsByCat: {} as DailyReport["summaryTotalsByCat"],
    summaryQuantitiesByCat: {} as DailyReport["summaryQuantitiesByCat"],
    grandTotal: rows.reduce((s, r) => s + r.rowSales, 0),
    grandQuantity: rows.reduce((s, r) => s + r.quantity, 0),
    percentByCat: {} as DailyReport["percentByCat"],
    rowDetails: rows,
    unmappedSummary: [],
  };
}

describe("canonicalItemName", () => {
  it("merges Cookie and Cookies to the menu singular", () => {
    expect(canonicalItemName("Double Chocolate Chip Cookie")).toBe(
      "Double Chocolate Chip Cookie",
    );
    expect(canonicalItemName("Double Chocolate Chip Cookies")).toBe(
      "Double Chocolate Chip Cookie",
    );
  });

  it("does not rewrite Cookie Butter Oat Latte", () => {
    expect(canonicalItemName("Cookie Butter Oat Latte")).toBe(
      "Cookie Butter Oat Latte",
    );
  });

  it("itemKey prefers mapped name then canonicalizes", () => {
    expect(
      itemKey({
        mappedItemName: "Double Chocolate Chip Cookies",
        rawItemName: "other",
      }),
    ).toBe("Double Chocolate Chip Cookie");
  });
});

describe("mapRow cookie aliases", () => {
  it("stores singular Cookie for plural POS Cookies", () => {
    const singular = mapRow(snackRow("Double Chocolate Chip Cookie"), DEFAULT_MAPPING);
    const plural = mapRow(snackRow("Double Chocolate Chip Cookies"), DEFAULT_MAPPING);
    expect(singular.status).toBe("MAPPED");
    expect(plural.status).toBe("MAPPED");
    expect(singular.mappedItemName).toBe("Double Chocolate Chip Cookie");
    expect(plural.mappedItemName).toBe("Double Chocolate Chip Cookie");
  });
});

describe("computeProductTotals cookie merge", () => {
  it("sums Cookie and Cookies into one product row", () => {
    const [y, m, d] = [2026, 7, 1];
    const rows: ProcessedRow[] = [
      {
        status: "MAPPED",
        mappedCat: "SNACKS",
        mappedItemName: "Double Chocolate Chip Cookie",
        rawItemName: "Double Chocolate Chip Cookie",
        rawCategory: "DOT SNACKS",
        option: "",
        quantity: 2,
        unitPrice: 135,
        rowSales: 270,
        paymentType: "Cash",
        transactionDate: new Date(y, m, d, 10, 0, 0),
      },
      {
        status: "MAPPED",
        mappedCat: "SNACKS",
        mappedItemName: "Double Chocolate Chip Cookies",
        rawItemName: "Double Chocolate Chip Cookies",
        rawCategory: "DOT SNACKS",
        option: "",
        quantity: 3,
        unitPrice: 135,
        rowSales: 405,
        paymentType: "GrabFood",
        transactionDate: new Date(y, m, d + 1, 10, 0, 0),
      },
    ];

    const mix = computeProductTotals(
      [makeReport(rows)],
      {
        branchId: ["greenbelt"],
        dateFrom: "2026-08-01",
        dateTo: "2026-08-31",
        selectedCategories: ["SNACKS"],
      },
      "SNACKS",
    );

    expect(mix.products).toHaveLength(1);
    expect(mix.products[0].name).toBe("Double Chocolate Chip Cookie");
    expect(mix.products[0].qty).toBe(5);
    expect(mix.products[0].sales).toBe(675);

    const top5 = computeTop5ByChannelFromRows(rows);
    expect(top5.WALK_IN.items).toHaveLength(1);
    expect(top5.WALK_IN.items[0].name).toBe("Double Chocolate Chip Cookie");
    expect(top5.WALK_IN.items[0].qty).toBe(2);
    expect(top5.GRAB.items[0].name).toBe("Double Chocolate Chip Cookie");
    expect(top5.GRAB.items[0].qty).toBe(3);
  });
});

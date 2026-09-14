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

  it("merges Coco Chata spellings to CocoChata", () => {
    expect(canonicalItemName("CocoChata")).toBe("CocoChata");
    expect(canonicalItemName("Coco Chata")).toBe("CocoChata");
  });

  it("merges Signature Tea Latte to Signature Tea", () => {
    expect(canonicalItemName("Signature Tea")).toBe("Signature Tea");
    expect(canonicalItemName("Signature Tea Latte")).toBe("Signature Tea");
  });

  it("merges salt bread alias spellings", () => {
    expect(canonicalItemName("Dark Chocolate Salt Bread")).toBe("Chocolate Salt Bread");
    expect(canonicalItemName("Chocolate Salt Bread")).toBe("Chocolate Salt Bread");
    expect(canonicalItemName("Truffle Cheese Salt Bread")).toBe("Truffle Salt Bread");
    expect(canonicalItemName("Truffle Salt Bread")).toBe("Truffle Salt Bread");
  });

  it("merges oatmeal cookie protein bar word order only", () => {
    expect(canonicalItemName("Oatmeal Cookie Protein Bar")).toBe(
      "Oatmeal Crunch Protein Bar",
    );
    expect(canonicalItemName("Oatmeal Crunch Protein Bar")).toBe(
      "Oatmeal Crunch Protein Bar",
    );
    expect(canonicalItemName("Oatmeal Protein Cookie")).toBe("Oatmeal Protein Cookie");
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

describe("mapRow product aliases", () => {
  function icedRow(rawItemName: string): RawRow {
    return {
      rawCategory: "DOT SIGNATURES",
      rawItemName,
      option: "Iced Regular (12oz)",
      quantity: 1,
      unitPrice: 180,
    };
  }

  it("stores CocoChata for Coco Chata POS spelling", () => {
    const spaced = mapRow(icedRow("Coco Chata"), DEFAULT_MAPPING);
    const compact = mapRow(icedRow("CocoChata"), DEFAULT_MAPPING);
    expect(spaced.status).toBe("MAPPED");
    expect(compact.status).toBe("MAPPED");
    expect(spaced.mappedItemName).toBe("CocoChata");
    expect(compact.mappedItemName).toBe("CocoChata");
  });

  it("stores Chocolate Salt Bread for Dark Chocolate Salt Bread", () => {
    const dark = mapRow(snackRow("Dark Chocolate Salt Bread"), DEFAULT_MAPPING);
    const plain = mapRow(snackRow("Chocolate Salt Bread"), DEFAULT_MAPPING);
    expect(dark.status).toBe("MAPPED");
    expect(plain.status).toBe("MAPPED");
    expect(dark.mappedItemName).toBe("Chocolate Salt Bread");
    expect(plain.mappedItemName).toBe("Chocolate Salt Bread");
  });

  it("stores Oatmeal Crunch Protein Bar for word-order typo", () => {
    const typo = mapRow(snackRow("Oatmeal Cookie Protein Bar"), DEFAULT_MAPPING);
    const crunch = mapRow(snackRow("Oatmeal Crunch Protein Bar"), DEFAULT_MAPPING);
    const cookie = mapRow(snackRow("Oatmeal Protein Cookie"), DEFAULT_MAPPING);
    expect(typo.mappedItemName).toBe("Oatmeal Crunch Protein Bar");
    expect(crunch.mappedItemName).toBe("Oatmeal Crunch Protein Bar");
    expect(cookie.mappedItemName).toBe("Oatmeal Protein Cookie");
  });

  it("maps ADD ONS MILK + Dairy Milk to Dairy Milk", () => {
    const r = mapRow(
      {
        rawCategory: "ADD ONS",
        rawItemName: "ADD ONS MILK",
        option: "Dairy Milk",
        quantity: 1,
        unitPrice: 45,
      },
      DEFAULT_MAPPING,
    );
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("ADD-ONS");
    expect(r.mappedItemName).toBe("Dairy Milk");
  });

  it("falls back to option text when milk option is missing from mapping", () => {
    const r = mapRow(
      {
        rawCategory: "ADD ONS",
        rawItemName: "ADD ONS MILK",
        option: "Dairy Milk",
        quantity: 1,
        unitPrice: 45,
      },
      [],
    );
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("ADD-ONS");
    expect(r.mappedItemName).toBe("Dairy Milk");
    expect(r.debugReason).toBe("fallback_addon_milk_option");
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

  it("sums Coco Chata and CocoChata into one product row", () => {
    const [y, m, d] = [2026, 7, 1];
    const rows: ProcessedRow[] = [
      {
        status: "MAPPED",
        mappedCat: "ICED",
        mappedItemName: "Coco Chata",
        rawItemName: "Coco Chata",
        rawCategory: "DOT SIGNATURES",
        option: "Iced Regular (12oz)",
        quantity: 2,
        unitPrice: 180,
        rowSales: 360,
        paymentType: "Cash",
        transactionDate: new Date(y, m, d, 10, 0, 0),
      },
      {
        status: "MAPPED",
        mappedCat: "ICED",
        mappedItemName: "CocoChata",
        rawItemName: "CocoChata",
        rawCategory: "DOT SIGNATURES",
        option: "Iced Regular (12oz)",
        quantity: 1,
        unitPrice: 180,
        rowSales: 180,
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
        selectedCategories: ["ICED"],
      },
      "ICED",
    );

    expect(mix.products).toHaveLength(1);
    expect(mix.products[0].name).toBe("CocoChata");
    expect(mix.products[0].qty).toBe(3);
    expect(mix.products[0].sales).toBe(540);
  });
});

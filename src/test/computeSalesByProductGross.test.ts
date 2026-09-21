import { describe, expect, it } from "vitest";
import {
  SALES_BY_PRODUCT_GROSS_COLS,
  SALES_BY_PRODUCT_GROSS_SOURCE,
  computeSalesByProductGross,
  monthInputLabel,
  sheetColumnForRow,
} from "@/lib/reports/computeSalesByProductGross";
import type { DailyReport, ProcessedRow } from "@/utils/types";

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

function row(partial: Partial<ProcessedRow> & Pick<ProcessedRow, "mappedCat" | "rowSales">): ProcessedRow {
  return {
    status: "MAPPED",
    mappedItemName: partial.mappedItemName ?? "Item",
    rawItemName: partial.rawItemName ?? "Item",
    rawCategory: partial.rawCategory ?? "",
    paymentType: partial.paymentType ?? "Walk In",
    transactionDate: partial.transactionDate ?? new Date("2026-03-01T10:00:00+08:00"),
    quantity: 1,
    ...partial,
  } as ProcessedRow;
}

describe("monthInputLabel", () => {
  it("formats YYYY-MM as 01_JANUARY style", () => {
    expect(monthInputLabel("2026-01")).toBe("01_JANUARY");
    expect(monthInputLabel("2026-03")).toBe("03_MARCH");
  });
});

describe("sheetColumnForRow", () => {
  it("splits cold brew out of ICED", () => {
    expect(
      sheetColumnForRow(
        row({
          mappedCat: "ICED",
          rowSales: 100,
          mappedItemName: "Cold Brew Classic",
          rawItemName: "Cold Brew Classic",
        }),
      ),
    ).toBe("COLD BREW");
    expect(
      sheetColumnForRow(
        row({
          mappedCat: "ICED",
          rowSales: 100,
          mappedItemName: "Iced Latte",
          rawItemName: "Iced Latte",
        }),
      ),
    ).toBe("ICED");
  });

  it("detects canned by name", () => {
    expect(
      sheetColumnForRow(
        row({
          mappedCat: "SNACKS",
          rowSales: 50,
          mappedItemName: "Canned Spanish Latte",
          rawItemName: "Canned Spanish Latte",
        }),
      ),
    ).toBe("CANNED");
  });
});

describe("computeSalesByProductGross", () => {
  it("builds month × branch rows with sheet columns and POS+ DOT APP", () => {
    const greenbelt = makeReport("greenbelt", [
      row({
        mappedCat: "ICED",
        rowSales: 1000,
        mappedItemName: "Iced Latte",
        rawItemName: "Iced Latte",
        transactionDate: new Date("2026-03-01T10:00:00+08:00"),
      }),
      row({
        mappedCat: "ICED",
        rowSales: 300,
        mappedItemName: "Cold Brew",
        rawItemName: "Cold Brew",
        transactionDate: new Date("2026-03-02T10:00:00+08:00"),
      }),
      row({
        mappedCat: "SNACKS",
        rowSales: 200,
        transactionDate: new Date("2026-03-03T10:00:00+08:00"),
      }),
    ]);
    const podium = makeReport("podium", [
      row({
        mappedCat: "HOT",
        rowSales: 800,
        transactionDate: new Date("2026-03-02T10:00:00+08:00"),
      }),
    ]);

    const result = computeSalesByProductGross(
      [greenbelt, podium],
      {
        branchId: ["greenbelt", "podium"],
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
        selectedCategories: [],
      },
      [
        { slug: "greenbelt", code: "GB", label: "Greenbelt" },
        { slug: "podium", code: "PDM", label: "Podium" },
      ],
    );

    expect(result.columns).toEqual([...SALES_BY_PRODUCT_GROSS_COLS]);
    expect(result.rows).toHaveLength(2);

    const gb = result.rows.find((r) => r.branchCode === "GB");
    expect(gb).toMatchObject({
      monthKey: "2026-03",
      monthLabel: "03_MARCH",
      branchCode: "GB",
      source: SALES_BY_PRODUCT_GROSS_SOURCE,
    });
    expect(gb?.amounts.ICED).toBe(1000);
    expect(gb?.amounts["COLD BREW"]).toBe(300);
    expect(gb?.amounts.SNACKS).toBe(200);
    expect(gb?.total).toBe(1500);

    const pdm = result.rows.find((r) => r.branchCode === "PDM");
    expect(pdm?.amounts.HOT).toBe(800);
    expect(result.rows.map((r) => r.branchCode)).toEqual(["GB", "PDM"]);
  });

  it("buckets by UTC calendar day like HQ Sync", () => {
    const report = makeReport("uptown", [
      row({
        mappedCat: "ICED",
        rowSales: 500,
        transactionDate: new Date("2026-03-01T00:00:00+08:00"),
      }),
    ]);

    const result = computeSalesByProductGross(
      [report],
      {
        branchId: ["uptown"],
        dateFrom: "2026-02-01",
        dateTo: "2026-02-28",
        selectedCategories: [],
      },
      [{ slug: "uptown", code: "UPT", label: "Uptown" }],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].monthKey).toBe("2026-02");
    expect(result.rows[0].amounts.ICED).toBe(500);
  });
});

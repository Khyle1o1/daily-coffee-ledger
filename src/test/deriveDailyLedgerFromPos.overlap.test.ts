import { describe, expect, it } from "vitest";
import {
  compareReportOwnership,
  deriveDailyLedgerFromPos,
  pickDayReportOwners,
} from "@/lib/reports/deriveDailyLedgerFromPos";
import type { DailyReport, ProcessedRow } from "@/utils/types";

function baseReport(partial: Partial<DailyReport> & Pick<DailyReport, "id" | "branch" | "rowDetails">): DailyReport {
  return {
    date: "2026-06-01",
    dateRangeEnd: "2026-07-31",
    filename: "test.csv",
    uploadedAt: 1,
    totalRows: partial.rowDetails.length,
    mappedRows: partial.rowDetails.length,
    unmappedRows: 0,
    skippedRows: 0,
    summaryTotalsByCat: {} as DailyReport["summaryTotalsByCat"],
    summaryQuantitiesByCat: {} as DailyReport["summaryQuantitiesByCat"],
    grandTotal: 0,
    grandQuantity: 0,
    percentByCat: {} as DailyReport["percentByCat"],
    unmappedSummary: [],
    ...partial,
  };
}

function cashRow(localDay: string, rowSales: number, paymentType = "Cash"): ProcessedRow {
  const [y, m, d] = localDay.split("-").map(Number);
  return {
    status: "MAPPED",
    mappedCat: "CLASSICS",
    mappedItemName: "Test",
    rawCategory: "CLASSICS",
    rawItemName: "Test",
    option: "",
    quantity: 1,
    unitPrice: rowSales,
    rowSales,
    paymentType,
    transactionDate: new Date(y, m - 1, d, 12, 0, 0, 0),
  } as ProcessedRow;
}

describe("deriveDailyLedgerFromPos overlapping reports", () => {
  const slugToUuid = (slug: string) => (slug === "sm_bacoor" ? "uuid-bacoor" : undefined);

  it("compareReportOwnership prefers newer updatedAt, then narrower range, then higher id", () => {
    const olderWide = baseReport({
      id: "a",
      branch: "sm_bacoor",
      date: "2026-06-01",
      dateRangeEnd: "2026-07-31",
      updatedAt: 100,
      rowDetails: [],
    });
    const newerNarrow = baseReport({
      id: "b",
      branch: "sm_bacoor",
      date: "2026-07-02",
      dateRangeEnd: "2026-07-12",
      updatedAt: 200,
      rowDetails: [],
    });
    expect(compareReportOwnership(newerNarrow, olderWide)).toBeGreaterThan(0);

    const sameTimeNarrow = baseReport({
      id: "c",
      branch: "sm_bacoor",
      date: "2026-07-02",
      dateRangeEnd: "2026-07-12",
      updatedAt: 100,
      rowDetails: [],
    });
    expect(compareReportOwnership(sameTimeNarrow, olderWide)).toBeGreaterThan(0);

    const sameSpanHigherId = baseReport({
      id: "z",
      branch: "sm_bacoor",
      date: "2026-06-01",
      dateRangeEnd: "2026-07-31",
      updatedAt: 100,
      rowDetails: [],
    });
    expect(compareReportOwnership(sameSpanHigherId, olderWide)).toBeGreaterThan(0);
  });

  it("does not double-count amounts when two reports overlap on the same day", () => {
    const dual = baseReport({
      id: "dual",
      branch: "sm_bacoor",
      date: "2026-06-01",
      dateRangeEnd: "2026-07-31",
      updatedAt: 1_000,
      rowDetails: [
        cashRow("2026-07-05", 1000),
        cashRow("2026-07-05", 500),
        cashRow("2026-06-15", 200),
      ],
    });
    const julyOnly = baseReport({
      id: "july",
      branch: "sm_bacoor",
      date: "2026-07-02",
      dateRangeEnd: "2026-07-12",
      updatedAt: 2_000, // newer → wins Jul 5
      rowDetails: [cashRow("2026-07-05", 1000), cashRow("2026-07-05", 500)],
    });

    const owners = pickDayReportOwners([dual, julyOnly]);
    expect(owners.get("2026-07-05::sm_bacoor")).toBe("july");
    expect(owners.get("2026-06-15::sm_bacoor")).toBe("dual");

    const derived = deriveDailyLedgerFromPos([dual, julyOnly], slugToUuid);
    const jul5 = derived.find((d) => d.ledgerDate === "2026-07-05");
    const jun15 = derived.find((d) => d.ledgerDate === "2026-06-15");

    expect(jul5?.grossSales).toBe(1500); // not 3000
    expect(jun15?.grossSales).toBe(200);
  });

  it("keeps dual-month-only coverage when there is no overlap competitor", () => {
    const dual = baseReport({
      id: "dual",
      branch: "sm_bacoor",
      date: "2026-06-01",
      dateRangeEnd: "2026-07-31",
      updatedAt: 1_000,
      rowDetails: [cashRow("2026-06-15", 200), cashRow("2026-07-20", 300)],
    });

    const derived = deriveDailyLedgerFromPos([dual], slugToUuid);
    expect(derived.map((d) => d.ledgerDate).sort()).toEqual(["2026-06-15", "2026-07-20"]);
    expect(derived.find((d) => d.ledgerDate === "2026-07-20")?.grossSales).toBe(300);
  });

  it("keeps Gross Net equal to GROSS SALES when discounts exist", () => {
    const report = baseReport({
      id: "disc",
      branch: "sm_bacoor",
      date: "2026-08-01",
      dateRangeEnd: "2026-08-01",
      updatedAt: 3_000,
      rowDetails: [
        {
          ...cashRow("2026-08-01", 1000),
          discountedPrice: 1000,
          regularDiscount: 50,
          seniorDiscount: 20,
          pwdDiscount: 10,
          vatExemption: 40,
        },
      ],
    });

    const derived = deriveDailyLedgerFromPos([report], slugToUuid);
    expect(derived).toHaveLength(1);
    expect(derived[0].grossSales).toBe(1080);
    expect(derived[0].grossSalesNet).toBe(derived[0].grossSales);
    expect(derived[0].regularDiscount + derived[0].seniorDiscount + derived[0].pwdDiscount).toBe(80);
    expect(derived[0].regularDiscount).toBe(50);
    expect(derived[0].seniorDiscount).toBe(20);
    expect(derived[0].pwdDiscount).toBe(10);
  });

  it("infers PWD from Gross − Discounted when VAT-exempt and type is missing", () => {
    const report = baseReport({
      id: "infer-sc",
      branch: "sm_bacoor",
      date: "2026-09-01",
      dateRangeEnd: "2026-09-01",
      updatedAt: 4_000,
      rowDetails: [
        {
          ...cashRow("2026-09-01", 114.29),
          discountedPrice: 114.29,
          grossPrice: 142.86,
          vatExemption: 17.14,
        },
      ],
    });
    const derived = deriveDailyLedgerFromPos([report], slugToUuid);
    expect(derived[0].pwdDiscount).toBeCloseTo(28.57, 2);
    expect(derived[0].regularDiscount).toBe(0);
    expect(derived[0].seniorDiscount).toBe(0);
    expect(derived[0].grossSales).toBeCloseTo(142.86, 2);
    expect(derived[0].grossSalesNet).toBe(derived[0].grossSales);
  });

  it("infers Regular from Gross − Discounted when there is no VAT exemption", () => {
    const report = baseReport({
      id: "infer-reg",
      branch: "sm_bacoor",
      date: "2026-09-01",
      dateRangeEnd: "2026-09-01",
      updatedAt: 4_000,
      rowDetails: [
        {
          ...cashRow("2026-09-01", 90),
          discountedPrice: 90,
          grossPrice: 100,
        },
      ],
    });
    const derived = deriveDailyLedgerFromPos([report], slugToUuid);
    expect(derived[0].regularDiscount).toBeCloseTo(10, 2);
    expect(derived[0].seniorDiscount).toBe(0);
    expect(derived[0].pwdDiscount).toBe(0);
  });

  it("classifies inferred discount as PWD when another line in the same txn has a PWD amount", () => {
    const report = baseReport({
      id: "infer-pwd-txn",
      branch: "sm_bacoor",
      date: "2026-09-01",
      dateRangeEnd: "2026-09-01",
      updatedAt: 4_000,
      rowDetails: [
        {
          ...cashRow("2026-09-01", 259.05),
          transactionId: "txn-pwd",
          discountedPrice: 259.05,
          grossPrice: 297.14,
          pwdDiscount: 38.09,
          vatExemption: 22.86,
        },
        {
          ...cashRow("2026-09-01", 114.29),
          transactionId: "txn-pwd",
          discountedPrice: 114.29,
          grossPrice: 142.86,
          vatExemption: 17.14,
        },
      ],
    });
    const derived = deriveDailyLedgerFromPos([report], slugToUuid);
    expect(derived[0].pwdDiscount).toBeCloseTo(38.09 + 28.57, 1);
    expect(derived[0].seniorDiscount).toBe(0);
  });

  it("uses Item Discount Type to classify an inferred amount as PWD", () => {
    const report = baseReport({
      id: "infer-type",
      branch: "sm_bacoor",
      date: "2026-09-01",
      dateRangeEnd: "2026-09-01",
      updatedAt: 4_000,
      rowDetails: [
        {
          ...cashRow("2026-09-01", 114.29),
          discountedPrice: 114.29,
          grossPrice: 142.86,
          vatExemption: 17.14,
          itemDiscountType: "PWD",
        },
      ],
    });
    const derived = deriveDailyLedgerFromPos([report], slugToUuid);
    expect(derived[0].pwdDiscount).toBeCloseTo(28.57, 2);
    expect(derived[0].seniorDiscount).toBe(0);
  });

  it("keeps VAT-exempt lines as Senior when Item Discount Type is senior", () => {
    const report = baseReport({
      id: "infer-senior-type",
      branch: "sm_bacoor",
      date: "2026-09-01",
      dateRangeEnd: "2026-09-01",
      updatedAt: 4_000,
      rowDetails: [
        {
          ...cashRow("2026-09-01", 114.29),
          discountedPrice: 114.29,
          grossPrice: 142.86,
          vatExemption: 17.14,
          itemDiscountType: "senior",
        },
      ],
    });
    const derived = deriveDailyLedgerFromPos([report], slugToUuid);
    expect(derived[0].seniorDiscount).toBeCloseTo(28.57, 2);
    expect(derived[0].pwdDiscount).toBe(0);
  });

  it("inherits Total Discount Type pwd onto other lines of the same ticket", () => {
    const report = baseReport({
      id: "inherit-total-type",
      branch: "sm_bacoor",
      date: "2026-08-01",
      dateRangeEnd: "2026-08-01",
      updatedAt: 5_000,
      rowDetails: [
        {
          ...cashRow("2026-08-01", 142.86),
          transactionId: "1788000001",
          discountedPrice: 142.86,
          grossPrice: 178.57,
          vatExemption: 21.43,
          itemDiscountType: "pwd",
        },
        {
          ...cashRow("2026-08-01", 160),
          transactionId: "1788000001",
          discountedPrice: 160,
          grossPrice: 264.01,
        },
      ],
    });
    const derived = deriveDailyLedgerFromPos([report], slugToUuid);
    expect(derived[0].pwdDiscount).toBeCloseTo(35.71 + 104.01, 2);
    expect(derived[0].seniorDiscount).toBe(0);
    expect(derived[0].regularDiscount).toBe(0);
  });
});

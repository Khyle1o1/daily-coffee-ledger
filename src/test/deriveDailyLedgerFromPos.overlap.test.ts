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
});

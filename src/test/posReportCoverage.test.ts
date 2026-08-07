import { describe, expect, it } from "vitest";
import {
  collectLocalDaysFromRowDetails,
  contentDateBoundsFromRowDetails,
  rebuildSummaryJsonFromRowDetails,
} from "@/lib/reports/posReportCoverage";
import type { ProcessedRow } from "@/utils/types";

describe("posReportCoverage", () => {
  it("collects local days and bounds from rowDetails", () => {
    const rows = [
      { transactionDate: new Date(2026, 6, 2, 12) },
      { transactionDate: new Date(2026, 6, 12, 12) },
      { transactionDate: new Date(2026, 6, 2, 18) },
    ];
    const days = collectLocalDaysFromRowDetails(rows);
    expect([...days].sort()).toEqual(["2026-07-02", "2026-07-12"]);
    expect(contentDateBoundsFromRowDetails(rows)).toEqual({
      start: "2026-07-02",
      end: "2026-07-12",
    });
  });

  it("rebuilds aggregates after stripping rows", () => {
    const kept = [
      {
        status: "MAPPED",
        mappedCat: "PACKAGING",
        mappedItemName: "Cup",
        rawCategory: "PACKAGING",
        rawItemName: "Cup",
        option: "",
        quantity: 2,
        unitPrice: 5,
        rowSales: 10,
        transactionDate: new Date(2026, 6, 5, 12),
      },
    ] as ProcessedRow[];

    const json = rebuildSummaryJsonFromRowDetails(
      { filename: "x.csv", uploadedAt: 1 },
      kept,
    );
    expect(json.totalRows).toBe(1);
    expect(json.grandTotal).toBe(10);
    expect((json.summaryTotalsByCat as Record<string, number>).PACKAGING).toBe(10);
  });
});

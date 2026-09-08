import { describe, expect, it } from "vitest";
import { getChannelFromPaymentType } from "@/lib/reports/channel";
import { computeCategoryTotals } from "@/lib/reports/compute";
import { computeChannelSalesSummary } from "@/lib/reports/computeChannelSalesSummary";
import { dailyReportFromRow } from "@/services/reportConverter";
import { iterMonthWindows, rollupLinesToRowDetails } from "@/services/reportsService";
import type { DailyReportRow } from "@/lib/supabase-types";

describe("rollupLinesToRowDetails", () => {
  it("decodes positional lines into compute-ready rows", () => {
    const rows = rollupLinesToRowDetails([
      ["2026-03-01", "Americano", "HOT", "walk-in", 2, 300],
      ["2026-03-02", "Americano", "HOT", "grab", "1", "150.50"],
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].mappedItemName).toBe("Americano");
    expect(rows[0].quantity).toBe(2);
    expect(rows[1].rowSales).toBe(150.5);
    expect(getChannelFromPaymentType(rows[0].paymentType)).toBe("WALK_IN");
    expect(getChannelFromPaymentType(rows[1].paymentType)).toBe("GRAB");
  });

  it("skips malformed entries", () => {
    expect(rollupLinesToRowDetails(null)).toEqual([]);
    expect(rollupLinesToRowDetails([["2026-03-01", "x"]])).toEqual([]);
  });

  it("survives Date conversion and feeds category + channel totals", () => {
    const details = rollupLinesToRowDetails([
      ["2026-03-01", "Iced Latte", "ICED", "walk-in", 4, 1000],
      ["2026-03-02", "Iced Latte", "ICED", "grab", 2, 500],
      ["2026-03-03", "Croissant", "SNACKS", "foodpanda", 1, 200],
    ]);

    const report = dailyReportFromRow({
      id: "r1",
      branch_id: "b1",
      report_date: "2026-03-01",
      date_range_start: "2026-03-01",
      date_range_end: "2026-03-31",
      transactions_file_name: "t.csv",
      mapping_file_name: null,
      summary_json: {
        filename: "t.csv",
        uploadedAt: 0,
        totalRows: 3,
        mappedRows: 3,
        unmappedRows: 0,
        skippedRows: 0,
        summaryTotalsByCat: {},
        summaryQuantitiesByCat: {},
        grandTotal: 1700,
        grandQuantity: 7,
        percentByCat: {},
        rowDetails: details,
        unmappedSummary: [],
      },
      user_id: "u1",
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
      branch: {
        id: "b1",
        name: "greenbelt",
        label: "Greenbelt",
        created_at: "",
        updated_at: "",
      },
    } as DailyReportRow);

    expect(report.rowDetails.every((r) => r.transactionDate instanceof Date)).toBe(true);

    const filters = {
      branchId: ["greenbelt"],
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
      selectedCategories: [],
    };

    const mix = computeCategoryTotals([report], filters);
    expect(mix.grandTotal).toBe(1700);

    const channel = computeChannelSalesSummary([report], filters);
    expect(channel.overall.totals.walkIn).toBe(1000);
    expect(channel.overall.totals.grab).toBe(500);
    expect(channel.overall.totals.foodpanda).toBe(200);
  });
});

describe("rollup month windows", () => {
  it("splits a year so each RPC stays inside one calendar month", () => {
    expect(iterMonthWindows("2026-01-01", "2026-12-31")).toHaveLength(12);
  });
});

import { describe, expect, it } from "vitest";
import { detectDateRangeFromRows } from "@/lib/reports/detectDateRange";

describe("detectDateRangeFromRows", () => {
  it("parses bare YYYY-MM-DD as local midnight (not UTC-shifted)", () => {
    const range = detectDateRangeFromRows([
      { "Transaction Date": "2026-01-15", item: "a" },
      { "Transaction Date": "2026-02-03", item: "b" },
    ]);
    expect(range).not.toBeNull();
    expect(range!.start.getFullYear()).toBe(2026);
    expect(range!.start.getMonth()).toBe(0);
    expect(range!.start.getDate()).toBe(15);
    expect(range!.end.getFullYear()).toBe(2026);
    expect(range!.end.getMonth()).toBe(1);
    expect(range!.end.getDate()).toBe(3);
  });
});

import { describe, expect, it } from "vitest";
import { iterMonthWindows, MAX_SINGLE_REQUEST_SPAN_DAYS } from "@/services/reportsService";

describe("compute range splitting", () => {
  it("keeps a single month as one request", () => {
    const windows = iterMonthWindows("2026-08-01", "2026-08-31");
    expect(windows).toHaveLength(1);
    expect(windows[0]).toEqual({ dateFrom: "2026-08-01", dateTo: "2026-08-31" });
  });

  it("splits a full year into calendar months", () => {
    const windows = iterMonthWindows("2026-01-01", "2026-12-31");
    expect(windows).toHaveLength(12);
    expect(windows[0].dateFrom).toBe("2026-01-01");
    expect(windows[11].dateTo).toBe("2026-12-31");
  });

  it("clamps the first and last window to the selected bounds", () => {
    const windows = iterMonthWindows("2026-08-05", "2026-10-09");
    expect(windows).toEqual([
      { dateFrom: "2026-08-05", dateTo: "2026-08-31" },
      { dateFrom: "2026-09-01", dateTo: "2026-09-30" },
      { dateFrom: "2026-10-01", dateTo: "2026-10-09" },
    ]);
  });

  it("uses a single-request span that fits inside the 8s authenticator timeout", () => {
    // A month of rowDetails runs 2-6s; the cap must not exceed one calendar month.
    expect(MAX_SINGLE_REQUEST_SPAN_DAYS).toBeGreaterThanOrEqual(28);
    expect(MAX_SINGLE_REQUEST_SPAN_DAYS).toBeLessThanOrEqual(31);
  });
});

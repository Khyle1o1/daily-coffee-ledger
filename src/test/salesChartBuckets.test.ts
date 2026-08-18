import { describe, expect, it } from "vitest";
import { bucketSalesChartPoints } from "@/lib/reports/salesChartBuckets";

describe("bucketSalesChartPoints", () => {
  it("labels the ISO week of Jan 1–4 2026 from those days, not Dec 29", () => {
    const points = bucketSalesChartPoints(
      [
        { dateStr: "2026-01-01", value: 10 },
        { dateStr: "2026-01-02", value: 20 },
        { dateStr: "2026-01-03", value: 30 },
        { dateStr: "2026-01-04", value: 40 },
      ],
      "weekly",
    );
    expect(points).toHaveLength(1);
    expect(points[0].label).toBe("Jan 1–4");
    expect(points[0].label).not.toMatch(/Dec/);
    expect(points[0].value).toBe(100);
  });

  it("uses both month names when a week crosses months", () => {
    const points = bucketSalesChartPoints(
      [
        { dateStr: "2026-01-26", value: 1 },
        { dateStr: "2026-02-01", value: 2 },
      ],
      "weekly",
    );
    expect(points).toHaveLength(1);
    expect(points[0].label).toBe("Jan 26–Feb 1");
  });
});

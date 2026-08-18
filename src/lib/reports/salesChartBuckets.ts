import { format, startOfMonth, startOfWeek } from "date-fns";

export type ChartGranularity = "weekly" | "daily" | "monthly";

export type SalesChartPoint = {
  key: string;
  label: string;
  value: number;
};

function localDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00`);
}

function rangeLabel(minYmd: string, maxYmd: string): string {
  const start = localDate(minYmd);
  const end = localDate(maxYmd);
  if (minYmd === maxYmd) return format(start, "MMM d");
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, "MMM d")}–${format(end, "d")}`;
  }
  return `${format(start, "MMM d")}–${format(end, "MMM d")}`;
}

/**
 * Bucket calendar days for the Sales Overview chart.
 * Weekly groups by ISO week start (Monday) but labels from the min/max days
 * that actually landed in the bucket, so Jan 1–4 is not shown as Dec 29–4.
 */
export function bucketSalesChartPoints(
  days: Array<{ dateStr: string; value: number }>,
  granularity: ChartGranularity,
): SalesChartPoint[] {
  const buckets = new Map<
    string,
    { value: number; minDay: string; maxDay: string }
  >();

  for (const { dateStr, value } of days) {
    const date = localDate(dateStr);
    if (Number.isNaN(date.getTime())) continue;

    let key = dateStr;
    if (granularity === "weekly") {
      key = format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
    } else if (granularity === "monthly") {
      key = format(startOfMonth(date), "yyyy-MM");
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.value += value;
      if (dateStr < existing.minDay) existing.minDay = dateStr;
      if (dateStr > existing.maxDay) existing.maxDay = dateStr;
    } else {
      buckets.set(key, { value, minDay: dateStr, maxDay: dateStr });
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => {
      let label: string;
      if (granularity === "monthly") {
        label = format(localDate(`${bucket.minDay.slice(0, 7)}-01`), "MMM yyyy");
      } else if (granularity === "weekly") {
        label = rangeLabel(bucket.minDay, bucket.maxDay);
      } else {
        label = format(localDate(bucket.minDay), "MMM d");
      }
      return { key, label, value: bucket.value };
    });
}

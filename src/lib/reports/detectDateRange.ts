export interface DetectedDateRange {
  start: Date;
  end: Date;
}

export function detectDateRangeFromFilename(
  filename: string,
): DetectedDateRange | null {
  // matches: 2026-01-01 00-00 to 2026-01-31 23-59
  const re =
    /(\d{4}-\d{2}-\d{2})\s+\d{2}-\d{2}\s+to\s+(\d{4}-\d{2}-\d{2})\s+\d{2}-\d{2}/i;
  const m = filename.match(re);
  if (!m) return null;

  const start = new Date(`${m[1]}T00:00:00`);
  const end = new Date(`${m[2]}T23:59:59`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  return { start, end };
}

export function detectDateRangeFromRows(
  rows: Record<string, any>[],
): DetectedDateRange | null {
  if (!rows.length) return null;

  const candidateKeys = [
    "date",
    "datetime",
    "transaction_date",
    "transactionDate",
    "created_at",
    "createdAt",
    "order_date",
    "orderDate",
    "timestamp",
  ];

  const keys = Object.keys(rows[0] ?? {});
  const dateKey =
    candidateKeys.find((k) => keys.includes(k)) ??
    keys.find((k) => {
      const lower = k.toLowerCase();
      return lower.includes("date") || lower.includes("time");
    });

  if (!dateKey) return null;

  let min = Infinity;
  let max = -Infinity;

  for (const r of rows) {
    const raw = r[dateKey];
    if (!raw) continue;
    const d = new Date(String(raw).replace(" ", "T"));
    const t = d.getTime();
    if (Number.isNaN(t)) continue;
    min = Math.min(min, t);
    max = Math.max(max, t);
  }

  if (!isFinite(min) || !isFinite(max)) return null;
  return { start: new Date(min), end: new Date(max) };
}


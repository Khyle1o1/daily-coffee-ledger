export function filterRowsByDateRange<T extends { transactionDate: Date }>(
  rows: T[],
  start: Date,
  end: Date,
): T[] {
  const toLocalDateKey = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const startKey = toLocalDateKey(start);
  const endKey = toLocalDateKey(end);

  return rows.filter((r) => {
    const transactionDate = r.transactionDate;
    if (!(transactionDate instanceof Date)) return false;
    const t = transactionDate.getTime();
    if (Number.isNaN(t)) return false;
    const txKey = toLocalDateKey(transactionDate);
    return txKey >= startKey && txKey <= endKey;
  });
}


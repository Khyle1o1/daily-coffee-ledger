export function filterRowsByDateRange<T extends { transactionDate: Date }>(
  rows: T[],
  start: Date,
  end: Date,
): T[] {
  const startTime = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
  const endTime = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
    23,
    59,
    59,
    999,
  ).getTime();

  return rows.filter((r) => {
    const t = r.transactionDate?.getTime?.();
    if (!t || Number.isNaN(t)) return false;
    return t >= startTime && t <= endTime;
  });
}


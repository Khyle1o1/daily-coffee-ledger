export function findTransactionDateKey(headers: string[]): string | null {
  const normalized = headers.map((h) => h.trim().toLowerCase());

  const priority = [
    "transaction date",
    "transaction_date",
    "date",
    "datetime",
    "date time",
    "created at",
    "created_at",
    "timestamp",
  ];

  for (const p of priority) {
    const idx = normalized.findIndex((h) => h === p);
    if (idx >= 0) return headers[idx];
  }

  const anyDateIdx = normalized.findIndex(
    (h) => h.includes("date") || h.includes("time"),
  );
  if (anyDateIdx >= 0) return headers[anyDateIdx];

  return null;
}


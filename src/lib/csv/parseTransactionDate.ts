export function parseTransactionDate(raw: any): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // 1) ISO / YYYY-MM-DD or YYYY-MM-DD HH:mm(:ss)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const iso = s.includes("T") ? s : s.replace(" ", "T");
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // 2) MM/DD/YYYY or MM/DD/YYYY HH:mm(:ss)
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (m) {
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);
    const hh = Number(m[4] ?? 0);
    const mi = Number(m[5] ?? 0);
    const ss = Number(m[6] ?? 0);

    const d = new Date(yyyy, mm - 1, dd, hh, mi, ss);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // 3) Fallback: Date.parse
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  return null;
}


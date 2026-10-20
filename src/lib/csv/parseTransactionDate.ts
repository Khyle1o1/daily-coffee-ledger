const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function parseTransactionDate(raw: unknown): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // 1) YYYY-MM-DD (date only) -> parse as local date to avoid TZ shifts
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const yyyy = Number(ymd[1]);
    const mm = Number(ymd[2]);
    const dd = Number(ymd[3]);
    const d = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // 2) ISO / YYYY-MM-DD HH:mm(:ss)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const normalized = s.includes("T") ? s : s.replace(" ", "T");
    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // 3) MM/DD/YYYY or MM/DD/YYYY HH:mm(:ss)
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

  // 4) "DD Mon YYYY" or "D Mon YYYY" format (UTAK POS exports: "19 Oct 2026")
  const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmy) {
    const dd = Number(dmy[1]);
    const monthName = dmy[2].toLowerCase();
    const yyyy = Number(dmy[3]);
    const mm = MONTH_NAMES[monthName];
    if (mm !== undefined && dd >= 1 && dd <= 31 && yyyy >= 1900) {
      const d = new Date(yyyy, mm, dd, 0, 0, 0, 0);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  // 5) Fallback: Date.parse
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  return null;
}


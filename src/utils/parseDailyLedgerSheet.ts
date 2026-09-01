/** Detect / parse Google Sheets–style Daily Ledger CSV exports. */

export interface ParsedDailyLedgerRow {
  ledgerDate: string; // YYYY-MM-DD
  cash: number;
  maya: number;
  grab: number;
  paymongo: number;
  gcash: number;
  foodpanda: number;
  giftCard: number;
  regularDiscount: number;
  seniorDiscount: number;
  pwdDiscount: number;
  vatExemption: number;
  grossSalesNet: number;
  transactionCount: number;
  grossSales: number;
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findHeader(headers: string[], candidates: string[]): string | null {
  const norms = headers.map((h) => ({ raw: h, n: normHeader(h) }));
  for (const c of candidates) {
    const cn = normHeader(c);
    const exact = norms.find((h) => h.n === cn);
    if (exact) return exact.raw;
    const soft = norms.find((h) => h.n.includes(cn) || cn.includes(h.n));
    if (soft) return soft.raw;
  }
  return null;
}

/** True when CSV looks like the Daily Ledger sheet (not POS transactions). */
export function isDailyLedgerSheetFormat(headers: string[]): boolean {
  const hasCash = !!findHeader(headers, ["cash sales", "cash"]);
  const hasPaymongo = !!findHeader(headers, ["paymongo"]);
  const hasGross = !!findHeader(headers, ["gross sales", "gross sales net"]);
  const hasDate = !!findHeader(headers, ["date"]);
  const hasPosItem = !!findHeader(headers, ["item", "category", "price per unit"]);
  return hasDate && hasCash && (hasPaymongo || hasGross) && !hasPosItem;
}

function parseMoney(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const s = String(raw).replace(/[,₱\s]/g, "").trim();
  if (!s || s === "-" || s === "—") return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // June 29, 2026
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return null;
}

/**
 * Parse Daily Ledger sheet rows. Skips blank / total rows without a valid date.
 */
export function parseDailyLedgerSheetRows(
  headers: string[],
  data: Record<string, string>[],
): ParsedDailyLedgerRow[] {
  const dateH = findHeader(headers, ["date"]);
  if (!dateH) throw new Error("Daily Ledger sheet is missing a Date column");

  const map = {
    cash: findHeader(headers, ["cash sales", "cash"]),
    maya: findHeader(headers, ["maya"]),
    grab: findHeader(headers, ["grab"]),
    paymongo: findHeader(headers, ["paymongo"]),
    gcash: findHeader(headers, ["gcash", "g cash"]),
    foodpanda: findHeader(headers, ["food panda", "foodpanda"]),
    giftCard: findHeader(headers, ["gift card", "giftcard"]),
    regularDiscount: findHeader(headers, ["regular discount"]),
    seniorDiscount: findHeader(headers, ["senior discount"]),
    pwdDiscount: findHeader(headers, ["pwd discount"]),
    vatExemption: findHeader(headers, ["vat exemption"]),
    grossSalesNet: findHeader(headers, ["gross sales net", "gross sales (net)"]),
    transactionCount: findHeader(headers, ["transaction count", "transactions"]),
    grossSales: findHeader(headers, ["gross sales"]),
  };

  // Prefer explicit GROSS SALES over Gross Sales (Net) when both exist
  const grossHeaders = headers.filter((h) => normHeader(h) === "gross sales");
  if (grossHeaders.length > 0) {
    map.grossSales = grossHeaders[grossHeaders.length - 1];
  }

  const out: ParsedDailyLedgerRow[] = [];
  for (const row of data) {
    const ledgerDate = parseDate(row[dateH]);
    if (!ledgerDate) continue;

    const cash = map.cash ? parseMoney(row[map.cash]) : 0;
    const maya = map.maya ? parseMoney(row[map.maya]) : 0;
    const grab = map.grab ? parseMoney(row[map.grab]) : 0;
    const paymongo = map.paymongo ? parseMoney(row[map.paymongo]) : 0;
    const gcash = map.gcash ? parseMoney(row[map.gcash]) : 0;
    const foodpanda = map.foodpanda ? parseMoney(row[map.foodpanda]) : 0;
    const giftCard = map.giftCard ? parseMoney(row[map.giftCard]) : 0;
    const regularDiscount = map.regularDiscount ? parseMoney(row[map.regularDiscount]) : 0;
    const seniorDiscount = map.seniorDiscount ? parseMoney(row[map.seniorDiscount]) : 0;
    const pwdDiscount = map.pwdDiscount ? parseMoney(row[map.pwdDiscount]) : 0;
    const vatExemption = map.vatExemption ? parseMoney(row[map.vatExemption]) : 0;
    const tenderSum = cash + maya + grab + paymongo + gcash + foodpanda + giftCard;
    const parsedGross = map.grossSales ? parseMoney(row[map.grossSales]) : null;
    const parsedGrossNet = map.grossSalesNet ? parseMoney(row[map.grossSalesNet]) : null;
    // Gross Net equals GROSS SALES; prefer the explicit GROSS SALES column, then tender sum.
    const grossSales = parsedGross ?? parsedGrossNet ?? tenderSum;
    const grossSalesNet = grossSales;
    const transactionCount = map.transactionCount
      ? Math.round(parseMoney(row[map.transactionCount]))
      : 0;

    // Skip all-zero placeholder rows
    if (
      grossSales === 0 &&
      grossSalesNet === 0 &&
      transactionCount === 0 &&
      cash + maya + grab + paymongo + gcash + foodpanda + giftCard === 0
    ) {
      continue;
    }

    out.push({
      ledgerDate,
      cash,
      maya,
      grab,
      paymongo,
      gcash,
      foodpanda,
      giftCard,
      regularDiscount,
      seniorDiscount,
      pwdDiscount,
      vatExemption,
      grossSalesNet,
      transactionCount,
      grossSales,
    });
  }

  return out;
}

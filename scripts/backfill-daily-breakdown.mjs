/**
 * One-off: add summary_json.dailyBreakdown from rowDetails.transactionDate
 * so list/history/monthly can slice Jan–Feb uploads without re-upload.
 *
 * Run: node scripts/backfill-daily-breakdown.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const CATEGORIES = [
  "ICED",
  "HOT",
  "SNACKS",
  "ADD-ONS",
  "MERCH",
  "PROMO",
  "LOYALTY CARD",
  "PACKAGING",
];

function log(msg) {
  fs.writeSync(1, `${msg}\n`);
}

function loadEnv() {
  const envPath = path.resolve("d:/2026/daily-coffee-ledger/.env");
  const text = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function toLocalYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localYmdFromUnknown(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return toLocalYmd(d);
}

function emptyCell() {
  const totals = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const quantities = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  return { totals, quantities, grandTotal: 0, grandQuantity: 0 };
}

function buildDailyBreakdown(rows) {
  const byDay = new Map();
  for (const row of rows ?? []) {
    const day = localYmdFromUnknown(row.transactionDate);
    if (!day) continue;
    if (row.status === "SKIPPED") continue;
    let cell = byDay.get(day);
    if (!cell) {
      cell = emptyCell();
      byDay.set(day, cell);
    }
    if (row.mappedCat && CATEGORIES.includes(row.mappedCat)) {
      cell.totals[row.mappedCat] += Number(row.rowSales) || 0;
      cell.quantities[row.mappedCat] += Number(row.quantity) || 0;
      cell.grandTotal += Number(row.rowSales) || 0;
      cell.grandQuantity += Number(row.quantity) || 0;
    }
  }
  const out = {};
  for (const day of [...byDay.keys()].sort()) out[day] = byDay.get(day);
  return out;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL / service role key in .env");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init = {}) =>
      fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(60_000) }),
  },
});

async function withRetry(label, fn, attempts = 6) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const wait = Math.min(15000, 500 * 2 ** (i - 1));
      log(`${label} failed (${i}/${attempts}): ${err.message || err}; retry in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

log(`connected ${url}`);

const { count } = await withRetry("count reports_daily", async () => {
  const res = await supabase
    .from("reports_daily")
    .select("id", { count: "exact", head: true });
  if (res.error) throw new Error(res.error.message);
  return res;
});
log(`reports_daily count=${count ?? 0}`);

const PAGE = 20;
let from = 0;
let reportsScanned = 0;
let reportsUpdated = 0;
let reportsSkipped = 0;
let daysWritten = 0;

for (;;) {
  log(`fetching ids ${from}–${from + PAGE - 1}`);
  const { data: ids } = await withRetry(`fetch ids ${from}–${from + PAGE - 1}`, async () => {
    const res = await supabase
      .from("reports_daily")
      .select("id, report_date")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (res.error) throw new Error(res.error.message);
    return res;
  });
  if (!ids?.length) break;

  for (const meta of ids) {
    const { data: report } = await withRetry(`fetch ${meta.id}`, async () => {
      const res = await supabase
        .from("reports_daily")
        .select("id, report_date, summary_json")
        .eq("id", meta.id)
        .single();
      if (res.error) throw new Error(res.error.message);
      return res;
    });
    reportsScanned += 1;
    if (reportsScanned % 5 === 0) log(`scanned ${reportsScanned}/${count ?? "?"}`);
    const json = report.summary_json;
    if (!json || !Array.isArray(json.rowDetails)) {
      reportsSkipped += 1;
      continue;
    }

    const dailyBreakdown = buildDailyBreakdown(json.rowDetails);
    const dayCount = Object.keys(dailyBreakdown).length;
    if (dayCount === 0) {
      reportsSkipped += 1;
      continue;
    }

    const nextJson = { ...json, dailyBreakdown };
    await withRetry(`update ${report.id}`, async () => {
      const res = await supabase
        .from("reports_daily")
        .update({ summary_json: nextJson })
        .eq("id", report.id);
      if (res.error) throw new Error(res.error.message);
      return res;
    });

    reportsUpdated += 1;
    daysWritten += dayCount;
    log(`updated ${report.id} date=${report.report_date} days=${dayCount}`);
  }

  if (ids.length < PAGE) break;
  from += PAGE;
}

log(
  JSON.stringify(
    { reportsScanned, reportsUpdated, reportsSkipped, daysWritten },
    null,
    2,
  ),
);

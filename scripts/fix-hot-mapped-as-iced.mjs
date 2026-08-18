/**
 * One-off: move Hot POS lines that were stored as ICED onto HOT
 * (and the reverse) inside reports_daily.summary_json, then rebuild totals.
 *
 * Does not call saveDailyReport (no overlap reconcile).
 * Run: node scripts/fix-hot-mapped-as-iced.mjs
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

function optionTemperature(text) {
  const lower = String(text ?? "").toLowerCase();
  const hasIced = /\biced\b/.test(lower);
  const hasHot = /\bhot\b/.test(lower);
  if (hasIced === hasHot) return null;
  return hasIced ? "iced" : "hot";
}

function rematchRows(rowDetails) {
  let icedToHot = 0;
  let hotToIced = 0;
  const next = (rowDetails ?? []).map((row) => {
    if (!row || row.status === "SKIPPED") return row;
    const temp = optionTemperature(row.option);
    if (temp === "hot" && row.mappedCat === "ICED") {
      icedToHot += 1;
      return { ...row, mappedCat: "HOT" };
    }
    if (temp === "iced" && row.mappedCat === "HOT") {
      hotToIced += 1;
      return { ...row, mappedCat: "ICED" };
    }
    return row;
  });
  return { rows: next, icedToHot, hotToIced };
}

function aggregate(rows) {
  const totals = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const quantities = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const row of rows) {
    if (!row || row.status === "SKIPPED") continue;
    if (row.mappedCat && CATEGORIES.includes(row.mappedCat)) {
      totals[row.mappedCat] += Number(row.rowSales) || 0;
      quantities[row.mappedCat] += Number(row.quantity) || 0;
    }
  }
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const grandQuantity = Object.values(quantities).reduce((a, b) => a + b, 0);
  const percents = Object.fromEntries(
    CATEGORIES.map((c) => [
      c,
      grandTotal > 0 ? Math.round((totals[c] / grandTotal) * 100) : 0,
    ]),
  );
  return { totals, quantities, grandTotal, grandQuantity, percents };
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
let icedToHot = 0;
let hotToIced = 0;

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
    if (!json || !Array.isArray(json.rowDetails)) continue;

    const rematch = rematchRows(json.rowDetails);
    if (rematch.icedToHot === 0 && rematch.hotToIced === 0) continue;

    const agg = aggregate(rematch.rows);
    const nextJson = {
      ...json,
      rowDetails: rematch.rows,
      summaryTotalsByCat: agg.totals,
      summaryQuantitiesByCat: agg.quantities,
      grandTotal: agg.grandTotal,
      grandQuantity: agg.grandQuantity,
      percentByCat: agg.percents,
    };

    await withRetry(`update ${report.id}`, async () => {
      const res = await supabase
        .from("reports_daily")
        .update({ summary_json: nextJson })
        .eq("id", report.id);
      if (res.error) throw new Error(res.error.message);
      return res;
    });

    reportsUpdated += 1;
    icedToHot += rematch.icedToHot;
    hotToIced += rematch.hotToIced;
    log(
      `updated ${report.id} date=${report.report_date} iced→hot=${rematch.icedToHot} hot→iced=${rematch.hotToIced}`,
    );
  }

  if (ids.length < PAGE) break;
  from += PAGE;
}

log(
  JSON.stringify(
    { reportsScanned, reportsUpdated, icedToHot, hotToIced },
    null,
    2,
  ),
);

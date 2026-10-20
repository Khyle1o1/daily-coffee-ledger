#!/usr/bin/env node

/**
 * UTAK POS Daily Transaction Sync
 *
 * Automates downloading transaction CSVs from UTAK POS for all branches
 * and imports them into the DOT Coffee ledger (Supabase).
 *
 * Usage:
 *   node scripts/utak-sync.mjs                    # Sync yesterday (default)
 *   node scripts/utak-sync.mjs --date 2026-10-19  # Sync specific date
 *   node scripts/utak-sync.mjs --from 2026-10-01 --to 2026-10-19  # Date range
 *   node scripts/utak-sync.mjs --dry-run          # Preview without saving
 *
 * Environment variables (required):
 *   UTAK_EMAIL              - UTAK master account email
 *   UTAK_PASSWORD           - UTAK master account password
 *   SUPABASE_URL            - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   UTAK_SYNC_USER_ID       - UUID of the sync user in user_profiles (optional)
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const UTAK_LOGIN_URL = "https://utak.io/login";
const UTAK_MASTER_URL = "https://utak.io/master";
const UTAK_TRANSACTIONS_URL = "https://utak.io/transactions";

const DOWNLOAD_DIR = join(ROOT, ".utak-downloads");

// Timeout settings (milliseconds)
const PAGE_LOAD_TIMEOUT = 60000;
const BRANCH_CARD_TIMEOUT = 45000;
const DOWNLOAD_TIMEOUT = 60000;
const NAV_TIMEOUT = 30000;

// ─────────────────────────────────────────────────────────────────────────────
// UTAK Branch Mapping (inline for Node.js compatibility)
// ─────────────────────────────────────────────────────────────────────────────

const UTAK_BRANCH_MAPPINGS = [
  { utakEmail: "dotcoffee_greenbelt@utak.io", utakCardName: "DOT COFFEE - GREENBELT 3", ledgerSlug: "greenbelt" },
  { utakEmail: "dotcoffee_podium@utak.io", utakCardName: "DOT COFFEE - THE PODIUM MALL", ledgerSlug: "podium" },
  { utakEmail: "dotcoffee_themindmuseum@utak.io", utakCardName: "DOT COFFEE - THE MIND MUSEUM", ledgerSlug: "mind_museum" },
  { utakEmail: "dotcoffee_landmarktrinoma@utak.io", utakCardName: "DOT COFFEE - LANDMARK TRINOMA", ledgerSlug: "trinoma" },
  { utakEmail: "dotcoffee_uptownbgc@utak.io", utakCardName: "DOT COFFEE - UPTOWN MALL", ledgerSlug: "uptown" },
  { utakEmail: "dotcoffee_wgc@utak.io", utakCardName: "DOT COFFEE - WGC", ledgerSlug: "wgc" },
  { utakEmail: "wcc@utak.io", utakCardName: "DOT COFFEE - W CITY CENTER", ledgerSlug: "wcc" },
  { utakEmail: "dotcoffee_events@utaklite.io", utakCardName: "Dot HQ Events", ledgerSlug: "events" },
  { utakEmail: "dotcoffee_ayalapavillionlaguna@utak.io", utakCardName: "DOT AYALA PAVILION", ledgerSlug: "ayala_pavilion" },
  { utakEmail: "dotcoffee_arcasouth@utak.io", utakCardName: "DOT COFFEE - ARCA SOUTH", ledgerSlug: "arca_south" },
  { utakEmail: "dotcoffee_falconqc@utak.io", utakCardName: "DOT COFFEE - FALCON HUB", ledgerSlug: "falcon_hub" },
  { utakEmail: "dotcoffee_ayalamrt@utak.io", utakCardName: "DOT COFFEE - ONE AYALA MRT", ledgerSlug: "one_ayala_mrt" },
  { utakEmail: "dotcoffee_smnorthedsa@utak.io", utakCardName: "DOT COFFEE - SM NORTH EDSA", ledgerSlug: "sm_north_edsa" },
  { utakEmail: "dotcoffee_smstarosa@utak.io", utakCardName: "DOT COFFEE - SM STA ROSA", ledgerSlug: "sm_sta_rosa" },
  { utakEmail: "dotcoffee_southwoods@utak.io", utakCardName: "DOT COFFEE - SOUTHWOODS MALL", ledgerSlug: "southwoods" },
  { utakEmail: "dotcoffee_threecentral@utak.io", utakCardName: "DOT COFFEE - THREE CENTRAL", ledgerSlug: "three_central" },
  { utakEmail: "dotcoffee_eastwood@utak.io", utakCardName: "DOT EASTWOOD 1800", ledgerSlug: "eastwood" },
  { utakEmail: "dotcoffee_luckychinatownmall@utak.io", utakCardName: "DOT LUCKY CHINATOWN", ledgerSlug: "lucky_chinatown" },
  { utakEmail: "dotcoffee_smbacoor@utak.io", utakCardName: "DOT SM BACOOR", ledgerSlug: "sm_bacoor" },
  { utakEmail: "dotcoffee_nationaluniversitymoa@utak.io", utakCardName: "Dot NU MOA", ledgerSlug: "nu_moa" },
  { utakEmail: "dot_beatiraga@utak.io", utakCardName: "ROB GALLERIA", ledgerSlug: "robinsons_galleria" },
  { utakEmail: "dotcoffee_smmoa@utak.io", utakCardName: "SM MALL OF ASIA (MOA)", ledgerSlug: "sm_moa" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Date Parsing (from src/lib/csv/parseTransactionDate.ts)
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function parseTransactionDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    if (!Number.isNaN(d.getTime())) return d;
  }

  // ISO / YYYY-MM-DD HH:mm
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
    if (!Number.isNaN(d.getTime())) return d;
  }

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (mdy) {
    const d = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]), Number(mdy[4] ?? 0), Number(mdy[5] ?? 0));
    if (!Number.isNaN(d.getTime())) return d;
  }

  // DD Mon YYYY (UTAK format: "19 Oct 2026")
  const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = MONTH_NAMES[dmy[2].toLowerCase()];
    const yyyy = Number(dmy[3]);
    if (mm !== undefined && dd >= 1 && dd <= 31) {
      const d = new Date(yyyy, mm, dd);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  // Fallback
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Column Auto-Detection (from src/utils/parseCsv.ts)
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_HINTS = {
  itemDiscountType: ["item discount type", "pax discount type", "discount type"],
  totalDiscountType: ["total discount type"],
  itemDiscountAmount: ["item discount amount"],
  totalDiscountAmount: ["total discount amount"],
  rawCategory: ["category", "cat", "rawcategory", "type"],
  rawItemName: ["item", "item_name", "itemname", "name", "product", "description"],
  option: ["option", "modifier", "variant", "size"],
  quantity: ["quantity", "qty", "num"],
  unitPrice: ["unit_price", "unitprice", "price", "unit price", "price per unit"],
  paymentType: ["payment_type", "payment type", "channel"],
  transactionId: ["transaction id", "transaction_id", "txn id"],
  receiptNo: ["receipt no", "receipt_no"],
  grossPrice: ["gross price", "gross_price"],
  discountedPrice: ["discounted price", "discounted_price"],
  regularDiscount: ["pax discount amount regular", "pax discount amount - regular", "regular discount"],
  seniorDiscount: ["pax discount amount senior", "pax discount amount - senior", "senior discount"],
  pwdDiscount: ["pax discount amount pwd", "pax discount amount - pwd", "pwd discount"],
  vatExemption: ["vat exemption", "pax vat exemption"],
};

function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/[^a-z0-9_]+/g, " ").replace(/\s+/g, " ").trim();
}

function autoDetectColumns(headers) {
  const result = {};
  const lowerHeaders = headers.map(normalizeHeader);
  for (const [field, hints] of Object.entries(HEADER_HINTS)) {
    for (const hint of hints) {
      const normHint = normalizeHeader(hint);
      const idx = lowerHeaders.findIndex((h) => h === normHint || h.includes(normHint));
      if (idx !== -1 && !Object.values(result).includes(headers[idx])) {
        result[field] = headers[idx];
        break;
      }
    }
  }
  return result;
}

function findTransactionDateKey(headers) {
  const candidates = ["Date", "date", "Transaction Date", "transaction_date", "TransactionDate"];
  for (const c of candidates) {
    if (headers.includes(c)) return c;
  }
  const lower = headers.map((h) => h.toLowerCase());
  const idx = lower.findIndex((h) => h.includes("date"));
  return idx >= 0 ? headers[idx] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simplified Mapping (category-based, for sync script)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ["ICED", "HOT", "SNACKS", "ADD-ONS", "MERCH", "PROMO", "LOYALTY CARD", "PACKAGING"];

function inferCategory(rawCategory, rawItem, option) {
  const catLower = (rawCategory || "").toLowerCase().trim();
  const itemLower = (rawItem || "").toLowerCase().trim();
  const optLower = (option || "").toLowerCase().trim();

  // Packaging
  if (catLower.includes("packaging")) return "PACKAGING";
  if (itemLower.includes("dabba cup") || itemLower.includes("paper cup") || itemLower.includes("straw")) return "PACKAGING";

  // Add-ons
  if (catLower.includes("add") && catLower.includes("on")) return "ADD-ONS";
  if (itemLower.startsWith("add ons ")) return "ADD-ONS";
  if (itemLower.includes("less ice") || itemLower.includes("less sweet") || itemLower.includes("half-shot")) return "ADD-ONS";

  // Snacks
  if (catLower.includes("snack") || catLower.includes("del - snack") || catLower.includes("del-snack")) return "SNACKS";

  // Merch
  if (catLower.includes("merch")) return "MERCH";

  // Promo
  if (catLower.includes("promo")) return "PROMO";

  // Loyalty
  if (catLower.includes("loyalty")) return "LOYALTY CARD";

  // Temperature-based (signatures and classics)
  const isClassics = catLower.includes("classic");
  const isSignatures = catLower.includes("signature");

  if (isClassics || isSignatures) {
    if (optLower.includes("hot")) return "HOT";
    if (optLower.includes("iced") || optLower.includes("cold")) return "ICED";
    // Default signatures to ICED
    return "ICED";
  }

  // Fallback: try to detect from option
  if (optLower.includes("hot")) return "HOT";
  if (optLower.includes("iced")) return "ICED";

  return null;
}

function mapRowSimple(rawRow) {
  const { rawCategory, rawItemName, option, quantity, unitPrice } = rawRow;

  if (!rawItemName || rawItemName.trim() === "-") {
    return { ...rawRow, rowSales: 0, mappedCat: null, mappedItemName: null, status: "SKIPPED" };
  }

  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const rowSales = qty * price;

  const mappedCat = inferCategory(rawCategory, rawItemName, option);

  if (mappedCat) {
    return { ...rawRow, rowSales, mappedCat, mappedItemName: rawItemName.trim(), status: "MAPPED" };
  }

  return { ...rawRow, rowSales, mappedCat: null, mappedItemName: null, status: "UNMAPPED" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────────────────────────

function aggregateByCategory(rows) {
  const totals = {};
  const quantities = {};
  for (const cat of CATEGORIES) {
    totals[cat] = 0;
    quantities[cat] = 0;
  }

  for (const row of rows) {
    if (row.status === "SKIPPED") continue;
    if (row.mappedCat && CATEGORIES.includes(row.mappedCat)) {
      totals[row.mappedCat] += row.rowSales || 0;
      quantities[row.mappedCat] += row.quantity || 0;
    }
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const grandQuantity = Object.values(quantities).reduce((a, b) => a + b, 0);

  const percents = {};
  for (const cat of CATEGORIES) {
    percents[cat] = grandTotal > 0 ? Math.round((totals[cat] / grandTotal) * 100) : 0;
  }

  return { totals, quantities, grandTotal, grandQuantity, percents };
}

function getUnmappedSummary(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.status !== "UNMAPPED") continue;
    const key = row.rawItemName || "Unknown";
    const existing = map.get(key) || { count: 0, totalSales: 0 };
    existing.count++;
    existing.totalSales += row.rowSales || 0;
    map.set(key, existing);
  }
  return Array.from(map.entries())
    .map(([rawItemName, v]) => ({ rawItemName, ...v }))
    .sort((a, b) => b.totalSales - a.totalSales);
}

function buildDailyBreakdown(rows) {
  const byDay = new Map();
  for (const row of rows) {
    if (!row.transactionDate) continue;
    const d = row.transactionDate;
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (!byDay.has(day)) {
      byDay.set(day, {
        totals: Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
        quantities: Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
        grandTotal: 0,
        grandQuantity: 0,
      });
    }

    const cell = byDay.get(day);
    if (row.status !== "SKIPPED" && row.mappedCat && CATEGORIES.includes(row.mappedCat)) {
      cell.totals[row.mappedCat] += row.rowSales || 0;
      cell.quantities[row.mappedCat] += row.quantity || 0;
      cell.grandTotal += row.rowSales || 0;
      cell.grandQuantity += row.quantity || 0;
    }
  }

  const out = {};
  for (const day of [...byDay.keys()].sort()) {
    out[day] = byDay.get(day);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Processing
// ─────────────────────────────────────────────────────────────────────────────

function parseCsvContent(csvContent) {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
  });

  const headers = result.meta.fields || [];
  const data = result.data.filter((row) =>
    Object.values(row).some((v) => String(v ?? "").trim() !== "")
  );

  return { headers, data };
}

function processTransactionsCsv(csvContent, targetDate) {
  const { headers, data } = parseCsvContent(csvContent);

  if (data.length === 0) {
    return { rows: [], report: null, error: "Empty CSV file" };
  }

  const mapping = autoDetectColumns(headers);
  const dateKey = findTransactionDateKey(headers);

  if (!mapping.rawCategory || !mapping.rawItemName || !mapping.quantity || !mapping.unitPrice) {
    return { rows: [], report: null, error: "Missing required columns" };
  }

  const parseOptMoney = (raw) => {
    if (raw == null || raw === "") return undefined;
    const n = parseFloat(String(raw).replace(/[,₱\s]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };

  const rawRows = [];
  let skippedDates = 0;

  for (const r of data) {
    const d = dateKey ? parseTransactionDate(r[dateKey]) : null;
    if (!d) {
      skippedDates++;
      continue;
    }

    // Filter to target date if specified
    if (targetDate) {
      const rowDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (rowDateStr !== targetDate) continue;
    }

    rawRows.push({
      rawCategory: r[mapping.rawCategory] || "",
      rawItemName: r[mapping.rawItemName] || "",
      option: mapping.option ? r[mapping.option] || "" : "",
      quantity: parseFloat(r[mapping.quantity]) || 0,
      unitPrice: parseFloat(r[mapping.unitPrice]) || 0,
      paymentType: mapping.paymentType ? r[mapping.paymentType] || "" : undefined,
      transactionDate: d,
      transactionId: mapping.transactionId ? r[mapping.transactionId] || undefined : undefined,
      receiptNo: mapping.receiptNo ? r[mapping.receiptNo] || undefined : undefined,
      grossPrice: mapping.grossPrice ? parseOptMoney(r[mapping.grossPrice]) : undefined,
      discountedPrice: mapping.discountedPrice ? parseOptMoney(r[mapping.discountedPrice]) : undefined,
      regularDiscount: mapping.regularDiscount ? parseOptMoney(r[mapping.regularDiscount]) : undefined,
      seniorDiscount: mapping.seniorDiscount ? parseOptMoney(r[mapping.seniorDiscount]) : undefined,
      pwdDiscount: mapping.pwdDiscount ? parseOptMoney(r[mapping.pwdDiscount]) : undefined,
      vatExemption: mapping.vatExemption ? parseOptMoney(r[mapping.vatExemption]) : undefined,
    });
  }

  if (rawRows.length === 0) {
    return { rows: [], report: null, error: targetDate ? `No transactions for ${targetDate}` : "No valid rows" };
  }

  const processed = rawRows.map(mapRowSimple);
  const { totals, quantities, grandTotal, grandQuantity, percents } = aggregateByCategory(processed);
  const unmappedSummary = getUnmappedSummary(processed);
  const dailyBreakdown = buildDailyBreakdown(processed);

  const days = Object.keys(dailyBreakdown).sort();
  const dateRangeStart = days[0] || targetDate;
  const dateRangeEnd = days[days.length - 1] || targetDate;

  return {
    rows: processed,
    report: {
      dateRangeStart,
      dateRangeEnd,
      totalRows: processed.length,
      mappedRows: processed.filter((r) => r.status === "MAPPED").length,
      unmappedRows: processed.filter((r) => r.status === "UNMAPPED").length,
      skippedRows: processed.filter((r) => r.status === "SKIPPED").length,
      skippedDates,
      summaryTotalsByCat: totals,
      summaryQuantitiesByCat: quantities,
      grandTotal,
      grandQuantity,
      percentByCat: percents,
      rowDetails: processed,
      unmappedSummary,
      dailyBreakdown,
    },
    error: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client
// ─────────────────────────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getBranchUuidBySlug(supabase, slug) {
  const { data, error } = await supabase
    .from("branches")
    .select("id")
    .eq("name", slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to lookup branch ${slug}: ${error.message}`);
  return data?.id || null;
}

async function saveDailyReport(supabase, { branchId, reportDate, dateRangeStart, dateRangeEnd, filename, summaryJson, userId }) {
  const { data, error } = await supabase
    .from("reports_daily")
    .upsert(
      {
        branch_id: branchId,
        report_date: reportDate,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        transactions_file_name: filename,
        summary_json: summaryJson,
        user_id: userId,
      },
      { onConflict: "branch_id,report_date" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save report: ${error.message}`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Playwright Automation
// ─────────────────────────────────────────────────────────────────────────────

async function loginToUtak(page, email, password) {
  console.log("  Navigating to UTAK login...");
  await page.goto(UTAK_LOGIN_URL, { timeout: PAGE_LOAD_TIMEOUT, waitUntil: "networkidle" });

  // Wait for login form
  await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]', { timeout: 10000 });

  console.log("  Entering credentials...");
  const emailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]');
  const passwordInput = await page.$('input[type="password"]');

  if (!emailInput || !passwordInput) {
    throw new Error("Could not find login form inputs");
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Click login button
  const loginButton = await page.$('button[type="submit"]') ||
    await page.$('button:has-text("Login")') ||
    await page.$('button:has-text("Sign in")');

  if (!loginButton) {
    throw new Error("Could not find login button");
  }

  await loginButton.click();

  // Wait for navigation to master page
  console.log("  Waiting for master account page...");
  await page.waitForURL("**/master**", { timeout: PAGE_LOAD_TIMEOUT });
  console.log("  Login successful!");
}

async function getBranchCards(page) {
  console.log("  Loading branch cards...");

  // Wait for branch cards to load (they can take a while)
  await page.waitForSelector('[class*="card"], [class*="branch"], [data-branch]', { timeout: BRANCH_CARD_TIMEOUT }).catch(() => null);

  // Give extra time for all cards to load
  await page.waitForTimeout(3000);

  // Find all clickable branch cards
  const cards = await page.$$eval('a[href*="@"], [class*="card"] a, [class*="branch-card"]', (elements) => {
    return elements.map((el) => {
      const text = el.textContent || "";
      const href = el.getAttribute("href") || "";
      return { text: text.trim(), href };
    }).filter((c) => c.text && c.href);
  });

  console.log(`  Found ${cards.length} branch cards`);
  return cards;
}

async function navigateToBranch(page, cardName) {
  // Find and click the branch card
  const cardSelector = `a:has-text("${cardName}"), [class*="card"]:has-text("${cardName}") a`;
  const card = await page.$(cardSelector);

  if (!card) {
    // Try finding by partial match
    const allCards = await page.$$('a[href*="@"]');
    for (const c of allCards) {
      const text = await c.textContent();
      if (text && text.includes(cardName.split(" - ")[0])) {
        await c.click();
        await page.waitForURL("**/dashboard**", { timeout: NAV_TIMEOUT });
        return true;
      }
    }
    return false;
  }

  await card.click();
  await page.waitForURL("**/dashboard**", { timeout: NAV_TIMEOUT });
  return true;
}

async function downloadTransactionsForDate(page, context, fromDate, toDate) {
  console.log(`    Navigating to transactions page...`);
  await page.goto(UTAK_TRANSACTIONS_URL, { timeout: PAGE_LOAD_TIMEOUT, waitUntil: "networkidle" });

  // Click DETAILS tab
  const detailsTab = await page.$('button:has-text("DETAILS"), [role="tab"]:has-text("DETAILS"), a:has-text("DETAILS")');
  if (detailsTab) {
    await detailsTab.click();
    await page.waitForTimeout(1000);
  }

  // Set date range
  console.log(`    Setting date range: ${fromDate} to ${toDate}`);

  // Find date inputs (native HTML date inputs)
  const fromInput = await page.$('input[type="date"]:first-of-type') || await page.$('input[placeholder*="From" i]');
  const toInput = await page.$('input[type="date"]:last-of-type') || await page.$('input[placeholder*="To" i]');

  if (fromInput && toInput) {
    await fromInput.fill(fromDate);
    await toInput.fill(toDate);
  } else {
    // Try alternative date picker approach
    const dateInputs = await page.$$('input[type="date"], input[type="text"][placeholder*="date" i]');
    if (dateInputs.length >= 2) {
      await dateInputs[0].fill(fromDate);
      await dateInputs[1].fill(toDate);
    }
  }

  // Click Go button
  const goButton = await page.$('button:has-text("Go"), button:has-text("GO"), button:has-text("Apply")');
  if (goButton) {
    await goButton.click();
    await page.waitForTimeout(2000);
  }

  // Wait for data to load
  await page.waitForTimeout(3000);

  // Click Download button
  console.log(`    Clicking Download button...`);
  const downloadButton = await page.$('button:has-text("Download"), a:has-text("Download"), [class*="download"]');

  if (!downloadButton) {
    throw new Error("Could not find Download button");
  }

  // Set up download listener
  const downloadPromise = page.waitForEvent("download", { timeout: DOWNLOAD_TIMEOUT });
  await downloadButton.click();

  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const downloadPath = join(DOWNLOAD_DIR, filename);

  await download.saveAs(downloadPath);
  console.log(`    Downloaded: ${filename}`);

  return { filename, path: downloadPath };
}

async function returnToMaster(page) {
  // Click "Back to Master" link
  const backLink = await page.$('a:has-text("Back to Master"), a:has-text("Master"), [class*="back"]');
  if (backLink) {
    await backLink.click();
    await page.waitForURL("**/master**", { timeout: NAV_TIMEOUT });
  } else {
    // Navigate directly
    await page.goto(UTAK_MASTER_URL, { timeout: PAGE_LOAD_TIMEOUT });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Sync Logic
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    date: null,
    from: null,
    to: null,
    branches: null, // null = all branches
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--date" && args[i + 1]) {
      options.date = args[++i];
    } else if (arg === "--from" && args[i + 1]) {
      options.from = args[++i];
    } else if (arg === "--to" && args[i + 1]) {
      options.to = args[++i];
    } else if (arg === "--branch" && args[i + 1]) {
      options.branches = options.branches || [];
      options.branches.push(args[++i]);
    }
  }

  // Default to yesterday in Asia/Manila timezone
  if (!options.date && !options.from) {
    const now = new Date();
    // Get yesterday in Manila time (UTC+8)
    const manilaOffset = 8 * 60;
    const manilaYesterday = new Date(now.getTime() + manilaOffset * 60000 - 24 * 60 * 60 * 1000);
    options.date = `${manilaYesterday.getUTCFullYear()}-${String(manilaYesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(manilaYesterday.getUTCDate()).padStart(2, "0")}`;
  }

  if (options.from && !options.to) {
    options.to = options.from;
  }
  if (options.date) {
    options.from = options.date;
    options.to = options.date;
  }

  return options;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  UTAK POS Daily Transaction Sync");
  console.log("═══════════════════════════════════════════════════════════════════");

  const options = parseArgs();
  console.log(`\nSync date range: ${options.from} to ${options.to}`);
  console.log(`Dry run: ${options.dryRun}`);

  // Validate environment
  const utakEmail = process.env.UTAK_EMAIL;
  const utakPassword = process.env.UTAK_PASSWORD;
  const syncUserId = process.env.UTAK_SYNC_USER_ID;

  if (!utakEmail || !utakPassword) {
    console.error("\n❌ ERROR: Missing UTAK_EMAIL or UTAK_PASSWORD environment variables");
    process.exit(1);
  }

  // Create download directory
  if (!existsSync(DOWNLOAD_DIR)) {
    mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }

  // Initialize Supabase (skip in dry-run if credentials missing)
  let supabase = null;
  if (!options.dryRun) {
    try {
      supabase = getSupabaseClient();
    } catch (e) {
      console.error(`\n❌ ERROR: ${e.message}`);
      process.exit(1);
    }
  }

  // Results tracking
  const results = {
    success: [],
    failed: [],
    skipped: [],
    emptyDays: [],
  };

  // Launch browser
  console.log("\nLaunching browser...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    acceptDownloads: true,
  });

  const page = await context.newPage();

  try {
    // Login
    console.log("\n📱 Logging into UTAK...");
    await loginToUtak(page, utakEmail, utakPassword);

    // Determine which branches to process
    const branchesToSync = options.branches
      ? UTAK_BRANCH_MAPPINGS.filter((m) => options.branches.includes(m.ledgerSlug) || options.branches.includes(m.utakCardName))
      : UTAK_BRANCH_MAPPINGS.filter((m) => m.ledgerSlug);

    console.log(`\n📦 Processing ${branchesToSync.length} branches...\n`);

    for (const branchMapping of branchesToSync) {
      const { utakCardName, ledgerSlug } = branchMapping;
      console.log(`\n🏪 ${utakCardName} → ${ledgerSlug}`);

      try {
        // Navigate to branch
        console.log("  Navigating to branch...");
        const navigated = await navigateToBranch(page, utakCardName);
        if (!navigated) {
          console.log(`  ⚠️ Could not find branch card, skipping`);
          results.skipped.push({ branch: ledgerSlug, reason: "Branch card not found" });
          continue;
        }

        // Download transactions
        const download = await downloadTransactionsForDate(page, context, options.from, options.to);

        // Read and process CSV
        const csvContent = readFileSync(download.path, "utf-8");
        const { rows, report, error } = processTransactionsCsv(csvContent, options.date);

        if (error) {
          if (error.includes("No transactions")) {
            console.log(`  ℹ️ ${error}`);
            results.emptyDays.push({ branch: ledgerSlug, date: options.date });
          } else {
            console.log(`  ⚠️ ${error}`);
            results.failed.push({ branch: ledgerSlug, error });
          }
          await returnToMaster(page);
          continue;
        }

        console.log(`  📊 Processed: ${report.mappedRows} mapped, ${report.unmappedRows} unmapped, ₱${report.grandTotal.toLocaleString()}`);

        // Save to database
        if (!options.dryRun && supabase) {
          const branchUuid = await getBranchUuidBySlug(supabase, ledgerSlug);
          if (!branchUuid) {
            console.log(`  ⚠️ Branch "${ledgerSlug}" not found in database, skipping save`);
            results.skipped.push({ branch: ledgerSlug, reason: "Branch not in database" });
          } else {
            await saveDailyReport(supabase, {
              branchId: branchUuid,
              reportDate: report.dateRangeStart,
              dateRangeStart: report.dateRangeStart,
              dateRangeEnd: report.dateRangeEnd,
              filename: download.filename,
              summaryJson: {
                summaryTotalsByCat: report.summaryTotalsByCat,
                summaryQuantitiesByCat: report.summaryQuantitiesByCat,
                grandTotal: report.grandTotal,
                grandQuantity: report.grandQuantity,
                percentByCat: report.percentByCat,
                totalRows: report.totalRows,
                mappedRows: report.mappedRows,
                unmappedRows: report.unmappedRows,
                skippedRows: report.skippedRows,
                rowDetails: report.rowDetails,
                unmappedSummary: report.unmappedSummary,
                dailyBreakdown: report.dailyBreakdown,
                filename: download.filename,
                uploadedAt: Date.now(),
              },
              userId: syncUserId || null,
            });
            console.log(`  ✅ Saved to database`);
          }
        } else if (options.dryRun) {
          console.log(`  ✅ Would save to database (dry-run)`);
        }

        results.success.push({ branch: ledgerSlug, total: report.grandTotal, rows: report.totalRows });

        // Return to master page for next branch
        await returnToMaster(page);

      } catch (branchError) {
        console.log(`  ❌ Error: ${branchError.message}`);
        results.failed.push({ branch: ledgerSlug, error: branchError.message });

        // Try to recover by going back to master
        try {
          await page.goto(UTAK_MASTER_URL, { timeout: PAGE_LOAD_TIMEOUT });
        } catch {
          // If we can't recover, re-login
          await loginToUtak(page, utakEmail, utakPassword);
        }
      }
    }

  } finally {
    await browser.close();

    // Cleanup downloads
    if (existsSync(DOWNLOAD_DIR)) {
      rmSync(DOWNLOAD_DIR, { recursive: true, force: true });
    }
  }

  // Print summary
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(`  ✅ Success: ${results.success.length} branches`);
  console.log(`  ⚠️ Skipped: ${results.skipped.length} branches`);
  console.log(`  ℹ️ Empty: ${results.emptyDays.length} branches`);
  console.log(`  ❌ Failed: ${results.failed.length} branches`);

  if (results.success.length > 0) {
    const totalSales = results.success.reduce((sum, r) => sum + r.total, 0);
    console.log(`\n  Total sales: ₱${totalSales.toLocaleString()}`);
  }

  if (results.failed.length > 0) {
    console.log("\n  Failed branches:");
    for (const f of results.failed) {
      console.log(`    - ${f.branch}: ${f.error}`);
    }
    process.exit(1);
  }

  console.log("\n✅ Sync completed successfully!");
}

main().catch((e) => {
  console.error("\n❌ Fatal error:", e.message);
  process.exit(1);
});

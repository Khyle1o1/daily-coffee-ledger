#!/usr/bin/env npx tsx
/* eslint-disable no-console */

/**
 * UTAK POS Daily Transaction Sync
 *
 * Automates downloading transaction CSVs from UTAK POS for all branches
 * and imports them into the DOT Coffee ledger (Supabase).
 *
 * This script uses the SAME processing pipeline as the Add-data dialog
 * in SummaryPage.tsx, ensuring synced data produces identical reports_daily
 * rows as manual uploads.
 *
 * Usage:
 *   npx tsx scripts/utak-sync.ts                    # Sync yesterday (default)
 *   npx tsx scripts/utak-sync.ts --date 2026-10-19  # Sync specific date
 *   npx tsx scripts/utak-sync.ts --from 2026-10-01 --to 2026-10-19  # Date range
 *   npx tsx scripts/utak-sync.ts --dry-run          # Preview without saving
 *   npx tsx scripts/utak-sync.ts --list-branches    # Show branch mapping
 *
 * Environment variables (required):
 *   UTAK_EMAIL              - UTAK master account email
 *   UTAK_PASSWORD           - UTAK master account password
 *   SUPABASE_URL            - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   UTAK_SYNC_USER_ID       - UUID of the sync user in user_profiles (optional)
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Import shared processing pipeline
import { processTransactionsCsv } from '../src/lib/reports/processTransactionsCsv';
import {
  saveDailyReportServer,
  getBranchUuidBySlug,
  listBranchesServer,
} from '../src/lib/reports/saveDailyReportServer';
import {
  loadMappingTableFromFile,
  loadManualMappingsFromDb,
  getDefaultMappingTable,
} from '../src/lib/reports/loadMappingTable';
import type { MappingEntry } from '../src/utils/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const UTAK_LOGIN_URL = 'https://utak.io/login';
const UTAK_MASTER_URL = 'https://utak.io/master';
const UTAK_TRANSACTIONS_URL = 'https://utak.io/transactions';

const DOWNLOAD_DIR = join(ROOT, '.utak-downloads');

// Timeout settings (milliseconds)
const PAGE_LOAD_TIMEOUT = 60000;
const BRANCH_CARD_TIMEOUT = 45000;
const DOWNLOAD_TIMEOUT = 60000;
const NAV_TIMEOUT = 30000;

// ─────────────────────────────────────────────────────────────────────────────
// UTAK Branch Mapping
//
// Maps UTAK account identifiers to ledger branch slugs.
// Verified slugs from migrations: greenbelt, greenhills, podium, mind_museum,
// trinoma, uptown, wgc, wcc, events
// ─────────────────────────────────────────────────────────────────────────────

interface BranchMapping {
  utakEmail: string;
  utakCardName: string;
  ledgerSlug: string;
  needsVerification?: boolean;
}

const UTAK_BRANCH_MAPPINGS: BranchMapping[] = [
  // Verified branches (confirmed in migrations/seed)
  { utakEmail: 'dotcoffee_greenbelt@utak.io', utakCardName: 'DOT COFFEE - GREENBELT 3', ledgerSlug: 'greenbelt' },
  { utakEmail: 'dotcoffee_podium@utak.io', utakCardName: 'DOT COFFEE - THE PODIUM MALL', ledgerSlug: 'podium' },
  { utakEmail: 'dotcoffee_themindmuseum@utak.io', utakCardName: 'DOT COFFEE - THE MIND MUSEUM', ledgerSlug: 'mind_museum' },
  { utakEmail: 'dotcoffee_landmarktrinoma@utak.io', utakCardName: 'DOT COFFEE - LANDMARK TRINOMA', ledgerSlug: 'trinoma' },
  { utakEmail: 'dotcoffee_uptownbgc@utak.io', utakCardName: 'DOT COFFEE - UPTOWN MALL', ledgerSlug: 'uptown' },
  { utakEmail: 'dotcoffee_wgc@utak.io', utakCardName: 'DOT COFFEE - WGC', ledgerSlug: 'wgc' },
  { utakEmail: 'wcc@utak.io', utakCardName: 'DOT COFFEE - W CITY CENTER', ledgerSlug: 'wcc' },
  { utakEmail: 'dotcoffee_events@utaklite.io', utakCardName: 'Dot HQ Events', ledgerSlug: 'events' },

  // Branches needing verification (slug may need to be added to branches table)
  { utakEmail: 'dotcoffee_greenhills@utak.io', utakCardName: 'DOT COFFEE - GREENHILLS', ledgerSlug: 'greenhills' },
  { utakEmail: 'dotcoffee_ayalapavillionlaguna@utak.io', utakCardName: 'DOT AYALA PAVILION', ledgerSlug: 'ayala_pavilion', needsVerification: true },
  { utakEmail: 'dotcoffee_arcasouth@utak.io', utakCardName: 'DOT COFFEE - ARCA SOUTH', ledgerSlug: 'arca_south', needsVerification: true },
  { utakEmail: 'dotcoffee_falconqc@utak.io', utakCardName: 'DOT COFFEE - FALCON HUB', ledgerSlug: 'falcon_hub', needsVerification: true },
  { utakEmail: 'dotcoffee_ayalamrt@utak.io', utakCardName: 'DOT COFFEE - ONE AYALA MRT', ledgerSlug: 'one_ayala_mrt', needsVerification: true },
  { utakEmail: 'dotcoffee_smnorthedsa@utak.io', utakCardName: 'DOT COFFEE - SM NORTH EDSA', ledgerSlug: 'sm_north_edsa', needsVerification: true },
  { utakEmail: 'dotcoffee_smstarosa@utak.io', utakCardName: 'DOT COFFEE - SM STA ROSA', ledgerSlug: 'sm_sta_rosa', needsVerification: true },
  { utakEmail: 'dotcoffee_southwoods@utak.io', utakCardName: 'DOT COFFEE - SOUTHWOODS MALL', ledgerSlug: 'southwoods', needsVerification: true },
  { utakEmail: 'dotcoffee_threecentral@utak.io', utakCardName: 'DOT COFFEE - THREE CENTRAL', ledgerSlug: 'three_central', needsVerification: true },
  { utakEmail: 'dotcoffee_eastwood@utak.io', utakCardName: 'DOT EASTWOOD 1800', ledgerSlug: 'eastwood', needsVerification: true },
  { utakEmail: 'dotcoffee_luckychinatownmall@utak.io', utakCardName: 'DOT LUCKY CHINATOWN', ledgerSlug: 'lucky_chinatown', needsVerification: true },
  { utakEmail: 'dotcoffee_smbacoor@utak.io', utakCardName: 'DOT SM BACOOR', ledgerSlug: 'sm_bacoor', needsVerification: true },
  { utakEmail: 'dotcoffee_nationaluniversitymoa@utak.io', utakCardName: 'Dot NU MOA', ledgerSlug: 'nu_moa', needsVerification: true },
  { utakEmail: 'dot_beatiraga@utak.io', utakCardName: 'ROB GALLERIA', ledgerSlug: 'robinsons_galleria', needsVerification: true },
  { utakEmail: 'dotcoffee_smmoa@utak.io', utakCardName: 'SM MALL OF ASIA (MOA)', ledgerSlug: 'sm_moa', needsVerification: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SyncOptions {
  dryRun: boolean;
  date: string | null;
  from: string | null;
  to: string | null;
  branches: string[] | null;
  verbose: boolean;
  listBranches: boolean;
}

interface SyncResults {
  success: Array<{ branch: string; total: number; rows: number }>;
  failed: Array<{ branch: string; error: string }>;
  skipped: Array<{ branch: string; reason: string }>;
  emptyDays: Array<{ branch: string; date: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client
// ─────────────────────────────────────────────────────────────────────────────

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping Table Loading
// ─────────────────────────────────────────────────────────────────────────────

async function loadMappingTable(supabase: SupabaseClient | null): Promise<MappingEntry[]> {
  const validationPath = join(ROOT, 'public', 'Validation.xlsx');

  // Try to load XLSX from public folder
  let xlsxEntries: MappingEntry[] = [];
  if (existsSync(validationPath)) {
    try {
      xlsxEntries = await loadMappingTableFromFile(validationPath);
      console.log(`  Loaded ${xlsxEntries.length} mapping entries from Validation.xlsx`);
    } catch (e) {
      console.warn(`  Warning: Could not load Validation.xlsx: ${e instanceof Error ? e.message : e}`);
      xlsxEntries = getDefaultMappingTable();
    }
  } else {
    console.warn('  Warning: Validation.xlsx not found, using default mappings');
    xlsxEntries = getDefaultMappingTable();
  }

  // Load manual mappings from database if Supabase is available
  let manualEntries: MappingEntry[] = [];
  if (supabase) {
    try {
      manualEntries = await loadManualMappingsFromDb(supabase);
      if (manualEntries.length > 0) {
        console.log(`  Loaded ${manualEntries.length} manual mapping entries from database`);
      }
    } catch (e) {
      console.warn(`  Warning: Could not load manual mappings: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Manual mappings take priority
  return [...manualEntries, ...xlsxEntries];
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch Validation
// ─────────────────────────────────────────────────────────────────────────────

async function validateBranchMappings(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const dbBranches = await listBranchesServer(supabase);
  const slugToUuid = new Map<string, string>();

  for (const branch of dbBranches) {
    slugToUuid.set(branch.name, branch.id);
  }

  return slugToUuid;
}

function printBranchMapping(
  slugToUuid: Map<string, string>,
  dbBranches: Array<{ id: string; name: string; label: string }>
): void {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Branch Mapping: UTAK → Ledger');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('Ledger branches in database:');
  for (const branch of dbBranches) {
    console.log(`  • ${branch.name} (${branch.label})`);
  }

  console.log('\nUTAK branch mappings:');
  for (const mapping of UTAK_BRANCH_MAPPINGS) {
    const status = slugToUuid.has(mapping.ledgerSlug)
      ? '✓'
      : '✗ NOT IN DB';
    const verify = mapping.needsVerification ? ' [needs verification]' : '';
    console.log(`  ${status} ${mapping.utakCardName}`);
    console.log(`      → ${mapping.ledgerSlug}${verify}`);
  }

  const unmappedDb = dbBranches.filter(
    (b) => !UTAK_BRANCH_MAPPINGS.some((m) => m.ledgerSlug === b.name)
  );
  if (unmappedDb.length > 0) {
    console.log('\nLedger branches without UTAK mapping:');
    for (const branch of unmappedDb) {
      console.log(`  • ${branch.name} (${branch.label})`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Playwright Automation
// ─────────────────────────────────────────────────────────────────────────────

async function loginToUtak(page: Page, email: string, password: string): Promise<void> {
  console.log('  Navigating to UTAK login...');
  await page.goto(UTAK_LOGIN_URL, { timeout: PAGE_LOAD_TIMEOUT, waitUntil: 'networkidle' });

  await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]', { timeout: 10000 });

  console.log('  Entering credentials...');
  const emailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]');
  const passwordInput = await page.$('input[type="password"]');

  if (!emailInput || !passwordInput) {
    throw new Error('Could not find login form inputs');
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);

  const loginButton = await page.$('button[type="submit"]') ||
    await page.$('button:has-text("Login")') ||
    await page.$('button:has-text("Sign in")');

  if (!loginButton) {
    throw new Error('Could not find login button');
  }

  await loginButton.click();

  console.log('  Waiting for master account page...');
  await page.waitForURL('**/master**', { timeout: PAGE_LOAD_TIMEOUT });
  console.log('  Login successful!');
}

async function navigateToBranch(page: Page, cardName: string): Promise<boolean> {
  const cardSelector = `a:has-text("${cardName}"), [class*="card"]:has-text("${cardName}") a`;
  const card = await page.$(cardSelector);

  if (!card) {
    const allCards = await page.$$('a[href*="@"]');
    for (const c of allCards) {
      const text = await c.textContent();
      if (text && text.includes(cardName.split(' - ')[0])) {
        await c.click();
        await page.waitForURL('**/dashboard**', { timeout: NAV_TIMEOUT });
        return true;
      }
    }
    return false;
  }

  await card.click();
  await page.waitForURL('**/dashboard**', { timeout: NAV_TIMEOUT });
  return true;
}

async function downloadTransactionsForDate(
  page: Page,
  fromDate: string,
  toDate: string
): Promise<{ filename: string; path: string }> {
  console.log('    Navigating to transactions page...');
  await page.goto(UTAK_TRANSACTIONS_URL, { timeout: PAGE_LOAD_TIMEOUT, waitUntil: 'networkidle' });

  const detailsTab = await page.$('button:has-text("DETAILS"), [role="tab"]:has-text("DETAILS"), a:has-text("DETAILS")');
  if (detailsTab) {
    await detailsTab.click();
    await page.waitForTimeout(1000);
  }

  console.log(`    Setting date range: ${fromDate} to ${toDate}`);

  const fromInput = await page.$('input[type="date"]:first-of-type') || await page.$('input[placeholder*="From" i]');
  const toInput = await page.$('input[type="date"]:last-of-type') || await page.$('input[placeholder*="To" i]');

  if (fromInput && toInput) {
    await fromInput.fill(fromDate);
    await toInput.fill(toDate);
  } else {
    const dateInputs = await page.$$('input[type="date"], input[type="text"][placeholder*="date" i]');
    if (dateInputs.length >= 2) {
      await dateInputs[0].fill(fromDate);
      await dateInputs[1].fill(toDate);
    }
  }

  const goButton = await page.$('button:has-text("Go"), button:has-text("GO"), button:has-text("Apply")');
  if (goButton) {
    await goButton.click();
    await page.waitForTimeout(2000);
  }

  await page.waitForTimeout(3000);

  console.log('    Clicking Download button...');
  const downloadButton = await page.$('button:has-text("Download"), a:has-text("Download"), [class*="download"]');

  if (!downloadButton) {
    throw new Error('Could not find Download button');
  }

  const downloadPromise = page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT });
  await downloadButton.click();

  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const downloadPath = join(DOWNLOAD_DIR, filename);

  await download.saveAs(downloadPath);
  console.log(`    Downloaded: ${filename}`);

  return { filename, path: downloadPath };
}

async function returnToMaster(page: Page): Promise<void> {
  const backLink = await page.$('a:has-text("Back to Master"), a:has-text("Master"), [class*="back"]');
  if (backLink) {
    await backLink.click();
    await page.waitForURL('**/master**', { timeout: NAV_TIMEOUT });
  } else {
    await page.goto(UTAK_MASTER_URL, { timeout: PAGE_LOAD_TIMEOUT });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  const options: SyncOptions = {
    dryRun: false,
    date: null,
    from: null,
    to: null,
    branches: null,
    verbose: false,
    listBranches: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--list-branches') {
      options.listBranches = true;
    } else if (arg === '--date' && args[i + 1]) {
      options.date = args[++i];
    } else if (arg === '--from' && args[i + 1]) {
      options.from = args[++i];
    } else if (arg === '--to' && args[i + 1]) {
      options.to = args[++i];
    } else if (arg === '--branch' && args[i + 1]) {
      options.branches = options.branches || [];
      options.branches.push(args[++i]);
    }
  }

  // Default to yesterday in Asia/Manila timezone
  if (!options.date && !options.from && !options.listBranches) {
    const now = new Date();
    const manilaOffset = 8 * 60;
    const manilaYesterday = new Date(now.getTime() + manilaOffset * 60000 - 24 * 60 * 60 * 1000);
    options.date = `${manilaYesterday.getUTCFullYear()}-${String(manilaYesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(manilaYesterday.getUTCDate()).padStart(2, '0')}`;
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Sync Logic
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  UTAK POS Daily Transaction Sync');
  console.log('═══════════════════════════════════════════════════════════════════');

  const options = parseArgs();

  // Initialize Supabase (needed for validation and --list-branches)
  let supabase: SupabaseClient | null = null;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    if (!options.dryRun && !options.listBranches) {
      console.error(`\n❌ ERROR: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  }

  // Handle --list-branches flag
  if (options.listBranches) {
    if (!supabase) {
      console.error('\n❌ ERROR: Cannot list branches without Supabase credentials');
      process.exit(1);
    }
    const dbBranches = await listBranchesServer(supabase);
    const slugToUuid = await validateBranchMappings(supabase);
    printBranchMapping(slugToUuid, dbBranches);
    return;
  }

  console.log(`\nSync date range: ${options.from} to ${options.to}`);
  console.log(`Dry run: ${options.dryRun}`);

  // Validate environment
  const utakEmail = process.env.UTAK_EMAIL;
  const utakPassword = process.env.UTAK_PASSWORD;
  const syncUserId = process.env.UTAK_SYNC_USER_ID;

  if (!utakEmail || !utakPassword) {
    console.error('\n❌ ERROR: Missing UTAK_EMAIL or UTAK_PASSWORD environment variables');
    process.exit(1);
  }

  // Validate branch mappings against database
  let slugToUuid = new Map<string, string>();
  if (supabase) {
    console.log('\nValidating branch mappings...');
    slugToUuid = await validateBranchMappings(supabase);
    const invalidMappings = UTAK_BRANCH_MAPPINGS.filter(
      (m) => !slugToUuid.has(m.ledgerSlug)
    );
    if (invalidMappings.length > 0) {
      console.log(`  ⚠️ ${invalidMappings.length} branches not found in database (will be skipped):`);
      for (const m of invalidMappings) {
        console.log(`    - ${m.ledgerSlug} (${m.utakCardName})`);
      }
    }
  }

  // Load mapping table
  console.log('\nLoading mapping table...');
  const mappingTable = await loadMappingTable(supabase);

  // Create download directory
  if (!existsSync(DOWNLOAD_DIR)) {
    mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }

  // Results tracking
  const results: SyncResults = {
    success: [],
    failed: [],
    skipped: [],
    emptyDays: [],
  };

  // Launch browser
  console.log('\nLaunching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    acceptDownloads: true,
  });

  const page = await context.newPage();

  try {
    // Login
    console.log('\n📱 Logging into UTAK...');
    await loginToUtak(page, utakEmail, utakPassword);

    // Determine which branches to process
    const branchesToSync = options.branches
      ? UTAK_BRANCH_MAPPINGS.filter(
          (m) => options.branches!.includes(m.ledgerSlug) || options.branches!.includes(m.utakCardName)
        )
      : UTAK_BRANCH_MAPPINGS;

    console.log(`\n📦 Processing ${branchesToSync.length} branches...\n`);

    for (const branchMapping of branchesToSync) {
      const { utakCardName, ledgerSlug } = branchMapping;
      console.log(`\n🏪 ${utakCardName} → ${ledgerSlug}`);

      // Validate branch exists in database
      if (supabase && !slugToUuid.has(ledgerSlug)) {
        console.log(`  ⚠️ Branch "${ledgerSlug}" not found in database, skipping`);
        results.skipped.push({ branch: ledgerSlug, reason: 'Branch not in database' });
        continue;
      }

      try {
        // Navigate to branch
        console.log('  Navigating to branch...');
        const navigated = await navigateToBranch(page, utakCardName);
        if (!navigated) {
          console.log('  ⚠️ Could not find branch card, skipping');
          results.skipped.push({ branch: ledgerSlug, reason: 'Branch card not found in UTAK' });
          continue;
        }

        // Download transactions
        const download = await downloadTransactionsForDate(page, options.from!, options.to!);

        // Read and process CSV using shared pipeline
        const csvContent = readFileSync(download.path, 'utf-8');
        const { report, error, skippedDates } = await processTransactionsCsv({
          csvContent,
          branch: ledgerSlug,
          filename: download.filename,
          mappingTable,
          targetDate: options.date,
        });

        if (error) {
          if (error.includes('No transactions')) {
            console.log(`  ℹ️ ${error}`);
            results.emptyDays.push({ branch: ledgerSlug, date: options.date || '' });
          } else {
            console.log(`  ⚠️ ${error}`);
            results.failed.push({ branch: ledgerSlug, error });
          }
          await returnToMaster(page);
          continue;
        }

        if (!report) {
          console.log('  ⚠️ No report generated');
          results.failed.push({ branch: ledgerSlug, error: 'No report generated' });
          await returnToMaster(page);
          continue;
        }

        if (skippedDates > 0) {
          console.log(`  ⚠️ Skipped ${skippedDates} rows with invalid dates`);
        }

        console.log(`  📊 Processed: ${report.mappedRows} mapped, ${report.unmappedRows} unmapped, ₱${report.grandTotal.toLocaleString()}`);

        // Save to database
        if (!options.dryRun && supabase) {
          const branchUuid = slugToUuid.get(ledgerSlug);
          if (!branchUuid) {
            console.log(`  ⚠️ Branch UUID not found for "${ledgerSlug}", skipping save`);
            results.skipped.push({ branch: ledgerSlug, reason: 'Branch UUID not found' });
          } else {
            const saved = await saveDailyReportServer({
              supabase,
              branchId: branchUuid,
              report,
              userId: syncUserId || null,
            });
            console.log(`  ✅ Saved to database (id: ${saved.id})`);
            if (saved.reconciled.trimmed > 0 || saved.reconciled.deleted > 0) {
              console.log(`    Reconciled overlaps: ${saved.reconciled.trimmed} trimmed, ${saved.reconciled.deleted} deleted`);
            }
          }
        } else if (options.dryRun) {
          console.log('  ✅ Would save to database (dry-run)');
        }

        results.success.push({ branch: ledgerSlug, total: report.grandTotal, rows: report.totalRows });

        // Return to master page for next branch
        await returnToMaster(page);
      } catch (branchError) {
        console.log(`  ❌ Error: ${branchError instanceof Error ? branchError.message : branchError}`);
        results.failed.push({ branch: ledgerSlug, error: branchError instanceof Error ? branchError.message : String(branchError) });

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
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  ✅ Success: ${results.success.length} branches`);
  console.log(`  ⚠️ Skipped: ${results.skipped.length} branches`);
  console.log(`  ℹ️ Empty: ${results.emptyDays.length} branches`);
  console.log(`  ❌ Failed: ${results.failed.length} branches`);

  if (results.success.length > 0) {
    const totalSales = results.success.reduce((sum, r) => sum + r.total, 0);
    console.log(`\n  Total sales: ₱${totalSales.toLocaleString()}`);
  }

  if (results.skipped.length > 0) {
    console.log('\n  Skipped branches:');
    for (const s of results.skipped) {
      console.log(`    - ${s.branch}: ${s.reason}`);
    }
  }

  if (results.failed.length > 0) {
    console.log('\n  Failed branches:');
    for (const f of results.failed) {
      console.log(`    - ${f.branch}: ${f.error}`);
    }
    process.exit(1);
  }

  console.log('\n✅ Sync completed successfully!');
}

main().catch((e) => {
  console.error('\n❌ Fatal error:', e instanceof Error ? e.message : e);
  process.exit(1);
});

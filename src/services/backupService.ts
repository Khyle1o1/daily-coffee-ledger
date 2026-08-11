import { supabase } from "@/lib/supabaseClient";
import { requireAdminUser } from "@/lib/api/authGuards";
import {
  listBranches,
  createBranch,
  updateBranch,
} from "@/lib/api/branches";
import {
  listManualMappings,
  createManualMapping,
  updateManualMapping,
  type ManualMapping,
  type SaveManualMappingPayload,
} from "@/lib/api/manualMappings";
import {
  listDirectoryLinks,
  createDirectoryLink,
  updateDirectoryLink,
} from "@/services/directoryLinksService";
import {
  saveDailyReport,
} from "@/services/reportsService";
import {
  upsertDailyLedgerEntries,
  type DailyLedgerSource,
  type UpsertDailyLedgerPayload,
} from "@/services/dailyLedgerService";
import { normalizeText } from "@/utils/normalize";
import { normalizeOption } from "@/utils/defaultMapping";
import { CATEGORIES, type Category } from "@/utils/types";
import type { DirectoryLink } from "@/lib/supabase-types";

export const BACKUP_VERSION = 1 as const;

const REPORT_CHUNK = 8;
const LEDGER_CHUNK = 500;
const LEDGER_UPSERT_BATCH = 100;
const MAPPING_PAGE = 200;
const DIRECTORY_PAGE = 200;

export interface BackupBranch {
  code: string;
  name: string;
  slug: string;
  address: string | null;
  isActive: boolean;
}

export interface BackupManualMapping {
  sourceCategory: string;
  sourceItem: string;
  sourceOption: string;
  mappedCategory: Category;
  mappedItemName: string;
  priority: number;
  isActive: boolean;
  notes: string | null;
}

export interface BackupDailyReport {
  branchCode: string;
  branchSlug: string;
  reportDate: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  transactionsFileName: string | null;
  mappingFileName: string | null;
  summaryJson: Record<string, unknown>;
}

export interface BackupLedgerEntry {
  branchCode: string;
  branchSlug: string;
  ledgerDate: string;
  source: DailyLedgerSource;
  sourceFileName: string | null;
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

export interface BackupDirectoryLink {
  name: string;
  url: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
}

export interface BackupPack {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  branches: BackupBranch[];
  manualMappings: BackupManualMapping[];
  reportsDaily: BackupDailyReport[];
  dailyLedgerEntries: BackupLedgerEntry[];
  directoryLinks: BackupDirectoryLink[];
}

export interface RestoreDomainCounts {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface RestoreSummary {
  branches: RestoreDomainCounts;
  mappings: RestoreDomainCounts;
  reports: RestoreDomainCounts;
  ledger: RestoreDomainCounts;
  directory: RestoreDomainCounts;
  errors: string[];
}

type BranchJoin = {
  code?: string | null;
  name?: string | null;
  label?: string | null;
};

function emptyCounts(): RestoreDomainCounts {
  return { created: 0, updated: 0, skipped: 0, failed: 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function asBoolean(value: unknown, fallback = true): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function mappingKey(
  sourceCategory: string,
  sourceItem: string,
  sourceOption: string,
): string {
  return [
    normalizeText(sourceCategory),
    normalizeText(sourceItem),
    normalizeOption(sourceOption),
  ].join("\0");
}

function directoryKey(name: string, url: string): string {
  return `${name.trim().toLowerCase()}\0${normalizeUrl(url).toLowerCase()}`;
}

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An error occurred";
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const rows = await fetchPage(from, from + pageSize - 1);
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function loadBackupBranches(): Promise<BackupBranch[]> {
  const { data, error } = await (supabase.from("branches") as any)
    .select("code, name, label, address, is_active")
    .order("label", { ascending: true });

  if (error) throw new Error(`Failed to export branches: ${error.message}`);

  return ((data as any[]) ?? []).map((row) => ({
    code: asString(row.code).trim(),
    name: asString(row.label || row.name),
    slug: asString(row.name),
    address: asNullableString(row.address),
    isActive: row.is_active !== false,
  }));
}

async function loadBackupMappings(): Promise<BackupManualMapping[]> {
  const all: ManualMapping[] = [];
  let page = 1;
  for (;;) {
    const { items, total } = await listManualMappings({
      page,
      pageSize: MAPPING_PAGE,
    });
    all.push(...items);
    if (all.length >= total || items.length === 0) break;
    page += 1;
  }

  return all.map((m) => ({
    sourceCategory: m.sourceCategory,
    sourceItem: m.sourceItem,
    sourceOption: m.sourceOption,
    mappedCategory: m.mappedCategory,
    mappedItemName: m.mappedItemName,
    priority: m.priority,
    isActive: m.isActive,
    notes: m.notes,
  }));
}

async function loadBackupReports(): Promise<BackupDailyReport[]> {
  const rows = await fetchAllPages(async (from, to) => {
    const { data, error } = await supabase
      .from("reports_daily")
      .select(
        "report_date, date_range_start, date_range_end, transactions_file_name, mapping_file_name, summary_json, branch:branches(code, name, label)",
      )
      .order("report_date", { ascending: true })
      .order("branch_id", { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Failed to export daily reports: ${error.message}`);
    return (data as any[]) ?? [];
  }, REPORT_CHUNK);

  return rows.map((row) => {
    const branch = (row.branch ?? {}) as BranchJoin;
    return {
      branchCode: asString(branch.code).trim(),
      branchSlug: asString(branch.name),
      reportDate: asString(row.report_date),
      dateRangeStart: asString(row.date_range_start || row.report_date),
      dateRangeEnd: asString(row.date_range_end || row.report_date),
      transactionsFileName: asNullableString(row.transactions_file_name),
      mappingFileName: asNullableString(row.mapping_file_name),
      summaryJson: isRecord(row.summary_json) ? row.summary_json : {},
    };
  });
}

async function loadBackupLedger(): Promise<BackupLedgerEntry[]> {
  const rows = await fetchAllPages(async (from, to) => {
    const { data, error } = await (supabase as any)
      .from("daily_ledger_entries")
      .select(
        "ledger_date, cash, maya, grab, paymongo, gcash, foodpanda, gift_card, " +
          "regular_discount, senior_discount, pwd_discount, vat_exemption, " +
          "gross_sales_net, transaction_count, gross_sales, source, source_file_name, " +
          "branch:branches(code, name, label)",
      )
      .order("ledger_date", { ascending: true })
      .order("branch_id", { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Failed to export cash ledger: ${error.message}`);
    return (data as any[]) ?? [];
  }, LEDGER_CHUNK);

  return rows.map((row) => {
    const branch = (row.branch ?? {}) as BranchJoin;
    return {
      branchCode: asString(branch.code).trim(),
      branchSlug: asString(branch.name),
      ledgerDate: asString(row.ledger_date),
      source: (row.source as DailyLedgerSource) || "sheet",
      sourceFileName: asNullableString(row.source_file_name),
      cash: asNumber(row.cash),
      maya: asNumber(row.maya),
      grab: asNumber(row.grab),
      paymongo: asNumber(row.paymongo),
      gcash: asNumber(row.gcash),
      foodpanda: asNumber(row.foodpanda),
      giftCard: asNumber(row.gift_card),
      regularDiscount: asNumber(row.regular_discount),
      seniorDiscount: asNumber(row.senior_discount),
      pwdDiscount: asNumber(row.pwd_discount),
      vatExemption: asNumber(row.vat_exemption),
      grossSalesNet: asNumber(row.gross_sales_net),
      transactionCount: Math.round(asNumber(row.transaction_count)),
      grossSales: asNumber(row.gross_sales),
    };
  });
}

async function loadBackupDirectory(): Promise<BackupDirectoryLink[]> {
  const all: DirectoryLink[] = [];
  let page = 1;
  for (;;) {
    const { items, total } = await listDirectoryLinks({
      page,
      pageSize: DIRECTORY_PAGE,
      sort: "name",
      order: "asc",
    });
    all.push(...items);
    if (all.length >= total || items.length === 0) break;
    page += 1;
  }

  return all.map((link) => ({
    name: link.name,
    url: link.url,
    description: link.description,
    category: link.category,
    isActive: link.is_active,
  }));
}

export async function buildBackupPack(): Promise<BackupPack> {
  await requireAdminUser();

  const [branches, manualMappings, reportsDaily, dailyLedgerEntries, directoryLinks] =
    await Promise.all([
      loadBackupBranches(),
      loadBackupMappings(),
      loadBackupReports(),
      loadBackupLedger(),
      loadBackupDirectory(),
    ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    branches,
    manualMappings,
    reportsDaily,
    dailyLedgerEntries,
    directoryLinks,
  };
}

export async function downloadBackupPack(): Promise<BackupPack> {
  const pack = await buildBackupPack();
  const blob = new Blob([JSON.stringify(pack)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `daily-coffee-ledger-backup-${pack.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return pack;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Backup is missing a valid "${label}" array.`);
  }
  return value;
}

export function validateBackupPack(raw: unknown): BackupPack {
  if (!isRecord(raw)) {
    throw new Error("Backup file is not a valid backup pack.");
  }
  if (raw.version !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version (${String(raw.version)}). This app expects version ${BACKUP_VERSION}.`,
    );
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: asString(raw.exportedAt, new Date().toISOString()),
    branches: requireArray(raw.branches, "branches") as BackupBranch[],
    manualMappings: requireArray(raw.manualMappings, "manualMappings") as BackupManualMapping[],
    reportsDaily: requireArray(raw.reportsDaily, "reportsDaily") as BackupDailyReport[],
    dailyLedgerEntries: requireArray(
      raw.dailyLedgerEntries,
      "dailyLedgerEntries",
    ) as BackupLedgerEntry[],
    directoryLinks: requireArray(raw.directoryLinks, "directoryLinks") as BackupDirectoryLink[],
  };
}

export async function parseBackupPack(file: File): Promise<BackupPack> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error("Could not read the selected file.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  return validateBackupPack(raw);
}

async function loadBranchLookup(): Promise<{
  byCode: Map<string, { id: string; code: string; slug: string }>;
  bySlug: Map<string, { id: string; code: string; slug: string }>;
}> {
  const { data, error } = await (supabase.from("branches") as any).select(
    "id, code, name",
  );
  if (error) throw new Error(`Failed to load branches: ${error.message}`);

  const byCode = new Map<string, { id: string; code: string; slug: string }>();
  const bySlug = new Map<string, { id: string; code: string; slug: string }>();

  for (const row of (data as any[]) ?? []) {
    const entry = {
      id: asString(row.id),
      code: asString(row.code).trim().toUpperCase(),
      slug: asString(row.name),
    };
    if (entry.code) byCode.set(entry.code, entry);
    if (entry.slug) bySlug.set(entry.slug, entry);
  }

  return { byCode, bySlug };
}

function resolveBranchId(
  branchCode: string | undefined,
  branchSlug: string | undefined,
  lookup: { byCode: Map<string, { id: string }>; bySlug: Map<string, { id: string }> },
): string | null {
  const code = (branchCode ?? "").trim().toUpperCase();
  if (code && lookup.byCode.has(code)) return lookup.byCode.get(code)!.id;
  const slug = (branchSlug ?? "").trim();
  if (slug && lookup.bySlug.has(slug)) return lookup.bySlug.get(slug)!.id;
  return null;
}

async function restoreBranches(
  items: BackupBranch[],
  errors: string[],
): Promise<RestoreDomainCounts> {
  const counts = emptyCounts();
  const existing = await listBranches({});
  const byCode = new Map(
    existing.items
      .filter((b) => b.code)
      .map((b) => [b.code.trim().toUpperCase(), b]),
  );

  for (const item of items) {
    const code = asString(item?.code).trim().toUpperCase();
    const name = asString(item?.name).trim();
    if (!code || !name) {
      counts.skipped += 1;
      errors.push("Skipped a branch with no code or name.");
      continue;
    }

    const payload = {
      code,
      name,
      address: item.address ?? undefined,
      isActive: asBoolean(item.isActive, true),
    };

    try {
      const current = byCode.get(code);
      if (current) {
        await updateBranch(current.id, payload);
        counts.updated += 1;
      } else {
        const created = await createBranch(payload);
        byCode.set(code, created);
        counts.created += 1;
      }
    } catch (error) {
      counts.failed += 1;
      errors.push(`Branch ${code}: ${errMessage(error)}`);
    }
  }

  return counts;
}

async function restoreMappings(
  items: BackupManualMapping[],
  errors: string[],
): Promise<RestoreDomainCounts> {
  const counts = emptyCounts();
  const existing: ManualMapping[] = [];
  let page = 1;
  for (;;) {
    const { items: rows, total } = await listManualMappings({
      page,
      pageSize: MAPPING_PAGE,
    });
    existing.push(...rows);
    if (existing.length >= total || rows.length === 0) break;
    page += 1;
  }

  const byKey = new Map<string, ManualMapping>();
  for (const m of existing) {
    const key = mappingKey(m.sourceCategory, m.sourceItem, m.sourceOption);
    const prev = byKey.get(key);
    if (!prev || (m.isActive && !prev.isActive)) byKey.set(key, m);
  }

  for (const item of items) {
    const sourceItem = asString(item?.sourceItem).trim();
    const mappedItemName = asString(item?.mappedItemName).trim();
    if (!sourceItem || !mappedItemName || !isCategory(item?.mappedCategory)) {
      counts.skipped += 1;
      errors.push(
        `Skipped mapping "${asString(item?.sourceItem) || "(blank)"}": missing required fields.`,
      );
      continue;
    }

    const payload: SaveManualMappingPayload = {
      sourceCategory: asString(item.sourceCategory),
      sourceItem,
      sourceOption: asString(item.sourceOption),
      mappedCategory: item.mappedCategory,
      mappedItemName,
      priority: asNumber(item.priority, 0),
      isActive: asBoolean(item.isActive, true),
      notes: item.notes ?? undefined,
    };

    const key = mappingKey(payload.sourceCategory, payload.sourceItem, payload.sourceOption);

    try {
      const current = byKey.get(key);
      if (current) {
        await updateManualMapping(current.id, payload);
        counts.updated += 1;
      } else {
        const created = await createManualMapping(payload);
        byKey.set(key, created);
        counts.created += 1;
      }
    } catch (error) {
      counts.failed += 1;
      errors.push(`Mapping "${sourceItem}": ${errMessage(error)}`);
    }
  }

  return counts;
}

async function restoreReports(
  items: BackupDailyReport[],
  lookup: Awaited<ReturnType<typeof loadBranchLookup>>,
  errors: string[],
): Promise<RestoreDomainCounts> {
  const counts = emptyCounts();

  for (const item of items) {
    const reportDate = asString(item?.reportDate);
    if (!reportDate || !isRecord(item?.summaryJson)) {
      counts.skipped += 1;
      errors.push("Skipped a daily report with no date or summary.");
      continue;
    }

    const branchId = resolveBranchId(item.branchCode, item.branchSlug, lookup);
    if (!branchId) {
      counts.skipped += 1;
      errors.push(
        `Skipped report ${reportDate} — unknown branch ${item.branchCode || item.branchSlug || "(none)"}.`,
      );
      continue;
    }

    try {
      const existing = await supabase
        .from("reports_daily")
        .select("id")
        .eq("branch_id", branchId)
        .eq("report_date", reportDate)
        .maybeSingle();

      if (existing.error && existing.error.code !== "PGRST116") {
        throw new Error(existing.error.message);
      }

      await saveDailyReport({
        branchId,
        reportDate,
        dateRangeStart: asString(item.dateRangeStart, reportDate),
        dateRangeEnd: asString(item.dateRangeEnd, reportDate),
        transactionsFileName:
          item.transactionsFileName ||
          asString((item.summaryJson as { filename?: unknown }).filename, "restored.json"),
        mappingFileName: item.mappingFileName ?? undefined,
        summaryJson: item.summaryJson,
      });

      if (existing.data) counts.updated += 1;
      else counts.created += 1;
    } catch (error) {
      counts.failed += 1;
      errors.push(`Report ${reportDate}: ${errMessage(error)}`);
    }
  }

  return counts;
}

async function restoreLedger(
  items: BackupLedgerEntry[],
  lookup: Awaited<ReturnType<typeof loadBranchLookup>>,
  errors: string[],
): Promise<RestoreDomainCounts> {
  const counts = emptyCounts();
  const payloads: UpsertDailyLedgerPayload[] = [];

  for (const item of items) {
    const ledgerDate = asString(item?.ledgerDate);
    if (!ledgerDate) {
      counts.skipped += 1;
      errors.push("Skipped a ledger entry with no date.");
      continue;
    }

    const branchId = resolveBranchId(item.branchCode, item.branchSlug, lookup);
    if (!branchId) {
      counts.skipped += 1;
      errors.push(
        `Skipped ledger ${ledgerDate} — unknown branch ${item.branchCode || item.branchSlug || "(none)"}.`,
      );
      continue;
    }

    payloads.push({
      branchId,
      ledgerDate,
      source: item.source || "sheet",
      sourceFileName: item.sourceFileName,
      cash: asNumber(item.cash),
      maya: asNumber(item.maya),
      grab: asNumber(item.grab),
      paymongo: asNumber(item.paymongo),
      gcash: asNumber(item.gcash),
      foodpanda: asNumber(item.foodpanda),
      giftCard: asNumber(item.giftCard),
      regularDiscount: asNumber(item.regularDiscount),
      seniorDiscount: asNumber(item.seniorDiscount),
      pwdDiscount: asNumber(item.pwdDiscount),
      vatExemption: asNumber(item.vatExemption),
      grossSalesNet: asNumber(item.grossSalesNet),
      transactionCount: Math.round(asNumber(item.transactionCount)),
      grossSales: asNumber(item.grossSales),
    });
  }

  const existingKeys = new Set<string>();
  if (payloads.length > 0) {
    const existingRows = await fetchAllPages(async (from, to) => {
      const { data, error } = await (supabase as any)
        .from("daily_ledger_entries")
        .select("branch_id, ledger_date")
        .range(from, to);
      if (error) throw new Error(`Failed to list ledger keys: ${error.message}`);
      return (data as any[]) ?? [];
    }, LEDGER_CHUNK);

    for (const row of existingRows) {
      existingKeys.add(`${row.branch_id}|${row.ledger_date}`);
    }
  }

  for (let i = 0; i < payloads.length; i += LEDGER_UPSERT_BATCH) {
    const batch = payloads.slice(i, i + LEDGER_UPSERT_BATCH);
    try {
      await upsertDailyLedgerEntries(batch);
      for (const p of batch) {
        if (existingKeys.has(`${p.branchId}|${p.ledgerDate}`)) counts.updated += 1;
        else counts.created += 1;
      }
    } catch (error) {
      for (const p of batch) {
        try {
          await upsertDailyLedgerEntries([p]);
          if (existingKeys.has(`${p.branchId}|${p.ledgerDate}`)) counts.updated += 1;
          else counts.created += 1;
        } catch (itemError) {
          counts.failed += 1;
          errors.push(`Ledger ${p.ledgerDate}: ${errMessage(itemError)}`);
        }
      }
      if (batch.length === 0) {
        errors.push(`Ledger batch: ${errMessage(error)}`);
      }
    }
  }

  return counts;
}

async function restoreDirectory(
  items: BackupDirectoryLink[],
  errors: string[],
): Promise<RestoreDomainCounts> {
  const counts = emptyCounts();
  const existing: DirectoryLink[] = [];
  let page = 1;
  for (;;) {
    const { items: rows, total } = await listDirectoryLinks({
      page,
      pageSize: DIRECTORY_PAGE,
    });
    existing.push(...rows);
    if (existing.length >= total || rows.length === 0) break;
    page += 1;
  }

  const byKey = new Map(existing.map((link) => [directoryKey(link.name, link.url), link]));

  for (const item of items) {
    const name = asString(item?.name).trim();
    const url = asString(item?.url).trim();
    if (!name || !url) {
      counts.skipped += 1;
      errors.push("Skipped a directory link with no name or URL.");
      continue;
    }

    const payload = {
      name,
      url,
      description: item.description ?? null,
      category: item.category ?? null,
      is_active: asBoolean(item.isActive, true),
    };

    const key = directoryKey(name, url);

    try {
      const current = byKey.get(key);
      if (current) {
        await updateDirectoryLink(current.id, payload);
        counts.updated += 1;
      } else {
        const created = await createDirectoryLink(payload);
        byKey.set(key, created);
        counts.created += 1;
      }
    } catch (error) {
      counts.failed += 1;
      errors.push(`Directory "${name}": ${errMessage(error)}`);
    }
  }

  return counts;
}

export async function restoreBackupPack(pack: BackupPack): Promise<RestoreSummary> {
  await requireAdminUser();

  const errors: string[] = [];
  const branches = await restoreBranches(pack.branches, errors);
  const mappings = await restoreMappings(pack.manualMappings, errors);
  const lookup = await loadBranchLookup();
  const reports = await restoreReports(pack.reportsDaily, lookup, errors);
  const ledger = await restoreLedger(pack.dailyLedgerEntries, lookup, errors);
  const directory = await restoreDirectory(pack.directoryLinks, errors);

  return { branches, mappings, reports, ledger, directory, errors };
}

export function formatRestoreSummary(summary: RestoreSummary): string {
  const fmt = (label: string, c: RestoreDomainCounts) => {
    const bits = [`${c.created} new`, `${c.updated} updated`];
    if (c.skipped) bits.push(`${c.skipped} skipped`);
    if (c.failed) bits.push(`${c.failed} failed`);
    return `${label}: ${bits.join(", ")}`;
  };

  return [
    fmt("Branches", summary.branches),
    fmt("Mappings", summary.mappings),
    fmt("Reports", summary.reports),
    fmt("Ledger", summary.ledger),
    fmt("Directory", summary.directory),
  ].join(" · ");
}

export function backupPackCounts(pack: BackupPack) {
  return {
    branches: pack.branches.length,
    mappings: pack.manualMappings.length,
    reports: pack.reportsDaily.length,
    ledger: pack.dailyLedgerEntries.length,
    directory: pack.directoryLinks.length,
  };
}

/**
 * Shared mapping table loading for browser and Node.js.
 *
 * This module provides functions to load the mapping table from:
 * - Validation.xlsx (from public/ folder or filesystem)
 * - DEFAULT_MAPPING (bundled fallback)
 * - manual_mappings database table (via Supabase client)
 *
 * The combined mapping table is used by processTransactionsCsv to ensure
 * synced data produces the same category mappings as manual uploads.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MappingEntry, Category } from '@/utils/types';
import { CATEGORIES } from '@/utils/types';
import { DEFAULT_MAPPING } from '@/utils/defaultMapping';
import { normalizeCategoryCore, normalizeRowOption } from '@/utils/mapRow';
import { normalizeText } from '@/utils/normalize';

/**
 * Load mapping entries from a Validation.xlsx workbook buffer.
 *
 * @param buf ArrayBuffer or Uint8Array of the XLSX file
 * @returns Array of MappingEntry records
 */
export async function mappingEntriesFromWorkbookBuffer(
  buf: ArrayBuffer | Uint8Array
): Promise<MappingEntry[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array' });
  if (!wb.SheetNames.length) throw new Error('Validation mapping workbook is empty.');

  const PREFERRED_SHEET = 'MENU 8172026';
  const MAPPED_NAME_KEYS = ['validation', 'mapped name', 'mappedname', 'mapped_name'];
  const CATEGORY_KEYS = ['category'];
  const ITEM_KEYS = ['item'];
  const OPTION_KEYS = ['option'];

  function pick(row: Record<string, unknown>, keys: string[]): string {
    const wanted = new Set(keys.map((k) => k.trim().toLowerCase()));
    for (const key of Object.keys(row)) {
      if (!wanted.has(key.trim().toLowerCase())) continue;
      const value = row[key];
      if (value == null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  }

  interface ValidationRow {
    mappedName: string;
    category: string;
    item: string;
    option: string;
  }

  function toRows(sheet: XLSX.WorkSheet): ValidationRow[] {
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    return records
      .map((r) => ({
        mappedName: pick(r, MAPPED_NAME_KEYS),
        category: pick(r, CATEGORY_KEYS),
        item: pick(r, ITEM_KEYS),
        option: pick(r, OPTION_KEYS),
      }))
      .filter((r) => r.mappedName && r.category && r.item);
  }

  function pickSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
    const preferred = workbook.Sheets[PREFERRED_SHEET];
    if (preferred && toRows(preferred).length) return preferred;

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (sheet && toRows(sheet).length) return sheet;
    }

    throw new Error('No usable rows found in validation mapping workbook.');
  }

  const rows = toRows(pickSheet(wb));
  if (!rows.length) throw new Error('No usable rows found in validation mapping workbook.');

  return rows.map((r) => ({
    mappedName: r.mappedName.toUpperCase() as Category,
    category: r.category,
    item: r.item,
    option: r.option,
    catNorm: normalizeCategoryCore(r.category),
    itemNorm: normalizeText(r.item),
    optionNorm: normalizeRowOption(r.option),
  }));
}

/**
 * Load mapping table from Validation.xlsx file path (Node.js).
 *
 * @param filePath Path to Validation.xlsx
 * @returns Combined mapping entries (XLSX + defaults)
 */
export async function loadMappingTableFromFile(filePath: string): Promise<MappingEntry[]> {
  const { readFileSync } = await import('fs');
  const buf = readFileSync(filePath);
  const xlsxEntries = await mappingEntriesFromWorkbookBuffer(buf);
  return [...xlsxEntries, ...DEFAULT_MAPPING];
}

/**
 * Load mapping table from public URL (browser).
 *
 * @param url URL to Validation.xlsx (default: /Validation.xlsx)
 * @returns Combined mapping entries (XLSX + defaults)
 */
export async function loadMappingTableFromUrl(
  url: string = '/Validation.xlsx'
): Promise<MappingEntry[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch validation mapping file.');
  const buf = await res.arrayBuffer();
  const xlsxEntries = await mappingEntriesFromWorkbookBuffer(buf);
  return [...xlsxEntries, ...DEFAULT_MAPPING];
}

/**
 * Load manual mapping entries from the database.
 *
 * Manual mappings are user-created entries that override the XLSX mappings.
 * They're stored in the manual_mappings table and should be prepended to
 * the mapping table (so they take priority in lookups).
 *
 * @param supabase Supabase client
 * @returns Array of MappingEntry records from manual_mappings
 */
export async function loadManualMappingsFromDb(
  supabase: SupabaseClient
): Promise<MappingEntry[]> {
  const { data, error } = await supabase
    .from('manual_mappings')
    .select('mapped_name, category, item, option, output_item')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    // If the table doesn't exist or query fails, return empty array
    // This allows the sync to continue with just XLSX + defaults
    console.warn(`Failed to load manual mappings: ${error.message}`);
    return [];
  }

  return (data ?? [])
    .filter(
      (r): r is { mapped_name: string; category: string; item: string; option: string; output_item: string | null } =>
        typeof r.mapped_name === 'string' &&
        typeof r.category === 'string' &&
        typeof r.item === 'string'
    )
    .filter((r) => CATEGORIES.includes(r.mapped_name.toUpperCase() as Category))
    .map((r) => ({
      mappedName: r.mapped_name.toUpperCase() as Category,
      category: r.category,
      item: r.item,
      option: r.option ?? '',
      catNorm: normalizeCategoryCore(r.category),
      itemNorm: normalizeText(r.item),
      optionNorm: normalizeRowOption(r.option ?? ''),
      outputItem: r.output_item ?? undefined,
    }));
}

/**
 * Load the complete mapping table for processing.
 *
 * Order matters: manual mappings first (highest priority), then XLSX, then defaults.
 *
 * @param supabase Supabase client for loading manual mappings
 * @param validationXlsxPath Path to Validation.xlsx (Node.js) or URL (browser)
 * @param isNode Whether running in Node.js (true) or browser (false)
 * @returns Combined mapping table ready for processTransactionsCsv
 */
export async function loadCompleteMappingTable(
  supabase: SupabaseClient,
  validationXlsxPath: string,
  isNode: boolean = typeof window === 'undefined'
): Promise<MappingEntry[]> {
  // Load manual mappings from database
  const manualEntries = await loadManualMappingsFromDb(supabase);

  // Load XLSX + defaults
  const xlsxEntries = isNode
    ? await loadMappingTableFromFile(validationXlsxPath)
    : await loadMappingTableFromUrl(validationXlsxPath);

  // Manual mappings take priority
  return [...manualEntries, ...xlsxEntries];
}

/**
 * Get the default mapping table (no XLSX, no manual mappings).
 *
 * Use this as a fallback when XLSX is not available.
 */
export function getDefaultMappingTable(): MappingEntry[] {
  return [...DEFAULT_MAPPING];
}

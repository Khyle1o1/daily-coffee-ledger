import * as XLSX from "xlsx";
import { toMappingEntries, type ValidationRow } from "./validationMapping";
import type { MappingEntry } from "./types";

const VALIDATION_URL = "/Validation.xlsx";
const PREFERRED_SHEET = "MENU 8172026";

const MAPPED_NAME_KEYS = ["validation", "mapped name", "mappedname", "mapped_name"];
const CATEGORY_KEYS = ["category"];
const ITEM_KEYS = ["item"];
const OPTION_KEYS = ["option"];

function pick(row: Record<string, unknown>, keys: string[]): string {
  const wanted = new Set(keys.map((k) => k.trim().toLowerCase()));
  for (const key of Object.keys(row)) {
    if (!wanted.has(key.trim().toLowerCase())) continue;
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function toRows(sheet: XLSX.WorkSheet): ValidationRow[] {
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return records
    .map((r) => ({
      mappedName: pick(r, MAPPED_NAME_KEYS),
      category: pick(r, CATEGORY_KEYS),
      item: pick(r, ITEM_KEYS),
      option: pick(r, OPTION_KEYS),
    }))
    .filter((r) => r.mappedName && r.category && r.item);
}

function pickSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  const preferred = wb.Sheets[PREFERRED_SHEET];
  if (preferred && toRows(preferred).length) return preferred;

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (sheet && toRows(sheet).length) return sheet;
  }

  throw new Error("No usable rows found in validation mapping workbook.");
}

export function mappingEntriesFromWorkbook(buf: ArrayBuffer | Uint8Array): MappingEntry[] {
  const wb = XLSX.read(buf, { type: "array" });
  if (!wb.SheetNames.length) throw new Error("Validation mapping workbook is empty.");
  const rows = toRows(pickSheet(wb));
  if (!rows.length) throw new Error("No usable rows found in validation mapping workbook.");
  return toMappingEntries(rows);
}

export async function loadValidationMappingFromPublic(): Promise<MappingEntry[]> {
  const res = await fetch(VALIDATION_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch validation mapping file.");

  const buf = await res.arrayBuffer();
  return mappingEntriesFromWorkbook(buf);
}

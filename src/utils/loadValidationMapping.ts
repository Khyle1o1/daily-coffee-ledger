import * as XLSX from "xlsx";
import { normalizeText } from "./normalize";
import { normalizeOption } from "./defaultMapping";
import type { MappingEntry, Category } from "./types";

interface ValidationRow {
  mappedName: string;
  category: string;
  item: string;
  option: string;
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
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
      mappedName: pick(r, ["Mapped Name", "mappedName", "mapped_name", "MappedName"]),
      category: pick(r, ["Category", "category"]),
      item: pick(r, ["Item", "item"]),
      option: pick(r, ["Option", "option"]),
    }))
    .filter((r) => r.mappedName && r.category && r.item);
}

function toMappingEntries(rows: ValidationRow[]): MappingEntry[] {
  return rows.map((r) => ({
    mappedName: r.mappedName as Category,
    category: r.category,
    item: r.item,
    option: r.option ?? "",
    catNorm: normalizeText(r.category),
    itemNorm: normalizeText(r.item),
    optionNorm: normalizeOption(r.option ?? ""),
  }));
}

export async function loadValidationMappingFromPublic(): Promise<MappingEntry[]> {
  const res = await fetch("/VALIDATION DATA.xlsx", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch validation mapping file.");

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("Validation mapping workbook is empty.");

  const sheet = wb.Sheets[firstSheetName];
  const rows = toRows(sheet);
  if (!rows.length) throw new Error("No usable rows found in validation mapping workbook.");

  return toMappingEntries(rows);
}

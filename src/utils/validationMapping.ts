import { normalizeText } from "./normalize";
import { CATEGORIES, type Category, type MappingEntry } from "./types";

const CATEGORY_SET = new Set<string>(CATEGORIES);

const SOURCE_CATEGORY_ALIASES: Record<string, string> = {
  "ADD ONS": "ADD-ONS",
  "DEL - ADD ONS": "DEL-ADD-ONS",
  "DEL ADD ONS": "DEL-ADD-ONS",
};

export interface ValidationRow {
  mappedName: string;
  category: string;
  item: string;
  option: string;
}

/**
 * Normalize an option string for consistent lookup.
 * Extends normalizeText() with option-specific cleanup:
 *   - "12oz."  → "12 oz"
 *   - "l Dairy" → "| Dairy"
 *   - trailing period removed
 *   - pipe spacing normalized ("  |  " → " | ")
 */
export function normalizeOption(opt: string): string {
  let t = normalizeText(opt);
  t = t.replace(/\(\s*(\d+\s*oz)\s*\)/g, "$1");
  t = t.replace(/\(\s*[+-]?\s*\d+\s*\)/g, "");
  t = t.replace(/\boz\./g, "oz");
  t = t.replace(/\.$/, "");
  t = t.replace(/\s+l\s+/g, " | ");
  t = t.replace(/\s*\|\s*/g, " | ");
  t = t.replace(/\s+/g, " ");
  return t.trim();
}

export function canonicalizeMappedName(raw: string): Category | null {
  const mapped = raw.trim().toUpperCase().replace(/^ADD ONS$/, "ADD-ONS");
  if (!CATEGORY_SET.has(mapped)) return null;
  return mapped as Category;
}

export function canonicalizeSourceCategory(raw: string): string {
  const stripped = raw.replace(/^\d{1,3}\s*[.)-]?\s+/i, "").trim();
  const aliased = SOURCE_CATEGORY_ALIASES[stripped.toUpperCase()];
  return aliased ?? stripped;
}

export function isAddOnBucketItemName(item: string): boolean {
  const itemNorm = normalizeText(item);
  if (/^add[\s-]*ons?[\s-]+/i.test(itemNorm)) return true;
  const compact = itemNorm.replace(/\s+/g, "");
  return /^addonsmisc$/i.test(compact);
}

function mappingKey(mappedName: string, category: string, item: string, option: string): string {
  return `${mappedName}|${normalizeText(category)}|${normalizeText(item)}|${normalizeOption(option)}`;
}

/**
 * Compile validation rows into lookup entries.
 * Add-on bucket rows (ADD ONS FOAM + Vanilla Foam) get outputItem = option
 * and a flattened alias row (item = Vanilla Foam) for older POS exports.
 */
export function toMappingEntries(rows: ValidationRow[]): MappingEntry[] {
  const out: MappingEntry[] = [];
  const seen = new Set<string>();

  const add = (
    mappedNameRaw: string,
    categoryRaw: string,
    item: string,
    option: string,
    outputItem?: string,
  ) => {
    const mappedName = canonicalizeMappedName(mappedNameRaw);
    if (!mappedName || !item) return;
    const category = canonicalizeSourceCategory(categoryRaw);
    const key = mappingKey(mappedName, category, item, option);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      mappedName,
      category,
      item,
      option,
      catNorm: normalizeText(category),
      itemNorm: normalizeText(item),
      optionNorm: normalizeOption(option),
      ...(outputItem ? { outputItem } : {}),
    });
  };

  for (const row of rows) {
    const option = row.option ?? "";
    const bucket = isAddOnBucketItemName(row.item) && !!option;
    add(row.mappedName, row.category, row.item, option, bucket ? option : undefined);
    if (bucket) add(row.mappedName, row.category, option, "");
  }

  return out;
}

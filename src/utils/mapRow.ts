import { normalizeText } from "./normalize";
import { CATEGORIES, type RawRow, type ProcessedRow, type MappingEntry, type Category } from "./types";

const DOT_SIG_PATTERNS = [
  "dot signatures",
  "del - dot signatures",
  "del-dot signatures",
  "deldotsignatures",
  "dotsignatures",
];

// Normalized versions of standard categories for fallback matching
const CATEGORY_NORMS = CATEGORIES.map(c => ({ cat: c, norm: normalizeText(c) }));

function isDotSignature(rawCatNorm: string): boolean {
  const collapsed = rawCatNorm.replace(/[\s-]/g, "");
  for (const p of DOT_SIG_PATTERNS) {
    const pc = p.replace(/[\s-]/g, "");
    if (collapsed.includes(pc)) return true;
  }
  return rawCatNorm.includes("dot signatures");
}

/**
 * Strip DEL / delivery prefixes from a normalized category string.
 * e.g. "del - iced" → "iced", "del-add-ons" → "add-ons"
 */
function stripDeliveryPrefix(catNorm: string): string {
  return catNorm
    .replace(/^del\s*[-–—]\s*/i, "")
    .replace(/^del\s+/i, "")
    .trim();
}

/**
 * Try to resolve the raw category to one of the standard categories.
 * Handles DEL- prefixes and fuzzy matching.
 */
function resolveCategory(rawCatNorm: string): Category | null {
  const stripped = stripDeliveryPrefix(rawCatNorm);
  for (const { cat, norm } of CATEGORY_NORMS) {
    if (stripped === norm) return cat;
  }
  // Also try collapsing spaces/hyphens for things like "add ons" vs "add-ons"
  const collapsedStripped = stripped.replace(/[\s-]/g, "");
  for (const { cat, norm } of CATEGORY_NORMS) {
    if (collapsedStripped === norm.replace(/[\s-]/g, "")) return cat;
  }
  return null;
}

/**
 * Detect ICED or HOT from the Option column.
 * e.g. "Iced Large 16 oz. (+10)" → "ICED", "Hot Regular 12oz." → "HOT"
 */
function detectTempFromOption(optionNorm: string): "ICED" | "HOT" | null {
  if (!optionNorm) return null;
  if (/\biced\b/.test(optionNorm)) return "ICED";
  if (/\bhot\b/.test(optionNorm)) return "HOT";
  return null;
}

function isSkipped(row: RawRow): boolean {
  const name = row.rawItemName.trim();
  if (!name || name === "-") return true;
  if (isNaN(row.quantity) || isNaN(row.unitPrice)) return true;
  return false;
}

export function mapRow(row: RawRow, mappingTable: MappingEntry[]): ProcessedRow {
  if (isSkipped(row)) {
    return { ...row, rowSales: 0, mappedCat: null, mappedItemName: null, status: "SKIPPED" };
  }

  const rowSales = row.quantity * row.unitPrice;
  const rawItemNorm = normalizeText(row.rawItemName);
  const rawCatNorm = normalizeText(row.rawCategory);
  const optionNorm = normalizeText(row.option);

  // Detect temperature from option column (e.g. "Iced Large 16 oz." → ICED)
  const optionTemp = detectTempFromOption(optionNorm);

  // Find exact item mapping match
  const match = mappingTable.find(m => (m.utakNorm || normalizeText(m.UTAK)) === rawItemNorm);

  // Override: DOT SIGNATURES → ICED
  if (isDotSignature(rawCatNorm)) {
    return {
      ...row,
      rowSales,
      mappedCat: "ICED",
      mappedItemName: match ? match.ITEM_NAME : row.rawItemName,
      status: "MAPPED",
    };
  }

  // Exact item name match from mapping table
  if (match) {
    // If mapping table has a category, use it; but if the option says Iced/Hot,
    // override the category to ICED or HOT (option column takes priority for temperature)
    let cat = match.CAT.toUpperCase() as Category;
    if (optionTemp) cat = optionTemp;
    return {
      ...row,
      rowSales,
      mappedCat: cat,
      mappedItemName: match.ITEM_NAME,
      status: "MAPPED",
    };
  }

  // Fallback: resolve category from rawCategory column
  const resolvedCat = resolveCategory(rawCatNorm);
  if (resolvedCat) {
    // If category resolved but option says Iced/Hot, prefer option for ICED/HOT
    const finalCat = optionTemp || resolvedCat;
    return {
      ...row,
      rowSales,
      mappedCat: finalCat,
      mappedItemName: row.rawItemName,
      status: "MAPPED",
    };
  }

  // Last fallback: if option column indicates Iced or Hot, use that
  if (optionTemp) {
    return {
      ...row,
      rowSales,
      mappedCat: optionTemp,
      mappedItemName: row.rawItemName,
      status: "MAPPED",
    };
  }

  return { ...row, rowSales, mappedCat: null, mappedItemName: null, status: "UNMAPPED" };
}

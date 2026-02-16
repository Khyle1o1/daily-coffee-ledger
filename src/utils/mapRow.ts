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
  // Check for "iced" anywhere in the option text
  if (optionNorm.includes("iced")) return "ICED";
  // Check for "hot" anywhere in the option text
  if (optionNorm.includes("hot")) return "HOT";
  return null;
}

/**
 * Check if an item is Cold Brew (which should be categorized as ICED)
 */
function isColdBrew(rawItemNorm: string, rawCatNorm: string): boolean {
  return rawItemNorm.includes("cold brew") || rawCatNorm.includes("cold brew") || rawCatNorm.includes("coldbrew");
}

function isSkipped(row: RawRow): boolean {
  const name = row.rawItemName.trim();
  if (!name || name === "-") return true;
  if (isNaN(row.quantity) || isNaN(row.unitPrice)) return true;
  return false;
}

/**
 * Detect if an item is a PROMO (discount/promotion).
 * PROMO = discounts when customer brings their own items or special promotions
 * NOT items being sold at a promotional price (those keep their original category)
 */
function isPromoItem(row: RawRow, rawCatNorm: string, rawItemNorm: string): boolean {
  // DON'T categorize as PROMO if it's clearly a different category
  const protectedCategories = [
    "loyalty card",
    "lc free",
    "lc discount",
    "packaging",
    "cold brew",
    "merch",
    "tumbler only", // "Tumbler Only Promo Price" is MERCH, not PROMO
  ];
  
  for (const cat of protectedCategories) {
    if (rawCatNorm.includes(cat) || rawItemNorm.includes(cat)) return false;
  }
  
  // Check if category explicitly says "promo" (and item doesn't say "only")
  if (rawCatNorm.includes("promo") && !rawItemNorm.includes("only")) return true;
  
  // ONLY categorize as PROMO if it's a BYO (bring your own) discount
  const promoKeywords = [
    "bring your own",
    "byo",
  ];
  
  for (const keyword of promoKeywords) {
    if (rawItemNorm.includes(keyword)) return true;
  }
  
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

  // OVERRIDE: Items that are PHYSICAL MERCHANDISE being sold at promo prices
  // These should be MERCH, not PROMO (PROMO is for discounts, not products)
  if (rawItemNorm.includes("tumbler only")) {
    return {
      ...row,
      rowSales,
      mappedCat: "MERCH",
      mappedItemName: row.rawItemName,
      status: "MAPPED",
    };
  }

  // OVERRIDE: Cold Brew should be categorized as ICED
  if (isColdBrew(rawItemNorm, rawCatNorm)) {
    return {
      ...row,
      rowSales,
      mappedCat: "ICED",
      mappedItemName: row.rawItemName,
      status: "MAPPED",
    };
  }

  // PRIORITY CHECK: Check if this is a PROMO item FIRST (before any other categorization)
  // PROMO = discounts like "Bring your Own Tumbler"
  if (isPromoItem(row, rawCatNorm, rawItemNorm)) {
    return {
      ...row,
      rowSales,
      mappedCat: "PROMO",
      mappedItemName: row.rawItemName,
      status: "MAPPED",
    };
  }

  // Find exact item mapping match
  const match = mappingTable.find(m => (m.utakNorm || normalizeText(m.UTAK)) === rawItemNorm);

  // Override: DOT SIGNATURES → ICED (unless option says HOT)
  if (isDotSignature(rawCatNorm)) {
    return {
      ...row,
      rowSales,
      mappedCat: optionTemp || "ICED", // Use option temp if present, otherwise default to ICED
      mappedItemName: match ? match.ITEM_NAME : row.rawItemName,
      status: "MAPPED",
    };
  }

  // Exact item name match from mapping table
  if (match) {
    // Option column temperature takes absolute priority for ICED/HOT classification
    let cat: Category;
    if (optionTemp) {
      // Option explicitly says "Iced" or "Hot" - use that
      cat = optionTemp;
    } else {
      // No temperature in option, use mapping table category
      cat = match.CAT.toUpperCase() as Category;
    }
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

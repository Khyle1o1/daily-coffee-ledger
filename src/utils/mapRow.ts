import { normalizeText } from "./normalize";
import { normalizeOption } from "./defaultMapping";
import type { RawRow, ProcessedRow, MappingEntry, Category } from "./types";

// ─── Normalization helpers ────────────────────────────────────────────────────

/** Normalize a category string for lookup. */
function normCat(s: string): string {
  return normalizeText(s);
}

/** Normalize an item string for lookup. */
function normItem(s: string): string {
  return normalizeText(s);
}

/**
 * Strip a delivery prefix from a normalized category so that
 * "del - classics" → "classics", "del-add-ons" → "add-ons", etc.
 * Returns the same string if no delivery prefix is present.
 */
function stripDeliveryPrefix(catNorm: string): string {
  return catNorm.replace(/^del\s*-\s*/i, "").trim();
}

// ─── Validation index ─────────────────────────────────────────────────────────

interface ValidationIndex {
  /**
   * Primary lookup: catNorm + "|||" + itemNorm + "|||" + optionNorm → entry.
   * Used for exact 3-field match.
   */
  full: Map<string, MappingEntry>;

  /**
   * Category+Item lookup → entry, but only stored when ALL rows for that
   * cat+item pair share the same mappedName (i.e., the result is unambiguous
   * regardless of option).
   */
  catItemUnique: Map<string, MappingEntry>;
}

function makeFullKey(catNorm: string, itemNorm: string, optNorm: string): string {
  return `${catNorm}|||${itemNorm}|||${optNorm}`;
}

function makeCatItemKey(catNorm: string, itemNorm: string): string {
  return `${catNorm}|||${itemNorm}`;
}

let _cachedTable: MappingEntry[] | null = null;
let _cachedIndex: ValidationIndex | null = null;

function getIndex(table: MappingEntry[]): ValidationIndex {
  if (_cachedTable === table && _cachedIndex) return _cachedIndex;

  const full = new Map<string, MappingEntry>();
  const catItemMapped = new Map<string, Set<string>>();
  const catItemEntry = new Map<string, MappingEntry>();

  for (const entry of table) {
    // Full 3-field lookup
    const fk = makeFullKey(entry.catNorm, entry.itemNorm, entry.optionNorm);
    if (!full.has(fk)) full.set(fk, entry);

    // Track all distinct mappedNames per cat+item pair
    const ck = makeCatItemKey(entry.catNorm, entry.itemNorm);
    if (!catItemMapped.has(ck)) catItemMapped.set(ck, new Set());
    catItemMapped.get(ck)!.add(entry.mappedName);
    if (!catItemEntry.has(ck)) catItemEntry.set(ck, entry);
  }

  // Populate catItemUnique only where there is exactly one mappedName
  const catItemUnique = new Map<string, MappingEntry>();
  for (const [ck, names] of catItemMapped) {
    if (names.size === 1) catItemUnique.set(ck, catItemEntry.get(ck)!);
  }

  _cachedTable = table;
  _cachedIndex = { full, catItemUnique };
  return _cachedIndex;
}

// ─── Row helpers ──────────────────────────────────────────────────────────────

function isSkipped(row: RawRow): boolean {
  const name = row.rawItemName.trim();
  if (!name || name === "-") return true;
  if (isNaN(row.quantity) || isNaN(row.unitPrice)) return true;
  return false;
}

function mapped(
  row: RawRow,
  rowSales: number,
  mappedCat: Category,
  mappedItemName: string,
): ProcessedRow {
  return { ...row, rowSales, mappedCat, mappedItemName, status: "MAPPED" };
}

/**
 * Resolve the output item name from a MappingEntry.
 * Manual mappings set `outputItem` separately from the lookup `item`
 * (so they can remap rawItemName to a different canonical name).
 * Validation table entries leave `outputItem` undefined, so `item` is used.
 */
function resolveOutputItem(entry: MappingEntry): string {
  return entry.outputItem ?? entry.item;
}

// ─── Lookup strategies ────────────────────────────────────────────────────────

/**
 * Strategy 1 – Exact normalized 3-field lookup.
 * Handles the vast majority of real transactions.
 */
function lookupExact(
  idx: ValidationIndex,
  catNorm: string,
  itemNorm: string,
  optNorm: string,
): MappingEntry | undefined {
  return idx.full.get(makeFullKey(catNorm, itemNorm, optNorm));
}

/**
 * Strategy 2 – Category+Item lookup when the pair has exactly one
 * unique mappedName (i.e., the item always resolves to the same category
 * regardless of the option value).
 *
 * Used when an option variant is not explicitly listed in the table.
 */
function lookupCatItemUnique(
  idx: ValidationIndex,
  catNorm: string,
  itemNorm: string,
): MappingEntry | undefined {
  return idx.catItemUnique.get(makeCatItemKey(catNorm, itemNorm));
}

// ─── Main: mapRow ─────────────────────────────────────────────────────────────

/**
 * Map a single raw transaction row to a standardized (mappedCat, mappedItemName)
 * pair using the validation table as the authoritative source.
 *
 * Matching priority:
 *   1. SKIP – invalid rows (blank name, NaN quantity/price).
 *   2. EXACT – normalize Category + Item + Option, look up directly in table.
 *   3. DEL PREFIX – strip "DEL-" / "DEL - " from category, retry exact lookup.
 *      (Handles cases like DEL-ADD-ONS → ADD-ONS when the item isn't listed
 *       under the delivery variant.)
 *   4. CAT+ITEM UNIQUE – if the cat+item pair maps to exactly one category
 *      regardless of option, use that (safe when option text slightly differs).
 *   5. CAT+ITEM UNIQUE (base category) – same as (4) but after stripping the
 *      delivery prefix.
 *   6. UNMAPPED – no match found.
 *
 * Output:
 *   mappedCat      = validationRow.mappedName  (e.g. "ICED", "HOT", "ADD-ONS")
 *   mappedItemName = validationRow.item        (original item name from table)
 */
export function mapRow(row: RawRow, mappingTable: MappingEntry[]): ProcessedRow {
  // ── Step 1: SKIP ────────────────────────────────────────────────────────
  if (isSkipped(row)) {
    return { ...row, rowSales: 0, mappedCat: null, mappedItemName: null, status: "SKIPPED" };
  }

  const rowSales = row.quantity * row.unitPrice;
  const catNorm  = normCat(row.rawCategory);
  const itemNorm = normItem(row.rawItemName);
  const optNorm  = normalizeOption(row.option);

  const idx = getIndex(mappingTable);

  // ── Step 2: EXACT 3-field match ─────────────────────────────────────────
  const exact = lookupExact(idx, catNorm, itemNorm, optNorm);
  if (exact) {
    return mapped(row, rowSales, exact.mappedName, resolveOutputItem(exact));
  }

  // ── Step 3: Strip delivery prefix, retry exact match ────────────────────
  const baseCatNorm = stripDeliveryPrefix(catNorm);
  if (baseCatNorm !== catNorm) {
    const baseExact = lookupExact(idx, baseCatNorm, itemNorm, optNorm);
    if (baseExact) {
      return mapped(row, rowSales, baseExact.mappedName, resolveOutputItem(baseExact));
    }
  }

  // ── Step 4: Cat+Item unique fallback (original category) ────────────────
  const unique = lookupCatItemUnique(idx, catNorm, itemNorm);
  if (unique) {
    return mapped(row, rowSales, unique.mappedName, resolveOutputItem(unique));
  }

  // ── Step 5: Cat+Item unique fallback (base category after DEL strip) ────
  if (baseCatNorm !== catNorm) {
    const baseUnique = lookupCatItemUnique(idx, baseCatNorm, itemNorm);
    if (baseUnique) {
      return mapped(row, rowSales, baseUnique.mappedName, resolveOutputItem(baseUnique));
    }
  }

  // ── Step 6: UNMAPPED ────────────────────────────────────────────────────
  return { ...row, rowSales, mappedCat: null, mappedItemName: null, status: "UNMAPPED" };
}

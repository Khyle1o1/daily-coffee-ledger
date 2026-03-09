import { normalizeText } from "./normalize";
import { CATEGORIES, type RawRow, type ProcessedRow, type MappingEntry, type Category } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Compact lookup result from the validation index */
interface ValidationMatch {
  cat: Category;
  itemName: string;
}

/** Pre-built lookup index for fast mapping */
interface ValidationIndex {
  /** Keyed by normalized UTAK string → first matching entry wins */
  byUtak: Map<string, ValidationMatch>;
  /** Keyed by normalized ITEM_NAME → first matching entry wins */
  byItemName: Map<string, ValidationMatch>;
  /** Raw array for candidate-based lookups */
  entries: MappingEntry[];
}

// ─── Index Builder ────────────────────────────────────────────────────────────

/**
 * Build a fast lookup index from the provided mapping table.
 * Called once per mapping table reference (memoized by Map identity via
 * the module-level cache below).
 */
function buildValidationIndex(table: MappingEntry[]): ValidationIndex {
  const byUtak    = new Map<string, ValidationMatch>();
  const byItemName = new Map<string, ValidationMatch>();

  for (const entry of table) {
    const catUpper = entry.CAT.toUpperCase() as Category;
    if (!CATEGORIES.includes(catUpper)) continue; // skip invalid/placeholder rows

    const match: ValidationMatch = { cat: catUpper, itemName: entry.ITEM_NAME };

    const uk = entry.utakNorm ?? normalizeText(entry.UTAK);
    if (uk && uk !== "-" && !byUtak.has(uk)) {
      byUtak.set(uk, match);
    }

    const ik = entry.itemNameNorm ?? normalizeText(entry.ITEM_NAME);
    if (ik && ik !== "-" && !byItemName.has(ik)) {
      byItemName.set(ik, match);
    }
  }

  return { byUtak, byItemName, entries: table };
}

/** Simple module-level cache so we don't rebuild on every call. */
let _cachedTable: MappingEntry[] | null = null;
let _cachedIndex: ValidationIndex | null = null;

function getIndex(table: MappingEntry[]): ValidationIndex {
  if (table !== _cachedTable || !_cachedIndex) {
    _cachedTable = table;
    _cachedIndex = buildValidationIndex(table);
  }
  return _cachedIndex;
}

// ─── Normalized standard-category list ───────────────────────────────────────

const CATEGORY_NORMS = CATEGORIES.map(c => ({ cat: c, norm: normalizeText(c) }));

// ─── Helper: normalize ────────────────────────────────────────────────────────

/** Re-export the central normalizer for internal use. */
const norm = normalizeText;

// ─── Helper: detectTempFromOption ─────────────────────────────────────────────

/**
 * Detect whether the option text explicitly mentions "iced" or "hot".
 * Returns "ICED", "HOT", or null if no temperature signal is present.
 *
 * Examples:
 *   "Iced Large 16 oz. (+10)"  → "ICED"
 *   "Hot Regular 12 oz."       → "HOT"
 *   "Add oat milk"             → null
 */
function detectTempFromOption(optionNorm: string): "ICED" | "HOT" | null {
  if (!optionNorm) return null;
  if (optionNorm.includes("iced")) return "ICED";
  if (optionNorm.includes("hot"))  return "HOT";
  return null;
}

// ─── Helper: stripDeliveryPrefix ─────────────────────────────────────────────

/** "del - iced" → "iced",  "del-add-ons" → "add-ons" */
function stripDeliveryPrefix(catNorm: string): string {
  return catNorm
    .replace(/^del\s*[-–—]\s*/i, "")
    .replace(/^del\s+/i, "")
    .trim();
}

// ─── Helper: resolveRawCategory ──────────────────────────────────────────────

/**
 * Map a raw CSV category string to one of the known standard categories.
 * Returns null when no standard category can be confidently determined.
 *
 * Raw source categories not in CATEGORIES (like "CLASSICS", "DOT SIGNATURES",
 * "DOT TEA LINE", "DEHUSK LINE") will return null and must be handled by
 * the temperature-aware lookup steps in mapRow().
 */
function resolveRawCategory(rawCatNorm: string): Category | null {
  const stripped = stripDeliveryPrefix(rawCatNorm);
  for (const { cat, norm: n } of CATEGORY_NORMS) {
    if (stripped === n) return cat;
  }
  // Collapse spaces/hyphens for "add ons" vs "add-ons", "cold brew", etc.
  const c = stripped.replace(/[\s-]/g, "");
  for (const { cat, norm: n } of CATEGORY_NORMS) {
    if (c === n.replace(/[\s-]/g, "")) return cat;
  }
  return null;
}

// ─── Helper: safeExactOverrides ───────────────────────────────────────────────

/**
 * A small set of rock-solid, narrow overrides that should always win before
 * any validation-table lookup.  Every rule here is an exact normalized match.
 *
 * Returns a fully-formed ProcessedRow when matched, or null to continue.
 */
function applyExactOverrides(
  row: RawRow,
  rawItemNorm: string,
  rowSales: number,
): ProcessedRow | null {

  // "Gift Card Sleeves" (exact) → LOYALTY CARD
  // NOTE: "FREE Gift Card Sleeves" is a different item (MERCH) and must NOT
  // be caught here.  The validation table handles it via UTAK lookup.
  if (rawItemNorm === "gift card sleeves") {
    return mapped(row, rowSales, "LOYALTY CARD", "Gift Card Sleeves");
  }

  // Gift Certificates: "GC 50", "GC 100", "GC 300", etc. → PROMO
  if (rawItemNorm === "gift certificate" || /^gc\s*\d+\b/.test(rawItemNorm)) {
    return mapped(row, rowSales, "PROMO", row.rawItemName.trim());
  }

  // "Tumbler Only" variants → MERCH / "Tumbler Only Promo Price"
  // ("Tumbler Only Promo Price" is the canonical validation name)
  if (rawItemNorm === "tumbler only" || rawItemNorm === "tumbler only promo price") {
    return mapped(row, rowSales, "MERCH", "Tumbler Only Promo Price");
  }

  return null;
}

// ─── Helper: isSkipped ────────────────────────────────────────────────────────

function isSkipped(row: RawRow): boolean {
  const name = row.rawItemName.trim();
  if (!name || name === "-") return true;
  if (isNaN(row.quantity) || isNaN(row.unitPrice)) return true;
  return false;
}

// ─── Helper: isPromoItem ─────────────────────────────────────────────────────

/**
 * Returns true only for genuine discount/promotion rows (not products sold
 * at a discounted price — those keep their regular category).
 */
function isPromoItem(rawCatNorm: string, rawItemNorm: string): boolean {
  // These categories must never be promoted to PROMO
  const protected_ = [
    "loyalty card", "lc free", "lc discount",
    "packaging", "cold brew", "merch",
  ];
  for (const p of protected_) {
    if (rawCatNorm.includes(p) || rawItemNorm.includes(p)) return false;
  }

  // "Tumbler Only …" is MERCH even if promo-priced
  if (rawItemNorm.includes("tumbler only")) return false;

  // Category explicitly flagged as PROMO
  if (rawCatNorm.includes("promo") && !rawItemNorm.includes("only")) return true;

  // Bring-Your-Own discount lines
  if (rawItemNorm.includes("bring your own") || rawItemNorm.includes("byo")) return true;

  return false;
}

// ─── Helper: mapped (small factory) ──────────────────────────────────────────

function mapped(
  row: RawRow,
  rowSales: number,
  cat: Category,
  itemName: string,
): ProcessedRow {
  return { ...row, rowSales, mappedCat: cat, mappedItemName: itemName, status: "MAPPED" };
}

// ─── Helper: lookupByUtak ────────────────────────────────────────────────────

/** Direct UTAK key lookup in the validation index. */
function lookupByUtak(idx: ValidationIndex, key: string): ValidationMatch | undefined {
  return idx.byUtak.get(key);
}

// ─── Helper: lookupWithTempPrefix ────────────────────────────────────────────

/**
 * When the raw item name lacks a temperature prefix (e.g. "Americano")
 * and the option column signals "Iced" or "Hot", attempt a prefixed lookup:
 *   "iced" + " " + "americano" → looks up "iced americano"
 *
 * This correctly resolves "Americano" + "Iced Large 16 oz." → Iced Americano
 * without needing a hardcoded alias entry for every base name.
 */
function lookupWithTempPrefix(
  idx: ValidationIndex,
  rawItemNorm: string,
  temp: "ICED" | "HOT",
): ValidationMatch | undefined {
  const prefix = temp === "ICED" ? "iced" : "hot";
  const key = `${prefix} ${rawItemNorm}`;
  return idx.byUtak.get(key) ?? idx.byItemName.get(key);
}

// ─── Helper: lookupBestCandidate ─────────────────────────────────────────────

/**
 * When neither a direct UTAK match nor a prefix-built match succeeds,
 * scan ALL validation entries whose normalized UTAK or ITEM_NAME CONTAINS
 * the rawItemNorm as a whole word.  Among those candidates:
 *
 *   • If temp is ICED, prefer entries whose ITEM_NAME starts with "Iced ".
 *   • If temp is HOT,  prefer entries whose ITEM_NAME starts with "Hot ".
 *   • If no temp signal, return the first candidate.
 *
 * This handles items like "Dirty Horchata" → "Iced Dirty Horchata" when no
 * explicit UTAK alias exists but a substring match is unambiguous.
 */
function lookupBestCandidate(
  idx: ValidationIndex,
  rawItemNorm: string,
  temp: "ICED" | "HOT" | null,
): ValidationMatch | undefined {
  if (!rawItemNorm) return undefined;

  // Build a word-boundary regex for the raw item name
  const escaped = rawItemNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`);

  const candidates: ValidationMatch[] = [];
  const seen = new Set<string>();

  for (const entry of idx.entries) {
    const uk = entry.utakNorm ?? norm(entry.UTAK);
    const ik = entry.itemNameNorm ?? norm(entry.ITEM_NAME);

    if (!re.test(uk) && !re.test(ik)) continue;

    const catUpper = entry.CAT.toUpperCase() as Category;
    if (!CATEGORIES.includes(catUpper)) continue;

    const key = `${catUpper}||${entry.ITEM_NAME}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ cat: catUpper, itemName: entry.ITEM_NAME });
  }

  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  if (temp === "ICED") {
    const iced = candidates.find(c => c.itemName.toLowerCase().startsWith("iced "));
    if (iced) return iced;
  }
  if (temp === "HOT") {
    const hot = candidates.find(c => c.itemName.toLowerCase().startsWith("hot "));
    if (hot) return hot;
  }

  // Return first candidate when we cannot disambiguate
  return candidates[0];
}

// ─── Main: mapRow ─────────────────────────────────────────────────────────────

/**
 * Map a single raw CSV row to a ProcessedRow with a validated category and
 * canonical item name, following this priority:
 *
 *  1. SKIP   — blank / dash / NaN rows → status SKIPPED
 *  2. EXACT OVERRIDES — narrow, proven hardcoded rules (GC, Tumbler Only,
 *     Gift Card Sleeves).  These are exact-match only — no broad includes().
 *  3. PROMO CHECK — BYO tumbler discounts, explicit promo category rows
 *  4. UTAK LOOKUP — exact normalized match against validation index
 *  5. ITEM_NAME LOOKUP — exact normalized match against canonical names
 *  6. TEMP-PREFIX LOOKUP — prepend "iced"/"hot" detected from option column
 *     and retry UTAK/ITEM_NAME lookup (resolves "Americano" + "Iced Large"
 *     → "Iced Americano" cleanly)
 *  7. CANDIDATE SCAN — substring/word-boundary search across all entries,
 *     temperature-preferred
 *  8. CATEGORY FALLBACK — resolve category from rawCategory column; use
 *     option temperature to pick ICED/HOT if available
 *  9. UNMAPPED — status UNMAPPED
 */
export function mapRow(row: RawRow, mappingTable: MappingEntry[]): ProcessedRow {

  // ── Step 1: SKIP ──────────────────────────────────────────────────────────
  if (isSkipped(row)) {
    return { ...row, rowSales: 0, mappedCat: null, mappedItemName: null, status: "SKIPPED" };
  }

  const rowSales    = row.quantity * row.unitPrice;
  const rawItemNorm = norm(row.rawItemName);
  const rawCatNorm  = norm(row.rawCategory);
  const optionNorm  = norm(row.option);

  // Temperature signal from the option column ("Iced Large 16 oz." → ICED)
  const optionTemp = detectTempFromOption(optionNorm);

  // ── Step 2: EXACT OVERRIDES ───────────────────────────────────────────────
  const overrideResult = applyExactOverrides(row, rawItemNorm, rowSales);
  if (overrideResult) return overrideResult;

  // ── Step 3: PROMO CHECK ───────────────────────────────────────────────────
  if (isPromoItem(rawCatNorm, rawItemNorm)) {
    return mapped(row, rowSales, "PROMO", row.rawItemName.trim());
  }

  // Build the lookup index (memoized)
  const idx = getIndex(mappingTable);

  // ── Step 4: DIRECT UTAK LOOKUP ────────────────────────────────────────────
  const utakMatch = lookupByUtak(idx, rawItemNorm);
  if (utakMatch) {
    // When a direct UTAK match exists, respect the option temperature for
    // ICED/HOT items so that the same UTAK in HOT vs ICED context maps
    // to the right category.  For all other categories (COLD BREW, PACKAGING,
    // ADD-ONS, etc.) use the validation category directly.
    const finalCat = shouldOverrideWithTemp(utakMatch.cat, optionTemp)
      ? optionTemp!
      : utakMatch.cat;
    return mapped(row, rowSales, finalCat, utakMatch.itemName);
  }

  // ── Step 5: ITEM_NAME LOOKUP ──────────────────────────────────────────────
  const itemNameMatch = idx.byItemName.get(rawItemNorm);
  if (itemNameMatch) {
    const finalCat = shouldOverrideWithTemp(itemNameMatch.cat, optionTemp)
      ? optionTemp!
      : itemNameMatch.cat;
    return mapped(row, rowSales, finalCat, itemNameMatch.itemName);
  }

  // ── Step 6: TEMPERATURE-PREFIX LOOKUP ────────────────────────────────────
  // Handles "Americano" + option "Iced Large 16 oz." → looks up "iced americano"
  if (optionTemp) {
    const prefixed = lookupWithTempPrefix(idx, rawItemNorm, optionTemp);
    if (prefixed) {
      return mapped(row, rowSales, optionTemp, prefixed.itemName);
    }
  }

  // ── Step 7: CANDIDATE SCAN ────────────────────────────────────────────────
  // Substring/word-boundary search; temp-preferred among multiple hits
  const candidate = lookupBestCandidate(idx, rawItemNorm, optionTemp);
  if (candidate) {
    const finalCat = shouldOverrideWithTemp(candidate.cat, optionTemp)
      ? optionTemp!
      : candidate.cat;
    return mapped(row, rowSales, finalCat, candidate.itemName);
  }

  // ── Step 8: RAW CATEGORY FALLBACK ────────────────────────────────────────
  // If we still have no match, try to resolve the category from rawCategory.
  // "CLASSICS", "DOT SIGNATURES", "DOT TEA LINE", "DEHUSK LINE" are not
  // standard categories — they return null here, so we fall through.
  const resolvedCat = resolveRawCategory(rawCatNorm);
  if (resolvedCat) {
    // Respect the option temperature when the resolved category is ICED/HOT
    const finalCat = shouldOverrideWithTemp(resolvedCat, optionTemp)
      ? optionTemp!
      : resolvedCat;
    return mapped(row, rowSales, finalCat, row.rawItemName.trim());
  }

  // If only the option column gives us a temperature hint, use it
  if (optionTemp) {
    return mapped(row, rowSales, optionTemp, row.rawItemName.trim());
  }

  // ── Step 9: UNMAPPED ──────────────────────────────────────────────────────
  return { ...row, rowSales, mappedCat: null, mappedItemName: null, status: "UNMAPPED" };
}

// ─── Helper: shouldOverrideWithTemp ──────────────────────────────────────────

/**
 * Returns true when the option-column temperature should override the
 * validation-table category.  We only do this for ICED/HOT categories —
 * never for COLD BREW, PACKAGING, ADD-ONS, MERCH, etc.
 */
function shouldOverrideWithTemp(
  validationCat: Category,
  optionTemp: "ICED" | "HOT" | null,
): boolean {
  if (!optionTemp) return false;
  // Only swap between ICED and HOT — leave all other categories alone
  return validationCat === "ICED" || validationCat === "HOT";
}

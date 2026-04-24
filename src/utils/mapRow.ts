import { normalizeText } from "./normalize";
import { normalizeOption as normalizeValidationOption } from "./defaultMapping";
import type { RawRow, ProcessedRow, MappingEntry, Category } from "./types";
import { CATEGORIES } from "./types";
import {
  getMenuReferenceSnapshot,
  makeMenuReferenceCategoryItemKey,
  makeMenuReferenceTripleKey,
} from "./menuReference";

// ─── Normalization helpers ────────────────────────────────────────────────────

/** Normalize a category string for lookup. */
function normCat(s: string): string {
  return normalizeText(s);
}

/** Normalize an item string for lookup. */
function normItem(s: string): string {
  return normalizeText(s);
}

function normalizeCategory(rawCategory: string): string {
  const pre = rawCategory.replace(/[ÂÃ]/g, " ").replace(/\u00A0/g, " ");
  let t = normCat(pre);
  // Handles mojibake artifacts from CSV encoding issues.
  t = t
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

function normalizeCategoryCore(rawCategory: string): string {
  let t = normalizeCategory(rawCategory);
  t = t.replace(/^dot\s+classics$/, "classics");
  t = t.replace(/^dot\s+snacks$/, "snacks");
  t = t.replace(/^add[\s-]*ons?.*$/, "add-ons");
  t = t.replace(/^del\s*-\s*add[\s-]*ons?.*$/, "del-add-ons");
  t = t.replace(/^del\s+dot\s+snacks$/, "del-snacks");
  t = t.replace(/^del\s+dot\s+signatures$/, "del - dot signatures");
  t = t.replace(/^del\s+dot\s+classics$/, "del - classics");
  t = t.replace(/^del\s*-\s*dot\s+classics$/, "del - classics");
  t = t.replace(/^del\s*-\s*dot\s+snacks$/, "del-snacks");
  return t.trim();
}

function normalizeItem(rawItem: string): string {
  const pre = rawItem.replace(/[ÂÃ]/g, " ").replace(/\u00A0/g, " ");
  const t = normItem(pre);
  return t
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCategoryCandidates(rawCategory: string): string[] {
  const base = normalizeCategoryCore(rawCategory);
  const out = new Set<string>([base]);

  const add = (s: string) => {
    const t = normalizeText(s);
    if (t) out.add(t);
  };

  // Direct aliases observed in March exports.
  if (base === "dot classics" || base === "classics") add("classics");
  if (base === "del dot classics") add("del - classics");
  if (base === "add ons" || base === "add-on" || base === "add-ons") add("add-ons");
  if (base === "del add ons" || base === "del add-on" || base === "del add ons") add("del-add-ons");
  if (base === "dot snacks" || base === "snacks") add("snacks");
  if (base === "del dot snacks") add("del-snacks");
  if (base === "del dot signatures") add("del - dot signatures");
  if (base.includes("packaging")) add("packaging");
  if (base === "special events") {
    // Special Events exports are source buckets; validation remains in canonical categories.
    for (const c of [
      "classics",
      "dot signatures",
      "dehusk line",
      "dot tea line",
      "snacks",
      "packaging",
      "add-ons",
      "promo",
      "merch",
      "loyalty card",
    ]) {
      add(c);
    }
  }

  // Preserve already-correct categories while normalizing DEL format variants.
  if (base.startsWith("del ")) {
    add(base.replace(/^del\s+/, "del - "));
    add(base.replace(/^del\s+/, "del-"));
    // Safe fallback to base category when delivery variant is incomplete in validation.
    add(base.replace(/^del\s*-\s*/, "").replace(/^del-/, "").replace(/^del\s+/, ""));
  }
  if (/^del-/.test(base) || /^del\s*-\s*/.test(base)) {
    add(base.replace(/^del\s*-\s*/, ""));
    add(base.replace(/^del-/, ""));
    add(base.replace(/^del-/, "del - "));
  }

  // General dash/space variants.
  const current = Array.from(out);
  for (const c of current) {
    add(c.replace(/-/g, " "));
    add(c.replace(/\s+/g, "-"));
  }

  return Array.from(out);
}

function normalizeOption(rawOption: string): string {
  const pre = rawOption.replace(/[ÂÃ]/g, " ").replace(/\u00A0/g, " ");
  let t = normalizeText(pre);
  t = t
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t === "-" || t === "--" || t === "n/a" || t === "na") return "";
  t = t.replace(/\s+[l]\s+/g, " | ");
  t = t.replace(/\s+l\s+/g, " | ");
  t = t.replace(/\s*\|\s*/g, " | ");

  // Standardize explicit size forms.
  t = t.replace(/\biced\s+regular\s*\(?\s*12\s*oz\s*\)?\.?/g, "iced regular 12 oz.");
  t = t.replace(/\biced\s+large\s*\(?\s*16\s*oz\s*\)?\.?/g, "iced large 16 oz. (+10)");
  t = t.replace(/\bhot\s+regular\s*\(?\s*12\s*oz\s*\)?\.?/g, "hot regular 12oz.");
  t = t.replace(/\bhot\s+large\s*\(?\s*16\s*oz\s*\)?\.?/g, "hot large 16 oz. (+10)");
  t = t.replace(/\bregular\s*\(?\s*12\s*oz\s*\)?\.?/g, "regular 12 oz.");
  t = t.replace(/\blarge\s*\(?\s*16\s*oz\s*\)?\.?/g, "large 16 oz. (+10)");
  t = t.replace(/\biced\s+regular\s+12oz\b/g, "iced regular 12 oz.");
  t = t.replace(/\biced\s+large\s+16oz\b/g, "iced large 16 oz. (+10)");
  t = t.replace(/\bhot\s+regular\s+12oz\b/g, "hot regular 12oz.");
  t = t.replace(/\bhot\s+large\s+16oz\b/g, "hot large 16 oz. (+10)");

  return normalizeValidationOption(t);
}

function buildOptionCandidates(rawOption: string, catNorm: string): string[] {
  const base = normalizeOption(rawOption);
  const out = new Set<string>([base]);

  const maybeSignatureCategory =
    catNorm.includes("dot signatures") || catNorm.includes("del - dot signatures");

  if (maybeSignatureCategory && base.startsWith("iced ")) {
    out.add(base.replace(/^iced\s+/, "").trim());
  }
  // Preserve milk suffixes while trying no-leading-iced variants.
  if (maybeSignatureCategory && /\|\s*(oat|almond|dairy)\b/.test(base)) {
    out.add(base.replace(/^iced\s+/, "").trim());
  }

  // Accept either with or without (+10) token in normalized form.
  if (base.includes("(+10)")) out.add(normalizeValidationOption(base.replace(/\s*\(\+10\)/g, "")));
  if (/\blarge\s+16\s+oz\b/.test(base) && !base.includes("(+10)")) {
    out.add(normalizeValidationOption(base.replace(/\blarge\s+16\s+oz\b/g, "large 16 oz. (+10)")));
  }

  return Array.from(out);
}

const ITEM_ALIASES: Record<string, string[]> = {
  [normalizeText("dirty cereal")]: [normalizeText("dirty cereal milk")],
  [normalizeText("double chocolate chip cookie")]: [normalizeText("double chocolate chip cookies")],
  [normalizeText("peanut butter protein latte")]: [normalizeText("pb protein latte")],
  [normalizeText("cocochata")]: [normalizeText("coco chata")],
  [normalizeText("truffle salt bread")]: [normalizeText("truffle cheese salt bread")],
  [normalizeText("oatmeal crunch protein bar")]: [normalizeText("oatmeal cookie protein bar")],
  [normalizeText("chocolate salt bread")]: [normalizeText("dark chocolate salt bread")],
  [normalizeText("dc tote bag")]: [normalizeText("dc tote bag"), normalizeText("Dc Tote Bag")],
  [normalizeText("bring your own tumbler")]: [normalizeText("bring your own tumbler")],
  [normalizeText("16oz iced dabba cups")]: [normalizeText("16oz iced dabba cup")],
  [normalizeText("12oz iced dabba cups")]: [normalizeText("12oz iced dabba cup")],
  [normalizeText("straw")]: [normalizeText("rice straw")],
  [normalizeText("16oz hot paper cups")]: [normalizeText("16oz paper cup")],
  [normalizeText("12oz hot paper cups")]: [normalizeText("12oz paper cup")],
  [normalizeText("delivery | straw")]: [normalizeText("delivery | rice straw")],
  [normalizeText("salted carmael")]: [normalizeText("salted caramel")],
};

function applyMenuReferenceAliases(rawItem: string, menuItems: Set<string>): string[] {
  const base = normalizeItem(rawItem);
  const out = new Set<string>();
  const knownAliases = ITEM_ALIASES[base] ?? [];
  for (const alias of knownAliases) {
    if (menuItems.size === 0 || menuItems.has(alias)) out.add(alias);
  }
  return Array.from(out);
}

function buildItemCandidates(rawItem: string, catCandidates: string[]): string[] {
  const base = normalizeItem(rawItem);
  const out = new Set<string>([base]);
  const menuRef = getMenuReferenceSnapshot();
  const menuItemsForCats = new Set<string>();
  for (const c of catCandidates) {
    const menuItems = menuRef.itemsByCategory.get(c);
    if (!menuItems) continue;
    for (const i of menuItems) menuItemsForCats.add(i);
  }
  for (const alias of applyMenuReferenceAliases(rawItem, menuItemsForCats)) out.add(alias);
  for (const alias of ITEM_ALIASES[base] ?? []) out.add(alias);
  // Also try a spacing-insensitive form (e.g. "cocochata" <-> "coco chata").
  if (base.includes(" ")) out.add(base.replace(/\s+/g, ""));
  else if (base.length > 3) out.add(base.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase());
  return Array.from(out);
}

function isAddOnsLikeCategory(catNorm: string): boolean {
  return /(^|[\s-])add[\s-]*ons?([\s-]|$)/i.test(catNorm);
}

function isAddOnsBucketItem(itemNorm: string): boolean {
  return /^add[\s-]*ons?[\s-]+/.test(itemNorm);
}

function resolveAddOnBucketItem(catNorm: string, itemNorm: string, optNorm: string): string | null {
  if (!optNorm) return null;
  if (!isAddOnsLikeCategory(catNorm)) return null;
  const menuRef = getMenuReferenceSnapshot();
  const inKnownBucket = menuRef.addOnBuckets.has(itemNorm);
  const genericBucket =
    itemNorm === "others" ||
    itemNorm === "milk" ||
    itemNorm === "syrups" ||
    itemNorm === "misc" ||
    itemNorm === "foam";
  if (!isAddOnsBucketItem(itemNorm) && !inKnownBucket && !genericBucket) return null;
  return optNorm;
}

function isSpecialEventsCategory(catNorm: string): boolean {
  return catNorm === "special events";
}

function normalizePackagingItem(rawItem: string): string {
  const normalized = normalizeItem(rawItem);
  if (normalized.startsWith("delivery | ")) return `delivery | ${normalized.replace(/^delivery\s+\|\s+/, "")}`;
  if (normalized.startsWith("delivery|")) return `delivery | ${normalized.replace(/^delivery\|/, "").trim()}`;
  return normalized;
}

function buildCategoryRescueCandidates(catNorm: string, itemCandidates: string[]): string[] {
  const out = new Set<string>();
  const has = (name: string) => itemCandidates.includes(normalizeText(name));

  // Observed March export issue: some DEHUSK items appear under DOT SIGNATURES.
  if (
    (catNorm === "dot signatures" || catNorm === "del - dot signatures" || catNorm === "del dot signatures") &&
    (has("coco chata") || has("coconut cream cold brew") || has("calamansi coconut latte"))
  ) {
    out.add(normalizeText("dehusk line"));
    out.add(normalizeText("del - dehusk line"));
  }

  return Array.from(out);
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

// ─── Category conflict detection ─────────────────────────────────────────────

/**
 * Categories whose rawCategory name is "strict" — i.e. an item with that source
 * category should not silently land in a completely different output category.
 * Cross-categorisation IS expected for beverage/food categories (ICED, HOT, …).
 */
const STRICT_SOURCE_CATEGORIES: Category[] = ["MERCH", "PACKAGING", "LOYALTY CARD"];

/**
 * If the raw source category directly corresponds to a strict category (after
 * stripping the DEL- delivery prefix) but the final mapped category is
 * different, return the expected category so callers can flag the conflict.
 */
function detectCategoryConflict(rawCategory: string, mappedCat: Category): Category | undefined {
  // Strip optional delivery prefix (DEL-, DEL - , DEL , …)
  const stripped = rawCategory.replace(/^del[-\s]+/i, "").trim().toUpperCase();
  for (const strict of STRICT_SOURCE_CATEGORIES) {
    if (stripped === strict && mappedCat !== strict) return strict;
  }
  return undefined;
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
  reason?: string,
): ProcessedRow {
  const categoryConflict = detectCategoryConflict(row.rawCategory, mappedCat);
  return {
    ...row,
    rowSales,
    mappedCat,
    mappedItemName,
    status: "MAPPED",
    categoryConflict,
    debugReason: reason,
  };
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
 *   0. SKIP       – invalid rows (blank name, NaN quantity/price).
 *   1. EXACT      – normalize Category + Item + Option, look up directly in table.
 *   2. DEL PREFIX – strip "DEL-" / "DEL - " from category, retry exact lookup.
 *      (Handles cases like DEL-ADD-ONS → ADD-ONS when the item isn't listed
 *       under the delivery variant.)
 *   3. CAT+ITEM UNIQUE – if the cat+item pair maps to exactly one category
 *      regardless of option, use that (safe when option text slightly differs).
 *   4. CAT+ITEM UNIQUE (base category) – same as (3) but after stripping the
 *      delivery prefix.
 *   5. UNMAPPED – no match found.
 *
 * Output:
 *   mappedCat        = validationRow.mappedName  (e.g. "ICED", "HOT", "ADD-ONS")
 *   mappedItemName   = validationRow.item        (original item name from table)
 *   categoryConflict = set when rawCategory implies a different strict category
 *                      than the final mappedCat
 */
export function mapRow(row: RawRow, mappingTable: MappingEntry[]): ProcessedRow {
  // ── Step 0: SKIP ────────────────────────────────────────────────────────
  if (isSkipped(row)) {
    return { ...row, rowSales: 0, mappedCat: null, mappedItemName: null, status: "SKIPPED" };
  }

  const rowSales = row.quantity * row.unitPrice;
  const catNorm = normalizeCategoryCore(row.rawCategory);
  const itemNorm = normalizePackagingItem(row.rawItemName);
  const optNorm = normalizeOption(row.option);

  const pass1Cats = [catNorm];
  const pass1Items = [itemNorm];
  const pass1Opts = [optNorm];

  const pass2Cats = buildCategoryCandidates(row.rawCategory);
  const pass3Opts = buildOptionCandidates(row.option, pass2Cats[0] ?? catNorm);
  const pass4Items = buildItemCandidates(row.rawItemName, pass2Cats);

  const idx = getIndex(mappingTable);
  const menuRef = getMenuReferenceSnapshot();
  const resolveMapped = (entry: MappingEntry): ProcessedRow =>
    mapped(row, rowSales, entry.mappedName, resolveOutputItem(entry));

  const findExact = (cats: string[], items: string[], opts: string[]): MappingEntry | undefined => {
    for (const c of cats) {
      for (const i of items) {
        for (const o of opts) {
          const hit = lookupExact(idx, c, i, o);
          if (hit) return hit;
        }
      }
    }
    return undefined;
  };

  // PASS 1: exact normalized (raw normalized fields only)
  const p1 = findExact(pass1Cats, pass1Items, pass1Opts);
  if (p1) return resolveMapped(p1);

  // PASS 2: category alias normalization
  const p2 = findExact(pass2Cats, pass1Items, pass1Opts);
  if (p2) return resolveMapped(p2);

  // PASS 3: option normalization variants
  const p3 = findExact(pass2Cats, pass1Items, pass3Opts);
  if (p3) return resolveMapped(p3);

  // PASS 4: item aliases + option variants
  const p4 = findExact(pass2Cats, pass4Items, pass3Opts);
  if (p4) return resolveMapped(p4);

  // PASS 4b: item-scoped category rescue for known export mis-buckets
  const rescueCats = buildCategoryRescueCandidates(catNorm, pass4Items);
  if (rescueCats.length) {
    const p4b = findExact(rescueCats, pass4Items, pass3Opts);
    if (p4b) return resolveMapped(p4b);
  }

  // PASS 5: add-ons bucket resolver (option-as-item)
  const bucketItem = resolveAddOnBucketItem(catNorm, itemNorm, optNorm);
  if (bucketItem) {
    const addOnsCats = buildCategoryCandidates("add-ons");
    const p5 = findExact(addOnsCats, [normalizeItem(bucketItem)], [""]);
    if (p5) return resolveMapped(p5);
  }

  // PASS 5b: Special Events bucket rows (Item is bucket, Option is real item)
  if (isSpecialEventsCategory(catNorm) && optNorm) {
    const specialBucketItem = normalizeItem(row.rawItemName);
    if (specialBucketItem.includes("packaging")) {
      const p5bPack = findExact(buildCategoryCandidates("packaging"), buildItemCandidates(row.option, ["packaging"]), [""]);
      if (p5bPack) return resolveMapped(p5bPack);
    }
    if (specialBucketItem.includes("add ons") || specialBucketItem.includes("add-ons")) {
      const p5bAddOns = findExact(buildCategoryCandidates("add-ons"), buildItemCandidates(row.option, ["add-ons"]), [""]);
      if (p5bAddOns) return resolveMapped(p5bAddOns);
    }
  }

  // PASS 6: menu-confirmed candidate expansion (no fuzzy guessing)
  for (const c of pass2Cats) {
    for (const i of pass4Items) {
      const menuCatItemKey = makeMenuReferenceCategoryItemKey(c, i);
      const menuOptions = menuRef.optionsByCategoryItem.get(menuCatItemKey);
      if (!menuOptions) continue;

      const menuDrivenOptions = new Set<string>(pass3Opts);
      for (const menuOption of menuOptions) {
        for (const candidate of buildOptionCandidates(menuOption, c)) {
          menuDrivenOptions.add(candidate);
          if (menuRef.validTriples.has(makeMenuReferenceTripleKey(c, i, candidate))) {
            menuDrivenOptions.add(candidate);
          }
        }
      }
      const p6 = findExact([c], [i], Array.from(menuDrivenOptions));
      if (p6) return resolveMapped(p6);
    }
  }

  // PASS 7: cat+item fallback only when exactly one validation row exists
  const seenCatItem = new Set<string>();
  for (const c of pass2Cats) {
    for (const i of pass4Items) {
      const catItemKey = makeMenuReferenceCategoryItemKey(c, i);
      if (seenCatItem.has(catItemKey)) continue;
      seenCatItem.add(catItemKey);
      const unique = lookupCatItemUnique(idx, c, i);
      if (unique) return resolveMapped(unique);
    }
  }

  // PASS 8: unmapped + diagnostic reason
  let debugReason = "no_exact_candidate_found";
  if (bucketItem) {
    debugReason = "add_on_bucket_not_resolved";
  } else if (pass2Cats.length > 1) {
    debugReason = "category_alias_missing";
  } else if (pass3Opts.length > 1) {
    debugReason = "option_normalization_missing";
  } else if (pass4Items.length > 1) {
    debugReason = "item_alias_needed";
  } else if (menuRef.itemsByCategory.size > 0) {
    const existsInMenu = pass2Cats.some((c) => {
      const items = menuRef.itemsByCategory.get(c);
      if (!items) return false;
      return pass4Items.some((i) => items.has(i));
    });
    if (existsInMenu) {
      debugReason = "menu_item_not_in_validation";
    }
  }

  return {
    ...row,
    rowSales,
    mappedCat: null,
    mappedItemName: null,
    status: "UNMAPPED",
    debugReason,
  };
}

import Papa from "papaparse";
import { normalizeText } from "./normalize";

interface MenuRefRow {
  category: string;
  itemName: string;
  optionName: string;
}

export interface MenuReferenceSnapshot {
  itemsByCategory: Map<string, Set<string>>;
  optionsByCategoryItem: Map<string, Set<string>>;
  validTriples: Set<string>;
  addOnBuckets: Set<string>;
}

const MENU_FILENAMES = [
  "/MENU 2026 - MENU 4162026.csv",
  "/MENU 2026 - MENU 4162026 - MENU 2026 - MENU 4162026.csv",
];

const EMPTY_SNAPSHOT: MenuReferenceSnapshot = {
  itemsByCategory: new Map(),
  optionsByCategoryItem: new Map(),
  validTriples: new Set(),
  addOnBuckets: new Set(),
};

let cachedSnapshot: MenuReferenceSnapshot = EMPTY_SNAPSHOT;
let hasLoaded = false;
let loadPromise: Promise<MenuReferenceSnapshot> | null = null;

function makeCategoryItemKey(categoryNorm: string, itemNorm: string): string {
  return `${categoryNorm}|||${itemNorm}`;
}

function makeTripleKey(categoryNorm: string, itemNorm: string, optionNorm: string): string {
  return `${categoryNorm}|||${itemNorm}|||${optionNorm}`;
}

function parseMenuRows(csvText: string): MenuRefRow[] {
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });
  const rows: MenuRefRow[] = [];
  for (const cells of parsed.data) {
    const category = (cells[0] ?? "").trim();
    const itemName = (cells[2] ?? "").trim();
    const optionName = (cells[3] ?? "").trim();
    if (!category || !itemName || normalizeText(category) === "category") continue;
    rows.push({ category, itemName, optionName });
  }
  return rows;
}

function buildSnapshot(rows: MenuRefRow[]): MenuReferenceSnapshot {
  const itemsByCategory = new Map<string, Set<string>>();
  const optionsByCategoryItem = new Map<string, Set<string>>();
  const validTriples = new Set<string>();
  const addOnBuckets = new Set<string>();

  for (const row of rows) {
    const categoryNorm = normalizeText(row.category);
    const itemNorm = normalizeText(row.itemName);
    const optionNorm = normalizeText(row.optionName);

    if (!itemsByCategory.has(categoryNorm)) itemsByCategory.set(categoryNorm, new Set<string>());
    itemsByCategory.get(categoryNorm)!.add(itemNorm);

    const ck = makeCategoryItemKey(categoryNorm, itemNorm);
    if (!optionsByCategoryItem.has(ck)) optionsByCategoryItem.set(ck, new Set<string>());
    optionsByCategoryItem.get(ck)!.add(optionNorm);

    validTriples.add(makeTripleKey(categoryNorm, itemNorm, optionNorm));

    if (categoryNorm === "add-ons" && /^add[\s-]*ons?\b/.test(itemNorm)) {
      addOnBuckets.add(itemNorm);
    }
  }

  return { itemsByCategory, optionsByCategoryItem, validTriples, addOnBuckets };
}

async function fetchMenuCsvText(): Promise<string> {
  for (const fileName of MENU_FILENAMES) {
    const response = await fetch(fileName, { cache: "no-store" });
    if (response.ok) return response.text();
  }
  throw new Error("Failed to fetch menu reference CSV from public folder.");
}

export async function preloadMenuReference(): Promise<MenuReferenceSnapshot> {
  if (hasLoaded) return cachedSnapshot;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const csvText = await fetchMenuCsvText();
      cachedSnapshot = buildSnapshot(parseMenuRows(csvText));
      hasLoaded = true;
      return cachedSnapshot;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function getMenuReferenceSnapshot(): MenuReferenceSnapshot {
  return cachedSnapshot;
}

export function hasMenuReferenceLoaded(): boolean {
  return hasLoaded;
}

export function makeMenuReferenceTripleKey(categoryNorm: string, itemNorm: string, optionNorm: string): string {
  return makeTripleKey(categoryNorm, itemNorm, optionNorm);
}

export function makeMenuReferenceCategoryItemKey(categoryNorm: string, itemNorm: string): string {
  return makeCategoryItemKey(categoryNorm, itemNorm);
}

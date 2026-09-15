import { normalizeText } from "./normalize";

/**
 * Known POS spellings → the menu / DEFAULT_MAPPING display name.
 * Only pairs that should collapse on reports (not every ITEM_ALIASES lookup alias).
 */
const CANONICAL_DISPLAY: Record<string, string> = {
  [normalizeText("double chocolate chip cookies")]: "Double Chocolate Chip Cookie",
  [normalizeText("double chocolate chip cookie")]: "Double Chocolate Chip Cookie",
  [normalizeText("16oz iced dabba cups")]: "16oz Iced Dabba Cup",
  [normalizeText("12oz iced dabba cups")]: "12oz Iced Dabba Cup",
  [normalizeText("16oz hot paper cups")]: "16oz Paper Cup",
  [normalizeText("12oz hot paper cups")]: "12oz Paper Cup",
  [normalizeText("coco chata")]: "CocoChata",
  [normalizeText("cocochata")]: "CocoChata",
  [normalizeText("signature tea")]: "Signature Tea",
  [normalizeText("signature tea latte")]: "Signature Tea",
  [normalizeText("chocolate salt bread")]: "Chocolate Salt Bread",
  [normalizeText("dark chocolate salt bread")]: "Chocolate Salt Bread",
  [normalizeText("truffle salt bread")]: "Truffle Salt Bread",
  [normalizeText("truffle cheese salt bread")]: "Truffle Salt Bread",
  [normalizeText("oatmeal crunch protein bar")]: "Oatmeal Crunch Protein Bar",
  [normalizeText("oatmeal cookie protein bar")]: "Oatmeal Crunch Protein Bar",
};

/** POS add-on bucket labels (not sellable SKUs). Option text is the real product. */
export function isAddOnBucketProductName(name: string | null | undefined): boolean {
  const norm = normalizeText(name);
  if (!norm) return false;
  if (/^add[\s-]*ons?[\s-]+/i.test(norm)) return true;
  const compact = norm.replace(/\s+/g, "");
  return /^addonsmisc$/i.test(compact) || /^(addons|addon)misc$/i.test(compact);
}

/**
 * Collapse plural / alias spellings so Product Mix, Top 5, HQ Sync, etc.
 * group Cookie and Cookies as one product. Does not strip arbitrary trailing "s"
 * (Cookie Butter Oat Latte stays intact).
 */
export function canonicalItemName(name: string | null | undefined): string {
  const raw = String(name ?? "").trim();
  if (!raw) return "";

  const norm = normalizeText(raw);
  const known = CANONICAL_DISPLAY[norm];
  if (known) return known;

  // Trailing word "cookies" → "cookie", then title-case words for display.
  if (/\bcookies\b/.test(norm)) {
    const singular = norm.replace(/\bcookies\b/g, "cookie");
    const knownSingular = CANONICAL_DISPLAY[singular];
    if (knownSingular) return knownSingular;
    return titleCaseWords(singular);
  }

  return raw;
}

function titleCaseWords(normalized: string): string {
  return normalized
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Report grouping key: mapped name when present, else raw POS name, then canonicalized.
 * Add-on buckets (ADD ONS MILK, …) resolve to option when available; bare buckets
 * return "" so product reports can omit them.
 */
export function itemKey(row: {
  mappedItemName?: string | null;
  rawItemName?: string | null;
  option?: string | null;
}): string {
  const primary = String(row.mappedItemName ?? row.rawItemName ?? "").trim();
  const option = String(row.option ?? "").trim();

  if (isAddOnBucketProductName(primary)) {
    if (option && !isAddOnBucketProductName(option)) {
      return canonicalItemName(option);
    }
    return "";
  }

  return canonicalItemName(primary);
}

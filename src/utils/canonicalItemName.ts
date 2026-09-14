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
};

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

/** Report grouping key: mapped name when present, else raw POS name, then canonicalized. */
export function itemKey(row: {
  mappedItemName?: string | null;
  rawItemName?: string | null;
}): string {
  return canonicalItemName(row.mappedItemName ?? row.rawItemName ?? "");
}

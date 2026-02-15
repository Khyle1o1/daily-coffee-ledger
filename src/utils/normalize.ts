export function normalizeText(s: string | undefined | null): string {
  if (!s) return "";
  let t = s.trim().toLowerCase();
  // remove surrounding quotes
  t = t.replace(/^["']+|["']+$/g, "");
  // normalize non-breaking spaces and weird whitespace
  t = t.replace(/[\u00A0\u200B\u2007\u202F\uFEFF]/g, " ");
  // collapse multiple spaces
  t = t.replace(/\s+/g, " ");
  // normalize en-dash / em-dash to hyphen
  t = t.replace(/[\u2013\u2014]/g, "-");
  // "12oz" → "12 oz"
  t = t.replace(/(\d)(oz|ml|g)\b/gi, "$1 $2");
  return t.trim();
}

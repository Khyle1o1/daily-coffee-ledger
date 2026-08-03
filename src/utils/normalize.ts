export function normalizeText(s: string | undefined | null): string {
  if (!s) return "";
  let t = s.trim().toLowerCase();
  // remove surrounding quotes
  t = t.replace(/^["']+|["']+$/g, "");
  // curly/smart apostrophes & primes → straight apostrophe (Kiehl's vs Kiehl's)
  t = t.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
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

/**
 * Shared percentage-change utility.
 *
 * Single source of truth for every period-over-period % comparison shown in
 * report tables, dashboard widgets, PDF exports, and Excel exports.
 *
 * Formula: ((current - previous) / previous) × 100
 *
 * Edge cases:
 *   previous > 0              → standard formula
 *   previous === 0, current > 0 → "New"  (no denominator to divide by)
 *   previous === 0, current === 0 → "0%"
 *   non-finite / invalid input → "-"
 */

export type PctChangeTone = "positive" | "negative" | "neutral";

export interface PctChangeResult {
  /** Raw float percentage (e.g. -88.88…). null when value is "New" or invalid. */
  raw: number | null;
  /** Display label already formatted, e.g. "+12%", "-89%", "New", "0%", "-". */
  label: string;
  tone: PctChangeTone;
}

export function getPercentChange(
  previousValue: unknown,
  currentValue: unknown,
): PctChangeResult {
  // Treat null, undefined, and empty string as missing/invalid BEFORE Number()
  // coercion, because Number(null) === 0 and Number("") === 0 which would
  // silently turn a missing value into the "New" path.
  if (
    previousValue === null || previousValue === undefined || previousValue === "" ||
    currentValue === null || currentValue === undefined || currentValue === ""
  ) {
    return { raw: null, label: "-", tone: "neutral" };
  }

  const previous = Number(previousValue);
  const current = Number(currentValue);

  if (!Number.isFinite(previous) || !Number.isFinite(current)) {
    return { raw: null, label: "-", tone: "neutral" };
  }

  if (previous === 0 && current === 0) {
    return { raw: 0, label: "0%", tone: "neutral" };
  }

  if (previous === 0 && current > 0) {
    return { raw: null, label: "New", tone: "neutral" };
  }

  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);

  return {
    raw: change,
    label: `${change > 0 ? "+" : ""}${rounded}%`,
    tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral",
  };
}

/**
 * Returns the Tailwind text-color class that matches a given tone.
 * Intended for use in JSX class names.
 */
export function pctToneClass(tone: PctChangeTone): string {
  switch (tone) {
    case "positive":
      return "text-emerald-600";
    case "negative":
      return "text-red-500";
    case "neutral":
      return "text-slate-400";
  }
}

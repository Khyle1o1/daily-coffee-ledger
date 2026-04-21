import { describe, it, expect } from "vitest";
import { getPercentChange } from "@/utils/percentChange";

describe("getPercentChange", () => {
  // ── Standard cases ────────────────────────────────────────────────────────

  it("1517 -> 1146 should be about -24%", () => {
    const r = getPercentChange(1517, 1146);
    expect(r.label).toBe("-24%");
    expect(r.tone).toBe("negative");
    expect(r.raw).toBeCloseTo(-24.456, 2);
  });

  it("9 -> 1 should be about -89% (never -800%)", () => {
    const r = getPercentChange(9, 1);
    expect(r.label).toBe("-89%");
    expect(r.tone).toBe("negative");
    expect(r.raw).toBeCloseTo(-88.888, 2);
  });

  it("8 -> 3 should be about -62% (never -2400%)", () => {
    // ((3 - 8) / 8) * 100 = -62.5; Math.round(-62.5) = -62 in JS (rounds toward +∞)
    const r = getPercentChange(8, 3);
    expect(r.label).toBe("-62%");
    expect(r.tone).toBe("negative");
    expect(r.raw).toBeCloseTo(-62.5, 2);
  });

  it("75 -> 75 should be 0%", () => {
    const r = getPercentChange(75, 75);
    expect(r.label).toBe("0%");
    expect(r.tone).toBe("neutral");
    expect(r.raw).toBe(0);
  });

  it("100 -> 150 should be +50%", () => {
    const r = getPercentChange(100, 150);
    expect(r.label).toBe("+50%");
    expect(r.tone).toBe("positive");
    expect(r.raw).toBe(50);
  });

  // ── Zero-previous edge cases ──────────────────────────────────────────────

  it("0 -> 15 should display New", () => {
    const r = getPercentChange(0, 15);
    expect(r.label).toBe("New");
    expect(r.tone).toBe("neutral");
    expect(r.raw).toBeNull();
  });

  it("0 -> 0 should display 0%", () => {
    const r = getPercentChange(0, 0);
    expect(r.label).toBe("0%");
    expect(r.tone).toBe("neutral");
    expect(r.raw).toBe(0);
  });

  // ── Invalid / missing inputs ──────────────────────────────────────────────

  it("null previous should display -", () => {
    const r = getPercentChange(null, 10);
    expect(r.label).toBe("-");
    expect(r.raw).toBeNull();
  });

  it("undefined previous should display -", () => {
    const r = getPercentChange(undefined, 10);
    expect(r.label).toBe("-");
    expect(r.raw).toBeNull();
  });

  it("empty string previous should display -", () => {
    const r = getPercentChange("", 10);
    expect(r.label).toBe("-");
    expect(r.raw).toBeNull();
  });

  it("non-numeric text should display -", () => {
    const r = getPercentChange("abc", "xyz");
    expect(r.label).toBe("-");
    expect(r.raw).toBeNull();
  });

  it("NaN previous should display -", () => {
    const r = getPercentChange(NaN, 10);
    expect(r.label).toBe("-");
    expect(r.raw).toBeNull();
  });

  it("Infinity should display -", () => {
    const r = getPercentChange(Infinity, 10);
    expect(r.label).toBe("-");
    expect(r.raw).toBeNull();
  });

  // ── Label formatting ──────────────────────────────────────────────────────

  it("positive change has + prefix", () => {
    const r = getPercentChange(50, 75);
    expect(r.label.startsWith("+")).toBe(true);
  });

  it("negative change has no extra prefix", () => {
    const r = getPercentChange(50, 25);
    expect(r.label.startsWith("-")).toBe(true);
  });

  it("rounding uses Math.round (not floor/ceil)", () => {
    // 100 -> 145 = +45% exactly
    expect(getPercentChange(100, 145).label).toBe("+45%");
    // 100 -> 144.4 rounds down
    expect(getPercentChange(100, 144.4).label).toBe("+44%");
    // 100 -> 144.5 rounds up
    expect(getPercentChange(100, 144.5).label).toBe("+45%");
  });
});

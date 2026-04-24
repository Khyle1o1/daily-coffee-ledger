/**
 * Category mapping correctness tests.
 *
 * Verifies that items are mapped to the right category and that the protection
 * rules for MERCH/GC items hold, even if the validation table is wrong.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { mapRow } from "@/utils/mapRow";
import { DEFAULT_MAPPING } from "@/utils/defaultMapping";
import { preloadMenuReference } from "@/utils/menuReference";
import type { RawRow, MappingEntry } from "@/utils/types";

// ── Test helpers ──────────────────────────────────────────────────────────────

function row(rawCategory: string, rawItemName: string, option = ""): RawRow {
  return { rawCategory, rawItemName, option, quantity: 1, unitPrice: 100 };
}

/**
 * Build a minimal mapping table that deliberately maps GC 100 to PROMO
 * (simulating a corrupted/wrong table entry).  Used to verify the protected
 * rule overrides it.
 */
function tableWithWrongGC(): MappingEntry[] {
  return [
    {
      mappedName: "PROMO",
      category: "MERCH",
      item: "GC 100",
      option: "",
      catNorm: "merch",
      itemNorm: "gc 100",
      optionNorm: "",
    },
    ...DEFAULT_MAPPING,
  ];
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, text: async () => "" } as Response)),
  );
  await preloadMenuReference();
});

// ── MERCH / Gift Card rules ───────────────────────────────────────────────────

describe("MERCH + GC / Gift Card items", () => {
  it("MERCH + GC 100 → MERCH (via default table)", () => {
    const r = mapRow(row("MERCH", "GC 100"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("MERCH");
    expect(r.mappedItemName).toBe("GC 100");
    expect(r.categoryConflict).toBeUndefined();
  });

  it("MERCH + GC 200 → MERCH", () => {
    const r = mapRow(row("MERCH", "GC 200"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("MERCH");
    expect(r.categoryConflict).toBeUndefined();
  });

  it("MERCH + GC 300 → MERCH", () => {
    const r = mapRow(row("MERCH", "GC 300"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("MERCH");
    expect(r.categoryConflict).toBeUndefined();
  });

  it("MERCH + GC 500 → MERCH", () => {
    const r = mapRow(row("MERCH", "GC 500"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("MERCH");
    expect(r.categoryConflict).toBeUndefined();
  });

  it("MERCH + Gift Card → MERCH", () => {
    const r = mapRow(row("MERCH", "Gift Card"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("MERCH");
    expect(r.categoryConflict).toBeUndefined();
  });

  it("protected rule: MERCH + GC 100 → MERCH even when table says PROMO", () => {
    const r = mapRow(row("MERCH", "GC 100"), tableWithWrongGC());
    expect(r.mappedCat).toBe("MERCH");
    // debugReason should indicate the override fired
    expect(r.debugReason).toBe("protected_merch_gc");
    expect(r.categoryConflict).toBeUndefined();
  });

  it("protected rule: case-insensitive GC prefix variants are covered", () => {
    // 'gc 250' — not in the table, protected rule creates a synthetic MERCH row
    const r = mapRow(row("MERCH", "GC 250"), DEFAULT_MAPPING);
    expect(r.mappedCat).toBe("MERCH");
  });

  it("protected rule does NOT fire for Gift Card accessories (sleeves stay LOYALTY CARD)", () => {
    // "FREE Gift Card Sleeves" is an accessory, not a gift card itself.
    // The protected rule only catches exact "GC <num>" or exact "Gift Card".
    // This item should remain mapped to LOYALTY CARD per the validation table.
    const r = mapRow(row("MERCH", "FREE Gift Card Sleeves", "total of 1000 php"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("LOYALTY CARD");
  });
});

// ── PROMO items ───────────────────────────────────────────────────────────────

describe("PROMO items stay PROMO", () => {
  it("PROMO + Bring your Own Tumbler → PROMO", () => {
    const r = mapRow(row("PROMO", "Bring your Own Tumbler"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("PROMO");
    expect(r.categoryConflict).toBeUndefined();
  });

  it("PROMO + Gcash Food → PROMO", () => {
    const r = mapRow(row("PROMO", "Gcash Food", "100 pesos off"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("PROMO");
  });
});

// ── PACKAGING ────────────────────────────────────────────────────────────────

describe("PACKAGING items", () => {
  it("PACKAGING item → PACKAGING", () => {
    const r = mapRow(row("PACKAGING", "Delivery | Rice Straw"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("PACKAGING");
    expect(r.categoryConflict).toBeUndefined();
  });
});

// ── Beverage categories ───────────────────────────────────────────────────────

describe("Beverage categories", () => {
  it("ICED category item → ICED", () => {
    const r = mapRow(row("DOT CLASSICS", "Americano", "Iced Regular (12oz)"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("ICED");
  });

  it("HOT category item → HOT", () => {
    const r = mapRow(row("DOT CLASSICS", "Americano", "Hot Regular (12oz)"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("HOT");
  });
});

// ── Conflict detection ────────────────────────────────────────────────────────

describe("categoryConflict detection", () => {
  it("no conflict when rawCategory matches mappedCat", () => {
    const r = mapRow(row("MERCH", "Dc Tote Bag"), DEFAULT_MAPPING);
    expect(r.mappedCat).toBe("MERCH");
    expect(r.categoryConflict).toBeUndefined();
  });

  it("no conflict flagged when rawCategory is a beverage category and mappedCat is ICED", () => {
    const r = mapRow(row("DOT CLASSICS", "Americano", "Iced Regular (12oz)"), DEFAULT_MAPPING);
    expect(r.mappedCat).toBe("ICED");
    // DOT CLASSICS is not a strict source category, so no conflict
    expect(r.categoryConflict).toBeUndefined();
  });

  it("conflict detected when table would wrongly map MERCH item to PROMO", () => {
    // Build a table without the protected rule coverage (no GC entry, only a wrong PROMO one)
    const wrongTable: MappingEntry[] = [
      {
        mappedName: "PROMO",
        category: "MERCH",
        item: "GC 999",          // hypothetical item not caught by protected rule
        option: "",
        catNorm: "merch",
        itemNorm: "gc 999",
        optionNorm: "",
      },
    ];
    // GC 999 starts with "GC " so the protected rule fires before the table —
    // it must return MERCH without conflict
    const r = mapRow(row("MERCH", "GC 999"), wrongTable);
    expect(r.mappedCat).toBe("MERCH");
    expect(r.categoryConflict).toBeUndefined();
  });
});

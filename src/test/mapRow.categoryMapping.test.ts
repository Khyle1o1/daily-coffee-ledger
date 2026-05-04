/**
 * Category mapping correctness tests.
 *
 * Verifies that items are mapped to the right category per the default table.
 * GC / Gift Card items are classified as PROMO.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { mapRow } from "@/utils/mapRow";
import { DEFAULT_MAPPING } from "@/utils/defaultMapping";
import { preloadMenuReference } from "@/utils/menuReference";
import type { RawRow } from "@/utils/types";

// ── Test helpers ──────────────────────────────────────────────────────────────

function row(rawCategory: string, rawItemName: string, option = ""): RawRow {
  return { rawCategory, rawItemName, option, quantity: 1, unitPrice: 100 };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, text: async () => "" } as Response)),
  );
  await preloadMenuReference();
});

// ── GC / Gift Card → PROMO ───────────────────────────────────────────────────

describe("GC / Gift Card items → PROMO", () => {
  it("MERCH + GC 100 → PROMO", () => {
    const r = mapRow(row("MERCH", "GC 100"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("PROMO");
    expect(r.mappedItemName).toBe("GC 100");
  });

  it("MERCH + GC 200 → PROMO", () => {
    const r = mapRow(row("MERCH", "GC 200"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("PROMO");
  });

  it("MERCH + GC 300 → PROMO", () => {
    const r = mapRow(row("MERCH", "GC 300"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("PROMO");
  });

  it("MERCH + GC 500 → PROMO", () => {
    const r = mapRow(row("MERCH", "GC 500"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("PROMO");
  });

  it("MERCH + Gift Card → PROMO", () => {
    const r = mapRow(row("MERCH", "Gift Card"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("PROMO");
  });

  it("MERCH + GC 750 → PROMO (fallback for any GC amount)", () => {
    const r = mapRow(row("MERCH", "GC 750"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("PROMO");
    expect(r.mappedItemName).toBe("GC 750");
  });

  it("MERCH + GC 999 still maps to PROMO even without mapping table", () => {
    const r = mapRow(row("MERCH", "GC 999"), []);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("PROMO");
    expect(r.mappedItemName).toBe("GC 999");
    expect(r.debugReason).toBe("fallback_gift_card_promo");
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

// ── MERCH items stay MERCH ────────────────────────────────────────────────────

describe("Non-GC MERCH items stay MERCH", () => {
  it("MERCH + Dc Tote Bag → MERCH", () => {
    const r = mapRow(row("MERCH", "Dc Tote Bag"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("MERCH");
    expect(r.categoryConflict).toBeUndefined();
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

describe("DEL - SIGNATURES and delivery category aliases", () => {
  it("maps DEL - SIGNATURES + Cereal Milk + Iced Regular (12oz) → ICED / Cereal Milk", () => {
    const r = mapRow(row("DEL - SIGNATURES", "Cereal Milk", "Iced Regular (12oz)"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("ICED");
    expect(r.mappedItemName).toBe("Cereal Milk");
  });

  it("maps DEL - SIGNATURES + Horchata + Iced Large (16oz) | Oat → ICED / Horchata", () => {
    const r = mapRow(row("DEL - SIGNATURES", "Horchata", "Iced Large (16oz) | Oat"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("ICED");
    expect(r.mappedItemName).toBe("Horchata");
  });

  it("maps DEL - ADD ONS + ADD ONS MISC + Coconut Water → ADD-ONS / Coconut Water", () => {
    const r = mapRow(row("DEL - ADD ONS", "ADD ONS MISC", "Coconut Water"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("ADD-ONS");
    expect(r.mappedItemName).toBe("Coconut Water");
  });

  it("maps Coconut Water even when the active mapping table has no ADD ONS rows (uploaded table gap)", () => {
    const r = mapRow(row("DEL - ADD ONS", "ADD ONS MISC", "Coconut Water"), []);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("ADD-ONS");
    expect(r.mappedItemName).toBe("Coconut Water");
    expect(r.debugReason).toBe("fallback_addon_misc_option");
  });

  it("maps ADD ONS MISC + Coconut Water with numeric category prefix", () => {
    const r = mapRow(row("01 DEL - ADD ONS", "ADD ONS MISC", "Coconut Water"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("ADD-ONS");
    expect(r.mappedItemName).toBe("Coconut Water");
  });

  it("maps ADDONSMISC (no spaces) + Coconut Water", () => {
    const r = mapRow(row("DEL - ADD ONS", "ADDONSMISC", "Coconut Water"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("ADD-ONS");
    expect(r.mappedItemName).toBe("Coconut Water");
  });

  it("maps DOT SIGNATURES + Creamy Coco Hojicha + Iced Regular (12oz)", () => {
    const r = mapRow(row("DOT SIGNATURES", "Creamy Coco Hojicha", "Iced Regular (12oz)"), DEFAULT_MAPPING);
    expect(r.status).toBe("MAPPED");
    expect(r.mappedCat).toBe("ICED");
    expect(r.mappedItemName).toBe("Creamy Coco Hojicha");
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
    expect(r.categoryConflict).toBeUndefined();
  });
});

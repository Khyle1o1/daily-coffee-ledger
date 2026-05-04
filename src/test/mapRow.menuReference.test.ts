import { beforeAll, describe, expect, it, vi } from "vitest";
import { mapRow } from "@/utils/mapRow";
import { DEFAULT_MAPPING } from "@/utils/defaultMapping";
import { preloadMenuReference } from "@/utils/menuReference";
import type { RawRow } from "@/utils/types";

const MOCK_MENU_CSV = [
  "CATEGORY ,,ITEM NAME,,",
  "ICED,02 DOT CLASSICS,Americano,Iced Large (16oz),120",
  "ICED,10 DEL - SIGNATURES,Dirty Cereal,Iced Large (16oz),230",
  "SNACKS,04 DOT SNACKS,Double Chocolate Chip Cookie,,135",
  "ADD-ONS,01 ADD ONS,ADD ONS MILK,Oat Milk,45",
  "ADD-ONS,01 ADD ONS,ADD ONS SYRUPS,Sugar Syrup,0",
  "PACKAGING,001 PACKAGING,Delivery | Rice Straw,,3",
  "MERCH,05 MERCH,FREE Gift Card Sleeves,total of 1000 php,0",
].join("\n");

function row(rawCategory: string, rawItemName: string, option = ""): RawRow {
  return {
    rawCategory,
    rawItemName,
    option,
    quantity: 1,
    unitPrice: 100,
  };
}

describe("mapRow menu reference coverage", () => {
  beforeAll(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return {
          ok: true,
          text: async () => MOCK_MENU_CSV,
        } as Response;
      }),
    );
    await preloadMenuReference();
  });

  it("maps A: DOT CLASSICS Americano Iced Large", () => {
    const result = mapRow(row("DOT CLASSICS", "Americano", "Iced Large (16oz)"), DEFAULT_MAPPING);
    expect(result.status).toBe("MAPPED");
    expect(result.mappedCat).toBe("ICED");
    expect(result.mappedItemName).toBe("Americano");
  });

  it("maps B: DOT SIGNATURES Dirty Cereal via alias", () => {
    const result = mapRow(row("DOT SIGNATURES", "Dirty Cereal", "Iced Large (16oz)"), DEFAULT_MAPPING);
    expect(result.status).toBe("MAPPED");
    expect(result.mappedCat).toBe("ICED");
    expect(result.mappedItemName).toBe("Dirty Cereal");
  });

  it("maps C: DOT SNACKS Double Chocolate Chip Cookie via canonical snack alias", () => {
    const result = mapRow(row("DOT SNACKS", "Double Chocolate Chip Cookie"), DEFAULT_MAPPING);
    expect(result.status).toBe("MAPPED");
    expect(result.mappedCat).toBe("SNACKS");
    expect(result.mappedItemName).toBe("Double Chocolate Chip Cookies");
  });

  it("maps D/E: ADD ONS bucket options as item names", () => {
    const milk = mapRow(row("ADD ONS", "ADD ONS MILK", "Oat Milk"), DEFAULT_MAPPING);
    const syrup = mapRow(row("ADD ONS", "ADD ONS SYRUPS", "Sugar Syrup"), DEFAULT_MAPPING);

    expect(milk.status).toBe("MAPPED");
    expect(milk.mappedCat).toBe("ADD-ONS");
    expect(milk.mappedItemName).toBe("Oat Milk");

    expect(syrup.status).toBe("MAPPED");
    expect(syrup.mappedCat).toBe("ADD-ONS");
    expect(syrup.mappedItemName).toBe("Sugar Syrup");
  });

  it("maps F: packaging delivery-prefixed items", () => {
    const result = mapRow(row("PACKAGING", "Delivery | Rice Straw"), DEFAULT_MAPPING);
    expect(result.status).toBe("MAPPED");
    expect(result.mappedCat).toBe("PACKAGING");
    expect(result.mappedItemName).toBe("Delivery | Rice Straw");
  });

  it("maps G: FREE Gift Card Sleeves remains distinct item", () => {
    const result = mapRow(row("MERCH", "FREE Gift Card Sleeves", "total of 1000 php"), DEFAULT_MAPPING);
    expect(result.status).toBe("MAPPED");
    expect(result.mappedItemName).toBe("FREE Gift Card Sleeves");
  });

  it("maps DEL DOT category variants from current uploads", () => {
    const peanut = mapRow(row("DEL DOT SNACKS", "Peanut Butter Monkey Bar"), DEFAULT_MAPPING);
    const oatmeal = mapRow(row("DEL DOT SNACKS", "Oatmeal Protein Cookie"), DEFAULT_MAPPING);
    const coconut = mapRow(
      row("DEL DOT SIGNATURES", "Coconut Cream Cold Brew", "Iced Large (16oz)"),
      DEFAULT_MAPPING,
    );
    const cocochata = mapRow(row("DEL DOT SIGNATURES", "CocoChata", "Iced Regular (12oz)"), DEFAULT_MAPPING);

    expect(peanut.status).toBe("MAPPED");
    expect(peanut.mappedCat).toBe("SNACKS");
    expect(peanut.mappedItemName).toBe("Peanut Butter Monkey Bar");

    expect(oatmeal.status).toBe("MAPPED");
    expect(oatmeal.mappedCat).toBe("SNACKS");
    expect(oatmeal.mappedItemName).toBe("Oatmeal Protein Cookie");

    expect(coconut.status).toBe("MAPPED");
    expect(coconut.mappedCat).toBe("ICED");
    expect(coconut.mappedItemName).toBe("Coconut Cream Cold Brew");

    expect(cocochata.status).toBe("MAPPED");
    expect(cocochata.mappedCat).toBe("ICED");
    expect(cocochata.mappedItemName).toBe("Coco Chata");
  });

  it("maps newly-seen validation item label variants", () => {
    const dirtyCereal = mapRow(
      row("DEL - SIGNATURES", "Dirty Cereal", "Iced Regular (12oz)"),
      DEFAULT_MAPPING,
    );
    const doubleChocolateCookie = mapRow(
      row("DOT SNACKS", "Double Chocolate Chip Cookie"),
      DEFAULT_MAPPING,
    );
    const truffleSaltBread = mapRow(
      row("DOT SNACKS", "Truffle Salt Bread"),
      DEFAULT_MAPPING,
    );
    const oatmealCrunchBar = mapRow(
      row("DOT SNACKS", "Oatmeal Crunch Protein Bar"),
      DEFAULT_MAPPING,
    );
    const chocolateSaltBread = mapRow(
      row("DOT SNACKS", "Chocolate Salt Bread"),
      DEFAULT_MAPPING,
    );
    const peanutButterProtein = mapRow(
      row("DEL - DOT SIGNATURES", "Peanut Butter Protein Latte", "Iced Large (16oz)"),
      DEFAULT_MAPPING,
    );

    expect(dirtyCereal.status).toBe("MAPPED");
    expect(dirtyCereal.mappedCat).toBe("ICED");
    expect(dirtyCereal.mappedItemName).toBe("Dirty Cereal");

    expect(doubleChocolateCookie.status).toBe("MAPPED");
    expect(doubleChocolateCookie.mappedCat).toBe("SNACKS");
    expect(doubleChocolateCookie.mappedItemName).toBe("Double Chocolate Chip Cookies");

    expect(truffleSaltBread.status).toBe("MAPPED");
    expect(truffleSaltBread.mappedCat).toBe("SNACKS");
    expect(truffleSaltBread.mappedItemName).toBe("Truffle Cheese Salt Bread");

    expect(oatmealCrunchBar.status).toBe("MAPPED");
    expect(oatmealCrunchBar.mappedCat).toBe("SNACKS");
    expect(oatmealCrunchBar.mappedItemName).toBe("Oatmeal Cookie Protein Bar");

    expect(chocolateSaltBread.status).toBe("MAPPED");
    expect(chocolateSaltBread.mappedCat).toBe("SNACKS");
    expect(chocolateSaltBread.mappedItemName).toBe("Dark Chocolate Salt Bread");

    expect(peanutButterProtein.status).toBe("MAPPED");
    expect(peanutButterProtein.mappedCat).toBe("ICED");
    expect(peanutButterProtein.mappedItemName).toBe("PB Protein Latte");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  mappingEntriesFromWorkbook,
  withDefaultMappingFallback,
} from "@/utils/loadValidationMapping";
import { mapRow } from "@/utils/mapRow";

describe("Validation.xlsx MBxCB Discount Deals", () => {
  it("maps from the live workbook (and via default fallback)", () => {
    const buf = readFileSync(resolve(process.cwd(), "public/Validation.xlsx"));
    const live = mappingEntriesFromWorkbook(buf);
    const table = withDefaultMappingFallback(live);

    const fromLive = mapRow(
      {
        rawCategory: "PROMO",
        rawItemName: "MBxCB Discount Deals",
        option: "",
        quantity: 1,
        unitPrice: 0,
      },
      live,
    );
    expect(fromLive.status).toBe("MAPPED");
    expect(fromLive.mappedCat).toBe("PROMO");
    expect(fromLive.mappedItemName).toBe("MBxCB Discount Deals");

    const fromMerged = mapRow(
      {
        rawCategory: "PROMO",
        rawItemName: "MBxCB Discount Deals",
        option: "",
        quantity: 1,
        unitPrice: 0,
      },
      table,
    );
    expect(fromMerged.status).toBe("MAPPED");
    expect(fromMerged.mappedCat).toBe("PROMO");
  });
});

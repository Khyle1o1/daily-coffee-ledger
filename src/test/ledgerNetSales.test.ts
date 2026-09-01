import { describe, expect, it } from "vitest";
import { ledgerNetSales, emptyLedgerAmounts } from "@/services/dailyLedgerService";
import { parseDailyLedgerSheetRows } from "@/utils/parseDailyLedgerSheet";
import { autoDetectColumns } from "@/utils/parseCsv";

describe("ledgerNetSales", () => {
  it("is GROSS SALES minus Regular, Senior, and PWD discounts", () => {
    const row = {
      ...emptyLedgerAmounts(),
      grossSales: 25547,
      grossSalesNet: 25547,
      regularDiscount: 100,
      seniorDiscount: 50,
      pwdDiscount: 25,
      vatExemption: 106,
    };
    expect(ledgerNetSales(row)).toBe(25372);
  });

  it("does not subtract VAT exemption", () => {
    const row = {
      ...emptyLedgerAmounts(),
      grossSales: 1000,
      vatExemption: 200,
    };
    expect(ledgerNetSales(row)).toBe(1000);
  });
});

describe("parseDailyLedgerSheetRows Gross Net", () => {
  it("forces Gross Net to equal GROSS SALES even when the sheet columns differ", () => {
    const rows = parseDailyLedgerSheetRows(
      ["Date", "Cash", "Gross Sales (Net)", "GROSS SALES", "Regular Discount"],
      [
        {
          Date: "2026-09-01",
          Cash: "1000",
          "Gross Sales (Net)": "900",
          "GROSS SALES": "1000",
          "Regular Discount": "100",
        },
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].grossSales).toBe(1000);
    expect(rows[0].grossSalesNet).toBe(1000);
    expect(rows[0].regularDiscount).toBe(100);
    expect(ledgerNetSales(rows[0])).toBe(900);
  });
});

describe("autoDetectColumns POS discounts", () => {
  it("maps Pax Discount Amount columns and Item Discount Type", () => {
    const detected = autoDetectColumns([
      "Category",
      "Item",
      "Quantity",
      "Price Per Unit",
      "Payment Type",
      "Gross Price",
      "Discounted Price",
      "VAT Exemption",
      "Pax Discount Amount - regular",
      "Pax Discount Amount - senior",
      "Pax Discount Amount - pwd",
      "Item Discount Type",
    ]);
    expect(detected.regularDiscount).toBe("Pax Discount Amount - regular");
    expect(detected.seniorDiscount).toBe("Pax Discount Amount - senior");
    expect(detected.pwdDiscount).toBe("Pax Discount Amount - pwd");
    expect(detected.vatExemption).toBe("VAT Exemption");
    expect(detected.itemDiscountType).toBe("Item Discount Type");
    expect(detected.rawItemName).toBe("Item");
  });
});

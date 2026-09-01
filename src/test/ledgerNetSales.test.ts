import { describe, expect, it } from "vitest";
import { ledgerGrossSales, ledgerNetSales, emptyLedgerAmounts } from "@/services/dailyLedgerService";
import { parseDailyLedgerSheetRows } from "@/utils/parseDailyLedgerSheet";
import { autoDetectColumns } from "@/utils/parseCsv";

describe("ledgerGrossSales / ledgerNetSales", () => {
  it("adds tenders plus Regular, Senior, and PWD discounts for GROSS SALES", () => {
    const row = {
      ...emptyLedgerAmounts(),
      cash: 8424,
      maya: 6875,
      grab: 3064,
      paymongo: 6955,
      foodpanda: 230,
      regularDiscount: 291,
      seniorDiscount: 176,
      pwdDiscount: 0,
      vatExemption: 106,
    };
    expect(ledgerGrossSales(row)).toBe(8424 + 6875 + 3064 + 6955 + 230 + 291 + 176);
    expect(ledgerNetSales(row)).toBe(8424 + 6875 + 3064 + 6955 + 230);
  });

  it("does not add VAT exemption into GROSS SALES or Net Sales", () => {
    const row = {
      ...emptyLedgerAmounts(),
      cash: 1000,
      vatExemption: 200,
    };
    expect(ledgerGrossSales(row)).toBe(1000);
    expect(ledgerNetSales(row)).toBe(1000);
  });
});

describe("parseDailyLedgerSheetRows GROSS SALES", () => {
  it("sums tenders plus Regular/Senior/PWD discounts", () => {
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
    expect(rows[0].grossSales).toBe(1100);
    expect(rows[0].regularDiscount).toBe(100);
    expect(ledgerNetSales(rows[0])).toBe(1000);
    expect(ledgerGrossSales(rows[0])).toBe(1100);
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

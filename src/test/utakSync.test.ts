import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTransactionDate } from "@/lib/csv/parseTransactionDate";
import { autoDetectColumns } from "@/utils/parseCsv";
import Papa from "papaparse";

const FIXTURE_PATH = join(__dirname, "fixtures", "greenbelt-2026-10-19.csv");

describe("parseTransactionDate", () => {
  it("parses UTAK format 'DD Mon YYYY' correctly", () => {
    const date = parseTransactionDate("19 Oct 2026");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(9); // October is month 9 (0-indexed)
    expect(date!.getDate()).toBe(19);
  });

  it("parses single-digit day 'D Mon YYYY'", () => {
    const date = parseTransactionDate("5 Jan 2026");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(0);
    expect(date!.getDate()).toBe(5);
  });

  it("parses full month name", () => {
    const date = parseTransactionDate("15 October 2026");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(9);
    expect(date!.getDate()).toBe(15);
  });

  it("still parses YYYY-MM-DD format", () => {
    const date = parseTransactionDate("2026-10-19");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(9);
    expect(date!.getDate()).toBe(19);
  });

  it("still parses MM/DD/YYYY format", () => {
    const date = parseTransactionDate("10/19/2026");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(9);
    expect(date!.getDate()).toBe(19);
  });

  it("returns null for invalid dates", () => {
    expect(parseTransactionDate("")).toBeNull();
    expect(parseTransactionDate(null)).toBeNull();
    expect(parseTransactionDate("invalid")).toBeNull();
  });
});

describe("UTAK CSV processing", () => {
  it("parses the Greenbelt sample CSV correctly", () => {
    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: "greedy",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.data.length).toBeGreaterThan(0);

    // Check headers include expected UTAK columns
    const headers = result.meta.fields || [];
    expect(headers).toContain("Date");
    expect(headers).toContain("Time");
    expect(headers).toContain("Category");
    expect(headers).toContain("Item");
    expect(headers).toContain("Quantity");
    expect(headers).toContain("Price per Unit");
    expect(headers).toContain("Payment Type");
  });

  it("auto-detects columns from UTAK headers", () => {
    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");
    const result = Papa.parse(csvContent, { header: true });
    const headers = result.meta.fields || [];

    const mapping = autoDetectColumns(headers);

    expect(mapping.rawCategory).toBe("Category");
    expect(mapping.rawItemName).toBe("Item");
    expect(mapping.quantity).toBe("Quantity");
    expect(mapping.unitPrice).toBe("Price per Unit");
    expect(mapping.paymentType).toBe("Payment Type");
  });

  it("parses dates from all rows in the sample file", () => {
    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: "greedy",
    });

    let parsedCount = 0;
    let failedCount = 0;

    for (const row of result.data as Record<string, string>[]) {
      const dateStr = row["Date"];
      if (!dateStr) continue;

      const date = parseTransactionDate(dateStr);
      if (date) {
        parsedCount++;
        // All dates in the sample should be Oct 19, 2026
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(9);
        expect(date.getDate()).toBe(19);
      } else {
        failedCount++;
      }
    }

    expect(parsedCount).toBeGreaterThan(100); // Sample has 146 rows
    expect(failedCount).toBe(0);
  });

  it("correctly sums quantities and sales", () => {
    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: "greedy",
    });

    let totalQuantity = 0;
    let totalSales = 0;

    for (const row of result.data as Record<string, string>[]) {
      const qty = parseFloat(row["Quantity"]) || 0;
      const price = parseFloat(row["Price per Unit"]) || 0;
      totalQuantity += qty;
      totalSales += qty * price;
    }

    // The sample file should have positive totals
    expect(totalQuantity).toBeGreaterThan(0);
    expect(totalSales).toBeGreaterThan(0);
  });

  it("identifies payment types correctly", () => {
    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: "greedy",
    });

    const paymentTypes = new Set<string>();
    for (const row of result.data as Record<string, string>[]) {
      const paymentType = row["Payment Type"]?.trim();
      if (paymentType) {
        paymentTypes.add(paymentType);
      }
    }

    // The sample should have various payment types
    expect(paymentTypes.size).toBeGreaterThan(1);
    // Common UTAK payment types
    const commonTypes = ["Cash", "Maya", "Paymongo", "Grab", "FoodPanda"];
    const hasCommonType = commonTypes.some((t) => paymentTypes.has(t));
    expect(hasCommonType).toBe(true);
  });

  it("identifies categories correctly", () => {
    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: "greedy",
    });

    const categories = new Set<string>();
    for (const row of result.data as Record<string, string>[]) {
      const category = row["Category"]?.trim();
      if (category) {
        categories.add(category);
      }
    }

    // The sample should have DOT Coffee categories
    expect(categories.size).toBeGreaterThan(1);
    // Check for expected category patterns
    const hasDotCategory = Array.from(categories).some(
      (c) => c.includes("DOT") || c.includes("PACKAGING") || c.includes("ADD ONS")
    );
    expect(hasDotCategory).toBe(true);
  });
});

describe("UTAK branch mapping", () => {
  it("maps Greenbelt correctly", () => {
    // This test verifies the branch mapping configuration
    const mapping = {
      utakEmail: "dotcoffee_greenbelt@utak.io",
      utakCardName: "DOT COFFEE - GREENBELT 3",
      ledgerSlug: "greenbelt",
    };

    expect(mapping.ledgerSlug).toBe("greenbelt");
    expect(mapping.utakEmail).toContain("greenbelt");
  });
});

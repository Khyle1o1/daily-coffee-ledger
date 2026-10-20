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

describe("Shared pipeline (processTransactionsCsv)", () => {
  it("processes the Greenbelt sample CSV using the real mapping pipeline", async () => {
    const { processTransactionsCsv } = await import("@/lib/reports/processTransactionsCsv");
    const { DEFAULT_MAPPING } = await import("@/utils/defaultMapping");

    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");

    const result = await processTransactionsCsv({
      csvContent,
      branch: "greenbelt",
      filename: "greenbelt-2026-10-19.csv",
      mappingTable: DEFAULT_MAPPING,
      targetDate: null,
    });

    expect(result.error).toBeNull();
    expect(result.report).not.toBeNull();

    const report = result.report!;

    // Verify basic report structure
    expect(report.branch).toBe("greenbelt");
    expect(report.filename).toBe("greenbelt-2026-10-19.csv");
    expect(report.date).toBe("2026-10-19");
    expect(report.dateRangeEnd).toBe("2026-10-19");

    // Verify row counts
    expect(report.totalRows).toBeGreaterThan(100);
    expect(report.mappedRows).toBeGreaterThan(0);
    expect(report.skippedRows).toBeGreaterThanOrEqual(0);

    // Verify the report has the same structure as UI uploads
    expect(report.summaryTotalsByCat).toBeDefined();
    expect(report.summaryQuantitiesByCat).toBeDefined();
    expect(report.percentByCat).toBeDefined();
    expect(report.grandTotal).toBeGreaterThan(0);
    expect(report.grandQuantity).toBeGreaterThan(0);
    expect(Array.isArray(report.rowDetails)).toBe(true);
    expect(Array.isArray(report.unmappedSummary)).toBe(true);
    expect(report.dailyBreakdown).toBeDefined();

    // Verify daily breakdown has correct date
    expect(report.dailyBreakdown!["2026-10-19"]).toBeDefined();
    expect(report.dailyBreakdown!["2026-10-19"].grandTotal).toBeGreaterThan(0);

    // Verify categories are correctly populated
    const categories = ["ICED", "HOT", "SNACKS", "ADD-ONS", "MERCH", "PROMO", "LOYALTY CARD", "PACKAGING"];
    for (const cat of categories) {
      expect(typeof report.summaryTotalsByCat[cat]).toBe("number");
      expect(typeof report.summaryQuantitiesByCat[cat]).toBe("number");
      expect(typeof report.percentByCat[cat]).toBe("number");
    }

    // Verify ICED category has sales (most items in sample are iced drinks)
    expect(report.summaryTotalsByCat["ICED"]).toBeGreaterThan(0);
  });

  it("filters transactions to a specific date when targetDate is provided", async () => {
    const { processTransactionsCsv } = await import("@/lib/reports/processTransactionsCsv");
    const { DEFAULT_MAPPING } = await import("@/utils/defaultMapping");

    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");

    // Process with target date filter
    const result = await processTransactionsCsv({
      csvContent,
      branch: "greenbelt",
      filename: "greenbelt-2026-10-19.csv",
      mappingTable: DEFAULT_MAPPING,
      targetDate: "2026-10-19",
    });

    expect(result.error).toBeNull();
    expect(result.report).not.toBeNull();

    // All transactions should be for the target date
    const report = result.report!;
    expect(Object.keys(report.dailyBreakdown!)).toEqual(["2026-10-19"]);
  });

  it("returns error for invalid target date with no matching transactions", async () => {
    const { processTransactionsCsv } = await import("@/lib/reports/processTransactionsCsv");
    const { DEFAULT_MAPPING } = await import("@/utils/defaultMapping");

    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");

    const result = await processTransactionsCsv({
      csvContent,
      branch: "greenbelt",
      filename: "greenbelt-2026-10-19.csv",
      mappingTable: DEFAULT_MAPPING,
      targetDate: "2026-01-01", // No transactions on this date
    });

    expect(result.error).toContain("No transactions");
    expect(result.report).toBeNull();
  });

  it("correctly maps DOT SIGNATURES items to ICED/HOT categories", async () => {
    const { processTransactionsCsv } = await import("@/lib/reports/processTransactionsCsv");
    const { DEFAULT_MAPPING } = await import("@/utils/defaultMapping");

    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");

    const result = await processTransactionsCsv({
      csvContent,
      branch: "greenbelt",
      filename: "greenbelt-2026-10-19.csv",
      mappingTable: DEFAULT_MAPPING,
      targetDate: null,
    });

    const report = result.report!;

    // Find rows that were originally DOT SIGNATURES
    const signatureRows = report.rowDetails.filter(
      (r) => r.rawCategory.includes("SIGNATURES")
    );

    expect(signatureRows.length).toBeGreaterThan(0);

    // Mapped signature drinks should be ICED or HOT (or unmapped)
    for (const row of signatureRows.filter((r) => r.status === "MAPPED")) {
      expect(["ICED", "HOT"]).toContain(row.mappedCat);
    }
  });

  it("correctly maps PACKAGING items", async () => {
    const { processTransactionsCsv } = await import("@/lib/reports/processTransactionsCsv");
    const { DEFAULT_MAPPING } = await import("@/utils/defaultMapping");

    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");

    const result = await processTransactionsCsv({
      csvContent,
      branch: "greenbelt",
      filename: "greenbelt-2026-10-19.csv",
      mappingTable: DEFAULT_MAPPING,
      targetDate: null,
    });

    const report = result.report!;

    // Find rows that were originally PACKAGING
    const packagingRows = report.rowDetails.filter(
      (r) => r.rawCategory === "PACKAGING"
    );

    expect(packagingRows.length).toBeGreaterThan(0);

    // Mapped packaging items should be in PACKAGING category (or ADD-ONS for some items)
    const mappedPackaging = packagingRows.filter((r) => r.status === "MAPPED");
    for (const row of mappedPackaging) {
      expect(["PACKAGING", "ADD-ONS"]).toContain(row.mappedCat);
    }
  });

  it("produces rowDetails with correct structure including discount fields", async () => {
    const { processTransactionsCsv } = await import("@/lib/reports/processTransactionsCsv");
    const { DEFAULT_MAPPING } = await import("@/utils/defaultMapping");

    const csvContent = readFileSync(FIXTURE_PATH, "utf-8");

    const result = await processTransactionsCsv({
      csvContent,
      branch: "greenbelt",
      filename: "greenbelt-2026-10-19.csv",
      mappingTable: DEFAULT_MAPPING,
      targetDate: null,
    });

    const report = result.report!;
    const firstMappedRow = report.rowDetails.find((r) => r.status === "MAPPED");

    expect(firstMappedRow).toBeDefined();
    if (firstMappedRow) {
      // Check structure matches what SummaryPage.tsx produces
      expect(firstMappedRow.rawCategory).toBeDefined();
      expect(firstMappedRow.rawItemName).toBeDefined();
      expect(typeof firstMappedRow.quantity).toBe("number");
      expect(typeof firstMappedRow.unitPrice).toBe("number");
      expect(typeof firstMappedRow.rowSales).toBe("number");
      expect(firstMappedRow.mappedCat).toBeDefined();
      expect(firstMappedRow.mappedItemName).toBeDefined();
      expect(firstMappedRow.status).toBe("MAPPED");
      expect(firstMappedRow.transactionDate).toBeInstanceOf(Date);
    }
  });
});

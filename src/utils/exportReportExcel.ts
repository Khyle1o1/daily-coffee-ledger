// Excel export utility — uses SheetJS (xlsx)
import * as XLSX from "xlsx";
import type { ReportCanvasData } from "@/components/reports/ReportCanvas";
import type {
  ComputedSalesMix,
  ComputedProductMix,
  ComputedProductMixByCategory,
  ComputedTop5,
  ComputedCategoryPerformance,
} from "@/lib/reports/compute";
import type { ProductMixChannelData } from "@/lib/reports/computeProductMixChannel";
import type { PourReportData } from "@/lib/reports/computePourItForward";

// ── Style constants ─────────────────────────────────────────────────────────
const S_HEADER = {
  fill: { patternType: "solid", fgColor: { rgb: "1E3A5F" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
  alignment: { horizontal: "center", vertical: "center" },
};

const S_HEADER_LEFT = {
  ...S_HEADER,
  alignment: { horizontal: "left", vertical: "center" },
};

const S_FOOTER = {
  fill: { patternType: "solid", fgColor: { rgb: "1E3A5F" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
  alignment: { horizontal: "right", vertical: "center" },
};

const S_FOOTER_LEFT = { ...S_FOOTER, alignment: { horizontal: "left", vertical: "center" } };

const S_ACCENT = {
  fill: { patternType: "solid", fgColor: { rgb: "C05A1F" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
  alignment: { horizontal: "left" },
};

const S_TITLE = {
  font: { bold: true, color: { rgb: "1E3A5F" }, sz: 14 },
};

const S_SECTION = {
  font: { bold: true, color: { rgb: "1E3A5F" }, sz: 10 },
};

const S_ALT = {
  fill: { patternType: "solid", fgColor: { rgb: "F7F9FC" } },
};

const S_NUM = { alignment: { horizontal: "right" } };
const S_NUM_BOLD = { font: { bold: true }, alignment: { horizontal: "right" } };
const S_PCT = { alignment: { horizontal: "right" } };

// ── Cell helpers ────────────────────────────────────────────────────────────
function c(v: string | number, s?: object): XLSX.CellObject {
  return { v, t: typeof v === "number" ? "n" : "s", s } as XLSX.CellObject;
}

function blank(): XLSX.CellObject {
  return { v: "", t: "s" };
}

function pct(n: number | undefined): string {
  if (n === undefined) return "";
  return `${n >= 0 ? "+" : ""}${n}%`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-PH");
}

function fmtPHP(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Sheet builder helper ────────────────────────────────────────────────────
/**
 * Build a worksheet from a 2D array of cell objects, with optional column widths.
 */
function buildSheet(
  rows: XLSX.CellObject[][],
  colWidths?: number[],
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const range = { s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 0 } };

  for (let r = 0; r < rows.length; r++) {
    for (let col = 0; col < rows[r].length; col++) {
      if (col > range.e.c) range.e.c = col;
      const ref = XLSX.utils.encode_cell({ r, c: col });
      ws[ref] = rows[r][col];
    }
  }

  range.e.r = rows.length - 1;
  ws["!ref"] = XLSX.utils.encode_range(range);

  if (colWidths) {
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  }

  return ws;
}

/** Write a meta info block (brand label + date range) and return the rows */
function metaRows(branchLabel: string, dateRangeLabel: string): XLSX.CellObject[][] {
  return [
    [c("HQ Weekly Sync", S_ACCENT)],
    [c(`Branch: ${branchLabel}`, S_SECTION)],
    [c(`Period: ${dateRangeLabel}`, S_SECTION)],
    [blank()],
  ];
}

// ── Per-report sheet builders ───────────────────────────────────────────────

function buildSalesMixSheet(
  data: ComputedSalesMix,
  branchLabel: string,
  dateRangeLabel: string,
  compareLabel: string | undefined,
): XLSX.WorkSheet {
  const hasCompare = data.categoryTotals.some((c) => c.compareSales !== undefined);

  const rows: XLSX.CellObject[][] = [
    ...metaRows(branchLabel, dateRangeLabel),
    [c(`Gross Sales: ${fmtPHP(data.grandTotal)}`, S_TITLE)],
    [blank()],
  ];

  // Header
  const head = hasCompare
    ? [c("Category", S_HEADER_LEFT), c("Sales", S_HEADER), c("% Mix", S_HEADER), c(compareLabel ?? "Compare", S_HEADER), c("Change", S_HEADER)]
    : [c("Category", S_HEADER_LEFT), c("Sales", S_HEADER), c("% Mix", S_HEADER)];
  rows.push(head);

  // Data rows
  data.categoryTotals.forEach((row, i) => {
    const s = i % 2 === 1 ? S_ALT : undefined;
    const base = [c(row.category, s ? { ...S_HEADER_LEFT, ...s, font: undefined } : undefined), c(fmtPHP(row.sales), { ...S_NUM, ...s }), c(`${row.percent.toFixed(1)}%`, { ...S_PCT, ...s })];
    if (hasCompare) {
      base.push(c(row.compareSales !== undefined ? fmtPHP(row.compareSales) : "—", { ...S_NUM, ...s }));
      base.push(c(row.pctChange !== undefined ? pct(row.pctChange) : "—", { ...S_NUM, ...s }));
    }
    rows.push(base);
  });

  // Footer
  const foot = hasCompare
    ? [c("TOTAL", S_FOOTER_LEFT), c(fmtPHP(data.grandTotal), S_FOOTER), c("100%", S_FOOTER), c(data.compareGrandTotal !== undefined ? fmtPHP(data.compareGrandTotal) : "—", S_FOOTER), c("", S_FOOTER)]
    : [c("TOTAL", S_FOOTER_LEFT), c(fmtPHP(data.grandTotal), S_FOOTER), c("100%", S_FOOTER)];
  rows.push(foot);

  // Top 5 by channel
  const channels = [
    { key: "WALK_IN" as const, label: "Walk-in" },
    { key: "GRAB" as const, label: "Grab" },
    { key: "FOODPANDA" as const, label: "FoodPanda" },
  ];

  rows.push([blank()], [c("Top 5 Items by Channel", S_TITLE)]);

  for (const ch of channels) {
    const chData = data.top5ByChannel?.[ch.key];
    const items = chData?.items ?? [];
    rows.push([blank()], [c(ch.label, S_SECTION)]);
    rows.push([c("#", S_HEADER), c("Item", S_HEADER_LEFT), c("Qty", S_HEADER), c("Sales", S_HEADER)]);

    if (!items.length) {
      rows.push([c(""), c("No data for this channel.", { font: { color: { rgb: "94A3B8" } } })]);
      continue;
    }
    items.forEach((item, idx) => {
      rows.push([c(idx + 1), c(item.name), c(item.qty, S_NUM), c(fmtPHP(item.sales), S_NUM)]);
    });
    if (chData?.totals) {
      rows.push([c(""), c("Total", S_FOOTER_LEFT), c(chData.totals.totalQty, { ...S_NUM_BOLD }), c(fmtPHP(chData.totals.totalSales), { ...S_NUM_BOLD })]);
    }
  }

  return buildSheet(rows, [32, 18, 10, 18, 10]);
}

function buildProductMixSheet(
  data: ComputedProductMix,
  branchLabel: string,
  dateRangeLabel: string,
  compareLabel: string | undefined,
): XLSX.WorkSheet {
  const hasCompare = data.products.some((p) => p.compareSales !== undefined);
  const catLabel = data.category ?? "ALL";

  const rows: XLSX.CellObject[][] = [
    ...metaRows(branchLabel, dateRangeLabel),
    [c(`Product Mix — ${catLabel}   Total: ${fmtPHP(data.totalSales)}`, S_TITLE)],
    [blank()],
  ];

  const head = hasCompare
    ? [c("#", S_HEADER), c("Menu Item", S_HEADER_LEFT), c(dateRangeLabel, S_HEADER), c(compareLabel ?? "Compare", S_HEADER), c("Change", S_HEADER)]
    : [c("#", S_HEADER), c("Menu Item", S_HEADER_LEFT), c("Qty", S_HEADER), c("Sales", S_HEADER)];
  rows.push(head);

  data.products.forEach((row, idx) => {
    const s = idx % 2 === 1 ? S_ALT : undefined;
    const base = [c(String(idx + 1).padStart(2, "0"), s), c(row.name, s)];
    if (hasCompare) {
      base.push(c(fmtPHP(row.sales), { ...S_NUM, ...s }));
      base.push(c(row.compareSales !== undefined ? fmtPHP(row.compareSales) : "—", { ...S_NUM, ...s }));
      base.push(c(row.pctChange !== undefined ? pct(row.pctChange) : "—", { ...S_NUM, ...s }));
    } else {
      base.push(c(row.qty, { ...S_NUM, ...s }));
      base.push(c(fmtPHP(row.sales), { ...S_NUM, ...s }));
    }
    rows.push(base);
  });

  return buildSheet(rows, [6, 36, 16, 16, 10]);
}

function buildProductMixByCategorySheet(
  data: ComputedProductMixByCategory,
  branchLabel: string,
  dateRangeLabel: string,
  compareLabel: string | undefined,
): XLSX.WorkSheet {
  const hasCompare = data.groups.some((g) =>
    g.products.some((p) => p.compareSales !== undefined),
  );

  const rows: XLSX.CellObject[][] = [
    ...metaRows(branchLabel, dateRangeLabel),
    [c(`Product Mix — Ranked per Category   Total: ${fmtPHP(data.grandTotalSales)}`, S_TITLE)],
    [blank()],
  ];

  for (const group of data.groups) {
    const catLabel = group.category ?? "ALL";
    rows.push([c(`CATEGORY — ${catLabel}   Total: ${fmtPHP(group.totalSales)}`, S_SECTION)], [blank()]);

    const head = hasCompare
      ? [
          c("#", S_HEADER),
          c("Menu Item", S_HEADER_LEFT),
          c(dateRangeLabel, S_HEADER),
          c(compareLabel ?? "Compare", S_HEADER),
          c("Change", S_HEADER),
        ]
      : [c("#", S_HEADER), c("Menu Item", S_HEADER_LEFT), c("Qty", S_HEADER), c("Sales", S_HEADER)];
    rows.push(head);

    group.products.forEach((row, idx) => {
      const s = idx % 2 === 1 ? S_ALT : undefined;
      const base = [c(String(idx + 1).padStart(2, "0"), s), c(row.name, s)];
      if (hasCompare) {
        base.push(c(fmtPHP(row.sales), { ...S_NUM, ...s }));
        base.push(c(row.compareSales !== undefined ? fmtPHP(row.compareSales) : "—", { ...S_NUM, ...s }));
        base.push(c(row.pctChange !== undefined ? pct(row.pctChange) : "—", { ...S_NUM, ...s }));
      } else {
        base.push(c(row.qty, { ...S_NUM, ...s }));
        base.push(c(fmtPHP(row.sales), { ...S_NUM, ...s }));
      }
      rows.push(base);
    });

    rows.push([blank()]);
  }

  if (data.excludedCategories?.length) {
    rows.push([c(`Excluded (no data): ${data.excludedCategories.join(", ")}`, { font: { color: { rgb: "64748B" } } })]);
  }

  return buildSheet(rows, [6, 36, 16, 16, 10]);
}

function buildTop5Sheet(
  data: ComputedTop5,
  selectedCategories: string[],
  branchLabel: string,
  dateRangeLabel: string,
): XLSX.WorkSheet {
  const rows: XLSX.CellObject[][] = [
    ...metaRows(branchLabel, dateRangeLabel),
    [c("Top 5 Products", S_TITLE)],
    [blank()],
  ];

  const cats = selectedCategories.length > 0
    ? selectedCategories.filter((cat) => data.topByCategory[cat]?.length)
    : Object.keys(data.topByCategory);

  for (const cat of cats) {
    const items = data.topByCategory[cat] ?? [];
    if (!items.length) continue;
    rows.push([c(`TOP 5 — ${cat}`, S_SECTION)], [blank()]);
    rows.push([c("#", S_HEADER), c("Item", S_HEADER_LEFT), c("Qty", S_HEADER), c("Sales", S_HEADER)]);
    items.forEach((item) => {
      rows.push([c(String(item.rank).padStart(2, "0")), c(item.name), c(item.qty, S_NUM), c(fmtPHP(item.sales), S_NUM)]);
    });
    rows.push([blank()]);
  }

  return buildSheet(rows, [6, 36, 12, 16]);
}

function buildRunningSalesMixSheet(
  data: ComputedProductMix,
  category: string,
  branchLabel: string,
  dateRangeLabel: string,
  compareLabel: string | undefined,
): XLSX.WorkSheet {
  const hasCompare = data.products.some((p) => p.compareSales !== undefined);

  const rows: XLSX.CellObject[][] = [
    ...metaRows(branchLabel, dateRangeLabel),
    [c(`Running Sales Mix — ${category}`, S_TITLE)],
    [blank()],
    [c(`TOP 5 ${category} — YTD as of ${dateRangeLabel}`, S_SECTION)],
    [blank()],
  ];

  const head = hasCompare
    ? [c("#", S_HEADER), c("Item", S_HEADER_LEFT), c("Qty", S_HEADER), c(compareLabel ?? "Compare Qty", S_HEADER), c("Change", S_HEADER)]
    : [c("#", S_HEADER), c("Item", S_HEADER_LEFT), c("Qty", S_HEADER)];
  rows.push(head);

  const top5 = data.products.slice(0, 5);
  top5.forEach((item, idx) => {
    const base = [c(String(idx + 1).padStart(2, "0")), c(item.name), c(item.qty, S_NUM)];
    if (hasCompare) {
      base.push(c(item.compareQty !== undefined ? item.compareQty : "—", S_NUM));
      base.push(c(item.pctChange !== undefined ? pct(item.pctChange) : "—", S_NUM));
    }
    rows.push(base);
  });

  if (data.products.length > 5) {
    rows.push([blank()], [c(`Full ${category} Breakdown`, S_SECTION)], [blank()]);
    rows.push(head);
    data.products.slice(5).forEach((item, idx) => {
      const base = [c(String(idx + 6)), c(item.name), c(item.qty, S_NUM)];
      if (hasCompare) {
        base.push(c(item.compareQty !== undefined ? item.compareQty : "—", S_NUM));
        base.push(c(item.pctChange !== undefined ? pct(item.pctChange) : "—", S_NUM));
      }
      rows.push(base);
    });
  }

  return buildSheet(rows, [6, 36, 12, 14, 10]);
}

function buildCategoryPerformanceSheet(
  data: ComputedCategoryPerformance,
  branchLabel: string,
  dateRangeLabel: string,
  compareLabel: string | undefined,
): XLSX.WorkSheet {
  const hasCompare = data.categories.some((c) => c.compareSales !== undefined);

  const rows: XLSX.CellObject[][] = [
    ...metaRows(branchLabel, dateRangeLabel),
    [c(`Category Performance   Gross Sales: ${fmtPHP(data.grandTotal)}`, S_TITLE)],
    [blank()],
  ];

  const head = hasCompare
    ? [c("Rank", S_HEADER), c("Category", S_HEADER_LEFT), c("Sales", S_HEADER), c("% of Total", S_HEADER), c(compareLabel ?? "Compare", S_HEADER), c("Change", S_HEADER)]
    : [c("Rank", S_HEADER), c("Category", S_HEADER_LEFT), c("Sales", S_HEADER), c("% of Total", S_HEADER)];
  rows.push(head);

  data.categories.forEach((row, idx) => {
    const s = idx % 2 === 1 ? S_ALT : undefined;
    const base = [c(idx + 1, s), c(row.category, s), c(fmtPHP(row.sales), { ...S_NUM, ...s }), c(`${row.percent.toFixed(1)}%`, { ...S_PCT, ...s })];
    if (hasCompare) {
      base.push(c(row.compareSales !== undefined ? fmtPHP(row.compareSales) : "—", { ...S_NUM, ...s }));
      base.push(c(row.pctChange !== undefined ? pct(row.pctChange) : "—", { ...S_NUM, ...s }));
    }
    rows.push(base);
  });

  const foot = hasCompare
    ? [c("", S_FOOTER), c("TOTAL", S_FOOTER_LEFT), c(fmtPHP(data.grandTotal), S_FOOTER), c("100%", S_FOOTER), c("", S_FOOTER), c("", S_FOOTER)]
    : [c("", S_FOOTER), c("TOTAL", S_FOOTER_LEFT), c(fmtPHP(data.grandTotal), S_FOOTER), c("100%", S_FOOTER)];
  rows.push(foot);

  return buildSheet(rows, [8, 24, 18, 12, 18, 10]);
}

function buildProductMixChannelSheets(
  data: ProductMixChannelData,
  branchLabel: string,
): [XLSX.WorkSheet, XLSX.WorkSheet] {
  const meta: XLSX.CellObject[][] = [
    [c("HQ Weekly Sync", S_ACCENT)],
    [c(`Branch: ${branchLabel}`, S_SECTION)],
    [c(`Period: ${data.periodLabel}`, S_SECTION)],
    [c(`Category: ${data.category}`, S_SECTION)],
    [blank()],
  ];

  const t = data.totals;

  // Quantities sheet
  const qtyRows: XLSX.CellObject[][] = [
    ...meta,
    [c("Product Mix — Quantities", S_TITLE)],
    [blank()],
    [c("#", S_HEADER), c("Menu Item", S_HEADER_LEFT), c("Total Qty", S_HEADER), c("Walk-in", S_HEADER), c("Grab", S_HEADER), c("FoodPanda", S_HEADER)],
  ];
  data.rows.forEach((row, idx) => {
    const s = idx % 2 === 1 ? S_ALT : undefined;
    qtyRows.push([c(String(idx + 1).padStart(2, "0"), s), c(row.name, s), c(row.totalQty, { ...S_NUM, ...s }), c(row.walkInQty, { ...S_NUM, ...s }), c(row.grabQty, { ...S_NUM, ...s }), c(row.foodpandaQty, { ...S_NUM, ...s })]);
  });
  qtyRows.push([c("", S_FOOTER), c("TOTAL", S_FOOTER_LEFT), c(fmt(t.totalQty), S_FOOTER), c(fmt(t.walkInQty), S_FOOTER), c(fmt(t.grabQty), S_FOOTER), c(fmt(t.foodpandaQty), S_FOOTER)]);

  // Sales sheet
  const salesRows: XLSX.CellObject[][] = [
    ...meta,
    [c("Product Mix — Sales", S_TITLE)],
    [blank()],
    [c("#", S_HEADER), c("Menu Item", S_HEADER_LEFT), c("Total Sales", S_HEADER), c("Walk-in", S_HEADER), c("Grab", S_HEADER), c("FoodPanda", S_HEADER)],
  ];
  data.rows.forEach((row, idx) => {
    const s = idx % 2 === 1 ? S_ALT : undefined;
    salesRows.push([c(String(idx + 1).padStart(2, "0"), s), c(row.name, s), c(fmtPHP(row.totalSales), { ...S_NUM, ...s }), c(fmtPHP(row.walkInSales), { ...S_NUM, ...s }), c(fmtPHP(row.grabSales), { ...S_NUM, ...s }), c(fmtPHP(row.foodpandaSales), { ...S_NUM, ...s })]);
  });
  salesRows.push([c("", S_FOOTER), c("TOTAL", S_FOOTER_LEFT), c(fmtPHP(t.totalSales), S_FOOTER), c(fmtPHP(t.walkInSales), S_FOOTER), c(fmtPHP(t.grabSales), S_FOOTER), c(fmtPHP(t.foodpandaSales), S_FOOTER)]);

  const colW = [6, 36, 14, 14, 12, 14];
  return [buildSheet(qtyRows, colW), buildSheet(salesRows, colW)];
}

function buildPourItForwardSheets(
  data: PourReportData,
  branchLabel: string,
  dateRangeLabel: string,
): XLSX.WorkSheet[] {
  const { rows, totals, dailyBreakdown, itemBreakdown } = data;

  const meta: XLSX.CellObject[][] = [
    [c("HQ Weekly Sync", S_ACCENT)],
    [c(`Branch: ${branchLabel}`, S_SECTION)],
    [c(`Period: ${dateRangeLabel}`, S_SECTION)],
    [blank()],
    [c(data.title, S_TITLE)],
    [blank()],
  ];

  // ── Summary sheet ────────────────────────────────────────────────────────
  const summaryRows: XLSX.CellObject[][] = [
    ...meta,
    [c("Branch", S_HEADER_LEFT), c("Foodpanda", S_HEADER), c("Grab", S_HEADER), c("Walk-in", S_HEADER), c("Grand Total", S_HEADER)],
  ];
  rows.forEach((row, i) => {
    const s = i % 2 === 1 ? S_ALT : undefined;
    summaryRows.push([c(row.branchName, s), c(row.foodpandaQty, { ...S_NUM, ...s }), c(row.grabQty, { ...S_NUM, ...s }), c(row.walkinQty, { ...S_NUM, ...s }), c(row.grandTotal, { ...S_NUM_BOLD, ...s })]);
  });
  summaryRows.push([c("Grand Total", S_FOOTER_LEFT), c(fmt(totals.foodpandaQty), S_FOOTER), c(fmt(totals.grabQty), S_FOOTER), c(fmt(totals.walkinQty), S_FOOTER), c(fmt(totals.grandTotal), S_FOOTER)]);

  const sheets: XLSX.WorkSheet[] = [buildSheet(summaryRows, [30, 14, 12, 14, 16])];

  // ── Day-by-Day sheet (single branch only) ───────────────────────────────
  if (dailyBreakdown && dailyBreakdown.length > 0) {
    const dayRows: XLSX.CellObject[][] = [
      ...meta,
      [c("Day-by-Day Breakdown", S_TITLE)],
      [blank()],
      [c("Date", S_HEADER_LEFT), c("Foodpanda", S_HEADER), c("Grab", S_HEADER), c("Walk-in", S_HEADER), c("Day Total", S_HEADER)],
    ];
    dailyBreakdown.forEach((row, i) => {
      const s = i % 2 === 1 ? S_ALT : undefined;
      dayRows.push([c(row.date, s), c(row.foodpandaQty, { ...S_NUM, ...s }), c(row.grabQty, { ...S_NUM, ...s }), c(row.walkinQty, { ...S_NUM, ...s }), c(row.grandTotal, { ...S_NUM_BOLD, ...s })]);
    });
    dayRows.push([c("Total", S_FOOTER_LEFT), c(fmt(totals.foodpandaQty), S_FOOTER), c(fmt(totals.grabQty), S_FOOTER), c(fmt(totals.walkinQty), S_FOOTER), c(fmt(totals.grandTotal), S_FOOTER)]);
    sheets.push(buildSheet(dayRows, [14, 14, 12, 14, 14]));
  }

  // ── Items sheet (single branch only) ────────────────────────────────────
  if (itemBreakdown && itemBreakdown.length > 0) {
    const itemRows: XLSX.CellObject[][] = [
      ...meta,
      [c("Cups by Item", S_TITLE)],
      [blank()],
      [c("Item", S_HEADER_LEFT), c("Foodpanda", S_HEADER), c("Grab", S_HEADER), c("Walk-in", S_HEADER), c("Total", S_HEADER)],
    ];
    itemBreakdown.forEach((row, i) => {
      const s = i % 2 === 1 ? S_ALT : undefined;
      itemRows.push([c(row.itemName, s), c(row.foodpandaQty, { ...S_NUM, ...s }), c(row.grabQty, { ...S_NUM, ...s }), c(row.walkinQty, { ...S_NUM, ...s }), c(row.grandTotal, { ...S_NUM_BOLD, ...s })]);
    });
    itemRows.push([c("Total", S_FOOTER_LEFT), c(fmt(totals.foodpandaQty), S_FOOTER), c(fmt(totals.grabQty), S_FOOTER), c(fmt(totals.walkinQty), S_FOOTER), c(fmt(totals.grandTotal), S_FOOTER)]);
    sheets.push(buildSheet(itemRows, [30, 14, 12, 14, 14]));
  }

  return sheets;
}

// ── Public export function ──────────────────────────────────────────────────

export function exportReportExcel(
  canvasData: ReportCanvasData,
  filename: string,
): void {
  const {
    reportType,
    branchLabel,
    dateRangeLabel,
    compareLabel,
    salesMix,
    productMix,
    productMixByCategory,
    productMixChannel,
    top5,
    runningSalesMixCategory,
    runningSalesCategory,
    categoryPerformance,
    selectedCategories,
    pourItForward,
  } = canvasData;

  const wb = XLSX.utils.book_new();

  if (reportType === "SALES_MIX_OVERVIEW" && salesMix) {
    XLSX.utils.book_append_sheet(wb, buildSalesMixSheet(salesMix, branchLabel, dateRangeLabel, compareLabel), "Sales Mix");
  }
  else if (reportType === "PRODUCT_MIX" && productMixByCategory) {
    XLSX.utils.book_append_sheet(
      wb,
      buildProductMixByCategorySheet(productMixByCategory, branchLabel, dateRangeLabel, compareLabel),
      "Product Mix (By Cat)"
    );
  }
  else if (reportType === "PRODUCT_MIX" && productMix) {
    XLSX.utils.book_append_sheet(wb, buildProductMixSheet(productMix, branchLabel, dateRangeLabel, compareLabel), "Product Mix");
  }
  else if (reportType === "TOP_5_PRODUCTS" && top5) {
    XLSX.utils.book_append_sheet(wb, buildTop5Sheet(top5, selectedCategories as string[], branchLabel, dateRangeLabel), "Top 5 Products");
  }
  else if (reportType === "RUNNING_SALES_MIX_CATEGORY" && runningSalesMixCategory && runningSalesCategory) {
    XLSX.utils.book_append_sheet(wb, buildRunningSalesMixSheet(runningSalesMixCategory, runningSalesCategory, branchLabel, dateRangeLabel, compareLabel), `Running ${runningSalesCategory}`);
  }
  else if (reportType === "CATEGORY_PERFORMANCE" && categoryPerformance) {
    XLSX.utils.book_append_sheet(wb, buildCategoryPerformanceSheet(categoryPerformance, branchLabel, dateRangeLabel, compareLabel), "Category Performance");
  }
  else if (reportType === "PRODUCT_MIX_CHANNEL" && productMixChannel) {
    const [qtySheet, salesSheet] = buildProductMixChannelSheets(productMixChannel, branchLabel);
    XLSX.utils.book_append_sheet(wb, qtySheet, "Quantities");
    XLSX.utils.book_append_sheet(wb, salesSheet, "Sales");
  }
  else if (reportType === "POUR_IT_FORWARD" && pourItForward) {
    const sheets = buildPourItForwardSheets(pourItForward, branchLabel, dateRangeLabel);
    const names = ["Summary", "By Day", "By Item"];
    sheets.forEach((sheet, i) => XLSX.utils.book_append_sheet(wb, sheet, names[i]));
  }

  if (wb.SheetNames.length === 0) {
    console.warn("[exportReportExcel] No sheet was generated for reportType:", reportType);
    return;
  }

  XLSX.writeFile(wb, filename, { cellStyles: true });
}

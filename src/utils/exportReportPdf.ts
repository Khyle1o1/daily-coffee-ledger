import jsPDF from "jspdf";
import "jspdf-autotable";
import type { ReportCanvasData } from "@/components/reports/ReportCanvas";
import { formatPHP } from "@/utils/format";

function pct(n: number | undefined) {
  if (n === undefined) return "";
  return `${n >= 0 ? "+" : ""}${n}%`;
}

const HEADER_COLOR: [number, number, number] = [30, 58, 95];
const ALT_ROW_COLOR: [number, number, number] = [245, 249, 252];
const ACCENT_COLOR: [number, number, number] = [192, 90, 31];

function drawHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  dateRange: string,
  marginLeft: number
) {
  let y = 50;

  // Orange "HQ Weekly Sync" label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ACCENT_COLOR);
  doc.text("HQ Weekly Sync", marginLeft, y);

  // Title
  y += 18;
  doc.setFontSize(18);
  doc.setTextColor(...HEADER_COLOR);
  doc.text(title, marginLeft, y);

  // Subtitle / branch
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${subtitle}   •   ${dateRange}`, marginLeft, y);

  // Divider
  y += 8;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, doc.internal.pageSize.getWidth() - marginLeft, y);

  return y + 12;
}

export async function exportReportPdf(
  canvasData: ReportCanvasData,
  filename: string
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginLeft = 48;
  const pageWidth = doc.internal.pageSize.getWidth();

  const {
    reportType,
    branchLabel,
    dateRangeLabel,
    compareLabel,
    salesMix,
    productMix,
    top5,
    runningSalesMixCategory,
    runningSalesCategory,
    categoryPerformance,
    selectedCategories,
    productMixChannel,
  } = canvasData;

  if (reportType === "SALES_MIX_OVERVIEW" && salesMix) {
    const title = `PRODUCT MIX for ${dateRangeLabel}`;
    let y = drawHeader(doc, title, branchLabel, dateRangeLabel, marginLeft);

    // Gross Sales
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...HEADER_COLOR);
    doc.text(`Gross Sales: ${formatPHP(salesMix.grandTotal)}`, marginLeft, y);
    y += 20;

    const hasCompare = salesMix.categoryTotals.some((c) => c.compareSales !== undefined);
    const head: string[][] = hasCompare
      ? [["Category", "Sales", "% Mix", compareLabel ?? "Compare", "Change"]]
      : [["Category", "Sales", "% Mix"]];

    const body = salesMix.categoryTotals.map((row) => {
      const base = [row.category, formatPHP(row.sales), `${row.percent.toFixed(1)}%`];
      if (hasCompare) {
        base.push(
          row.compareSales !== undefined ? formatPHP(row.compareSales) : "—",
          row.pctChange !== undefined ? pct(row.pctChange) : "—"
        );
      }
      return base;
    });

    // @ts-ignore
    doc.autoTable({
      startY: y,
      head,
      body,
      foot: [hasCompare
        ? ["TOTAL", formatPHP(salesMix.grandTotal), "100%",
           salesMix.compareGrandTotal !== undefined ? formatPHP(salesMix.compareGrandTotal) : "—", ""]
        : ["TOTAL", formatPHP(salesMix.grandTotal), "100%"]],
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW_COLOR },
      margin: { left: marginLeft, right: marginLeft },
    });

    y = (doc as any).lastAutoTable?.finalY ?? y;

    // Top 5 per channel section
    const channels: { key: "WALK_IN" | "GRAB" | "FOODPANDA"; label: string }[] = [
      { key: "WALK_IN", label: "Walk-in" },
      { key: "GRAB", label: "Grab" },
      { key: "FOODPANDA", label: "FoodPanda" },
    ];

    y += 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...HEADER_COLOR);
    doc.text("Top 5 items per channel", marginLeft, y);
    y += 10;

    for (const channel of channels) {
      const channelData = salesMix.top5ByChannel?.[channel.key];
      const items = channelData?.items ?? [];

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(channel.label, marginLeft, y);
      y += 6;

      if (!items.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text("No data for this channel in the selected filters.", marginLeft, y);
        y += 18;
        continue;
      }

      // @ts-ignore
      doc.autoTable({
        startY: y,
        head: [["#", "Item", "Qty", "Sales"]],
        body: [
          ...items.map((item, idx) => [
            String(idx + 1),
            item.name,
            item.qty.toLocaleString("en-PH"),
            formatPHP(item.sales),
          ]),
          channelData?.totals
            ? [
                "",
                "Total",
                channelData.totals.totalQty.toLocaleString("en-PH"),
                formatPHP(channelData.totals.totalSales),
              ]
            : [],
        ],
        styles: { font: "helvetica", fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: ALT_ROW_COLOR },
        margin: { left: marginLeft, right: marginLeft },
      });
      y = (doc as any).lastAutoTable?.finalY ?? y;
      y += 12;
    }
  }

  else if (reportType === "PRODUCT_MIX" && productMix) {
    const catLabel = productMix.category ?? "ALL";
    const title = `Product Mix_${catLabel}   ${formatPHP(productMix.totalSales)}`;
    let y = drawHeader(doc, title, branchLabel, dateRangeLabel, marginLeft);

    const hasCompare = productMix.products.some((p) => p.compareSales !== undefined);
    const head: string[][] = hasCompare
      ? [["#", "Menu Item", dateRangeLabel, compareLabel ?? "Compare", "Change"]]
      : [["#", "Menu Item", "Qty", "Sales"]];

    const body = productMix.products.map((row, idx) => {
      const base = [String(idx + 1).padStart(2, "0"), row.name];
      if (hasCompare) {
        base.push(
          formatPHP(row.sales),
          row.compareSales !== undefined ? formatPHP(row.compareSales) : "—",
          row.pctChange !== undefined ? pct(row.pctChange) : "—"
        );
      } else {
        base.push(row.qty.toLocaleString(), formatPHP(row.sales));
      }
      return base;
    });

    // @ts-ignore
    doc.autoTable({
      startY: y,
      head,
      body,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [253, 246, 238] },
      margin: { left: marginLeft, right: marginLeft },
      columnStyles: hasCompare
        ? { 4: { halign: "right" } }
        : { 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable?.finalY ?? y;
  }

  else if (reportType === "PRODUCT_MIX_CHANNEL" && productMixChannel) {
    const categoryLabel =
      productMixChannel.category === "ALL"
        ? "ALL CATEGORIES"
        : productMixChannel.category;
    const title =
      productMixChannel.category === "ALL"
        ? `Product Mix (Channel) — ${productMixChannel.periodLabel}`
        : `Product Mix (Channel) — ${productMixChannel.category} — ${productMixChannel.periodLabel}`;
    let y = drawHeader(doc, title, branchLabel, dateRangeLabel, marginLeft);

    const head: string[][] = [
      [
        "#",
        "Menu",
        `${productMixChannel.periodLabel} Qty`,
        `${productMixChannel.periodLabel} Sales`,
        "Walk-in Qty",
        "Walk-in Sales",
        "Grab Qty",
        "Grab Sales",
        "FoodPanda Qty",
        "FoodPanda Sales",
      ],
    ];

    const body = productMixChannel.rows.map((row, idx) => [
      String(idx + 1).padStart(2, "0"),
      row.name,
      row.totalQty.toLocaleString("en-PH"),
      formatPHP(row.totalSales),
      row.walkInQty.toLocaleString("en-PH"),
      formatPHP(row.walkInSales),
      row.grabQty.toLocaleString("en-PH"),
      formatPHP(row.grabSales),
      row.foodpandaQty.toLocaleString("en-PH"),
      formatPHP(row.foodpandaSales),
    ]);

    const t = productMixChannel.totals;

    // @ts-ignore
    doc.autoTable({
      startY: y,
      head,
      body,
      foot: [
        [
          "",
          "TOTAL",
          t.totalQty.toLocaleString("en-PH"),
          formatPHP(t.totalSales),
          t.walkInQty.toLocaleString("en-PH"),
          formatPHP(t.walkInSales),
          t.grabQty.toLocaleString("en-PH"),
          formatPHP(t.grabSales),
          t.foodpandaQty.toLocaleString("en-PH"),
          formatPHP(t.foodpandaSales),
        ],
      ],
      styles: { font: "helvetica", fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW_COLOR },
      margin: { left: marginLeft, right: marginLeft },
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "left" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
        9: { halign: "right" },
      },
    });
   	const yEnd = (doc as any).lastAutoTable?.finalY ?? y;
    y = yEnd;
  }

  else if (reportType === "TOP_5_PRODUCTS" && top5) {
    const cats =
      selectedCategories.length > 0
        ? selectedCategories.filter((c) => top5.topByCategory[c]?.length)
        : (Object.keys(top5.topByCategory) as typeof selectedCategories);

    let y = drawHeader(
      doc,
      "2026 Running Sales Mix — Top 5",
      branchLabel,
      dateRangeLabel,
      marginLeft
    );

    for (const cat of cats) {
      const items = top5.topByCategory[cat] ?? [];
      if (!items.length) continue;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...HEADER_COLOR);
      doc.text(`TOP 5 ${cat}`, marginLeft, y);
      y += 6;

      // @ts-ignore
      doc.autoTable({
        startY: y,
        head: [["#", "Item", "Qty", "Sales"]],
        body: items.map((item) => [
          String(item.rank).padStart(2, "0"),
          item.name,
          item.qty.toLocaleString(),
          `\u20B1${item.sales.toLocaleString("en-PH")}`,
        ]),
        styles: { font: "helvetica", fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: ALT_ROW_COLOR },
        margin: { left: marginLeft, right: marginLeft },
      });
      y = (doc as any).lastAutoTable?.finalY ?? y;
      y += 14;
    }
  }

  else if (
    reportType === "RUNNING_SALES_MIX_CATEGORY" &&
    runningSalesMixCategory &&
    runningSalesCategory
  ) {
    const title = `2026 Running Sales Mix_${runningSalesCategory}`;
    let y = drawHeader(doc, title, branchLabel, dateRangeLabel, marginLeft);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...HEADER_COLOR);
    doc.text(`TOP 5 ${runningSalesCategory} — YTD as of ${dateRangeLabel}`, marginLeft, y);
    y += 6;

    const top5items = runningSalesMixCategory.products.slice(0, 5);
    const hasCompare = top5items.some((p) => p.compareSales !== undefined);

    const head: string[][] = hasCompare
      ? [["#", "Item", "Qty", compareLabel ?? "Compare Qty", "Change"]]
      : [["#", "Item", "Qty"]];

    // @ts-ignore
    doc.autoTable({
      startY: y,
      head,
      body: top5items.map((item, idx) => {
        const base = [String(idx + 1).padStart(2, "0"), item.name, item.qty.toLocaleString()];
        if (hasCompare) {
          base.push(
            item.compareQty !== undefined ? item.compareQty.toLocaleString() : "—",
            item.pctChange !== undefined ? pct(item.pctChange) : "—"
          );
        }
        return base;
      }),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      margin: { left: marginLeft, right: marginLeft },
    });
    y = (doc as any).lastAutoTable?.finalY ?? y;

    if (runningSalesMixCategory.products.length > 5) {
      y += 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Full ${runningSalesCategory} breakdown`, marginLeft, y);
      y += 6;

      // @ts-ignore
      doc.autoTable({
        startY: y,
        head: hasCompare
          ? [["#", "Item", "Qty", "Compare Qty", "Change"]]
          : [["#", "Item", "Qty"]],
        body: runningSalesMixCategory.products.slice(5).map((item, idx) => {
          const base = [String(idx + 6), item.name, item.qty.toLocaleString()];
          if (hasCompare) {
            base.push(
              item.compareQty !== undefined ? item.compareQty.toLocaleString() : "—",
              item.pctChange !== undefined ? pct(item.pctChange) : "—"
            );
          }
          return base;
        }),
        styles: { font: "helvetica", fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [100, 116, 139], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: marginLeft, right: marginLeft },
      });
    }
  }

  else if (reportType === "CATEGORY_PERFORMANCE" && categoryPerformance) {
    let y = drawHeader(
      doc,
      "Category Performance",
      branchLabel,
      dateRangeLabel,
      marginLeft
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...HEADER_COLOR);
    doc.text(`Gross Sales: ${formatPHP(categoryPerformance.grandTotal)}`, marginLeft, y);
    y += 20;

    const hasCompare = categoryPerformance.categories.some(
      (c) => c.compareSales !== undefined
    );
    const head: string[][] = hasCompare
      ? [["Rank", "Category", "Sales", "% of Total", compareLabel ?? "Compare", "Change"]]
      : [["Rank", "Category", "Sales", "% of Total"]];

    const body = categoryPerformance.categories.map((row, idx) => {
      const base = [
        String(idx + 1),
        row.category,
        formatPHP(row.sales),
        `${row.percent.toFixed(1)}%`,
      ];
      if (hasCompare) {
        base.push(
          row.compareSales !== undefined ? formatPHP(row.compareSales) : "—",
          row.pctChange !== undefined ? pct(row.pctChange) : "—"
        );
      }
      return base;
    });

    // @ts-ignore
    doc.autoTable({
      startY: y,
      head,
      body,
      foot: [
        hasCompare
          ? ["", "TOTAL", formatPHP(categoryPerformance.grandTotal), "100%", "", ""]
          : ["", "TOTAL", formatPHP(categoryPerformance.grandTotal), "100%"],
      ],
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW_COLOR },
      margin: { left: marginLeft, right: marginLeft },
    });
  }

  // Footer on all pages
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Generated by DOT Coffee Daily Ledger  •  Page ${i} of ${pageCount}`,
      marginLeft,
      pageHeight - 28
    );
    doc.text(
      new Date().toLocaleString(),
      pageWidth - marginLeft,
      pageHeight - 28,
      { align: "right" }
    );
  }

  doc.save(filename);
}

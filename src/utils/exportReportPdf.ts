import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportCanvasData } from "@/components/reports/ReportCanvas";
import { formatPHP } from "@/utils/format";

function formatPHPPdf(value: number) {
  // Use plain "PHP" text instead of the peso symbol to avoid garbled glyphs in PDFs
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

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
    pourItForward,
  } = canvasData;

  const orientation: "portrait" | "landscape" =
    reportType === "PRODUCT_MIX_CHANNEL" ? "landscape" : "portrait";

  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const marginLeft = 48;
  const pageWidth = doc.internal.pageSize.getWidth();

  if (reportType === "SALES_MIX_OVERVIEW" && salesMix) {
    const title = `PRODUCT MIX for ${dateRangeLabel}`;
    let y = drawHeader(doc, title, branchLabel, dateRangeLabel, marginLeft);

    // Gross Sales
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...HEADER_COLOR);
    doc.text(`Gross Sales: ${formatPHPPdf(salesMix.grandTotal)}`, marginLeft, y);
    y += 20;

    const hasCompare = salesMix.categoryTotals.some((c) => c.compareSales !== undefined);
    const head: string[][] = hasCompare
      ? [["Category", "Sales", "% Mix", compareLabel ?? "Compare", "Change"]]
      : [["Category", "Sales", "% Mix"]];

    const body = salesMix.categoryTotals.map((row) => {
      const base = [row.category, formatPHPPdf(row.sales), `${row.percent.toFixed(1)}%`];
      if (hasCompare) {
        base.push(
          row.compareSales !== undefined ? formatPHPPdf(row.compareSales) : "—",
          row.pctChange !== undefined ? pct(row.pctChange) : "—"
        );
      }
      return base;
    });

    autoTable(doc, {
      startY: y,
      head,
      body,
      foot: [hasCompare
        ? ["TOTAL", formatPHPPdf(salesMix.grandTotal), "100%",
           salesMix.compareGrandTotal !== undefined ? formatPHPPdf(salesMix.compareGrandTotal) : "—", ""]
        : ["TOTAL", formatPHPPdf(salesMix.grandTotal), "100%"]],
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

      autoTable(doc, {
        startY: y,
        head: [["#", "Item", "Qty", "Sales"]],
        body: [
          ...items.map((item, idx) => [
            String(idx + 1),
            item.name,
            item.qty.toLocaleString("en-PH"),
            formatPHPPdf(item.sales),
          ]),
          channelData?.totals
            ? [
                "",
                "Total",
                channelData.totals.totalQty.toLocaleString("en-PH"),
                formatPHPPdf(channelData.totals.totalSales),
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
    const title = `Product Mix_${catLabel}   ${formatPHPPdf(productMix.totalSales)}`;
    let y = drawHeader(doc, title, branchLabel, dateRangeLabel, marginLeft);

    const hasCompare = productMix.products.some((p) => p.compareSales !== undefined);
    const head: string[][] = hasCompare
      ? [["#", "Menu Item", dateRangeLabel, compareLabel ?? "Compare", "Change"]]
      : [["#", "Menu Item", "Qty", "Sales"]];

    const body = productMix.products.map((row, idx) => {
      const base = [String(idx + 1).padStart(2, "0"), row.name];
      if (hasCompare) {
        base.push(
          formatPHPPdf(row.sales),
          row.compareSales !== undefined ? formatPHPPdf(row.compareSales) : "—",
          row.pctChange !== undefined ? pct(row.pctChange) : "—"
        );
      } else {
        base.push(row.qty.toLocaleString(), formatPHPPdf(row.sales));
      }
      return base;
    });

    autoTable(doc, {
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

    const qtyHead: string[][] = [
      [
        "#",
        "Menu",
        `${productMixChannel.periodLabel} Qty`,
        "Walk-in Qty",
        "Grab Qty",
        "FoodPanda Qty",
      ],
    ];

    const salesHead: string[][] = [
      [
        "#",
        "Menu",
        `${productMixChannel.periodLabel} Sales`,
        "Walk-in Sales",
        "Grab Sales",
        "FoodPanda Sales",
      ],
    ];

    const qtyBody = productMixChannel.rows.map((row, idx) => [
      String(idx + 1).padStart(2, "0"),
      row.name,
      row.totalQty.toLocaleString("en-PH"),
      row.walkInQty.toLocaleString("en-PH"),
      row.grabQty.toLocaleString("en-PH"),
      row.foodpandaQty.toLocaleString("en-PH"),
    ]);

    const salesBody = productMixChannel.rows.map((row, idx) => [
      String(idx + 1).padStart(2, "0"),
      row.name,
      formatPHPPdf(row.totalSales),
      formatPHPPdf(row.walkInSales),
      formatPHPPdf(row.grabSales),
      formatPHPPdf(row.foodpandaSales),
    ]);

    const t = productMixChannel.totals;

    const gap = 16;
    const tableWidth =
      (pageWidth - marginLeft * 2 - gap) / 2;

    // Left: quantities
    autoTable(doc, {
      startY: y,
      head: qtyHead,
      body: qtyBody,
      foot: [
        [
          "",
          "TOTAL",
          t.totalQty.toLocaleString("en-PH"),
          t.walkInQty.toLocaleString("en-PH"),
          t.grabQty.toLocaleString("en-PH"),
          t.foodpandaQty.toLocaleString("en-PH"),
        ],
      ],
      styles: { font: "helvetica", fontSize: 6, cellPadding: 2 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW_COLOR },
      margin: {
        left: marginLeft,
        right: pageWidth - marginLeft - tableWidth,
      },
      tableWidth,
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "left" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
    const leftEnd = (doc as any).lastAutoTable?.finalY ?? y;

    // Right: sales
    autoTable(doc, {
      startY: y,
      head: salesHead,
      body: salesBody,
      foot: [
        [
          "",
          "TOTAL",
          formatPHPPdf(t.totalSales),
          formatPHPPdf(t.walkInSales),
          formatPHPPdf(t.grabSales),
          formatPHPPdf(t.foodpandaSales),
        ],
      ],
      styles: { font: "helvetica", fontSize: 6, cellPadding: 2 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW_COLOR },
      margin: {
        left: marginLeft + tableWidth + gap,
        right: marginLeft,
      },
      tableWidth,
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "left" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
    const rightEnd = (doc as any).lastAutoTable?.finalY ?? y;
    y = Math.max(leftEnd, rightEnd);
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

      autoTable(doc, {
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

    autoTable(doc, {
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

      autoTable(doc, {
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
    doc.text(`Gross Sales: ${formatPHPPdf(categoryPerformance.grandTotal)}`, marginLeft, y);
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
        formatPHPPdf(row.sales),
        `${row.percent.toFixed(1)}%`,
      ];
      if (hasCompare) {
        base.push(
          row.compareSales !== undefined ? formatPHPPdf(row.compareSales) : "—",
          row.pctChange !== undefined ? pct(row.pctChange) : "—"
        );
      }
      return base;
    });

      autoTable(doc, {
      startY: y,
      head,
      body,
      foot: [
        hasCompare
          ? ["", "TOTAL", formatPHPPdf(categoryPerformance.grandTotal), "100%", "", ""]
          : ["", "TOTAL", formatPHPPdf(categoryPerformance.grandTotal), "100%"],
      ],
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW_COLOR },
      margin: { left: marginLeft, right: marginLeft },
    });
  }

  else if (reportType === "POUR_IT_FORWARD" && pourItForward) {
    const title = pourItForward.title;
    let y = drawHeader(doc, title, branchLabel, dateRangeLabel, marginLeft);

    autoTable(doc, {
      startY: y,
      head: [["Branch", "Foodpanda", "Grab", "Walk-in", "Grand Total"]],
      body: pourItForward.rows.map((row) => [
        row.branchName,
        row.foodpandaQty.toLocaleString("en-PH"),
        row.grabQty.toLocaleString("en-PH"),
        row.walkinQty.toLocaleString("en-PH"),
        row.grandTotal.toLocaleString("en-PH"),
      ]),
      foot: [
        [
          "Grand Total",
          pourItForward.totals.foodpandaQty.toLocaleString("en-PH"),
          pourItForward.totals.grabQty.toLocaleString("en-PH"),
          pourItForward.totals.walkinQty.toLocaleString("en-PH"),
          pourItForward.totals.grandTotal.toLocaleString("en-PH"),
        ],
      ],
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ALT_ROW_COLOR },
      margin: { left: marginLeft, right: marginLeft },
      tableWidth: pageWidth - marginLeft * 2,
      columnStyles: {
        0: { halign: "left", cellWidth: 200 },
        1: { halign: "right", cellWidth: 80 },
        2: { halign: "right", cellWidth: 80 },
        3: { halign: "right", cellWidth: 80 },
        4: { halign: "right", cellWidth: 100 },
      },
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

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPHP } from "@/utils/format";
import type { CashLedgerReportResult } from "@/lib/reports/mergeCashLedgerReport";
import type { DailyLedgerAmounts } from "@/services/dailyLedgerService";

function money(n: number) {
  return Math.round(n * 100) / 100;
}

function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

function amountCells(t: DailyLedgerAmounts): (string | number)[] {
  return [
    money(t.cash),
    money(t.maya),
    money(t.grab),
    money(t.paymongo),
    money(t.gcash),
    money(t.foodpanda),
    money(t.giftCard),
    money(t.regularDiscount),
    money(t.seniorDiscount),
    money(t.pwdDiscount),
    money(t.vatExemption),
    money(t.grossSalesNet),
    t.transactionCount,
    money(t.grossSales),
  ];
}

const DETAIL_HEADERS = [
  "Date",
  "Day",
  "Branch",
  "Cash",
  "Maya",
  "Grab",
  "Paymongo",
  "GCash",
  "FoodPanda",
  "Gift Card",
  "Regular Discount",
  "Senior Discount",
  "PWD Discount",
  "VAT Exemption",
  "Gross Sales (Net)",
  "Txn Count",
  "GROSS SALES",
  "Source",
] as const;

export function exportCashLedgerCsv(result: CashLedgerReportResult): void {
  const lines = [DETAIL_HEADERS.map(csvCell).join(",")];

  for (const r of result.rows) {
    const cells = [
      r.ledgerDate,
      r.dayLabel,
      r.branchLabel,
      ...amountCells(r),
      r.source,
    ].map(csvCell);
    lines.push(cells.join(","));
  }

  const totalCells = [
    "TOTALS",
    "",
    "",
    ...amountCells(result.totals),
    "",
  ].map(csvCell);
  lines.push(totalCells.join(","));

  lines.push("");
  lines.push([csvCell("Summary"), csvCell("Value")].join(","));
  lines.push([csvCell("Rows"), csvCell(result.rows.length)].join(","));
  lines.push([csvCell("GROSS SALES"), csvCell(money(result.totals.grossSales))].join(","));
  lines.push([csvCell("Txn Count"), csvCell(result.totals.transactionCount)].join(","));
  lines.push([csvCell("Cash"), csvCell(money(result.totals.cash))].join(","));
  lines.push([csvCell("Maya"), csvCell(money(result.totals.maya))].join(","));
  lines.push([csvCell("Grab"), csvCell(money(result.totals.grab))].join(","));
  lines.push([csvCell("Paymongo"), csvCell(money(result.totals.paymongo))].join(","));
  lines.push([csvCell("GCash"), csvCell(money(result.totals.gcash))].join(","));
  lines.push([csvCell("FoodPanda"), csvCell(money(result.totals.foodpanda))].join(","));
  lines.push([csvCell("Gift Card"), csvCell(money(result.totals.giftCard))].join(","));
  lines.push([csvCell("Regular Discount"), csvCell(money(result.totals.regularDiscount))].join(","));
  lines.push([csvCell("Senior Discount"), csvCell(money(result.totals.seniorDiscount))].join(","));
  lines.push([csvCell("PWD Discount"), csvCell(money(result.totals.pwdDiscount))].join(","));
  lines.push([csvCell("VAT Exemption"), csvCell(money(result.totals.vatExemption))].join(","));
  lines.push([csvCell("Gross Sales (Net)"), csvCell(money(result.totals.grossSalesNet))].join(","));
  lines.push([csvCell("Generated"), csvCell(result.generatedAt)].join(","));

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `daily-cash-ledger-${result.generatedAt.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCashLedgerExcel(result: CashLedgerReportResult): void {
  const detailRows = result.rows.map((r) => ({
    Date: r.ledgerDate,
    Day: r.dayLabel,
    Branch: r.branchLabel,
    Cash: money(r.cash),
    Maya: money(r.maya),
    Grab: money(r.grab),
    Paymongo: money(r.paymongo),
    GCash: money(r.gcash),
    FoodPanda: money(r.foodpanda),
    "Gift Card": money(r.giftCard),
    "Regular Discount": money(r.regularDiscount),
    "Senior Discount": money(r.seniorDiscount),
    "PWD Discount": money(r.pwdDiscount),
    "VAT Exemption": money(r.vatExemption),
    "Gross Sales (Net)": money(r.grossSalesNet),
    "Txn Count": r.transactionCount,
    "GROSS SALES": money(r.grossSales),
    Source: r.source,
  }));

  detailRows.push({
    Date: "TOTALS",
    Day: "",
    Branch: "",
    Cash: money(result.totals.cash),
    Maya: money(result.totals.maya),
    Grab: money(result.totals.grab),
    Paymongo: money(result.totals.paymongo),
    GCash: money(result.totals.gcash),
    FoodPanda: money(result.totals.foodpanda),
    "Gift Card": money(result.totals.giftCard),
    "Regular Discount": money(result.totals.regularDiscount),
    "Senior Discount": money(result.totals.seniorDiscount),
    "PWD Discount": money(result.totals.pwdDiscount),
    "VAT Exemption": money(result.totals.vatExemption),
    "Gross Sales (Net)": money(result.totals.grossSalesNet),
    "Txn Count": result.totals.transactionCount,
    "GROSS SALES": money(result.totals.grossSales),
    Source: "",
  });

  const summaryRows = [
    { Metric: "Rows", Value: result.rows.length },
    { Metric: "GROSS SALES", Value: money(result.totals.grossSales) },
    { Metric: "Txn Count", Value: result.totals.transactionCount },
    { Metric: "Cash", Value: money(result.totals.cash) },
    { Metric: "Maya", Value: money(result.totals.maya) },
    { Metric: "Grab", Value: money(result.totals.grab) },
    { Metric: "Paymongo", Value: money(result.totals.paymongo) },
    { Metric: "GCash", Value: money(result.totals.gcash) },
    { Metric: "FoodPanda", Value: money(result.totals.foodpanda) },
    { Metric: "Gift Card", Value: money(result.totals.giftCard) },
    { Metric: "Regular Discount", Value: money(result.totals.regularDiscount) },
    { Metric: "Senior Discount", Value: money(result.totals.seniorDiscount) },
    { Metric: "PWD Discount", Value: money(result.totals.pwdDiscount) },
    { Metric: "VAT Exemption", Value: money(result.totals.vatExemption) },
    { Metric: "Gross Sales (Net)", Value: money(result.totals.grossSalesNet) },
    { Metric: "Generated", Value: result.generatedAt },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Cash Ledger");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");
  XLSX.writeFile(wb, `daily-cash-ledger-${result.generatedAt.slice(0, 10)}.xlsx`);
}

export function exportCashLedgerPdf(result: CashLedgerReportResult): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("DOT Coffee — Daily Cash Ledger", margin, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date(result.generatedAt).toLocaleString()}  |  GROSS SALES ${formatPHP(result.totals.grossSales)}  |  Txns ${result.totals.transactionCount}`,
    margin,
    52,
  );

  autoTable(doc, {
    startY: 64,
    head: [[
      "Date", "Day", "Branch", "Cash", "Maya", "Grab", "Paymongo", "GCash", "FP", "Gift",
      "Reg", "Senior", "PWD", "VAT Ex", "Net", "Txn", "GROSS", "Src",
    ]],
    body: [
      ...result.rows.map((r) => [
        r.ledgerDate,
        r.dayLabel.slice(0, 3),
        r.branchLabel,
        formatPHP(r.cash),
        formatPHP(r.maya),
        formatPHP(r.grab),
        formatPHP(r.paymongo),
        formatPHP(r.gcash),
        formatPHP(r.foodpanda),
        formatPHP(r.giftCard),
        formatPHP(r.regularDiscount),
        formatPHP(r.seniorDiscount),
        formatPHP(r.pwdDiscount),
        formatPHP(r.vatExemption),
        formatPHP(r.grossSalesNet),
        r.transactionCount,
        formatPHP(r.grossSales),
        r.source === "sheet" ? "Sheet" : r.source === "pos_derived" ? "POS" : "Partial",
      ]),
      [
        "TOTALS",
        "",
        "",
        formatPHP(result.totals.cash),
        formatPHP(result.totals.maya),
        formatPHP(result.totals.grab),
        formatPHP(result.totals.paymongo),
        formatPHP(result.totals.gcash),
        formatPHP(result.totals.foodpanda),
        formatPHP(result.totals.giftCard),
        formatPHP(result.totals.regularDiscount),
        formatPHP(result.totals.seniorDiscount),
        formatPHP(result.totals.pwdDiscount),
        formatPHP(result.totals.vatExemption),
        formatPHP(result.totals.grossSalesNet),
        result.totals.transactionCount,
        formatPHP(result.totals.grossSales),
        "",
      ],
    ],
    styles: { fontSize: 6, cellPadding: 2 },
    headStyles: { fillColor: [14, 45, 73], textColor: 255 },
    margin: { left: margin, right: margin },
  });

  doc.save(`daily-cash-ledger-${result.generatedAt.slice(0, 10)}.pdf`);
}

import { CATEGORIES, EMPTY_ROWS_TOP, EMPTY_ROWS_MIDDLE, type Category } from "@/utils/types";
import { formatNumber, formatPercent } from "@/utils/format";

interface Props {
  totals: Record<Category, number>;
  grandTotal: number;
  percents: Record<Category, number>;
}

export default function SummaryTable({ totals, grandTotal, percents }: Props) {
  const cats = [...CATEGORIES];
  const allCols = [...cats, "TOTAL" as const];

  const zeroRow = () => allCols.map(() => "0");
  const totalsRow = () => [
    ...cats.map(c => formatNumber(totals[c])),
    formatNumber(grandTotal),
  ];
  const percentRow = () => [
    ...cats.map(c => formatPercent(percents[c])),
    grandTotal > 0 ? "100%" : "0%",
  ];

  const rows: { cells: string[]; className: string }[] = [];

  // Top empty rows
  for (let i = 0; i < EMPTY_ROWS_TOP; i++) {
    rows.push({ cells: zeroRow(), className: "" });
  }
  // Totals row
  rows.push({ cells: totalsRow(), className: "totals-row" });
  // Middle empty rows
  for (let i = 0; i < EMPTY_ROWS_MIDDLE; i++) {
    rows.push({ cells: zeroRow(), className: "" });
  }
  // Repeated totals row
  rows.push({ cells: totalsRow(), className: "totals-row" });
  // Percentage row
  rows.push({ cells: percentRow(), className: "percent-row" });

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse min-w-[900px]">
        <thead className="sticky top-0 z-10">
          <tr>
            {allCols.map(col => (
              <th
                key={col}
                className={`spreadsheet-header border border-dotted border-table-grid ${col === "TOTAL" ? "min-w-[100px]" : "min-w-[80px]"}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={row.className}>
              {row.cells.map((cell, ci) => (
                <td
                  key={ci}
                  className={`spreadsheet-cell ${ci === allCols.length - 1 ? "font-bold border-l-2 border-l-table-highlight" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

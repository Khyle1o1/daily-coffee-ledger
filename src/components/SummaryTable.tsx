import { CATEGORIES, EMPTY_ROWS_TOP, EMPTY_ROWS_MIDDLE, type Category } from "@/utils/types";
import { formatNumber, formatPercent } from "@/utils/format";

interface Props {
  totals: Record<Category, number>;
  quantities: Record<Category, number>;
  grandTotal: number;
  grandQuantity: number;
  percents: Record<Category, number>;
}

export default function SummaryTable({ totals, quantities, grandTotal, grandQuantity, percents }: Props) {
  const cats = [...CATEGORIES];
  const allCols = [...cats, "TOTAL" as const];

  const zeroRow = () => allCols.map(() => "0");
  const totalsRow = () => [
    ...cats.map(c => formatNumber(totals[c])),
    formatNumber(grandTotal),
  ];
  const quantitiesRow = () => [
    ...cats.map(c => formatNumber(quantities[c])),
    formatNumber(grandQuantity),
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
  // Totals row (sales)
  rows.push({ cells: totalsRow(), className: "totals-row" });
  // Quantities row
  rows.push({ cells: quantitiesRow(), className: "quantities-row" });
  // Middle empty rows
  for (let i = 0; i < EMPTY_ROWS_MIDDLE; i++) {
    rows.push({ cells: zeroRow(), className: "" });
  }
  // Repeated totals row (sales)
  rows.push({ cells: totalsRow(), className: "totals-row" });
  // Repeated quantities row
  rows.push({ cells: quantitiesRow(), className: "quantities-row" });
  // Percentage row
  rows.push({ cells: percentRow(), className: "percent-row" });

  return (
    <div className="overflow-x-auto rounded-2xl shadow-lg">
      <table className="w-full border-collapse min-w-[900px]">
        <thead className="sticky top-0 z-10">
          <tr>
            {allCols.map(col => (
              <th
                key={col}
                className={`spreadsheet-header ${col === "TOTAL" ? "min-w-[100px]" : "min-w-[80px]"}`}
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
                  className={`spreadsheet-cell ${ci === allCols.length - 1 ? "font-bold border-l-2 border-l-primary" : ""}`}
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

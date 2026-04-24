import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ProcessedRow } from "@/utils/types";

interface ConflictRow {
  rawCategory: string;
  rawItemName: string;
  mappedCat: string;
  expectedCat: string;
  count: number;
}

interface Props {
  rows: ProcessedRow[];
}

function summariseConflicts(rows: ProcessedRow[]): ConflictRow[] {
  const map = new Map<string, ConflictRow>();
  for (const r of rows) {
    if (!r.categoryConflict || !r.mappedCat) continue;
    const key = `${r.rawCategory}|||${r.rawItemName}|||${r.mappedCat}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        rawCategory: r.rawCategory,
        rawItemName: r.rawItemName,
        mappedCat: r.mappedCat,
        expectedCat: r.categoryConflict,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export default function MappingConflictList({ rows }: Props) {
  const conflicts = summariseConflicts(rows);

  if (conflicts.length === 0) {
    return (
      <div className="text-center py-12 bg-emerald-50 rounded-2xl border-2 border-emerald-200">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <p className="text-base font-semibold text-emerald-700">No category conflicts found</p>
        <p className="text-sm text-emerald-600 mt-1">
          All mapped categories match their source categories
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3 mb-5 bg-orange-50 p-3 sm:p-4 rounded-xl border-2 border-orange-300">
        <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm sm:text-base font-bold text-orange-700">
            {conflicts.length} mapping conflict{conflicts.length !== 1 ? "s" : ""} detected
          </p>
          <p className="text-xs sm:text-sm text-orange-600 mt-0.5">
            The items below were mapped to a different category than their original source category
            suggests. Review and update via Settings → Manage Mappings if needed.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl shadow-lg">
        <table className="w-full border-collapse text-xs sm:text-sm min-w-[640px] bg-white">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-primary-foreground bg-primary rounded-tl-2xl">
                Item Name
              </th>
              <th className="px-4 py-3 text-left font-semibold text-primary-foreground bg-primary">
                Source Category
              </th>
              <th className="px-4 py-3 text-left font-semibold text-primary-foreground bg-primary">
                Mapped To
              </th>
              <th className="px-4 py-3 text-left font-semibold text-primary-foreground bg-primary">
                Expected
              </th>
              <th className="px-4 py-3 text-right font-semibold text-primary-foreground bg-primary rounded-tr-2xl">
                Occurrences
              </th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((c, i) => (
              <tr
                key={i}
                className="border-b border-border hover:bg-orange-50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-card-foreground">{c.rawItemName}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{c.rawCategory}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                    {c.mappedCat}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    {c.expectedCat}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-card-foreground">
                  {c.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        To fix a conflict permanently, add a manual mapping in{" "}
        <span className="font-semibold">Settings → Manage Mappings</span>.
      </p>
    </div>
  );
}

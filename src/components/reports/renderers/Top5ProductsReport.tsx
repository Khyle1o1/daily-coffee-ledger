import type { ComputedTop5 } from "@/lib/reports/compute";
import type { Category } from "@/utils/types";

interface Props {
  data: ComputedTop5;
  selectedCategories: Category[];
  branchLabel: string;
  dateRangeLabel: string;
}

const CATEGORY_BG: Record<string, string> = {
  ICED: "#EFF6FF",
  HOT: "#FFF7ED",
  SNACKS: "#F5F3FF",
  "ADD-ONS": "#FFFBEB",
  "CANNED ESPRESSO": "#ECFDF5",
  "COLD BREW": "#ECFEFF",
  MERCH: "#FDF2F8",
  PROMO: "#F7FEE7",
  "LOYALTY CARD": "#FEF2F2",
  PACKAGING: "#F8FAFC",
};

const CATEGORY_BORDER: Record<string, string> = {
  ICED: "#BFDBFE",
  HOT: "#FED7AA",
  SNACKS: "#DDD6FE",
  "ADD-ONS": "#FDE68A",
  "CANNED ESPRESSO": "#A7F3D0",
  "COLD BREW": "#A5F3FC",
  MERCH: "#FBCFE8",
  PROMO: "#D9F99D",
  "LOYALTY CARD": "#FECACA",
  PACKAGING: "#E2E8F0",
};

export default function Top5ProductsReport({
  data,
  selectedCategories,
  branchLabel,
  dateRangeLabel,
}: Props) {
  const categories =
    selectedCategories.length > 0
      ? selectedCategories.filter((c) => data.topByCategory[c]?.length)
      : (Object.keys(data.topByCategory) as Category[]);

  return (
    <div className="bg-white rounded-none p-8 min-h-[500px] font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#C05A1F]">
            HQ Weekly Sync
          </p>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f] mt-1">
            2026 Running Sales Mix — Top 5
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{branchLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider">
            YTD as of
          </p>
          <p className="text-sm font-semibold text-slate-600">{dateRangeLabel}</p>
        </div>
      </div>

      {/* Category grids */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const items = data.topByCategory[cat] ?? [];
          if (!items.length) return null;

          return (
            <div key={cat}>
              <div
                className="rounded-2xl overflow-hidden border"
                style={{
                  borderColor: CATEGORY_BORDER[cat] || "#E2E8F0",
                }}
              >
                {/* Category header */}
                <div
                  className="px-5 py-2.5 flex items-center justify-between"
                  style={{ background: CATEGORY_BORDER[cat] || "#E2E8F0" }}
                >
                  <span className="text-sm font-black uppercase tracking-widest text-[#1e3a5f]">
                    TOP 5 {cat}
                  </span>
                </div>

                {/* Items table */}
                <div
                  style={{ background: CATEGORY_BG[cat] || "#F8FAFC" }}
                >
                  <table className="w-full text-sm">
                    <tbody>
                      {items.map((item) => (
                        <tr
                          key={item.name}
                          className="border-t"
                          style={{ borderColor: CATEGORY_BORDER[cat] || "#E2E8F0" }}
                        >
                          <td className="w-10 px-4 py-2.5 text-center">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold">
                              {item.rank}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-800 font-medium flex-1">
                            {item.name}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-xs text-slate-500">
                            {item.qty.toLocaleString()} qty
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-[#1e3a5f] w-32">
                            ₱{item.sales.toLocaleString("en-PH")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {categories.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-12">
          No product data available for the selected filters.
        </p>
      )}
    </div>
  );
}

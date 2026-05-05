import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type {
  ComputedHQSyncPack,
  HQTop5ByChannel,
  HQChannelData,
} from "@/lib/reports/computeHQSyncPack";
import type { ComputedProductMix, ComputedSalesMix } from "@/lib/reports/compute";
import { CHANNEL_BRANDING, type ChannelBranding } from "../channelBranding";
import type { SalesChannel } from "@/lib/reports/channel";
import { getPercentChange } from "@/utils/percentChange";

// ─── Design tokens ────────────────────────────────────────────────────────────

const CREAM   = "#F4F0E5";
const CREAM2  = "#EDE7D6";
const NAVY    = "#1e3a5f";
const ORANGE  = "#C05A1F";
const ROW_ODD = "#FDEBD4"; // warm orange tint for alternating rows

const CAT_COLORS: Record<string, string> = {
  ICED:           "#3B82F6",
  HOT:            "#F97316",
  SNACKS:         "#8B5CF6",
  "ADD-ONS":      "#F59E0B",
  MERCH:          "#EC4899",
  PROMO:          "#84CC16",
  "LOYALTY CARD": "#EF4444",
  PACKAGING:      "#94A3B8",
  CANNED:         "#06B6D4",
  "COLD BREW":    "#6366F1",
  EVENTS:         "#10B981",
};

const CAT_DISPLAY: Record<string, string> = {
  SNACKS: "PASTRIES",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  const sign = v < 0 ? "-" : "";
  return `${sign}₱${Math.abs(v).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function abbrevAmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(3)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return `${Math.round(v)}`;
}

/** Shorten "MMM dd, yyyy — MMM dd, yyyy" → "MMM yyyy". */
function shortLabel(label?: string | null): string {
  if (!label) return "";
  const m = label.match(/^(\w{3})\s+\d+,\s+(\d{4})/);
  if (m) return `${m[1]} ${m[2]}`;
  return label;
}

/** Extract 4-digit year from any label string. */
function extractYear(label: string): string {
  const m = label.match(/\b(20\d{2})\b/);
  return m ? m[1] : String(new Date().getFullYear());
}

function PctTag({ prev, curr }: { prev: unknown; curr: number }) {
  const pc = getPercentChange(prev, curr);
  if (pc.label === "-") return <span style={{ color: "#94A3B8" }}>—</span>;
  const color =
    pc.tone === "positive" ? "#059669" :
    pc.tone === "negative" ? "#DC2626" : "#64748B";
  return (
    <span style={{ color, fontWeight: 700, fontSize: 11 }}>
      {pc.label}
    </span>
  );
}

// ─── Channel logo ─────────────────────────────────────────────────────────────

/** Renders the raw logo image with no extra wrapper (for top-5 and overview). */
function RawLogo({
  channel,
  size = 100,
}: {
  channel: ChannelBranding;
  size?: number;
}) {
  const [err, setErr] = useState(false);
  const Icon = channel.fallbackIcon;
  return err ? (
    <Icon style={{ width: size, height: size, color: NAVY }} />
  ) : (
    <img
      src={channel.logoSrc}
      alt={channel.title}
      loading="eager"
      decoding="sync"
      style={{ width: size, height: size, objectFit: "contain" }}
      onError={() => setErr(true)}
    />
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

function Page({
  children,
  isFirst = false,
}: {
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: CREAM,
        padding: "40px 48px",
        borderTop: isFirst ? "none" : `14px solid ${CREAM2}`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Small page header (HQ Weekly Sync label + title) ─────────────────────────

function SyncLabel() {
  return (
    <p
      className="text-[10px] font-extrabold tracking-[0.22em] uppercase mb-1"
      style={{ color: ORANGE }}
    >
      HQ Weekly Sync
    </p>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 1 — PRODUCT MIX OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function ProductMixOverviewPage({
  data,
  cupsData,
  dateRangeLabel,
  branchLabel,
}: {
  data: ComputedSalesMix;
  cupsData: { name: string; qty: number }[];
  dateRangeLabel: string;
  branchLabel: string;
}) {
  const pieData = data.categoryTotals
    .filter((c) => c.sales > 0)
    .map((c) => ({ name: c.category, value: c.sales }));

  // Channel share from top5ByChannel totals
  const PRES_CHANNELS: SalesChannel[] = ["WALK_IN", "GRAB", "FOODPANDA"];
  const chanTotals = PRES_CHANNELS.map((ch) => {
    const d = data.top5ByChannel?.[ch];
    return { ch, sales: d?.totals?.totalSales ?? 0 };
  });
  const totalChanSales = chanTotals.reduce((s, c) => s + c.sales, 0);

  const cupsTotal = cupsData.reduce((s, c) => s + c.qty, 0);

  return (
    <Page isFirst>
      <SyncLabel />
      <h1 className="text-[28px] font-black mb-5" style={{ color: NAVY }}>
        PRODUCT MIX for {dateRangeLabel}
      </h1>
      {branchLabel && branchLabel !== "All Branches" && (
        <p className="text-xs text-slate-400 font-medium -mt-3 mb-4">{branchLabel}</p>
      )}

      {/* 3-column body */}
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>

        {/* ── Left: Pie + channel logos ── */}
        <div style={{ width: "34%", flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                labelLine={false}
                label={({ cx, cy, midAngle, outerRadius: r, percent }) => {
                  if (percent < 0.03) return null;
                  const RAD = Math.PI / 180;
                  const x = cx + (r + 14) * Math.cos(-midAngle * RAD);
                  const y = cy + (r + 14) * Math.sin(-midAngle * RAD);
                  return (
                    <text x={x} y={y} fill={NAVY} textAnchor="middle" fontSize={10} fontWeight={700}>
                      {(percent * 100).toFixed(1)}%
                    </text>
                  );
                }}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={CAT_COLORS[entry.name] ?? "#64748B"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [fmt(v), "Sales"]} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 10 }}
                formatter={(value: string) => CAT_DISPLAY[value] ?? value}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Channel logos with share % */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 20,
              marginTop: 8,
            }}
          >
            {CHANNEL_BRANDING.map((cm) => {
              const chanSale = chanTotals.find((c) => c.ch === cm.key)?.sales ?? 0;
              const share =
                totalChanSales > 0 ? (chanSale / totalChanSales) * 100 : 0;
              return (
                <div
                  key={cm.key}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                >
                  <RawLogo channel={cm} size={72} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#1E293B" }}>
                    {Math.round(share)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Center: Cups Sold ── */}
        <div style={{ width: "22%", flexShrink: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: NAVY, color: "white" }}>
                <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700 }}>
                  CUPS SOLD
                </th>
                <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>
                  QTY
                </th>
              </tr>
            </thead>
            <tbody>
              {cupsData.length > 0 ? (
                cupsData.map((row, i) => (
                  <tr
                    key={row.name}
                    style={{ backgroundColor: i % 2 === 0 ? "white" : "#F5F0E8" }}
                  >
                    <td style={{ padding: "5px 10px", color: "#1E293B" }}>{row.name}</td>
                    <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 600, color: "#0F172A" }}>
                      {row.qty.toLocaleString("en-PH")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} style={{ padding: "12px 10px", textAlign: "center", color: "#94A3B8", fontSize: 11 }}>
                    No cup data
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: NAVY, color: "white" }}>
                <td style={{ padding: "6px 10px", fontWeight: 700 }}>Grand Total</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 900 }}>
                  {cupsTotal.toLocaleString("en-PH")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Right: Category sales list ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {data.categoryTotals.map((row) => (
                <tr key={row.category}>
                  <td style={{ padding: "5px 0", color: "#374151", fontWeight: 600 }}>
                    {CAT_DISPLAY[row.category] ?? row.category}
                  </td>
                  <td
                    style={{
                      padding: "5px 0",
                      textAlign: "right",
                      fontWeight: row.sales !== 0 ? 700 : 400,
                      color: row.sales < 0 ? "#DC2626" : row.sales === 0 ? "#94A3B8" : "#0F172A",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmt(row.sales)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={2}
                  style={{ padding: "4px 0", borderTop: `1.5px solid ${NAVY}30` }}
                />
              </tr>
              <tr>
                <td style={{ padding: "5px 0", color: NAVY, fontWeight: 900, fontSize: 14 }}>
                  GROSS SALES
                </td>
                <td
                  style={{
                    padding: "5px 0",
                    textAlign: "right",
                    color: NAVY,
                    fontWeight: 900,
                    fontSize: 14,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(data.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES 2–5 — CATEGORY DETAIL (QTY comparison)
// ═══════════════════════════════════════════════════════════════════════════════

function ProductMixCategoryDetailPage({
  data,
  displayName,
  dateRangeLabel,
  compareLabel,
}: {
  data: ComputedProductMix;
  displayName: string;
  dateRangeLabel: string;
  compareLabel?: string;
}) {
  const hasCompare = data.products.some((p) => p.compareQty !== undefined);

  const currCol = shortLabel(dateRangeLabel) || "CURRENT";
  const prevCol = shortLabel(compareLabel) || "PREV";

  return (
    <Page>
      {/* Inline title: "Product Mix_ICED  3.695M" */}
      <SyncLabel />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 900, color: NAVY, margin: 0 }}>
          Product Mix_{displayName}
        </h1>
        {data.totalSales > 0 && (
          <span style={{ fontSize: 26, fontWeight: 900, color: ORANGE }}>
            {abbrevAmt(data.totalSales)}
          </span>
        )}
      </div>

      {data.products.length === 0 ? (
        <div
          style={{
            padding: "40px 0",
            textAlign: "center",
            color: "#94A3B8",
            fontSize: 13,
          }}
        >
          No data available for this category in the selected range.
        </div>
      ) : (
        <div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              minWidth: 0,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: NAVY, color: "white" }}>
                <th style={{ padding: "7px 8px", textAlign: "left", width: 36, fontWeight: 700 }}>
                  #
                </th>
                <th style={{ padding: "7px 12px", textAlign: "left", fontWeight: 700 }}>
                  MENU
                </th>
                {hasCompare && (
                  <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {prevCol}
                  </th>
                )}
                <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {hasCompare ? currCol : "QTY"}
                </th>
                {hasCompare && (
                  <th style={{ padding: "7px 8px", textAlign: "right", width: 56, fontWeight: 700 }}>
                    %
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.products.map((item, idx) => (
                <tr
                  key={item.name}
                  style={{
                    backgroundColor: idx % 2 === 0 ? "white" : "#F5F0E8",
                  }}
                >
                  <td
                    style={{
                      padding: "5px 8px",
                      color: "#94A3B8",
                      fontWeight: 700,
                      textAlign: "center",
                      fontSize: 11,
                    }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                  <td
                    style={{
                      padding: "5px 12px",
                      color: "#1E293B",
                      fontWeight: 600,
                    }}
                  >
                    {item.name}
                  </td>
                  {hasCompare && (
                    <td
                      style={{
                        padding: "5px 12px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: "#64748B",
                      }}
                    >
                      {item.compareQty !== undefined
                        ? item.compareQty.toLocaleString("en-PH")
                        : "—"}
                    </td>
                  )}
                  <td
                    style={{
                      padding: "5px 12px",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: "#0F172A",
                    }}
                  >
                    {item.qty.toLocaleString("en-PH")}
                  </td>
                  {hasCompare && (
                    <td
                      style={{
                        padding: "5px 8px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        width: 56,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <PctTag prev={item.compareQty} curr={item.qty} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES 6–8 — TOP 5 BY CHANNEL
// ═══════════════════════════════════════════════════════════════════════════════

function ChannelTop5Column({
  ch,
  meta,
}: {
  ch: HQChannelData;
  meta: ChannelBranding;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Logo centered */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <RawLogo channel={meta} size={110} />
        <span
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "#1E293B",
            marginTop: 6,
          }}
        >
          {Math.round(ch.share)}%
        </span>
      </div>

      {/* Items */}
      {ch.items.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {ch.items.map((item, idx) => (
              <tr
                key={item.name}
                style={{
                  backgroundColor: idx % 2 === 0 ? ROW_ODD : "white",
                }}
              >
                <td
                  style={{
                    padding: "6px 8px",
                    fontWeight: 700,
                    color: "#64748B",
                    fontSize: 11,
                    width: 28,
                    textAlign: "center",
                  }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </td>
                <td
                  style={{
                    padding: "6px 4px",
                    textAlign: "center",
                    color: "#1E293B",
                    fontWeight: 600,
                  }}
                >
                  {item.name}
                </td>
                <td
                  style={{
                    padding: "6px 8px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 700,
                    color: "#0F172A",
                    fontSize: 11,
                  }}
                >
                  {item.qty.toLocaleString("en-PH")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 11, padding: "16px 0" }}>
          No data
        </p>
      )}
    </div>
  );
}

function Top5ByChannelPage({
  data,
  dateRangeLabel,
  branchLabel,
}: {
  data: HQTop5ByChannel;
  dateRangeLabel: string;
  branchLabel: string;
}) {
  const year = extractYear(dateRangeLabel);
  const metaMap = Object.fromEntries(CHANNEL_BRANDING.map((c) => [c.key, c]));

  return (
    <Page>
      {/* Page title */}
      <SyncLabel />
      <h1 style={{ fontSize: 26, fontWeight: 900, color: NAVY, margin: 0, marginBottom: 14 }}>
        {year} Running Sales Mix_{data.label}
      </h1>
      {branchLabel && branchLabel !== "All Branches" && (
        <p style={{ fontSize: 11, color: "#64748B", marginTop: -10, marginBottom: 10 }}>
          {branchLabel}
        </p>
      )}

      {/* Blue banner */}
      <div
        style={{
          backgroundColor: NAVY,
          color: "white",
          padding: "10px 20px",
          borderRadius: 6,
          marginBottom: 24,
          textAlign: "center",
        }}
      >
        <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: "0.05em" }}>
          TOP 5 {data.label} - YTD as of {dateRangeLabel.toUpperCase()}
        </span>
      </div>

      {/* Three channel columns */}
      <div style={{ display: "flex", gap: 20 }}>
        {data.channels.map((ch) => {
          const meta = metaMap[ch.key];
          if (!meta) return null;
          return <ChannelTop5Column key={ch.key} ch={ch} meta={meta} />;
        })}
      </div>
    </Page>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
  data: ComputedHQSyncPack;
  branchLabel: string;
  dateRangeLabel: string;
  compareLabel?: string;
}

const CATEGORY_DETAIL_PAGES: {
  key: keyof Pick<
    ComputedHQSyncPack,
    "icedDetail" | "hotDetail" | "pastriesDetail" | "addOnsDetail"
  >;
  displayName: string;
}[] = [
  { key: "icedDetail",     displayName: "ICED"    },
  { key: "hotDetail",      displayName: "HOT"     },
  { key: "pastriesDetail", displayName: "PASTRIES" },
  { key: "addOnsDetail",   displayName: "ADDON"   },
];

const CHANNEL_PAGES: {
  key: keyof Pick<ComputedHQSyncPack, "top5Drinks" | "top5Pastry" | "top5AddOn">;
}[] = [
  { key: "top5Drinks" },
  { key: "top5Pastry" },
  { key: "top5AddOn"  },
];

export default function HQSyncPackReport({
  data,
  branchLabel,
  dateRangeLabel,
  compareLabel,
}: Props) {
  return (
    <div style={{ backgroundColor: CREAM2 }}>
      {/* Page 1 — Overview */}
      <ProductMixOverviewPage
        data={data.overview}
        cupsData={data.cupsData}
        dateRangeLabel={dateRangeLabel}
        branchLabel={branchLabel}
      />

      {/* Pages 2–5 — Category detail */}
      {CATEGORY_DETAIL_PAGES.map((p) => (
        <ProductMixCategoryDetailPage
          key={p.key}
          data={data[p.key]}
          displayName={p.displayName}
          dateRangeLabel={dateRangeLabel}
          compareLabel={compareLabel}
        />
      ))}

      {/* Pages 6–8 — Top 5 by channel */}
      {CHANNEL_PAGES.map((p) => {
        const pageData = data[p.key];
        if (pageData.grandTotal === 0) return null;
        return (
          <Top5ByChannelPage
            key={p.key}
            data={pageData}
            dateRangeLabel={dateRangeLabel}
            branchLabel={branchLabel}
          />
        );
      })}
    </div>
  );
}

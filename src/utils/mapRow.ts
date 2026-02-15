import { normalizeText } from "./normalize";
import type { RawRow, ProcessedRow, MappingEntry, Category } from "./types";

const DOT_SIG_PATTERNS = [
  "dot signatures",
  "del - dot signatures",
  "del-dot signatures",
  "deldotsignatures",
  "dotsignatures",
];

function isDotSignature(rawCatNorm: string): boolean {
  // Check if any pattern is contained in the normalized category
  const collapsed = rawCatNorm.replace(/[\s-]/g, "");
  for (const p of DOT_SIG_PATTERNS) {
    const pc = p.replace(/[\s-]/g, "");
    if (collapsed.includes(pc)) return true;
  }
  return rawCatNorm.includes("dot signatures");
}

function isSkipped(row: RawRow): boolean {
  const name = row.rawItemName.trim();
  if (!name || name === "-") return true;
  if (isNaN(row.quantity) || isNaN(row.unitPrice)) return true;
  return false;
}

export function mapRow(row: RawRow, mappingTable: MappingEntry[]): ProcessedRow {
  if (isSkipped(row)) {
    return { ...row, rowSales: 0, mappedCat: null, mappedItemName: null, status: "SKIPPED" };
  }

  const rowSales = row.quantity * row.unitPrice;
  const rawItemNorm = normalizeText(row.rawItemName);
  const rawCatNorm = normalizeText(row.rawCategory);

  // Find mapping match
  const match = mappingTable.find(m => (m.utakNorm || normalizeText(m.UTAK)) === rawItemNorm);

  // Override: DOT SIGNATURES → ICED
  if (isDotSignature(rawCatNorm)) {
    return {
      ...row,
      rowSales,
      mappedCat: "ICED",
      mappedItemName: match ? match.ITEM_NAME : row.rawItemName,
      status: match ? "MAPPED" : "UNMAPPED",
    };
  }

  if (match) {
    return {
      ...row,
      rowSales,
      mappedCat: match.CAT.toUpperCase() as Category,
      mappedItemName: match.ITEM_NAME,
      status: "MAPPED",
    };
  }

  return { ...row, rowSales, mappedCat: null, mappedItemName: null, status: "UNMAPPED" };
}

import Papa from "papaparse";

export function parseCsvFile(file: File): Promise<{ headers: string[]; data: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const data = results.data as Record<string, string>[];
        resolve({ headers, data });
      },
      error: (err) => reject(err),
    });
  });
}

const HEADER_HINTS: Record<string, string[]> = {
  rawCategory: ["category", "cat", "rawcategory", "raw_category", "type"],
  rawItemName: ["item", "item_name", "itemname", "rawitemname", "raw_item_name", "name", "product", "description"],
  option: ["option", "modifier", "variant", "size"],
  quantity: ["quantity", "qty", "num"],
  unitPrice: ["unit_price", "unitprice", "price", "unit price", "price per unit"],
  paymentType: ["payment_type", "payment type", "channel", "order_type", "order type"],
  transactionId: ["transaction id", "transaction_id", "txn id", "txn_id"],
  receiptNo: ["receipt no", "receipt_no", "receipt number"],
  grossPrice: ["gross price", "gross_price"],
  discountedPrice: ["discounted price", "discounted_price"],
  // POS exports use "Pax Discount Amount - regular" (hyphen → spaces after normalize)
  regularDiscount: [
    "pax discount amount regular",
    "pax discount amount - regular",
    "regular discount",
  ],
  seniorDiscount: [
    "pax discount amount senior",
    "pax discount amount - senior",
    "senior discount",
  ],
  pwdDiscount: [
    "pax discount amount pwd",
    "pax discount amount - pwd",
    "pwd discount",
  ],
  // Prefer line-level VAT Exemption; pax VAT exemption columns are fallbacks
  vatExemption: ["vat exemption", "pax vat exemption"],
};

/** Normalize header text for fuzzy matching (lowercase, collapse punctuation to spaces). */
function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function autoDetectColumns(headers: string[]): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  const lowerHeaders = headers.map(normalizeHeader);

  for (const [field, hints] of Object.entries(HEADER_HINTS)) {
    for (const hint of hints) {
      const normHint = normalizeHeader(hint);
      const idx = lowerHeaders.findIndex((h) => h === normHint || h.includes(normHint));
      if (idx !== -1 && !Object.values(result).includes(headers[idx])) {
        result[field] = headers[idx];
        break;
      }
    }
  }
  return result;
}

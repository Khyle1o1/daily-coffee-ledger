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
  quantity: ["quantity", "qty", "count", "num"],
  unitPrice: ["unit_price", "unitprice", "price", "unit price", "price per unit"],
};

export function autoDetectColumns(headers: string[]): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  const lowerHeaders = headers.map(h => h.trim().toLowerCase().replace(/[^a-z0-9_ ]/g, ""));

  for (const [field, hints] of Object.entries(HEADER_HINTS)) {
    for (const hint of hints) {
      const idx = lowerHeaders.findIndex(h => h === hint || h.includes(hint));
      if (idx !== -1 && !Object.values(result).includes(headers[idx])) {
        result[field] = headers[idx];
        break;
      }
    }
  }
  return result;
}

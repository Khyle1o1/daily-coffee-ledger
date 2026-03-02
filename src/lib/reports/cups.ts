const CUP_KEYWORDS = ["cup", "iced cup", "hot cup"] as const;

export function isCupItem(itemName: string): boolean {
  const n = itemName.toLowerCase();
  return CUP_KEYWORDS.some((kw) => n.includes(kw));
}

export { CUP_KEYWORDS };


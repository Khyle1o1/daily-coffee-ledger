/** Official DOT Coffee design tokens for analytics UI. */

export const BRAND = {
  blue: "#1769E0",
  orange: "#F7652B",
  purple: "#7450C8",
  teal: "#2997A8",
  merch: "#C9A227",
  navy: "#172B4D",
  muted: "#667085",
  border: "#E6E8EC",
  cream: "#F7F4EE",
  white: "#FFFFFF",
  success: "#12B76A",
  danger: "#F04438",
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  ICED: BRAND.blue,
  HOT: BRAND.orange,
  SNACKS: BRAND.purple,
  "ADD-ONS": BRAND.teal,
  MERCH: BRAND.merch,
  PROMO: "#98A2B3",
  "LOYALTY CARD": BRAND.navy,
  PACKAGING: "#D0D5DD",
};

export const CATEGORY_LABELS: Record<string, string> = {
  ICED: "Iced",
  HOT: "Hot",
  SNACKS: "Snacks",
  "ADD-ONS": "Add-ons",
  MERCH: "Merch",
  PROMO: "Promo",
  "LOYALTY CARD": "Loyalty Card",
  PACKAGING: "Packaging",
};

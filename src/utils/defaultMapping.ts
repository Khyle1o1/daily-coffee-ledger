import { normalizeText } from "./normalize";
import type { MappingEntry } from "./types";

// Built-in default mapping table for DOT Coffee
const RAW_MAPPING: Omit<MappingEntry, "utakNorm">[] = [
  // ICED
  { CAT: "ICED", ITEM_NAME: "Iced Americano", UTAK: "Iced Americano" },
  { CAT: "ICED", ITEM_NAME: "Iced Latte", UTAK: "Iced Latte" },
  { CAT: "ICED", ITEM_NAME: "Iced Mocha", UTAK: "Iced Mocha" },
  { CAT: "ICED", ITEM_NAME: "Iced Caramel Macchiato", UTAK: "Iced Caramel Macchiato" },
  { CAT: "ICED", ITEM_NAME: "Iced Vanilla Latte", UTAK: "Iced Vanilla Latte" },
  { CAT: "ICED", ITEM_NAME: "Iced Hazelnut Latte", UTAK: "Iced Hazelnut Latte" },
  { CAT: "ICED", ITEM_NAME: "Iced Spanish Latte", UTAK: "Iced Spanish Latte" },
  { CAT: "ICED", ITEM_NAME: "Iced White Mocha", UTAK: "Iced White Mocha" },
  { CAT: "ICED", ITEM_NAME: "Iced Matcha Latte", UTAK: "Iced Matcha Latte" },
  { CAT: "ICED", ITEM_NAME: "Iced Dark Mocha", UTAK: "Iced Dark Mocha" },
  { CAT: "ICED", ITEM_NAME: "Iced Chocolate", UTAK: "Iced Chocolate" },
  { CAT: "ICED", ITEM_NAME: "DOT Signature Iced Coffee", UTAK: "DOT Signature Iced Coffee" },
  { CAT: "ICED", ITEM_NAME: "Iced Coffee", UTAK: "Iced Coffee" },
  { CAT: "ICED", ITEM_NAME: "Iced Cafe Latte", UTAK: "Iced Cafe Latte" },
  { CAT: "ICED", ITEM_NAME: "Cookies & Cream", UTAK: "Cookies & Cream" },
  { CAT: "ICED", ITEM_NAME: "Strawberry Milk", UTAK: "Strawberry Milk" },
  { CAT: "ICED", ITEM_NAME: "Mango Graham", UTAK: "Mango Graham" },
  { CAT: "ICED", ITEM_NAME: "Taro Latte", UTAK: "Taro Latte" },
  { CAT: "ICED", ITEM_NAME: "Ube Latte", UTAK: "Ube Latte" },

  // HOT
  { CAT: "HOT", ITEM_NAME: "Hot Americano", UTAK: "Hot Americano" },
  { CAT: "HOT", ITEM_NAME: "Hot Latte", UTAK: "Hot Latte" },
  { CAT: "HOT", ITEM_NAME: "Hot Mocha", UTAK: "Hot Mocha" },
  { CAT: "HOT", ITEM_NAME: "Hot Caramel Macchiato", UTAK: "Hot Caramel Macchiato" },
  { CAT: "HOT", ITEM_NAME: "Hot Vanilla Latte", UTAK: "Hot Vanilla Latte" },
  { CAT: "HOT", ITEM_NAME: "Hot Chocolate", UTAK: "Hot Chocolate" },
  { CAT: "HOT", ITEM_NAME: "Hot Matcha Latte", UTAK: "Hot Matcha Latte" },
  { CAT: "HOT", ITEM_NAME: "Hot Spanish Latte", UTAK: "Hot Spanish Latte" },
  { CAT: "HOT", ITEM_NAME: "Hot Coffee", UTAK: "Hot Coffee" },

  // SNACKS
  { CAT: "SNACKS", ITEM_NAME: "Croissant", UTAK: "Croissant" },
  { CAT: "SNACKS", ITEM_NAME: "Ham & Cheese Croissant", UTAK: "Ham & Cheese Croissant" },
  { CAT: "SNACKS", ITEM_NAME: "Chocolate Croissant", UTAK: "Chocolate Croissant" },
  { CAT: "SNACKS", ITEM_NAME: "Banana Bread", UTAK: "Banana Bread" },
  { CAT: "SNACKS", ITEM_NAME: "Cookies", UTAK: "Cookies" },
  { CAT: "SNACKS", ITEM_NAME: "Brownies", UTAK: "Brownies" },
  { CAT: "SNACKS", ITEM_NAME: "Cinnamon Roll", UTAK: "Cinnamon Roll" },
  { CAT: "SNACKS", ITEM_NAME: "Ensaymada", UTAK: "Ensaymada" },
  { CAT: "SNACKS", ITEM_NAME: "Pandesal", UTAK: "Pandesal" },
  { CAT: "SNACKS", ITEM_NAME: "Sandwich", UTAK: "Sandwich" },

  // ADD-ONS
  { CAT: "ADD-ONS", ITEM_NAME: "Extra Shot", UTAK: "Extra Shot" },
  { CAT: "ADD-ONS", ITEM_NAME: "Syrup", UTAK: "Syrup" },
  { CAT: "ADD-ONS", ITEM_NAME: "Whipped Cream", UTAK: "Whipped Cream" },
  { CAT: "ADD-ONS", ITEM_NAME: "Oat Milk", UTAK: "Oat Milk" },
  { CAT: "ADD-ONS", ITEM_NAME: "Soy Milk", UTAK: "Soy Milk" },
  { CAT: "ADD-ONS", ITEM_NAME: "Pearl", UTAK: "Pearl" },
  { CAT: "ADD-ONS", ITEM_NAME: "Nata de Coco", UTAK: "Nata de Coco" },
  { CAT: "ADD-ONS", ITEM_NAME: "Size Upgrade", UTAK: "Size Upgrade" },

  // CANNED
  { CAT: "CANNED", ITEM_NAME: "Canned Coffee", UTAK: "Canned Coffee" },
  { CAT: "CANNED", ITEM_NAME: "Canned Juice", UTAK: "Canned Juice" },
  { CAT: "CANNED", ITEM_NAME: "Bottled Water", UTAK: "Bottled Water" },
  { CAT: "CANNED", ITEM_NAME: "Soda", UTAK: "Soda" },

  // COLD BREW
  { CAT: "COLD BREW", ITEM_NAME: "Cold Brew Black", UTAK: "Cold Brew Black" },
  { CAT: "COLD BREW", ITEM_NAME: "Cold Brew Latte", UTAK: "Cold Brew Latte" },
  { CAT: "COLD BREW", ITEM_NAME: "Cold Brew Vanilla", UTAK: "Cold Brew Vanilla" },

  // MERCH
  { CAT: "MERCH", ITEM_NAME: "Tumbler", UTAK: "Tumbler" },
  { CAT: "MERCH", ITEM_NAME: "Mug", UTAK: "Mug" },
  { CAT: "MERCH", ITEM_NAME: "Tote Bag", UTAK: "Tote Bag" },

  // PROMO
  { CAT: "PROMO", ITEM_NAME: "Promo Bundle", UTAK: "Promo Bundle" },
  { CAT: "PROMO", ITEM_NAME: "Promo Drink", UTAK: "Promo Drink" },

  // LOYALTY CARD
  { CAT: "LOYALTY CARD", ITEM_NAME: "Loyalty Card", UTAK: "Loyalty Card" },
  { CAT: "LOYALTY CARD", ITEM_NAME: "Loyalty Card Reload", UTAK: "Loyalty Card Reload" },

  // PACKAGING
  { CAT: "PACKAGING", ITEM_NAME: "Paper Bag", UTAK: "Paper Bag" },
  { CAT: "PACKAGING", ITEM_NAME: "Plastic Bag", UTAK: "Plastic Bag" },
  { CAT: "PACKAGING", ITEM_NAME: "Cup Carrier", UTAK: "Cup Carrier" },
  { CAT: "PACKAGING", ITEM_NAME: "Box", UTAK: "Box" },
];

export const DEFAULT_MAPPING: MappingEntry[] = RAW_MAPPING.map(m => ({
  ...m,
  utakNorm: normalizeText(m.UTAK),
}));

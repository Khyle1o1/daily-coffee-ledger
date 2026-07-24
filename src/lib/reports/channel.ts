export type SalesChannel = "WALK_IN" | "GRAB" | "FOODPANDA" | "DOTAPP" | "EVENT";

export function getChannelFromPaymentType(paymentType?: string | null): SalesChannel {
  const v = (paymentType ?? "").toLowerCase().trim();
  // Use startsWith so that split-payment strings like "Cash 20 + Grab 180" (which contain
  // "grab" but are actually walk-in transactions paid partly with GrabPay/voucher) are not
  // mis-classified as Grab Food Delivery orders.
  if (v.startsWith("grab")) return "GRAB";
  if (v.startsWith("foodpanda") || v.startsWith("food panda")) return "FOODPANDA";
  if (v.includes("dotapp") || v.includes("dot app") || v.includes("app")) return "DOTAPP";
  if (v.includes("event")) return "EVENT";
  return "WALK_IN";
}


export type SalesChannel = "WALK_IN" | "GRAB" | "FOODPANDA" | "DOTAPP";

export function getChannelFromPaymentType(paymentType?: string | null): SalesChannel {
  const v = (paymentType ?? "").toLowerCase().trim();
  if (v.includes("grab")) return "GRAB";
  if (v.includes("foodpanda") || v.includes("food panda")) return "FOODPANDA";
  if (v.includes("dotapp") || v.includes("dot app") || v.includes("app")) return "DOTAPP";
  return "WALK_IN";
}


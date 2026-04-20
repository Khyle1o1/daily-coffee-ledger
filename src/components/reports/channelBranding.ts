import type { LucideIcon } from "lucide-react";
import { Bike, Store, UtensilsCrossed } from "lucide-react";

export type ChannelKey = "WALK_IN" | "GRAB" | "FOODPANDA";

export interface ChannelBranding {
  key: ChannelKey;
  title: string;
  logoSrc: string;
  fallbackIcon: LucideIcon;
  accentClass: string;
  badgeClass: string;
  headerBgClass: string;
}

/**
 * Centralized, swappable channel branding config.
 * Replace logoSrc files anytime without changing report layout logic.
 */
export const CHANNEL_BRANDING: ChannelBranding[] = [
  {
    key: "WALK_IN",
    title: "Walk-in",
    logoSrc: "/walk-in.png",
    fallbackIcon: Store,
    accentClass: "text-[#1e3a5f]",
    badgeClass: "bg-[#1e3a5f]/10 text-[#1e3a5f] border-[#1e3a5f]/20",
    headerBgClass: "bg-[#1e3a5f]/5",
  },
  {
    key: "GRAB",
    title: "Grab",
    logoSrc: "/grab.jpg",
    fallbackIcon: Bike,
    accentClass: "text-emerald-700",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    headerBgClass: "bg-emerald-50",
  },
  {
    key: "FOODPANDA",
    title: "FoodPanda",
    logoSrc: "/foodpanda.png",
    fallbackIcon: UtensilsCrossed,
    accentClass: "text-rose-700",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
    headerBgClass: "bg-rose-50",
  },
];


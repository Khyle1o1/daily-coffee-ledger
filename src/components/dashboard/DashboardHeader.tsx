import { getRoleLabel } from "@/lib/permissions";
import type { UserRole } from "@/lib/supabase-types";

export function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function getDashboardGreeting(role: UserRole | null | undefined) {
  const who = role === "admin" ? "Admin" : getRoleLabel(role);
  return `${getTimeGreeting()}, ${who === "–" ? "there" : who}! 👋`;
}

export function DashboardHeader({
  title,
  subtitle = "Here's what's happening with your business today.",
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-w-0">
      <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight text-[#172B4D] sm:text-[30px]">
        {title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

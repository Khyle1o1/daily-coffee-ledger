import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  LayoutList,
  Wallet,
  Shield,
  ScrollText,
  Link2,
  Settings,
  Coffee,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const OVERVIEW: NavItem[] = [
  { to: "/app/summary", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
  { to: "/app/monthly-branch-report", label: "Monthly Branch", icon: LayoutList },
];

const FINANCE: NavItem[] = [
  { to: "/app/daily-cash-ledger", label: "Cash Ledger", icon: Wallet },
];

const MANAGEMENT: NavItem[] = [
  { to: "/app/users", label: "User Management", icon: Shield },
  { to: "/app/activity-logs", label: "Activity Logs", icon: ScrollText },
  { to: "/app/directory", label: "Directory", icon: Link2 },
];

const SYSTEM: NavItem[] = [
  { to: "/app/settings", label: "Settings", icon: Settings },
];

function NavSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  onNavigate?: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="px-3 mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-[#172B4D]/80 hover:bg-[#F7F4EE] hover:text-[#172B4D]",
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

export function Sidebar({
  isAdmin,
  onNavigate,
}: {
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  return (
    <aside className="flex h-full min-h-0 w-[240px] flex-col overflow-hidden border-r border-border bg-white">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary text-primary-foreground">
          <Coffee className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15px] font-semibold text-[#172B4D]">DOT Coffee</p>
          <p className="truncate text-xs text-muted-foreground">Daily Ledger</p>
        </div>
      </div>

      <nav className="scrollbar-none flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main">
        <NavSection title="Overview" items={OVERVIEW} onNavigate={onNavigate} />
        <div className="mx-3 border-t border-border" />
        <NavSection title="Finance" items={FINANCE} onNavigate={onNavigate} />
        {isAdmin && (
          <>
            <div className="mx-3 border-t border-border" />
            <NavSection title="Management" items={MANAGEMENT} onNavigate={onNavigate} />
            <div className="mx-3 border-t border-border" />
            <NavSection title="System" items={SYSTEM} onNavigate={onNavigate} />
          </>
        )}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <a
          href="mailto:admin@dot.com?subject=DOT%20Coffee%20Daily%20Ledger%20support"
          className="flex items-center gap-3 rounded-[12px] bg-[#F4F5F7] px-3 py-3 text-sm transition-colors hover:bg-[#ECEEF2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#172B4D]">
            <Headphones className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Need help?</span>
            <span className="block font-medium text-[#172B4D]">Contact support →</span>
          </span>
        </a>
      </div>
    </aside>
  );
}

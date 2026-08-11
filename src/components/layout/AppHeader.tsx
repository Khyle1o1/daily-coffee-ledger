import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/layout/UserMenu";
import type { UserRole } from "@/lib/supabase-types";

export type HeaderNotice = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};

const SEARCHABLE_PAGES = [
  { label: "Dashboard", to: "/app/summary", keywords: "home summary overview" },
  { label: "Reports", to: "/app/reports", keywords: "hq mix product" },
  { label: "Monthly Branch", to: "/app/monthly-branch-report", keywords: "month branch" },
  { label: "Cash Ledger", to: "/app/daily-cash-ledger", keywords: "finance cash" },
  { label: "User Management", to: "/app/users", keywords: "admin accounts" },
  { label: "Activity Logs", to: "/app/activity-logs", keywords: "audit trail" },
  { label: "Directory", to: "/app/directory", keywords: "links" },
  { label: "Settings", to: "/app/settings", keywords: "branches mapping" },
];

const ADMIN_PATHS = new Set([
  "/app/users",
  "/app/activity-logs",
  "/app/directory",
  "/app/settings",
]);

export function AppHeader({
  title,
  subtitle,
  email,
  role,
  isAdmin = false,
  notices = [],
  onSignOut,
  onOpenMobileNav,
}: {
  title: string;
  subtitle?: string;
  email?: string | null;
  role: UserRole | null | undefined;
  isAdmin?: boolean;
  notices?: HeaderNotice[];
  onSignOut: () => void;
  onOpenMobileNav: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const results = useMemo(() => {
    const visible = SEARCHABLE_PAGES.filter((page) => isAdmin || !ADMIN_PATHS.has(page.to));
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((page) =>
      `${page.label} ${page.keywords}`.toLowerCase().includes(q),
    );
  }, [query, isAdmin]);

  return (
    <header className="shrink-0 border-b border-border/80 bg-background/90 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="mt-0.5 h-9 w-9 shrink-0 md:hidden"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight text-[#172B4D] sm:text-[30px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Search anything..."
              className="h-10 w-[220px] rounded-full border-border bg-white pl-9 lg:w-[260px]"
              aria-label="Search pages"
            />
            {searchOpen && (
              <div className="absolute right-0 z-30 mt-2 w-[260px] overflow-hidden rounded-xl border border-border bg-white shadow-card">
                {results.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">No matching pages</p>
                ) : (
                  results.map((page) => (
                    <button
                      key={page.to}
                      type="button"
                      className="block w-full px-3 py-2.5 text-left text-sm text-[#172B4D] hover:bg-muted/70"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        navigate(page.to);
                        setQuery("");
                        setSearchOpen(false);
                      }}
                    >
                      {page.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="relative h-10 w-10 rounded-full border-border bg-white"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {notices.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {notices.length > 9 ? "9+" : notices.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notices.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  No reports need attention right now.
                </p>
              ) : (
                notices.map((notice) => (
                  <DropdownMenuItem
                    key={notice.id}
                    className="flex cursor-pointer flex-col items-start gap-0.5 py-2.5"
                    onClick={() => notice.href && navigate(notice.href)}
                  >
                    <span className="text-sm font-medium">{notice.title}</span>
                    <span className="text-xs text-muted-foreground">{notice.detail}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <UserMenu email={email} role={role} onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  );
}

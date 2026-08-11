import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getRoleLabel } from "@/lib/permissions";
import type { UserRole } from "@/lib/supabase-types";

function initialsFromEmail(email?: string | null) {
  if (!email) return "AD";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "AD";
}

function roleDisplay(role: UserRole | null | undefined) {
  if (role === "admin") return "Administrator";
  return getRoleLabel(role);
}

export function UserMenu({
  email,
  role,
  onSignOut,
}: {
  email?: string | null;
  role: UserRole | null | undefined;
  onSignOut: () => void;
}) {
  const initials = initialsFromEmail(email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 rounded-[12px] px-1.5 py-1 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
            {initials}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-[13px] font-medium text-[#172B4D]">
              {email ?? "Signed in"}
            </span>
            <span className="block text-xs text-muted-foreground">{roleDisplay(role)}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{email}</p>
              <p className="text-xs text-muted-foreground">{roleDisplay(role)}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

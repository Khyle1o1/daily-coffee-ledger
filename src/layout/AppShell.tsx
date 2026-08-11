import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/auth/useAuth";
import { useToast } from "@/hooks/use-toast";
import { logEvent } from "@/services/auditService";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader, type HeaderNotice } from "@/components/layout/AppHeader";
import { getDashboardGreeting } from "@/components/dashboard/DashboardHeader";
import { useDailyReportsQuery } from "@/hooks/queries/useDailyReportsQuery";

const PAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  "/app/reports": {
    title: "Reports",
    subtitle: "Generate HQ-style reports for branch performance and product mix.",
  },
  "/app/monthly-branch-report": {
    title: "Monthly Branch",
    subtitle: "Compare branch performance across months.",
  },
  "/app/daily-cash-ledger": {
    title: "Cash Ledger",
    subtitle: "Review daily cash movement and POS-derived ledger entries.",
  },
  "/app/users": {
    title: "User Management",
    subtitle: "Create and manage user accounts and roles.",
  },
  "/app/activity-logs": {
    title: "Activity Logs",
    subtitle: "Audit trail of actions across Daily Ledger.",
  },
  "/app/directory": {
    title: "Directory",
    subtitle: "Shared links and operational shortcuts.",
  },
  "/app/settings": {
    title: "Settings",
    subtitle: "Configure branches, mappings, and system preferences.",
  },
};

export default function AppShell() {
  const { user, role, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const { data: noticeReports } = useDailyReportsQuery({ pageSize: 100 });

  const notices = useMemo<HeaderNotice[]>(() => {
    const reports = noticeReports?.reports ?? [];
    return reports
      .filter((report) => (report.unmappedRows ?? 0) > 0)
      .slice(0, 6)
      .map((report) => ({
        id: report.id,
        title: `${report.unmappedRows} item${report.unmappedRows === 1 ? "" : "s"} need review`,
        detail: `${report.branch} · ${report.date}`,
        href: "/app/summary",
      }));
  }, [noticeReports]);

  const handleLogout = async () => {
    void logEvent({ action: "logout", module: "auth", details: `${user?.email} signed out` });
    await signOut();
    toast({ title: "Signed out", description: "You have been successfully signed out." });
    navigate("/login");
  };

  const isDashboard = location.pathname.includes("/summary");
  const page = Object.entries(PAGE_COPY).find(([path]) => location.pathname.startsWith(path))?.[1];
  const title = isDashboard ? getDashboardGreeting(role) : page?.title ?? "Dashboard";
  const subtitle = isDashboard
    ? "Here's what's happening with your business today."
    : page?.subtitle;

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      <div className="hidden h-full w-[240px] shrink-0 md:block">
        <Sidebar isAdmin={!!isAdmin} />
      </div>

      <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <SheetContent side="left" className="w-[250px] border-r border-border bg-white p-0">
          <Sidebar isAdmin={!!isAdmin} onNavigate={() => setIsMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader
          title={title}
          subtitle={subtitle}
          email={user?.email}
          role={role}
          isAdmin={!!isAdmin}
          notices={notices}
          onSignOut={() => void handleLogout()}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />

        <main className="scrollbar-none min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

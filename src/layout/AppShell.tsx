import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Coffee,
  Calendar,
  LogOut,
  User,
  Shield,
  PanelLeftOpen,
  PanelLeftClose,
  BarChart3,
  Link2,
  Settings,
  Eye,
  ScrollText,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getRoleBadgeClass, getRoleLabel } from '@/lib/permissions';
import { logEvent } from '@/services/auditService';

function SidebarNav({
  isAdmin,
  isViewer,
  appVersion,
  badgeTitle,
  collapsed = false,
  responsiveCompact = true,
  onNavigate,
}: {
  isAdmin: boolean;
  isViewer: boolean;
  appVersion: string;
  badgeTitle?: string;
  collapsed?: boolean;
  responsiveCompact?: boolean;
  onNavigate?: () => void;
}) {
  const compact = collapsed;

  const navLink = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center ${compact ? 'justify-center' : 'gap-3'} px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
          isActive
            ? 'bg-white text-[#0e2d49] shadow-lg shadow-black/40'
            : 'text-primary-foreground/80 hover:bg-white/10'
        }`
      }
      title={compact ? label : undefined}
    >
      {icon}
      {!compact && (
        <span className={responsiveCompact ? "hidden 2xl:inline" : "inline"}>
          {label}
        </span>
      )}
    </NavLink>
  );

  return (
    <aside
      className={cn(
        "bg-[#0e2d49] text-primary-foreground flex h-full flex-col overflow-hidden border-r border-white/10",
        compact ? "w-[86px]" : "w-[86px] 2xl:w-[280px]",
      )}
    >
      {/* Logo / Brand */}
      <div className={cn("pt-6 pb-4 border-b border-white/10", compact ? "px-3" : "px-6")}>
        <div className={cn("flex items-center", compact ? "justify-center" : "gap-3")}>
          <div className="bg-white/10 rounded-2xl p-2.5 shadow-md shadow-black/40">
            <Coffee className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          {!compact && (
            <div className={cn("leading-tight", responsiveCompact ? "hidden 2xl:block" : "block")}>
              <h1 className="text-base font-semibold tracking-tight">DOT Coffee</h1>
              <p className="text-[11px] text-primary-foreground/70">Daily Ledger</p>
            </div>
          )}
        </div>
        {!compact && (
          <span
            title={badgeTitle}
            className={cn(
              "items-center mt-3 text-[10px] px-2.5 py-1 rounded-full bg-white/10 text-primary-foreground/90 font-semibold tracking-wide",
              responsiveCompact ? "hidden 2xl:inline-flex" : "inline-flex",
            )}
          >
            {`Build v${appVersion}`}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto pt-4 pb-6 space-y-1",
          compact ? "px-2" : "px-3",
        )}
      >
        {!compact && (
          <p
            className={cn(
              "px-3 text-[11px] font-semibold tracking-[0.16em] text-primary-foreground/50 uppercase",
              responsiveCompact ? "hidden 2xl:block" : "block",
            )}
          >
            Navigation
          </p>
        )}

        {navLink('/app/summary', <Calendar className="h-5 w-5" />, 'Summary')}
        {navLink('/app/reports', <BarChart3 className="h-5 w-5" />, 'Reports')}

        {isAdmin && navLink('/app/users', <Shield className="h-5 w-5" />, 'User Management')}
        {isAdmin && navLink('/app/activity-logs', <ScrollText className="h-5 w-5" />, 'Activity Logs')}
        {isAdmin && navLink('/app/directory', <Link2 className="h-5 w-5" />, 'Directory')}
        {isAdmin && navLink('/app/settings', <Settings className="h-5 w-5" />, 'Settings')}
      </nav>
    </aside>
  );
}

export default function AppShell() {
  const { user, role, isAdmin, isViewer, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const appVersion =
    import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    import.meta.env.VITE_APP_VERSION ||
    "local";
  const appBranch = import.meta.env.VITE_VERCEL_GIT_COMMIT_REF || "local";

  const handleLogout = async () => {
    void logEvent({ action: 'logout', module: 'auth', details: `${user?.email} signed out` });
    await signOut();
    toast({ title: 'Signed out', description: 'You have been successfully signed out.' });
    navigate('/login');
  };

  const getPageTitle = () => {
    if (location.pathname.includes('/summary'))       return 'Summary';
    if (location.pathname.includes('/reports'))       return 'Reports';
    if (location.pathname.includes('/users'))         return 'User Management';
    if (location.pathname.includes('/activity-logs')) return 'Activity Logs';
    if (location.pathname.includes('/directory'))     return 'Directory';
    if (location.pathname.includes('/settings'))      return 'Settings';
    return 'Dashboard';
  };

  const roleLabel = getRoleLabel(role);
  const roleBadgeClass = getRoleBadgeClass(role);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="hidden h-screen shrink-0 overflow-hidden md:sticky md:top-0 md:block">
        <SidebarNav
          isAdmin={!!isAdmin}
          isViewer={!!isViewer}
          appVersion={appVersion}
          badgeTitle={`Branch: ${appBranch}`}
          collapsed={isSidebarCollapsed}
        />
      </div>

      <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <SheetContent side="left" className="w-[272px] p-0 border-r border-white/10 bg-[#0e2d49]">
          <SidebarNav
            isAdmin={!!isAdmin}
            isViewer={!!isViewer}
            appVersion={appVersion}
            badgeTitle={`Branch: ${appBranch}`}
            collapsed={false}
            responsiveCompact={false}
            onNavigate={() => setIsMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex h-screen min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="shrink-0 bg-primary shadow-md">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="md:hidden h-9 w-9 rounded-full border-2 border-primary-foreground/70 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground hover:text-primary shrink-0"
                  onClick={() => setIsMobileNavOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="hidden 2xl:inline-flex h-9 w-9 rounded-full border-2 border-primary-foreground/70 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                  onClick={() => setIsSidebarCollapsed(prev => !prev)}
                >
                  {isSidebarCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
                <h2 className="text-lg sm:text-xl font-bold text-primary-foreground truncate">
                  {getPageTitle()}
                </h2>
              </div>

              <div className="w-full sm:w-auto flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-3">
                <div className="min-w-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-primary-foreground/10">
                  {isAdmin ? (
                    <Shield className="h-4 w-4 text-primary-foreground" />
                  ) : isViewer ? (
                    <Eye className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <User className="h-4 w-4 text-primary-foreground" />
                  )}
                  <span className="text-xs sm:text-sm font-medium text-primary-foreground truncate max-w-[120px] sm:max-w-[220px]">
                    {user?.email}
                  </span>
                  <span className={`ml-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${roleBadgeClass}`}>
                    {roleLabel}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-2 border-primary-foreground/70 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary h-9 px-3 sm:px-4"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="scrollbar-none min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

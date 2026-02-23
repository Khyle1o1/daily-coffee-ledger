import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Coffee, Calendar, LogOut, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/hooks/use-toast';

function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <aside className="w-[260px] lg:w-[280px] bg-[#0e2d49] text-primary-foreground flex flex-col border-r border-white/10">
      {/* Logo / Brand */}
      <div className="px-6 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 rounded-2xl p-2.5 shadow-md shadow-black/40">
            <Coffee className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight">DOT Coffee</h1>
            <p className="text-[11px] text-primary-foreground/70">Daily Ledger</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 mt-3 text-[10px] px-2.5 py-1 rounded-full bg-white/10 text-primary-foreground/90 font-semibold tracking-wide">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          MVP
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 pb-6 space-y-1">
        <p className="px-3 text-[11px] font-semibold tracking-[0.16em] text-primary-foreground/50 uppercase">
          Navigation
        </p>

        <NavLink
          to="/app/summary"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
              isActive
                ? "bg-white text-[#0e2d49] shadow-lg shadow-black/40"
                : "text-primary-foreground/80 hover:bg-white/10"
            }`
          }
        >
          <Calendar className="h-5 w-5" />
          <span>Summary</span>
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/app/users"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-[#0e2d49] shadow-lg shadow-black/40"
                  : "text-primary-foreground/80 hover:bg-white/10"
              }`
            }
          >
            <Shield className="h-5 w-5" />
            <span>User Management</span>
          </NavLink>
        )}
      </nav>
    </aside>
  );
}

export default function AppShell() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleLogout = async () => {
    await signOut();
    toast({
      title: 'Signed out',
      description: 'You have been successfully signed out.',
    });
    navigate('/login');
  };

  const getPageTitle = () => {
    if (location.pathname.includes('/summary')) return 'Summary';
    if (location.pathname.includes('/users')) return 'User Management';
    return 'Dashboard';
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Sidebar */}
      <SidebarNav isAdmin={!!isAdmin} />

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="bg-primary shadow-md">
          <div className="px-8 py-5">
            <div className="flex items-center justify-between">
              {/* Page Title */}
              <h2 className="text-xl font-bold text-primary-foreground">
                {getPageTitle()}
              </h2>

              {/* User Info and Logout */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10">
                  {isAdmin ? <Shield className="h-4 w-4 text-primary-foreground" /> : <User className="h-4 w-4 text-primary-foreground" />}
                  <span className="text-sm font-medium text-primary-foreground">{user?.email}</span>
                  {isAdmin && (
                    <Badge variant="secondary" className="ml-1">Admin</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-2 border-primary-foreground/70 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

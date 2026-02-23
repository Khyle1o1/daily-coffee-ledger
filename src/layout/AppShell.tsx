import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Coffee, Calendar, CalendarDays, LogOut, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function AppShell() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await signOut();
    toast({
      title: 'Signed out',
      description: 'You have been successfully signed out.',
    });
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="bg-primary sticky top-0 z-20 shadow-md">
        <div className="max-w-[1600px] mx-auto px-8 py-5">
          <div className="flex items-center justify-between mb-4">
            {/* Left: Logo and Title */}
            <div className="flex items-center gap-4">
              <Coffee className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
              <h1 className="text-2xl font-bold tracking-tight text-primary-foreground">
                DOT Coffee Daily Summary
              </h1>
              <span className="text-xs px-3 py-1 rounded-full border-2 border-primary-foreground/70 text-primary-foreground font-semibold">
                MVP
              </span>
            </div>

            {/* Right: User Info and Logout */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-primary-foreground">
                {isAdmin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                <span className="text-sm font-medium">{user?.email}</span>
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

          {/* Navigation Tabs */}
          <nav className="flex gap-3">
            <NavLink
              to="/app/daily"
              className={({ isActive }) =>
                `flex items-center gap-2 px-5 py-2.5 rounded-full border-2 font-medium transition-all ${
                  isActive
                    ? 'bg-primary-foreground text-primary border-primary-foreground'
                    : 'border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10'
                }`
              }
            >
              <Calendar className="h-4 w-4" />
              Daily Summary
            </NavLink>
            <NavLink
              to="/app/monthly"
              className={({ isActive }) =>
                `flex items-center gap-2 px-5 py-2.5 rounded-full border-2 font-medium transition-all ${
                  isActive
                    ? 'bg-primary-foreground text-primary border-primary-foreground'
                    : 'border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10'
                }`
              }
            >
              <CalendarDays className="h-4 w-4" />
              Monthly Summary
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/app/users"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-5 py-2.5 rounded-full border-2 font-medium transition-all ${
                    isActive
                      ? 'bg-primary-foreground text-primary border-primary-foreground'
                      : 'border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10'
                  }`
                }
              >
                <Shield className="h-4 w-4" />
                User Management
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}

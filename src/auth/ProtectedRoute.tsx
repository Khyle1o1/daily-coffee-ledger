import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Coffee } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-center">
          <Coffee className="h-16 w-16 text-primary-foreground animate-pulse mx-auto mb-4" />
          <p className="text-primary-foreground text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

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
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Coffee className="mx-auto mb-4 h-16 w-16 animate-pulse text-primary" />
          <p className="text-lg font-medium text-[#172B4D]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Navigate, Outlet } from 'react-router-dom';

export const ProtectedRoute: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--surface-bg)' }}>
        <div className="text-sm font-semibold animate-pulse" style={{ color: 'var(--ink-soft)' }}>
          Authenticating session...
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet />;
};

/**
 * AuthGate — wraps the app to enforce authentication when Supabase is connected.
 * When offline or auth is disabled, passes through without authentication.
 */

import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LoginPage } from './LoginPage';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { authEnabled, isAuthenticated, loading } = useAuth();

  // Auth not configured (offline mode) — pass through
  if (!authEnabled) {
    return <>{children}</>;
  }

  // Still checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a1a' }}>
        <p style={{ fontFamily: '"Press Start 2P", monospace', color: '#00ffd5', fontSize: 12 }}>
          AUTHENTICATING...
        </p>
      </div>
    );
  }

  // Not authenticated — show login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Authenticated — render app
  return <>{children}</>;
}

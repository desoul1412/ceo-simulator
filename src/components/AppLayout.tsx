import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';
import { AuthGate } from './AuthGate';
import { useDashboardStore } from '../store/dashboardStore';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

export function AppLayout() {
  const loadFromBackend = useDashboardStore(s => s.loadFromBackend);
  const loading = useDashboardStore(s => s.loading);

  useEffect(() => {
    loadFromBackend();
  }, [loadFromBackend]);

  useRealtimeSync();

  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100dvh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-hud)', color: 'var(--neon-cyan)',
        fontSize: 'var(--font-lg)',
        background: 'var(--hud-bg)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>▣</div>
          <div>CONNECTING TO MAINFRAME...</div>
          <div style={{ fontSize: 'var(--font-sm)', color: '#2a3a50', marginTop: 8 }}>
            Loading company data
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthGate>
      <div style={{
        width: '100%', height: '100dvh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--hud-bg)',
        overflow: 'hidden',
      }}>
        <NavBar />
        <div style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
        }}>
          <Outlet />
        </div>
      </div>
    </AuthGate>
  );
}

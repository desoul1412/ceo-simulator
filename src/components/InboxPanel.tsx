import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, getUnreadCount, markRead, markAllRead } from '../lib/orchestratorApi';
import { useDashboardStore } from '../store/dashboardStore';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  merge_request: 'MR',
  plan_approved: 'OK',
  alert: '!!',
  info: 'i',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function InboxPanel() {
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const loadCount = useCallback(async () => {
    if (!orchestratorConnected) return;
    const c = await getUnreadCount();
    setCount(c);
  }, [orchestratorConnected]);

  const loadNotifications = useCallback(async () => {
    if (!orchestratorConnected) return;
    const data = await fetchNotifications();
    setNotifications(data);
  }, [orchestratorConnected]);

  useEffect(() => {
    loadCount();
    const iv = setInterval(loadCount, 10_000);
    return () => clearInterval(iv);
  }, [loadCount]);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = async (n: Notification) => {
    await markRead(n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
    setCount(prev => Math.max(0, prev - 1));
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  const handleMarkAll = async () => {
    await markAllRead();
    setNotifications([]);
    setCount(0);
  };

  if (!orchestratorConnected) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 'var(--font-md)', padding: '4px 8px',
          color: open ? 'var(--neon-cyan)' : 'var(--hud-text-dim)',
          fontFamily: 'var(--font-hud)', position: 'relative',
        }}
      >
        {/* Bell icon */}
        <span style={{ fontSize: 'var(--font-sm)' }}>&#x1F514;</span>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 2,
            width: 14, height: 14, borderRadius: '50%',
            background: 'var(--neon-red)', color: '#fff',
            fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-hud)', lineHeight: 1,
            boxShadow: '0 0 6px var(--neon-red)',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0,
          width: 320, maxHeight: 400, overflow: 'auto',
          background: '#0d1117', border: '1px solid var(--hud-border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          zIndex: 1000,
          fontFamily: 'var(--font-hud)',
        }}>
          {/* Header */}
          <div style={{
            padding: '8px 10px', borderBottom: '1px solid var(--hud-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#090d14',
          }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Inbox
            </span>
            {notifications.length > 0 && (
              <button onClick={handleMarkAll} style={{
                padding: '2px 8px', fontSize: '10px',
                background: '#00ffff10', border: '1px solid #00ffff30',
                color: 'var(--neon-cyan)', cursor: 'pointer', fontFamily: 'var(--font-hud)',
                textTransform: 'uppercase',
              }}>
                Mark All Read
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 'var(--font-xs)', color: '#2a3a50' }}>
              No unread notifications
            </div>
          )}

          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              style={{
                padding: '8px 10px', borderBottom: '1px solid #0a0e14',
                cursor: 'pointer', display: 'flex', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0a0e14')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: 24, height: 24, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 'bold',
                background: n.type === 'merge_request' ? '#ff880018' : '#00ffff18',
                border: `1px solid ${n.type === 'merge_request' ? '#ff880040' : '#00ffff40'}`,
                color: n.type === 'merge_request' ? '#ff8800' : 'var(--neon-cyan)',
              }}>
                {TYPE_ICONS[n.type] ?? '?'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-xs)', color: '#8090a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.title}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--hud-text-dim)', marginTop: 2 }}>
                  {n.message}
                </div>
              </div>
              <span style={{ fontSize: '10px', color: '#2a3a50', flexShrink: 0 }}>
                {timeAgo(n.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

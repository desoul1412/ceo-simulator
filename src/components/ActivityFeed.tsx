import { useEffect, useState, useRef } from 'react';
import { fetchActivityLog } from '../lib/api';
import { supabase, isOnline } from '../lib/supabase';
import type { Company } from '../store/dashboardStore';

interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  created_at: string;
  agent_id: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  'goal-assigned':      '◆',
  'task-started':       '▶',
  'task-completed':     '✓',
  'delegation':         '→',
  'budget-spent':       '$',
  'agent-hired':        '+',
  'agent-fired':        '×',
  'status-change':      '●',
};

const TYPE_COLORS: Record<string, string> = {
  'goal-assigned':      '#00ffff',
  'task-started':       '#00ff88',
  'task-completed':     '#00ff88',
  'delegation':         '#c084fc',
  'budget-spent':       '#ff8800',
  'agent-hired':        '#00ff88',
  'agent-fired':        '#ff2244',
  'status-change':      '#4a5568',
};

interface ActivityFeedProps {
  company: Company;
}

export function ActivityFeed({ company }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial activity + periodic refresh
  const loadActivity = () => {
    if (!isOnline()) return;
    fetchActivityLog(company.id, 25).then(rows => {
      setEntries(rows.map(r => ({
        id: r.id,
        type: r.type,
        message: r.message,
        created_at: r.created_at,
        agent_id: r.agent_id,
      })));
    }).catch(() => {});
  };

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 10_000);
    return () => clearInterval(interval);
  }, [company.id]);

  // Subscribe to new activity in real-time
  useEffect(() => {
    if (!isOnline() || !supabase) return;

    const channel = supabase
      .channel(`activity-${company.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `company_id=eq.${company.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          setEntries(prev => [{
            id: row.id,
            type: row.type,
            message: row.message,
            created_at: row.created_at,
            agent_id: row.agent_id,
          }, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [company.id]);

  // Also generate local activity from employee state changes
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const prev = prevStatusRef.current;
    const now = new Date().toISOString();
    const newEntries: ActivityEntry[] = [];

    for (const emp of company.employees) {
      const prevStatus = prev.get(emp.id);
      if (prevStatus && prevStatus !== emp.status) {
        newEntries.push({
          id: `local-${emp.id}-${Date.now()}`,
          type: emp.status === 'working' ? 'task-started'
            : emp.status === 'break' ? 'task-completed'
            : 'status-change',
          message: emp.status === 'working'
            ? `${emp.role} started: ${emp.assignedTask ?? 'task'}`
            : emp.status === 'break'
            ? `${emp.role} completed their task`
            : `${emp.role} is now ${emp.status}`,
          created_at: now,
          agent_id: emp.id,
        });
      }
      prev.set(emp.id, emp.status);
    }

    if (newEntries.length > 0) {
      setEntries(prev => [...newEntries, ...prev].slice(0, 20));
    }
  }, [company.employees]);

  function formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch { return ''; }
  }

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#0d1117',
      border: '1px solid #1b2030',
      fontFamily: 'monospace',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '6px 10px',
        fontSize: 'var(--font-xs)',
        color: '#4a5568',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        borderBottom: '1px solid #1b2030',
        flexShrink: 0,
      }}>
        Activity Feed
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 8px',
        }}
      >
        {entries.length === 0 ? (
          <div style={{ fontSize: 'var(--font-sm)', color: '#2a3a50', fontStyle: 'italic', padding: '8px 0' }}>
            No activity yet
          </div>
        ) : (
          entries.map(entry => {
            const icon = TYPE_ICONS[entry.type] ?? '·';
            const color = TYPE_COLORS[entry.type] ?? '#4a5568';
            return (
              <div key={entry.id} style={{
                padding: '3px 0',
                borderBottom: '1px solid #0a0e14',
                display: 'flex',
                gap: 4,
                alignItems: 'flex-start',
              }}>
                <span style={{
                  fontSize: 'var(--font-xs)',
                  color,
                  flexShrink: 0,
                  width: 8,
                  textAlign: 'center',
                  marginTop: 1,
                  textShadow: `0 0 3px ${color}`,
                }}>
                  {icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--font-xs)',
                    color: '#8090a8',
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                  }}>
                    {entry.message}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginTop: 1 }}>
                    {formatTime(entry.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

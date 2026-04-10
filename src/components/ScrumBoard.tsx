import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import {
  fetchTickets,
  fetchSprints,
  updateTicketColumn,
} from '../lib/orchestratorApi';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  board_column: string | null;
  story_points: number | null;
  agent_id: string | null;
  merge_request_id: string | null;
  sprint_id: string | null;
  priority: number;
  created_at: string;
}

interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

const COLUMNS = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
type Column = (typeof COLUMNS)[number];

const COLUMN_LABELS: Record<Column, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

const COLUMN_COLORS: Record<Column, string> = {
  backlog: '#4a5568',
  todo: '#c084fc',
  in_progress: '#00ff88',
  review: '#ff8800',
  done: '#00ffff',
};

const ROLE_COLORS: Record<string, string> = {
  CEO: '#00ffff', PM: '#c084fc', DevOps: '#00ff88', Frontend: '#ff8800',
  Backend: '#3b82f6', QA: '#ef4444', Designer: '#f59e0b',
};

function getTicketColumn(t: Ticket): Column {
  if (t.board_column && COLUMNS.includes(t.board_column as Column)) return t.board_column as Column;
  if (t.status === 'completed') return 'done';
  if (t.status === 'in_progress') return 'in_progress';
  if (t.status === 'approved') return 'todo';
  if (t.status === 'awaiting_approval') return 'review';
  return 'backlog';
}

export function ScrumBoard() {
  const { companyId } = useParams<{ companyId: string }>();
  const company = useDashboardStore(s => s.companies.find(c => c.id === companyId));
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    const [t, s] = await Promise.all([
      fetchTickets(companyId),
      fetchSprints(companyId),
    ]);
    setTickets(t);
    setSprints(s);
  }, [companyId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  const filteredTickets = selectedSprint === 'all'
    ? tickets
    : tickets.filter(t => t.sprint_id === selectedSprint);

  const columnTickets = (col: Column) => filteredTickets.filter(t => getTicketColumn(t) === col);

  const columnPoints = (col: Column) =>
    columnTickets(col).reduce((s, t) => s + (t.story_points ?? 0), 0);

  const totalPlanned = filteredTickets.reduce((s, t) => s + (t.story_points ?? 0), 0);
  const totalDone = columnTickets('done').reduce((s, t) => s + (t.story_points ?? 0), 0);
  const burndownPct = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0;

  const activeSprint = sprints.find(s => s.id === selectedSprint) ?? sprints[0];

  const handleDrop = async (col: Column) => {
    if (!dragId) return;
    await updateTicketColumn(dragId, col);
    setTickets(prev => prev.map(t => t.id === dragId ? { ...t, board_column: col } : t));
    setDragId(null);
  };

  const agentForTicket = (t: Ticket) =>
    company?.employees.find(e => e.id === t.agent_id);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-hud)', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px var(--pad)',
        background: '#090d14', borderBottom: '1px solid var(--hud-border)', flexShrink: 0,
      }}>
        <span style={{ color: 'var(--hud-text-dim)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Sprint
        </span>
        <select
          value={selectedSprint}
          onChange={e => setSelectedSprint(e.target.value)}
          style={{
            background: '#0d1117', border: '1px solid var(--hud-border)', color: 'var(--hud-text)',
            fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)', padding: '4px 8px',
          }}
        >
          <option value="all">All Tickets</option>
          {sprints.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 'var(--font-xs)' }}>
          <span style={{ color: 'var(--hud-text-dim)' }}>
            PLANNED: <span style={{ color: 'var(--neon-cyan)' }}>{totalPlanned} pts</span>
          </span>
          <span style={{ color: 'var(--hud-text-dim)' }}>
            DONE: <span style={{ color: 'var(--neon-green)' }}>{totalDone} pts</span>
          </span>
          <span style={{ color: 'var(--hud-text-dim)' }}>
            BURNDOWN: <span style={{ color: burndownPct > 80 ? 'var(--neon-green)' : burndownPct > 40 ? 'var(--neon-orange)' : 'var(--neon-red)' }}>
              {burndownPct}%
            </span>
          </span>
          {activeSprint?.end_date && (
            <span style={{ color: 'var(--hud-text-dim)' }}>
              ENDS: <span style={{ color: 'var(--neon-purple)' }}>{new Date(activeSprint.end_date).toLocaleDateString()}</span>
            </span>
          )}
        </div>
      </div>

      {/* Columns */}
      <div style={{
        flex: 1, display: 'flex', gap: 8, padding: 'var(--pad)', overflow: 'auto', minHeight: 0,
      }}>
        {COLUMNS.map(col => (
          <div
            key={col}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col)}
            style={{
              flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column',
              background: '#0a0e14', border: '1px solid var(--hud-border)',
            }}
          >
            {/* Column header */}
            <div style={{
              padding: '8px 10px', borderBottom: '1px solid var(--hud-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#090d14',
            }}>
              <span style={{
                fontSize: 'var(--font-xs)', color: COLUMN_COLORS[col],
                textTransform: 'uppercase', letterSpacing: '0.1em',
                textShadow: `0 0 4px ${COLUMN_COLORS[col]}`,
              }}>
                {COLUMN_LABELS[col]}
              </span>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)' }}>
                {columnPoints(col)} pts
              </span>
            </div>

            {/* Cards */}
            <div style={{ flex: 1, overflow: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {columnTickets(col).map(ticket => {
                const agent = agentForTicket(ticket);
                const expanded = expandedId === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    draggable
                    onDragStart={() => setDragId(ticket.id)}
                    onClick={() => setExpandedId(expanded ? null : ticket.id)}
                    style={{
                      background: '#0d1117', border: '1px solid var(--hud-border)',
                      padding: '8px 10px', cursor: 'grab',
                      borderLeft: `3px solid ${ROLE_COLORS[agent?.role ?? ''] ?? '#4a5568'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: ROLE_COLORS[agent?.role ?? ''] ?? '#4a5568',
                        boxShadow: `0 0 4px ${ROLE_COLORS[agent?.role ?? ''] ?? '#4a5568'}`,
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 'var(--font-xs)', color: '#8090a8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ticket.title}
                      </span>
                      {ticket.story_points != null && (
                        <span style={{
                          fontSize: 'var(--font-xs)', color: 'var(--neon-cyan)',
                          background: '#00ffff10', padding: '1px 5px',
                          border: '1px solid #00ffff30',
                        }}>
                          {ticket.story_points}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, fontSize: 'var(--font-xs)' }}>
                      <span style={{ color: ROLE_COLORS[agent?.role ?? ''] ?? '#4a5568' }}>{agent?.role ?? '?'}</span>
                      <span style={{ color: 'var(--hud-text-dim)', textTransform: 'uppercase' }}>{ticket.status}</span>
                    </div>
                    {expanded && (
                      <div style={{ marginTop: 8, fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', lineHeight: 1.4 }}>
                        {ticket.description && <div style={{ marginBottom: 6 }}>{ticket.description}</div>}
                        {ticket.merge_request_id && (
                          <div style={{ color: 'var(--neon-purple)' }}>MR: {ticket.merge_request_id.slice(0, 8)}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {columnTickets(col).length === 0 && (
                <div style={{ fontSize: 'var(--font-xs)', color: '#1b2030', textAlign: 'center', padding: 20 }}>
                  No tickets
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '6px var(--pad)',
        background: '#090d14', borderTop: '1px solid var(--hud-border)', flexShrink: 0,
        fontSize: 'var(--font-xs)',
      }}>
        <span style={{ color: 'var(--hud-text-dim)' }}>
          VELOCITY
        </span>
        <div style={{ flex: 1, maxWidth: 200, height: 4, background: '#1b2030', position: 'relative' }}>
          <div style={{
            width: `${burndownPct}%`, height: '100%',
            background: 'var(--neon-green)', boxShadow: '0 0 6px var(--neon-green)',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{ color: 'var(--neon-green)' }}>{burndownPct}%</span>
        <span style={{ color: 'var(--hud-text-dim)', marginLeft: 'auto' }}>
          {filteredTickets.length} tickets
        </span>
      </div>
    </div>
  );
}

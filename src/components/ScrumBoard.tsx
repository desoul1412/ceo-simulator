import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import {
  fetchTickets,
  fetchSprints,
  updateTicketColumn,
  approveTicket,
  approveAllTickets,
  updateTicket,
  rejectTicket,
  completeSprint,
} from '../lib/orchestratorApi';
import {
  fetchDependencyGraph,
  fetchTicketDependencies,
  removeTicketDependency,
  type DependencyEdge,
} from '../lib/planningApi';

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
  dependency_status?: string;
  retry_count?: number;
  last_error?: string;
}

interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

const COLUMNS = ['todo', 'in_progress', 'review', 'done'] as const;
type Column = (typeof COLUMNS)[number];

const COLUMN_LABELS: Record<Column, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

const COLUMN_COLORS: Record<Column, string> = {
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
  if (t.board_column === 'backlog') return 'todo'; // backlog → todo
  if (t.status === 'completed') return 'done';
  if (t.status === 'in_progress') return 'in_progress';
  if (t.status === 'approved') return 'todo';
  if (t.status === 'awaiting_approval') return 'review';
  return 'todo';
}

export function ScrumBoard() {
  const { companyId } = useParams<{ companyId: string }>();
  const company = useDashboardStore(s => s.companies.find(c => c.id === companyId));
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<string>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');
  const [dragId, setDragId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPoints, setEditPoints] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [depEdges, setDepEdges] = useState<DependencyEdge[]>([]);
  const [ticketDeps, setTicketDeps] = useState<{ blockers: DependencyEdge[]; dependents: DependencyEdge[] }>({ blockers: [], dependents: [] });

  const load = useCallback(async () => {
    if (!companyId) return;
    const [t, s] = await Promise.all([
      fetchTickets(companyId),
      fetchSprints(companyId),
    ]);
    setTickets(t);
    setSprints(s);

    // Load dependency graph
    const graph = await fetchDependencyGraph(companyId).catch(() => ({ edges: [], tickets: [] }));
    setDepEdges(graph.edges);
  }, [companyId]);

  // Use ref to avoid interval recreation on every load callback change
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    loadRef.current();
    const iv = setInterval(() => loadRef.current(), 15_000);
    return () => clearInterval(iv);
  }, [companyId]);

  const filteredTickets = useMemo(() => tickets
    .filter(t => selectedSprint === 'all' || t.sprint_id === selectedSprint)
    .filter(t => selectedAgentFilter === 'all' || t.agent_id === selectedAgentFilter),
    [tickets, selectedSprint, selectedAgentFilter]);

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

  const openModal = (t: Ticket) => {
    setSelectedTicketId(t.id);
    setEditTitle(t.title);
    setEditDesc(t.description ?? '');
    setEditPoints(t.story_points);
    // Load dependencies for this ticket
    fetchTicketDependencies(t.id).then(setTicketDeps).catch(() => setTicketDeps({ blockers: [], dependents: [] }));
  };

  const closeModal = () => setSelectedTicketId(null);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId) ?? null;

  const handleSave = async () => {
    if (!selectedTicketId) return;
    setSaving(true);
    try {
      const updated = await updateTicket(selectedTicketId, {
        title: editTitle,
        description: editDesc,
        story_points: editPoints,
      });
      setTickets(prev => prev.map(t => t.id === selectedTicketId ? { ...t, ...updated } : t));
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleApproveTicket = async () => {
    if (!selectedTicketId) return;
    try {
      await approveTicket(selectedTicketId);
      setTickets(prev => prev.map(t => t.id === selectedTicketId ? { ...t, status: 'approved', board_column: 'todo' } : t));
      closeModal();
    } catch (err) {
      console.warn('[ScrumBoard] Failed to approve ticket:', err);
    }
  };

  const handleReject = async () => {
    if (!selectedTicketId) return;
    try {
      await rejectTicket(selectedTicketId);
      setTickets(prev => prev.map(t => t.id === selectedTicketId ? { ...t, status: 'cancelled', board_column: 'done' } : t));
      closeModal();
    } catch (err) {
      console.warn('[ScrumBoard] Failed to reject ticket:', err);
    }
  };

  // Unique agents from company for the filter dropdown
  const agents = company?.employees ?? [];

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
        <span style={{ color: 'var(--hud-text-dim)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Agent
        </span>
        <select
          value={selectedAgentFilter}
          onChange={e => setSelectedAgentFilter(e.target.value)}
          style={{
            background: '#0d1117', border: '1px solid var(--hud-border)', color: 'var(--hud-text)',
            fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)', padding: '4px 8px',
          }}
        >
          <option value="all">All Agents</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.role} - {a.name}</option>
          ))}
        </select>
        {/* Complete Sprint button — visible when a specific sprint is selected and burndown >= 90% */}
        {selectedSprint !== 'all' && burndownPct >= 90 && activeSprint?.status !== 'completed' && (
          <button
            onClick={async () => {
              if (!confirm(`Complete "${activeSprint?.name}"? This will create the next sprint from the master plan.`)) return;
              await completeSprint(selectedSprint);
              load();
            }}
            style={{
              padding: '4px 12px', fontSize: 'var(--font-xs)',
              background: '#c084fc10', border: '1px solid #c084fc40',
              color: 'var(--neon-purple)', cursor: 'pointer',
              fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
            }}
          >
            Complete Sprint →
          </button>
        )}
        {/* Approve all open tickets */}
        {tickets.some(t => t.status === 'open' || t.status === 'awaiting_approval') && companyId && (
          <button
            onClick={async () => {
              if (!confirm(`Approve all ${tickets.filter(t => t.status === 'open' || t.status === 'awaiting_approval').length} pending tickets? Agents will start executing.`)) return;
              await approveAllTickets(companyId);
              load();
            }}
            style={{
              padding: '4px 12px', fontSize: 'var(--font-xs)',
              background: '#00ff8810', border: '1px solid #00ff8840',
              color: 'var(--neon-green)', cursor: 'pointer',
              fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
            }}
          >
            ✓ Approve All ({tickets.filter(t => t.status === 'open' || t.status === 'awaiting_approval').length})
          </button>
        )}
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
                const depStatus = ticket.dependency_status;
                const isBlocked = depStatus === 'blocked';
                const isPartial = depStatus === 'partial';
                const hasBlockers = depEdges.some(e => e.blocked_ticket_id === ticket.id);
                const hasRetries = (ticket.retry_count ?? 0) > 0;

                return (
                  <div
                    key={ticket.id}
                    draggable
                    onDragStart={() => setDragId(ticket.id)}
                    onClick={() => openModal(ticket)}
                    style={{
                      background: isBlocked ? '#1a0a0a' : isPartial ? '#1a1500' : '#0d1117',
                      border: `1px solid ${isBlocked ? '#ff224440' : isPartial ? '#ff880040' : 'var(--hud-border)'}`,
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
                    <div style={{ display: 'flex', gap: 6, fontSize: 'var(--font-xs)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: ROLE_COLORS[agent?.role ?? ''] ?? '#4a5568' }}>
                        {agent?.role ?? '?'}{agent ? ` (${agent.name})` : ''}
                      </span>
                      <span style={{ color: 'var(--hud-text-dim)', textTransform: 'uppercase' }}>{ticket.status}</span>
                      {/* Dependency indicators */}
                      {isBlocked && (
                        <span style={{ color: 'var(--neon-red)', fontSize: 9 }} title="Blocked by dependencies">
                          BLOCKED
                        </span>
                      )}
                      {isPartial && (
                        <span style={{ color: 'var(--neon-orange)', fontSize: 9 }} title="Some dependencies satisfied">
                          PARTIAL
                        </span>
                      )}
                      {hasBlockers && !isBlocked && !isPartial && (
                        <span style={{ color: 'var(--hud-text-dim)', fontSize: 9 }} title="Has dependencies (all satisfied)">
                          🔗
                        </span>
                      )}
                      {hasRetries && (
                        <span style={{ color: 'var(--neon-orange)', fontSize: 9 }} title={`Retried ${ticket.retry_count} time(s)`}>
                          ↻{ticket.retry_count}
                        </span>
                      )}
                      {(ticket.status === 'open' || ticket.status === 'awaiting_approval') && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await approveTicket(ticket.id);
                              setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'approved', board_column: 'todo' } : t));
                            } catch (err) {
                              console.warn('[ScrumBoard] Quick-approve failed:', err);
                            }
                          }}
                          aria-label={`Approve ticket: ${ticket.title}`}
                          style={{
                            marginLeft: 'auto', padding: '1px 8px',
                            fontSize: 'var(--font-xs)', background: '#00ff8810',
                            border: '1px solid #00ff8840', color: 'var(--neon-green)',
                            cursor: 'pointer', fontFamily: 'var(--font-hud)',
                          }}
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {columnTickets(col).length === 0 && (
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textAlign: 'center', padding: 20, fontStyle: 'italic' }}>
                  No tickets in {col}
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

      {/* ── Ticket Detail Modal ─────────────────────────────────────────── */}
      {selectedTicket && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.75)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0a0e14', border: '1px solid var(--hud-border)',
              width: '95vw', maxWidth: 520, maxHeight: '80vh', overflow: 'auto',
              fontFamily: 'var(--font-hud)', boxShadow: '0 0 30px rgba(0,255,255,0.08)',
            }}
          >
            {/* Modal header */}
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--hud-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#090d14',
            }}>
              <span style={{
                fontSize: 'var(--font-xs)', color: 'var(--neon-cyan)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                textShadow: '0 0 4px var(--neon-cyan)',
              }}>
                Ticket Detail
              </span>
              <span style={{
                fontSize: 'var(--font-xs)', padding: '2px 8px',
                textTransform: 'uppercase',
                color: selectedTicket.status === 'completed' ? 'var(--neon-green)'
                  : selectedTicket.status === 'in_progress' ? 'var(--neon-orange)'
                  : selectedTicket.status === 'cancelled' ? 'var(--neon-red)'
                  : 'var(--hud-text-dim)',
                background: selectedTicket.status === 'completed' ? '#00ff8810'
                  : selectedTicket.status === 'in_progress' ? '#ff880010'
                  : selectedTicket.status === 'cancelled' ? '#ff224410'
                  : '#1b2030',
                border: `1px solid ${
                  selectedTicket.status === 'completed' ? '#00ff8840'
                  : selectedTicket.status === 'in_progress' ? '#ff880040'
                  : selectedTicket.status === 'cancelled' ? '#ff224440'
                  : 'var(--hud-border)'
                }`,
              }}>
                {selectedTicket.status}
              </span>
            </div>

            {/* Modal body */}
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Title */}
              <div>
                <label style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                  Title
                </label>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  style={{
                    width: '100%', background: '#05080f', border: '1px solid var(--hud-border)',
                    color: 'var(--hud-text)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
                    padding: '6px 8px', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                  Description
                </label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%', background: '#05080f', border: '1px solid var(--hud-border)',
                    color: 'var(--hud-text)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
                    padding: '6px 8px', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Agent assigned */}
              {(() => {
                const agent = agentForTicket(selectedTicket);
                return (
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                        Agent
                      </label>
                      <div style={{
                        fontSize: 'var(--font-xs)', padding: '6px 8px',
                        background: '#05080f', border: '1px solid var(--hud-border)',
                        color: ROLE_COLORS[agent?.role ?? ''] ?? '#4a5568',
                      }}>
                        {agent ? `${agent.name} (${agent.role})` : 'Unassigned'}
                      </div>
                    </div>

                    {/* Story Points */}
                    <div style={{ width: 100 }}>
                      <label style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                        Points
                      </label>
                      <input
                        type="number"
                        value={editPoints ?? ''}
                        onChange={e => setEditPoints(e.target.value ? Number(e.target.value) : null)}
                        style={{
                          width: '100%', background: '#05080f', border: '1px solid var(--hud-border)',
                          color: 'var(--neon-cyan)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
                          padding: '6px 8px', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Sprint + Created */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                    Sprint
                  </label>
                  <div style={{
                    fontSize: 'var(--font-xs)', padding: '6px 8px',
                    background: '#05080f', border: '1px solid var(--hud-border)',
                    color: 'var(--neon-purple)',
                  }}>
                    {sprints.find(s => s.id === selectedTicket.sprint_id)?.name ?? 'None'}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                    Created
                  </label>
                  <div style={{
                    fontSize: 'var(--font-xs)', padding: '6px 8px',
                    background: '#05080f', border: '1px solid var(--hud-border)',
                    color: 'var(--hud-text-dim)',
                  }}>
                    {new Date(selectedTicket.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Dependencies section */}
              {(ticketDeps.blockers.length > 0 || ticketDeps.dependents.length > 0) && (
                <div>
                  <label style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                    Dependencies
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {ticketDeps.blockers.length > 0 && (
                      <div style={{
                        fontSize: 'var(--font-xs)', padding: '6px 8px',
                        background: '#05080f', border: '1px solid var(--hud-border)',
                      }}>
                        <span style={{ color: 'var(--neon-red)', marginRight: 6 }}>BLOCKED BY</span>
                        {ticketDeps.blockers.map(dep => {
                          const blocker = tickets.find(t => t.id === dep.blocker_ticket_id);
                          return (
                            <div key={dep.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: dep.status === 'satisfied' ? 'var(--neon-green)' : dep.status === 'broken' ? 'var(--neon-red)' : 'var(--neon-orange)',
                              }} />
                              <span style={{ color: '#a0b4c8', flex: 1 }}>
                                {blocker?.title?.slice(0, 60) ?? dep.blocker_ticket_id.slice(0, 8)}
                              </span>
                              <span style={{ color: 'var(--hud-text-dim)', textTransform: 'uppercase' }}>{dep.status}</span>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await removeTicketDependency(dep.id);
                                    setTicketDeps(prev => ({
                                      ...prev,
                                      blockers: prev.blockers.filter(d => d.id !== dep.id),
                                    }));
                                  } catch (err) {
                                    console.warn('[ScrumBoard] Failed to remove dependency:', err);
                                  }
                                }}
                                aria-label="Remove dependency"
                                style={{
                                  background: 'none', border: '1px solid #1b2030',
                                  color: 'var(--hud-text-dim)', cursor: 'pointer',
                                  fontSize: 9, padding: '0 4px',
                                }}
                              >
                                x
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {ticketDeps.dependents.length > 0 && (
                      <div style={{
                        fontSize: 'var(--font-xs)', padding: '6px 8px',
                        background: '#05080f', border: '1px solid var(--hud-border)',
                      }}>
                        <span style={{ color: 'var(--neon-cyan)', marginRight: 6 }}>BLOCKS</span>
                        {ticketDeps.dependents.map(dep => {
                          const blocked = tickets.find(t => t.id === dep.blocked_ticket_id);
                          return (
                            <div key={dep.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: dep.status === 'satisfied' ? 'var(--neon-green)' : 'var(--neon-cyan)',
                              }} />
                              <span style={{ color: '#a0b4c8' }}>
                                {blocked?.title?.slice(0, 60) ?? dep.blocked_ticket_id.slice(0, 8)}
                              </span>
                              <span style={{ color: 'var(--hud-text-dim)', textTransform: 'uppercase' }}>{dep.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error info if retried */}
              {selectedTicket.last_error && (
                <div>
                  <label style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-red)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                    Last Error {selectedTicket.retry_count ? `(retry ${selectedTicket.retry_count})` : ''}
                  </label>
                  <div style={{
                    fontSize: 'var(--font-xs)', padding: '6px 8px',
                    background: '#1a0505', border: '1px solid #ff224430',
                    color: '#ff6677', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'auto',
                  }}>
                    {selectedTicket.last_error}
                  </div>
                </div>
              )}

              {/* MR link */}
              {selectedTicket.merge_request_id && (
                <div>
                  <label style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                    Merge Request
                  </label>
                  <div style={{
                    fontSize: 'var(--font-xs)', padding: '6px 8px',
                    background: '#05080f', border: '1px solid var(--hud-border)',
                    color: 'var(--neon-purple)',
                  }}>
                    MR: {selectedTicket.merge_request_id.slice(0, 8)}...
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer buttons */}
            <div style={{
              padding: '10px 14px', borderTop: '1px solid var(--hud-border)',
              display: 'flex', gap: 8, justifyContent: 'flex-end', background: '#090d14',
            }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '5px 14px', fontSize: 'var(--font-xs)',
                  background: '#00ffff10', border: '1px solid #00ffff40',
                  color: 'var(--neon-cyan)', cursor: 'pointer',
                  fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {(selectedTicket.status === 'open' || selectedTicket.status === 'awaiting_approval') && (
                <button
                  onClick={handleApproveTicket}
                  style={{
                    padding: '5px 14px', fontSize: 'var(--font-xs)',
                    background: '#00ff8810', border: '1px solid #00ff8840',
                    color: 'var(--neon-green)', cursor: 'pointer',
                    fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
                  }}
                >
                  Approve
                </button>
              )}
              <button
                onClick={handleReject}
                style={{
                  padding: '5px 14px', fontSize: 'var(--font-xs)',
                  background: '#ff224410', border: '1px solid #ff224440',
                  color: 'var(--neon-red)', cursor: 'pointer',
                  fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
                }}
              >
                Reject
              </button>
              <button
                onClick={closeModal}
                style={{
                  padding: '5px 14px', fontSize: 'var(--font-xs)',
                  background: '#1b2030', border: '1px solid var(--hud-border)',
                  color: 'var(--hud-text-dim)', cursor: 'pointer',
                  fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

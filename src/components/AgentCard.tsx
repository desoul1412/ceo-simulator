import { useEffect, useState, useCallback } from 'react';
import { fetchTickets, approveTicket, updateTicket, fireAgent, updateAgent, updateAgentLifecycle, fetchAgentRouting, setAgentRouting, fetchLLMModels } from '../lib/orchestratorApi';
import { fetchActivityLog } from '../lib/api';
import { useDashboardStore } from '../store/dashboardStore';
import { usePlanningStore } from '../store/planningStore';
import type { Employee } from '../store/dashboardStore';
import { getRoleDisplayName } from '../lib/agentDisplay';

const CHAR_FRAME_W = 16;
const CHAR_FRAME_H = 32;

const ROLE_CHAR_INDEX: Record<string, number> = {
  CEO: 0, PM: 1, DevOps: 2, Frontend: 3, Backend: 4, QA: 5,
};

const STATUS_COLORS: Record<string, string> = {
  working: '#00ff88', meeting: '#c084fc', idle: '#4a5568',
  break: '#ff8800', blocked: '#ff2244',
};

interface ActivityEntry {
  id: string; type: string; message: string; created_at: string;
}

interface Ticket {
  id: string; title: string; description: string; status: string;
  agent_id: string; story_points: number | null; board_column: string | null;
}

interface AgentCardProps {
  agent: Employee;
  companyId: string;
  allAgents: Employee[];
  onTicketAction?: () => void;
}

// Compact pixel avatar
export function PixelAvatar({ role, status, scale = 2.5 }: { role: string; status: string; scale?: number }) {
  const charIdx = ROLE_CHAR_INDEX[role] ?? 0;
  const statusColor = STATUS_COLORS[status] ?? '#4a5568';
  return (
    <div style={{ position: 'relative', width: CHAR_FRAME_W * scale, height: CHAR_FRAME_H * scale, flexShrink: 0 }}>
      <div style={{
        width: CHAR_FRAME_W * scale, height: CHAR_FRAME_H * scale,
        backgroundImage: `url(/assets/characters/char_${charIdx}.png)`,
        backgroundPosition: '0 0',
        backgroundSize: `${CHAR_FRAME_W * 7 * scale}px auto`,
        imageRendering: 'pixelated',
      }} />
      <div style={{
        position: 'absolute', bottom: 1, right: 1,
        width: 8, height: 8, borderRadius: '50%',
        background: statusColor, boxShadow: `0 0 5px ${statusColor}`,
        border: '1.5px solid #0d1117',
      }} />
    </div>
  );
}

export function AgentCard({ agent, companyId, allAgents, onTicketAction }: AgentCardProps) {
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const planningStatus = usePlanningStore(s => s.status);
  const planningSessionId = usePlanningStore(s => s.sessionId);
  const setOpenPlanning = usePlanningStore(s => s.setOpen);
  const [pendingCount, setPendingCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const isCeo = agent.role === 'CEO';

  // Poll pending ticket count (lightweight)
  useEffect(() => {
    if (!orchestratorConnected) return;
    const load = async () => {
      try {
        const all = await fetchTickets(companyId);
        setPendingCount(all.filter((t: any) =>
          t.agent_id === agent.id && (t.status === 'awaiting_approval' || t.status === 'open')
        ).length);
      } catch (err) { console.warn('[AgentCard] fetch failed:', err); }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [companyId, agent.id, orchestratorConnected]);

  const statusColor = STATUS_COLORS[agent.status] ?? '#4a5568';
  const displayName = getRoleDisplayName(agent.role, agent.id, allAgents);

  return (
    <>
      {/* ── Compact Card (fits 3-col grid) ───────────────────────────── */}
      <div
        onClick={() => {
          // CEO card: open planning popup if a session exists, otherwise open normal modal
          if (isCeo && planningSessionId && (planningStatus === 'generating' || planningStatus === 'review')) {
            setOpenPlanning(true);
          } else {
            setModalOpen(true);
          }
        }}
        style={{
          background: '#0d1117', border: '1px solid var(--hud-border)',
          fontFamily: 'var(--font-hud)', cursor: 'pointer',
          transition: 'border-color 0.15s',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '10px 6px 8px',
          gap: 4,
          minHeight: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = statusColor + '60')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--hud-border)')}
      >
        <PixelAvatar role={agent.role} status={agent.status} scale={2.5} />
        <span style={{
          fontSize: 'var(--font-xs)', color: 'var(--hud-text-h)',
          fontWeight: 600, textAlign: 'center',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}>
          {displayName}
        </span>
        <span style={{
          fontSize: 10, color: statusColor, textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {agent.status}
        </span>
        {pendingCount > 0 && (
          <span style={{
            fontSize: 10, padding: '1px 6px',
            background: '#ff880018', border: '1px solid #ff880040',
            color: '#ff8800',
          }}>
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* ── Detail Modal ─────────────────────────────────────────────── */}
      {modalOpen && (
        <AgentDetailModal
          agent={agent}
          companyId={companyId}
          allAgents={allAgents}
          displayName={displayName}
          onClose={() => setModalOpen(false)}
          onTicketAction={onTicketAction}
        />
      )}
    </>
  );
}

// ── Full detail modal (activity + tickets + approvals) ──────────────────────

function AgentDetailModal({
  agent, companyId, allAgents, displayName, onClose, onTicketAction,
}: {
  agent: Employee; companyId: string; allAgents: Employee[];
  displayName: string; onClose: () => void; onTicketAction?: () => void;
}) {
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const loadFromBackend = useDashboardStore(s => s.loadFromBackend);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Agent config editing
  const [showConfig, setShowConfig] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const [routingChain, setRoutingChain] = useState<any[]>([]);
  const [allModels, setAllModels] = useState<any[]>([]);

  // Load routing chain for this agent
  const loadRouting = useCallback(async () => {
    if (!orchestratorConnected) return;
    const [chain, models] = await Promise.all([
      fetchAgentRouting(agent.id).catch(() => []),
      fetchLLMModels().catch(() => []),
    ]);
    setRoutingChain(chain);
    setAllModels(models);
  }, [agent.id, orchestratorConnected]);

  useEffect(() => { if (showRouting) loadRouting(); }, [showRouting, loadRouting]);
  const [cfgName, setCfgName] = useState(agent.name ?? '');
  const [cfgRole, setCfgRole] = useState<string>(agent.role);
  const [cfgBudget, setCfgBudget] = useState((agent as any).budgetLimit ?? 10);
  const [cfgPrompt, setCfgPrompt] = useState((agent as any).systemPrompt ?? '');
  const [cfgSaving, setCfgSaving] = useState(false);
  const [confirmFire, setConfirmFire] = useState(false);

  const handleSaveConfig = async () => {
    setCfgSaving(true);
    try {
      await updateAgent(agent.id, {
        name: cfgName,
        role: cfgRole,
        budget_limit: cfgBudget,
        system_prompt: cfgPrompt || undefined,
      });
      loadFromBackend();
      setShowConfig(false);
    } catch (err) {
      console.warn('[AgentCard] Config save failed:', err);
    } finally {
      setCfgSaving(false);
    }
  };

  const handleFire = async () => {
    try {
      await fireAgent(agent.id);
      loadFromBackend();
      onClose();
    } catch (err) {
      console.warn('[AgentCard] Fire failed:', err);
    }
  };

  const handleLifecycle = async (status: 'active' | 'paused' | 'terminated') => {
    try {
      await updateAgentLifecycle(agent.id, status);
      loadFromBackend();
    } catch (err) {
      console.warn('[AgentCard] Lifecycle update failed:', err);
    }
  };

  // Load activity
  useEffect(() => {
    const load = async () => {
      try {
        const rows = await fetchActivityLog(companyId, 80);
        setActivities(
          rows
            .filter((r: any) => r.agent_id === agent.id || r.message?.includes(agent.role))
            .slice(0, 15)
            .map((r: any) => ({ id: r.id, type: r.type, message: r.message, created_at: r.created_at }))
        );
      } catch (err) { console.warn('[AgentCard] fetch failed:', err); }
    };
    load();
    const iv = setInterval(load, 10_000);
    return () => clearInterval(iv);
  }, [companyId, agent.id, agent.role]);

  // Load tickets
  useEffect(() => {
    if (!orchestratorConnected) return;
    const load = async () => {
      try {
        const all = await fetchTickets(companyId);
        setTickets(all.filter((t: any) => t.agent_id === agent.id));
      } catch (err) { console.warn('[AgentCard] fetch failed:', err); }
    };
    load();
    const iv = setInterval(load, 12_000);
    return () => clearInterval(iv);
  }, [companyId, agent.id, orchestratorConnected]);

  const handleApprove = async (ticketId: string) => {
    await approveTicket(ticketId);
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'approved', board_column: 'todo' } : t));
    onTicketAction?.();
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await updateTicket(editingId, { title: editTitle, description: editDesc });
    setTickets(prev => prev.map(t => t.id === editingId ? { ...t, title: editTitle, description: editDesc } : t));
    setEditingId(null);
  };

  const statusColor = STATUS_COLORS[agent.status] ?? '#4a5568';
  const pendingTickets = tickets.filter(t => t.status === 'awaiting_approval' || t.status === 'open');
  const activeTickets = tickets.filter(t => t.status === 'in_progress' || t.status === 'approved');
  const doneTickets = tickets.filter(t => t.status === 'completed' || t.status === 'cancelled');

  const TYPE_COLORS: Record<string, string> = {
    'task-started': '#00ff88', 'task-completed': '#00ff88',
    'delegation': '#c084fc', 'status-change': '#4a5568',
    'ceo-reasoning': '#00ffff', 'goal-assigned': '#00ffff',
  };

  function formatTime(iso: string): string {
    try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch { return ''; }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.78)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0a0e14', border: '1px solid var(--hud-border)',
          width: '95vw', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-hud)', boxShadow: `0 0 30px ${statusColor}15`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--hud-border)',
          display: 'flex', alignItems: 'center', gap: 12, background: '#090d14',
          flexShrink: 0,
        }}>
          <PixelAvatar role={agent.role} status={agent.status} scale={3} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--font-md)', color: 'var(--hud-text-h)', fontWeight: 600 }}>
              {displayName}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: statusColor, boxShadow: `0 0 4px ${statusColor}`,
              }} />
              <span style={{ fontSize: 'var(--font-xs)', color: statusColor, textTransform: 'uppercase' }}>
                {agent.status}
              </span>
              {agent.assignedTask && (
                <span style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', marginLeft: 4 }}>
                  — {agent.assignedTask}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--hud-text-dim)',
            fontSize: 16, cursor: 'pointer', padding: '4px 8px',
          }}>✕</button>
        </div>

        {/* Action bar */}
        <div style={{
          padding: '6px 16px', borderBottom: '1px solid var(--hud-border)',
          display: 'flex', gap: 6, alignItems: 'center', background: '#080b12', flexShrink: 0,
        }}>
          <button onClick={() => setShowConfig(!showConfig)} style={actionBtnStyle(showConfig ? '#00ffff' : '#4a5568')}>
            {showConfig ? '▲ Config' : '▼ Config'}
          </button>
          <button onClick={() => setShowRouting(!showRouting)} style={actionBtnStyle(showRouting ? '#c084fc' : '#4a5568')}>
            {showRouting ? '▲ Routing' : '▼ Routing'}
          </button>
          {agent.status !== 'working' && (
            <>
              {(agent as any).lifecycleStatus !== 'paused' ? (
                <button onClick={() => handleLifecycle('paused')} style={actionBtnStyle('#ff8800')}>Pause</button>
              ) : (
                <button onClick={() => handleLifecycle('active')} style={actionBtnStyle('#00ff88')}>Resume</button>
              )}
            </>
          )}
          {!confirmFire ? (
            <button onClick={() => setConfirmFire(true)} style={{ ...actionBtnStyle('#ff2244'), marginLeft: 'auto' }}>Fire</button>
          ) : (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-red)' }}>Confirm?</span>
              <button onClick={handleFire} style={actionBtnStyle('#ff2244')}>Yes, Fire</button>
              <button onClick={() => setConfirmFire(false)} style={actionBtnStyle('#4a5568')}>Cancel</button>
            </div>
          )}
        </div>

        {/* Config panel (expandable) */}
        {showConfig && (
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--hud-border)',
            background: '#060910', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Name</label>
                <input value={cfgName} onChange={e => setCfgName(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ width: 120 }}>
                <label style={labelStyle}>Role</label>
                <select value={cfgRole} onChange={e => setCfgRole(e.target.value)} style={inputStyle}>
                  {['CEO', 'PM', 'Frontend', 'Backend', 'QA', 'Designer', 'DevOps'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 100 }}>
                <label style={labelStyle}>Budget ($)</label>
                <input type="number" value={cfgBudget} onChange={e => setCfgBudget(Number(e.target.value))}
                  style={inputStyle} min={0} step={1} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>System Prompt (optional override)</label>
              <textarea value={cfgPrompt} onChange={e => setCfgPrompt(e.target.value)} rows={3}
                style={{ ...inputStyle, resize: 'vertical', width: '100%' }}
                placeholder="Leave empty to use default role prompt" />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConfig(false)} style={actionBtnStyle('#4a5568')}>Cancel</button>
              <button onClick={handleSaveConfig} disabled={cfgSaving}
                style={actionBtnStyle('#00ff88')}>
                {cfgSaving ? 'Saving...' : 'Save Config'}
              </button>
            </div>
          </div>
        )}

        {/* Model Routing panel */}
        {showRouting && (
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--hud-border)',
            background: '#060910', flexShrink: 0, maxHeight: 200, overflowY: 'auto',
          }}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-purple)', textTransform: 'uppercase', marginBottom: 6 }}>
              Model Routing (priority order)
            </div>
            {routingChain.length === 0 ? (
              <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic', marginBottom: 6 }}>
                Using global default. Add models below to override.
              </div>
            ) : routingChain.map((r: any, idx: number) => {
              const m = r.model ?? allModels.find((mm: any) => mm.id === r.model_id);
              if (!m) return null;
              return (
                <div key={r.id ?? idx} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
                  borderBottom: '1px solid #0a0e14', fontSize: 'var(--font-xs)',
                }}>
                  <span style={{ color: '#4a5568', width: 16 }}>#{idx + 1}</span>
                  <span style={{ color: 'var(--hud-text-h)', flex: 1 }}>{m.name}</span>
                  <span style={{ color: m.provider?.provider_type === 'sdk' ? '#00ff88' : '#ff8800', fontSize: 10 }}>
                    {m.provider?.provider_type === 'sdk' ? 'SDK' : 'HTTP'}
                  </span>
                  <button onClick={async () => {
                    const arr = routingChain.filter((_: any, i: number) => i !== idx);
                    await setAgentRouting(agent.id, arr.map((rr: any, i: number) => ({ model_id: rr.model_id ?? rr.model?.id, priority: i })));
                    loadRouting();
                  }} style={actionBtnStyle('#ff2244')}>×</button>
                </div>
              );
            })}
            {/* Add model */}
            <div style={{ marginTop: 6 }}>
              <select
                onChange={async (e) => {
                  const modelId = e.target.value;
                  if (!modelId) return;
                  const updated = [...routingChain.map((r: any, i: number) => ({ model_id: r.model_id ?? r.model?.id, priority: i })), { model_id: modelId, priority: routingChain.length }];
                  await setAgentRouting(agent.id, updated);
                  loadRouting();
                  e.target.value = '';
                }}
                style={{
                  width: '100%', background: '#05080f', border: '1px solid #1b2030',
                  color: '#6a7a90', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)', padding: '4px 6px',
                }}
              >
                <option value="">+ Add model to routing...</option>
                {allModels
                  .filter((m: any) => !routingChain.some((r: any) => (r.model_id ?? r.model?.id) === m.id))
                  .map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.provider?.name ?? '?'}) — {m.tier}</option>
                  ))
                }
              </select>
            </div>
          </div>
        )}

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {/* Pending Tickets */}
          {pendingTickets.length > 0 && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--hud-border)' }}>
              <div style={{
                fontSize: 'var(--font-xs)', color: '#ff8800',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
              }}>
                Needs Approval ({pendingTickets.length})
              </div>
              {pendingTickets.map(t => (
                <div key={t.id} style={{ padding: '5px 0', borderBottom: '1px solid #0a0e14' }}>
                  {editingId === t.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{
                        background: '#05080f', border: '1px solid var(--hud-border)', color: 'var(--hud-text)',
                        fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)', padding: '4px 6px',
                      }} />
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} style={{
                        background: '#05080f', border: '1px solid var(--hud-border)', color: 'var(--hud-text)',
                        fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)', padding: '4px 6px', resize: 'vertical',
                      }} />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={handleSaveEdit} style={actionBtnStyle('#00ffff')}>Save</button>
                        <button onClick={() => setEditingId(null)} style={actionBtnStyle('#ff2244')}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 'var(--font-xs)', color: '#8090a8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title}
                      </span>
                      <button onClick={() => handleApprove(t.id)} style={actionBtnStyle('#00ff88')}>✓</button>
                      <button onClick={() => { setEditingId(t.id); setEditTitle(t.title); setEditDesc(t.description ?? ''); }} style={actionBtnStyle('#00ffff')}>✎</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Active Tickets */}
          {activeTickets.length > 0 && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--hud-border)' }}>
              <div style={{
                fontSize: 'var(--font-xs)', color: 'var(--neon-green)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
              }}>
                Active ({activeTickets.length})
              </div>
              {activeTickets.map(t => (
                <div key={t.id} style={{
                  padding: '3px 0', borderBottom: '1px solid #0a0e14',
                  fontSize: 'var(--font-xs)', color: '#6a7a90',
                  display: 'flex', gap: 6, alignItems: 'center',
                }}>
                  <span style={{ color: t.status === 'in_progress' ? '#00ff88' : '#c084fc' }}>
                    {t.status === 'in_progress' ? '▶' : '◇'}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </span>
                  <span style={{ color: '#2a3a50', textTransform: 'uppercase' }}>{t.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Activity Stream */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--hud-border)' }}>
            <div style={{
              fontSize: 'var(--font-xs)', color: '#4a5568',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
            }}>
              Activity
            </div>
            {activities.length === 0 ? (
              <div style={{ fontSize: 'var(--font-xs)', color: '#1b2030', fontStyle: 'italic' }}>No recent activity</div>
            ) : activities.map(a => (
              <div key={a.id} style={{
                padding: '2px 0', display: 'flex', gap: 6, alignItems: 'flex-start',
                borderBottom: '1px solid #0a0e14',
              }}>
                <span style={{
                  fontSize: 'var(--font-xs)', color: TYPE_COLORS[a.type] ?? '#4a5568',
                  flexShrink: 0, width: 8, marginTop: 1,
                }}>
                  {a.type === 'task-completed' ? '✓' : a.type === 'task-started' ? '▶' : '·'}
                </span>
                <span style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', flex: 1, lineHeight: 1.3 }}>
                  {a.message}
                </span>
                <span style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', flexShrink: 0 }}>
                  {formatTime(a.created_at)}
                </span>
              </div>
            ))}
          </div>

          {/* Completed Tickets (last 5) */}
          {doneTickets.length > 0 && (
            <div style={{ padding: '10px 16px' }}>
              <div style={{
                fontSize: 'var(--font-xs)', color: '#2a3a50',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
              }}>
                Completed ({doneTickets.length})
              </div>
              {doneTickets.slice(0, 5).map(t => (
                <div key={t.id} style={{
                  padding: '2px 0', fontSize: 'var(--font-xs)', color: '#2a3a50',
                  borderBottom: '1px solid #0a0e14', textDecoration: 'line-through',
                }}>
                  {t.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    padding: '2px 8px', fontSize: 'var(--font-xs)',
    background: `${color}18`, border: `1px solid ${color}40`,
    color, cursor: 'pointer', fontFamily: 'var(--font-hud)',
    flexShrink: 0,
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '4px 8px',
  background: '#05080f', border: '1px solid var(--hud-border)',
  color: 'var(--hud-text)', fontFamily: 'var(--font-hud)',
  fontSize: 'var(--font-xs)',
};

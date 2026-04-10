import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchPlans,
  updatePlan,
  approvePlan,
  addPlanComment,
  fetchPlanComments,
  fetchEnvVars,
  createEnvVar,
  deleteEnvVar,
  assignGoalToOrchestrator,
  hireAgent,
  fetchTickets,
} from '../lib/orchestratorApi';

interface Plan {
  id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  approved_at: string | null;
  created_at: string;
}

interface PlanComment {
  id: string;
  plan_id: string;
  content: string;
  author: string;
  created_at: string;
}

interface EnvVar {
  id: string;
  key: string;
  value: string;
  is_secret: boolean;
}

const PLAN_TYPES = ['summary', 'master_plan', 'hiring_plan', 'daily_plan'] as const;
const PLAN_LABELS: Record<string, string> = {
  summary: 'Summary',
  master_plan: 'Master Plan',
  hiring_plan: 'Hiring Plan',
  daily_plan: "Today's Plan",
};

export function ProjectOverview() {
  const { companyId } = useParams<{ companyId: string }>();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [comments, setComments] = useState<Record<string, PlanComment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [newEnvSecret, setNewEnvSecret] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    const [p, e, t] = await Promise.all([
      fetchPlans(companyId),
      fetchEnvVars(companyId),
      fetchTickets(companyId),
    ]);
    setPlans(p);
    setEnvVars(e);
    setTickets(t);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const planByType = (type: string) => plans.find(p => p.type === type);

  const handleSave = async (planId: string) => {
    await updatePlan(planId, editContent);
    setEditingPlan(null);
    await load();
  };

  const handleApprove = async (planId: string) => {
    await approvePlan(planId);
    await load();
  };

  const loadComments = async (planId: string) => {
    const c = await fetchPlanComments(planId);
    setComments(prev => ({ ...prev, [planId]: c }));
  };

  const handleAddComment = async (planId: string) => {
    const text = newComment[planId]?.trim();
    if (!text) return;
    await addPlanComment(planId, text);
    setNewComment(prev => ({ ...prev, [planId]: '' }));
    await loadComments(planId);
  };

  const handleRegenerate = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // Try orchestrator first (real CEO agent reviews the repo)
      await assignGoalToOrchestrator(companyId, 'Review the project repository. Generate a project overview including: Summary, Master Execution Plan, Hiring Plan, Environment Variable requirements. Output structured plans.');
      await load();
    } catch {
      // Fallback: create template plans directly via orchestrator plan API
      try {
        const { createPlan } = await import('../lib/orchestratorApi');
        const templates = [
          { type: 'summary', title: 'Project Summary', content: '## Project Summary\n\n**Name:** \n**Stack:** \n**Repo:** \n**Current State:** \n**Goal:** \n\n_Edit this section with your project details._' },
          { type: 'master_plan', title: 'Master Execution Plan', content: '## Master Execution Plan\n\n### Phase 1: Setup & Planning\n- [ ] Review codebase\n- [ ] Define architecture\n- [ ] Set up CI/CD\n\n### Phase 2: Core Features\n- [ ] Feature A\n- [ ] Feature B\n\n### Phase 3: Polish & Launch\n- [ ] Testing\n- [ ] Documentation\n- [ ] Deploy\n\n_Edit phases and tasks to match your project._' },
          { type: 'hiring_plan', title: 'Hiring Plan', content: '## Hiring Plan\n\n| Role | Model | Budget | Reason |\n|------|-------|--------|--------|\n| PM | sonnet | $15 | Requirements & specs |\n| Frontend | sonnet | $15 | UI implementation |\n| Backend | sonnet | $15 | API & database |\n| QA | haiku | $5 | Testing |\n\n_Edit roles based on your project needs. Approve to auto-hire._' },
          { type: 'daily_plan', title: "Today's Plan", content: "## Today's Plan\n\nNo tasks scheduled yet. Create a sprint from the Board tab, or assign a goal from the Office view.\n\n_Edit to add today's priorities._" },
        ];
        for (const t of templates) {
          // Only create if doesn't exist
          if (!planByType(t.type)) {
            await createPlan(companyId, t);
          }
        }
        await load();
      } catch (innerErr) {
        // Last fallback: create plans directly in Supabase
        const { supabase, isOnline } = await import('../lib/supabase');
        if (isOnline() && supabase) {
          const templates = [
            { company_id: companyId, type: 'summary', title: 'Project Summary', content: '## Project Summary\n\nEdit this with your project details.', status: 'draft', author_type: 'human' },
            { company_id: companyId, type: 'master_plan', title: 'Master Execution Plan', content: '## Phases\n\n### Phase 1\n- [ ] Task\n\n### Phase 2\n- [ ] Task', status: 'draft', author_type: 'human' },
            { company_id: companyId, type: 'hiring_plan', title: 'Hiring Plan', content: '## Roles Needed\n\n- PM\n- Frontend\n- Backend', status: 'draft', author_type: 'human' },
            { company_id: companyId, type: 'daily_plan', title: "Today's Plan", content: '## Today\n\nNo tasks yet.', status: 'draft', author_type: 'human' },
          ];
          for (const t of templates) {
            if (!planByType(t.type)) {
              await supabase.from('project_plans').insert(t as any);
            }
          }
          await load();
        }
      }
    }
    setLoading(false);
  };

  const handleAddEnv = async () => {
    if (!companyId || !newEnvKey.trim()) return;
    await createEnvVar(companyId, { key: newEnvKey.trim(), value: newEnvVal, is_secret: newEnvSecret });
    setNewEnvKey('');
    setNewEnvVal('');
    setNewEnvSecret(false);
    await load();
  };

  const handleDeleteEnv = async (id: string) => {
    await deleteEnvVar(id);
    await load();
  };

  const sectionStyle: React.CSSProperties = {
    background: '#0d1117', border: '1px solid var(--hud-border)', marginBottom: 12,
  };
  const headerStyle: React.CSSProperties = {
    padding: '8px 12px', borderBottom: '1px solid var(--hud-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#090d14',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)',
    textTransform: 'uppercase', letterSpacing: '0.1em',
  };
  const btnStyle: React.CSSProperties = {
    padding: '3px 10px', fontSize: 'var(--font-xs)',
    background: '#00ffff10', border: '1px solid #00ffff30',
    color: 'var(--neon-cyan)', cursor: 'pointer', fontFamily: 'var(--font-hud)',
    textTransform: 'uppercase',
  };

  const todayTickets = tickets.filter(t => {
    const d = new Date(t.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 'var(--pad)', fontFamily: 'var(--font-hud)' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--pad)',
        padding: '8px var(--pad)', background: '#090d14', border: '1px solid var(--hud-border)',
      }}>
        <span style={{ fontSize: 'var(--font-md)', color: 'var(--neon-cyan)', textShadow: '0 0 6px var(--neon-cyan)' }}>
          PROJECT OVERVIEW
        </span>
        <button onClick={handleRegenerate} disabled={loading} style={{
          ...btnStyle, marginLeft: 'auto',
          background: loading ? '#1b2030' : '#c084fc10', borderColor: '#c084fc40', color: 'var(--neon-purple)',
        }}>
          {loading ? 'Generating...' : 'Regenerate with CEO'}
        </button>
      </div>

      {/* Plan sections */}
      {PLAN_TYPES.map(type => {
        const plan = planByType(type);
        const isEditing = editingPlan === plan?.id;
        const planComments = plan ? (comments[plan.id] ?? []) : [];

        return (
          <div key={type} style={sectionStyle}>
            <div style={headerStyle}>
              <span style={labelStyle}>{PLAN_LABELS[type]}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {plan && plan.status !== 'approved' && (
                  <button onClick={() => handleApprove(plan.id)} style={{
                    ...btnStyle, background: '#00ff8810', borderColor: '#00ff8840', color: 'var(--neon-green)',
                  }}>Approve</button>
                )}
                {plan && !isEditing && (
                  <button onClick={() => { setEditingPlan(plan.id); setEditContent(plan.content); }} style={btnStyle}>
                    Edit
                  </button>
                )}
                {plan?.status === 'approved' && (
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-green)', padding: '3px 8px' }}>
                    APPROVED
                  </span>
                )}
              </div>
            </div>
            <div style={{ padding: '10px 12px' }}>
              {!plan && (
                <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic' }}>
                  No {PLAN_LABELS[type]} yet. Click "Regenerate with CEO" to generate.
                </div>
              )}
              {plan && isEditing && (
                <div>
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    style={{
                      width: '100%', minHeight: 120, background: '#05080f',
                      border: '1px solid var(--hud-border)', color: 'var(--hud-text)',
                      fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
                      padding: 8, resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button onClick={() => handleSave(plan.id)} style={btnStyle}>Save</button>
                    <button onClick={() => setEditingPlan(null)} style={{ ...btnStyle, borderColor: '#ff224440', color: 'var(--neon-red)' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {plan && !isEditing && (
                <div style={{ fontSize: 'var(--font-xs)', color: '#8090a8', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {plan.content}
                </div>
              )}

              {/* Hiring plan special: list agents with Approve button */}
              {type === 'hiring_plan' && plan && (
                <div style={{ marginTop: 8 }}>
                  {(() => {
                    try {
                      const parsed = JSON.parse(plan.content);
                      if (Array.isArray(parsed)) {
                        return parsed.map((agent: any, i: number) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                            borderBottom: '1px solid #0a0e14',
                          }}>
                            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text)' }}>
                              {agent.role} — {agent.name ?? 'Auto'}
                            </span>
                            <button
                              onClick={async () => {
                                if (!companyId) return;
                                await hireAgent({ companyId, mode: 'auto', role: agent.role, name: agent.name });
                                await load();
                              }}
                              style={{ ...btnStyle, marginLeft: 'auto', background: '#00ff8810', borderColor: '#00ff8840', color: 'var(--neon-green)' }}
                            >
                              Hire
                            </button>
                          </div>
                        ));
                      }
                    } catch { /* not JSON */ }
                    return null;
                  })()}
                </div>
              )}

              {/* Comments for each plan */}
              {plan && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--hud-border)', paddingTop: 8 }}>
                  <button onClick={() => loadComments(plan.id)} style={{ ...btnStyle, fontSize: '10px', marginBottom: 6 }}>
                    Load Comments ({planComments.length})
                  </button>
                  {planComments.map(c => (
                    <div key={c.id} style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', padding: '3px 0', borderBottom: '1px solid #0a0e14' }}>
                      <span style={{ color: 'var(--neon-purple)' }}>{c.author}</span>: {c.content}
                      <span style={{ color: '#2a3a50', marginLeft: 6 }}>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <input
                      value={newComment[plan.id] ?? ''}
                      onChange={e => setNewComment(prev => ({ ...prev, [plan.id]: e.target.value }))}
                      placeholder="Add comment..."
                      style={{
                        flex: 1, background: '#05080f', border: '1px solid var(--hud-border)',
                        color: 'var(--hud-text)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
                        padding: '4px 8px',
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleAddComment(plan.id)}
                    />
                    <button onClick={() => handleAddComment(plan.id)} style={btnStyle}>Post</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Today's Tickets */}
      <div style={sectionStyle}>
        <div style={headerStyle}>
          <span style={labelStyle}>Today's Tickets</span>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)' }}>{todayTickets.length}</span>
        </div>
        <div style={{ padding: '8px 12px', maxHeight: 200, overflow: 'auto' }}>
          {todayTickets.length === 0 && (
            <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic' }}>No tickets today.</div>
          )}
          {todayTickets.map((t: any) => (
            <div key={t.id} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid #0a0e14', fontSize: 'var(--font-xs)' }}>
              <span style={{
                color: t.status === 'completed' ? 'var(--neon-green)' : t.status === 'in_progress' ? 'var(--neon-orange)' : 'var(--hud-text-dim)',
                textTransform: 'uppercase', width: 80, flexShrink: 0,
              }}>
                {t.status}
              </span>
              <span style={{ color: '#8090a8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Env Vars */}
      <div style={sectionStyle}>
        <div style={headerStyle}>
          <span style={labelStyle}>Environment Variables</span>
        </div>
        <div style={{ padding: '8px 12px' }}>
          {envVars.map(ev => (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
              borderBottom: '1px solid #0a0e14', fontSize: 'var(--font-xs)',
            }}>
              <span style={{ color: 'var(--neon-cyan)', width: 160, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ev.key}
              </span>
              <span style={{ color: '#6a7a90', flex: 1, fontFamily: 'monospace' }}>
                {ev.is_secret && !revealed.has(ev.id) ? '********' : ev.value}
              </span>
              {ev.is_secret && (
                <button
                  onClick={() => setRevealed(prev => {
                    const next = new Set(prev);
                    next.has(ev.id) ? next.delete(ev.id) : next.add(ev.id);
                    return next;
                  })}
                  style={{ ...btnStyle, fontSize: '10px' }}
                >
                  {revealed.has(ev.id) ? 'Hide' : 'Reveal'}
                </button>
              )}
              <button onClick={() => handleDeleteEnv(ev.id)} style={{
                ...btnStyle, fontSize: '10px', borderColor: '#ff224440', color: 'var(--neon-red)',
              }}>
                Del
              </button>
            </div>
          ))}

          {/* Add new */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <input
              value={newEnvKey} onChange={e => setNewEnvKey(e.target.value)} placeholder="KEY"
              style={{
                width: 140, background: '#05080f', border: '1px solid var(--hud-border)',
                color: 'var(--hud-text)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)', padding: '4px 8px',
              }}
            />
            <input
              value={newEnvVal} onChange={e => setNewEnvVal(e.target.value)} placeholder="value"
              style={{
                flex: 1, background: '#05080f', border: '1px solid var(--hud-border)',
                color: 'var(--hud-text)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)', padding: '4px 8px',
              }}
            />
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={newEnvSecret} onChange={e => setNewEnvSecret(e.target.checked)} />
              Secret
            </label>
            <button onClick={handleAddEnv} style={btnStyle}>+ Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

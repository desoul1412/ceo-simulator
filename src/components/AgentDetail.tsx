import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { supabase, isOnline } from '../lib/supabase';
import { ConfigManager } from './ConfigManager';
import { fireAgent } from '../lib/orchestratorApi';
import * as api from '../lib/api';
import { getRoleDisplayName } from '../lib/agentDisplay';

interface AgentSession {
  id: string;
  status: string;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  last_invoked_at: string;
  created_at: string;
}

interface AgentMemory {
  shortTerm?: string[];
  longTerm?: string[];
  skills?: string[];
  rules?: string[];
  completedTasks?: { task: string; date: string; summary: string }[];
}

export function AgentDetail() {
  const { companyId, agentId } = useParams();
  const navigate = useNavigate();
  const companies = useDashboardStore(s => s.companies);
  const company = companies.find(c => c.id === companyId);
  const agent = company?.employees.find(e => e.id === agentId);

  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [memory, setMemory] = useState<AgentMemory>({});
  const [skills, setSkills] = useState<string[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [firing, setFiring] = useState(false);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);

  // Load agent details from Supabase
  useEffect(() => {
    if (!agentId || !isOnline() || !supabase) return;

    // Fetch sessions
    supabase
      .from('agent_sessions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const rows = (data ?? []) as AgentSession[];
        setSessions(rows);
        setTotalCost(rows.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0));
      });

    // Fetch memory + skills from agent row
    supabase
      .from('agents')
      .select('memory, skills')
      .eq('id', agentId)
      .single()
      .then(({ data }) => {
        const row = data as any;
        setMemory(row?.memory ?? {});
        setSkills(row?.skills ?? []);
      });
  }, [agentId]);

  if (!company || !agent) {
    return <div style={{ padding: 16, color: '#2a3a50' }}>Agent not found</div>;
  }

  const STATUS_COLORS: Record<string, string> = {
    working: '#00ff88', meeting: '#c084fc', idle: '#4a5568', break: '#ff8800',
  };

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-hud)', maxWidth: 750, overflow: 'auto' }}>
      <button
        onClick={() => navigate(`/company/${companyId}/agents`)}
        style={{
          background: '#1b2030', border: '1px solid #2a3a50',
          color: '#6a7a90', fontFamily: 'var(--font-hud)',
          fontSize: 'var(--font-xs)', padding: '4px 10px', cursor: 'pointer',
          textTransform: 'uppercase', marginBottom: 12,
        }}
      >
        ← Agents
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 14, height: 14, background: agent.color,
          boxShadow: `0 0 10px ${agent.color}`,
        }} />
        <div>
          <div style={{ fontSize: 'var(--font-lg)', color: 'var(--hud-text-h)' }}>
            {getRoleDisplayName(agent.role, agent.id, company.employees)}
          </div>
          <div style={{ fontSize: 'var(--font-md)', color: agent.color, textTransform: 'uppercase' }}>{agent.role}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--font-sm)', color: '#4a5568' }}>TOTAL COST</div>
            <div style={{ fontSize: 'var(--font-md)', color: totalCost > 0 ? '#c084fc' : '#2a3a50' }}>
              ${totalCost.toFixed(4)}
            </div>
          </div>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!confirm(`Fire ${agent.name}? This will permanently remove this agent.`)) return;
              setFiring(true);
              try {
                if (orchestratorConnected) {
                  await fireAgent(agentId!);
                } else if (isOnline() && supabase) {
                  await supabase.from('agents').delete().eq('id', agentId);
                }
                // Refresh companies
                if (isOnline()) {
                  const apiCompanies = await api.fetchCompanies();
                  const store = useDashboardStore.getState();
                  useDashboardStore.setState({
                    companies: store.companies.map(co => {
                      const updated = apiCompanies.find(c => c.id === co.id);
                      if (!updated) return co;
                      return {
                        ...co,
                        employees: updated.agents.map(a => ({
                          id: a.id, name: a.name, role: a.role as any, status: a.status as any,
                          col: a.tileCol, row: a.tileRow, color: a.color,
                          assignedTask: a.assignedTask, progress: a.progress,
                        })),
                      };
                    }),
                  });
                }
                navigate(`/company/${companyId}/agents`);
              } catch (err) {
                console.error('[fire] Failed:', err);
              }
              setFiring(false);
            }}
            disabled={firing}
            style={{
              background: '#1a0a0a', border: '1px solid #ff224460',
              color: '#ff2244', fontFamily: 'var(--font-hud)',
              fontSize: 'var(--font-xs)', padding: '6px 14px', cursor: firing ? 'wait' : 'pointer',
              textTransform: 'uppercase', opacity: firing ? 0.5 : 1,
            }}
          >
            {firing ? 'Firing...' : 'Fire Agent'}
          </button>
        </div>
      </div>

      {/* Status */}
      <div style={{
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '10px 14px', marginBottom: 10, display: 'flex', gap: 20,
      }}>
        <div>
          <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>STATUS </span>
          <span style={{
            fontSize: 'var(--font-sm)', color: STATUS_COLORS[agent.status] ?? '#4a5568',
            textTransform: 'uppercase',
          }}>
            ● {agent.status}
          </span>
        </div>
        {agent.assignedTask && (
          <div style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', flex: 1 }}>{agent.assignedTask}</div>
        )}
        <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>Progress: {agent.progress}%</div>
      </div>

      {/* Skills */}
      <div style={{
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '10px 14px', marginBottom: 10,
      }}>
        <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 6 }}>
          Skills {skills.length > 0 && `(${skills.length})`}
        </div>
        {skills.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {skills.map(s => (
              <span key={s} style={{
                padding: '2px 8px', fontSize: 'var(--font-xs)',
                background: '#00ff8815', border: '1px solid #00ff8830',
                color: '#00ff88',
              }}>
                {s}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic' }}>
            No skills learned yet — skills are auto-detected from completed tasks
          </div>
        )}
      </div>

      {/* Memory */}
      <div style={{
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '10px 14px', marginBottom: 10,
      }}>
        <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 6 }}>
          Memory
        </div>

        {(memory.shortTerm?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', marginBottom: 3 }}>SHORT-TERM</div>
            {memory.shortTerm!.map((m, i) => (
              <div key={i} style={{ fontSize: 'var(--font-xs)', color: '#8090a8', padding: '2px 0', lineHeight: 1.3 }}>
                · {m}
              </div>
            ))}
          </div>
        )}

        {(memory.longTerm?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', marginBottom: 3 }}>LONG-TERM</div>
            {memory.longTerm!.map((m, i) => (
              <div key={i} style={{ fontSize: 'var(--font-xs)', color: '#c084fc', padding: '2px 0' }}>
                · {m}
              </div>
            ))}
          </div>
        )}

        {(memory.completedTasks?.length ?? 0) > 0 && (
          <div>
            <div style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', marginBottom: 3 }}>COMPLETED TASKS</div>
            {memory.completedTasks!.slice(0, 5).map((t, i) => (
              <div key={i} style={{
                padding: '4px 0', borderBottom: '1px solid #0a0e14',
              }}>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-h)' }}>{t.task}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>{t.date} — {t.summary.slice(0, 100)}</div>
              </div>
            ))}
          </div>
        )}

        {!memory.shortTerm?.length && !memory.longTerm?.length && !memory.completedTasks?.length && (
          <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic' }}>
            No memories yet — memory populates after completing tasks
          </div>
        )}
      </div>

      {/* Agent-Level Configs */}
      {(['skill', 'mcp_server', 'rule'] as const).map(type => (
        <div key={type} style={{
          background: '#0d1117', border: '1px solid var(--hud-border)',
          padding: '10px 14px', marginBottom: 10,
        }}>
          <ConfigManager type={type} scope="agent" scopeId={agentId} />
        </div>
      ))}

      {/* Session History */}
      <div style={{
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '10px 14px', marginBottom: 10,
      }}>
        <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 6 }}>
          Session History {sessions.length > 0 && `(${sessions.length})`}
        </div>
        {sessions.length > 0 ? (
          sessions.map(sess => (
            <div key={sess.id} style={{
              padding: '6px 0', borderBottom: '1px solid #0a0e14',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: sess.status === 'completed' ? '#00ff88' : sess.status === 'error' ? '#ff2244' : '#ff8800',
              }} />
              <span style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', flex: 1 }}>
                {new Date(sess.created_at).toLocaleString()}
              </span>
              <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>
                {sess.total_input_tokens}↓ {sess.total_output_tokens}↑
              </span>
              <span style={{ fontSize: 'var(--font-xs)', color: '#c084fc' }}>
                ${(sess.total_cost_usd ?? 0).toFixed(4)}
              </span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic' }}>
            No sessions yet — sessions are created when this agent executes tasks via Claude
          </div>
        )}
      </div>
    </div>
  );
}

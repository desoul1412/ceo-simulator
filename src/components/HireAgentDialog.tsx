import { useState, useEffect } from 'react';

// Agent models with pre-designed skills, rules, and system prompts
const AGENT_MODELS: Record<string, AgentModel> = {
  CEO: {
    role: 'CEO', color: '#00ffff', model: 'opus', budget: 25,
    skills: ['Strategic Delegation', 'Business Reasoning', 'Discovery', 'Tavily Research'],
    rules: ['No Hallucination', 'Pre-Flight Docs', 'Post-Flight Update', 'Budget Awareness', 'Gate Rule'],
    mcpServers: ['Tavily', 'Supabase'],
    systemPrompt: 'You are the CEO. Receive goals, reason strategically, delegate to 9 agent types, and monitor progress.',
    description: 'Strategic leader — delegates goals, makes decisions, tracks progress',
  },
  PM: {
    role: 'PM', color: '#c084fc', model: 'sonnet', budget: 15,
    skills: ['Project Planning', 'Discovery', 'Writing Plans', 'Tavily Research', 'Context7 Docs'],
    rules: ['Data-First', 'Gate Rule', 'No Placeholders', 'ADR Rule', 'Dual-Track Output'],
    mcpServers: ['Context7', 'Tavily', 'Supabase'],
    systemPrompt: 'You are the Planner/PM. Gather requirements, design solutions, write TDD implementation plans.',
    description: 'Architecture & planning — requirements, specs, implementation plans',
  },
  Frontend: {
    role: 'Frontend', color: '#ff8800', model: 'sonnet', budget: 15,
    skills: ['UI/UX Pro Max', 'React Development', 'CSS/Tailwind', 'Quality Engineering', 'Systematic Debugging', 'Context7 Docs', 'Git Worktree'],
    rules: ['TDD Circuit Breaker', 'Context7 First', 'Design System', 'Pre-Flight Docs', 'Git Worktree Isolation'],
    mcpServers: ['Context7'],
    systemPrompt: 'You are a Frontend Designer. Build React 19 + TypeScript + Tailwind v4 components with pixel art / HUD / sci-fi style.',
    description: 'UI/UX builder — React, Tailwind, design intelligence, pixel art',
  },
  Backend: {
    role: 'Backend', color: '#3b82f6', model: 'sonnet', budget: 15,
    skills: ['API Design', 'Database', 'Quality Engineering', 'Systematic Debugging', 'Context7 Docs', 'Tavily Research', 'Git Worktree'],
    rules: ['TDD Circuit Breaker', 'Context7 First', 'Atomic Operations', 'RLS Always', 'No Secrets in Code'],
    mcpServers: ['Context7', 'Supabase', 'Tavily'],
    systemPrompt: 'You are a Backend Developer. Build APIs and manage data with Supabase PostgreSQL + Express.',
    description: 'API & data engineer — endpoints, schemas, integrations',
  },
  DevOps: {
    role: 'DevOps', color: '#00ff88', model: 'sonnet', budget: 10,
    skills: ['DevOps CI/CD', 'Infrastructure Management', 'Database', 'Quality Engineering', 'Systematic Debugging', 'Context7 Docs', 'Git Worktree'],
    rules: ['No Secrets in Code', 'Test Before Deploy', 'Never Force Push Main', 'MCP Fallback', 'Runbook Updates'],
    mcpServers: ['Supabase', 'Context7', 'Tavily'],
    systemPrompt: 'You are a DevOps Engineer. Manage Vercel, Supabase, CI/CD, and system reliability.',
    description: 'Infrastructure — CI/CD, deployment, monitoring, reliability',
  },
  QA: {
    role: 'QA', color: '#ef4444', model: 'haiku', budget: 5,
    skills: ['Quality Engineering', 'Systematic Debugging'],
    rules: ['TDD Circuit Breaker', 'Test Behavior Not Implementation', 'Regression Tests Required', 'No Mocks for Critical Paths'],
    mcpServers: ['Supabase'],
    systemPrompt: 'You are a QA Engineer. Write test plans, validate acceptance criteria, catch regressions.',
    description: 'Quality gatekeeper — tests, validation, regressions',
  },
  Marketer: {
    role: 'Marketer', color: '#f59e0b', model: 'sonnet', budget: 10,
    skills: ['Product Launch', 'SEO Growth', 'Analytics & Metrics', 'Social & Ads', 'Brand Positioning', 'Tavily Research'],
    rules: ['Data-Driven', 'Research First', 'Measure Everything', 'ROI Focus'],
    mcpServers: ['Tavily'],
    systemPrompt: 'You are a Growth Marketer. Drive user acquisition, SEO, paid ads, and brand awareness.',
    description: 'Growth & acquisition — launches, SEO, ads, analytics, brand',
  },
  'Content Writer': {
    role: 'Content Writer', color: '#a78bfa', model: 'haiku', budget: 5,
    skills: ['Copywriting', 'Technical Writing', 'Content Strategy', 'SEO Growth', 'Tavily Research'],
    rules: ['Accuracy First', 'Write for the Reader', 'Every Feature = Benefit', 'Copy-Pasteable Code'],
    mcpServers: ['Tavily'],
    systemPrompt: 'You are a Content Writer. Create landing pages, docs, blog posts, and email sequences.',
    description: 'Copy & docs — landing pages, blog, technical writing, email',
  },
  Sales: {
    role: 'Sales', color: '#06b6d4', model: 'sonnet', budget: 10,
    skills: ['Pricing & Conversion', 'Customer Success', 'Analytics & Metrics', 'Tavily Research'],
    rules: ['Customer-First', 'Data-Driven Pricing', 'Measure Retention', 'Close the Loop'],
    mcpServers: ['Tavily', 'Supabase'],
    systemPrompt: 'You are a Sales & Customer Success agent. Optimize pricing, conversions, and retention.',
    description: 'Revenue & retention — pricing, funnels, onboarding, churn prevention',
  },
  Operations: {
    role: 'Operations', color: '#6b7280', model: 'haiku', budget: 5,
    skills: ['Process & Finance', 'Compliance', 'Analytics & Metrics'],
    rules: ['Document Everything', 'Budget Alerts', 'Automate ROI', 'Compliance First'],
    mcpServers: ['Supabase'],
    systemPrompt: 'You are an Operations agent. Manage budgets, SOPs, compliance, and team capacity.',
    description: 'Process & compliance — budgets, SOPs, legal docs, capacity planning',
  },
};

interface AgentModel {
  role: string;
  color: string;
  model: string;
  budget: number;
  skills: string[];
  rules: string[];
  mcpServers: string[];
  systemPrompt: string;
  description: string;
}

const ROLES = Object.keys(AGENT_MODELS);

interface HireAgentDialogProps {
  companyId: string;
  onHire: (config: HireConfig) => void;
  onClose: () => void;
}

export interface HireConfig {
  companyId: string;
  mode: 'auto' | 'manual';
  role: string;
  name?: string;
  systemPrompt?: string;
  skills?: string[];
  monthlyCost?: number;
  model?: string;
  runtimeType?: string;
  runtimeConfig?: any;
  budgetLimit?: number;
}

export function HireAgentDialog({ companyId, onHire, onClose }: HireAgentDialogProps) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [role, setRole] = useState('Frontend');
  const [name, setName] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [model, setModel] = useState('sonnet');
  const [runtimeType, setRuntimeType] = useState('claude_sdk');
  const [httpUrl] = useState('');
  const [bashCommand] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('10');

  const agentModel = AGENT_MODELS[role];
  const effectiveRole = customRole || role;
  const color = agentModel?.color ?? '#6a7a90';

  // Sync model defaults when role changes
  useEffect(() => {
    if (agentModel) {
      setSelectedSkills([...agentModel.skills]);
      setModel(agentModel.model);
      setBudgetLimit(String(agentModel.budget));
      setSystemPrompt(agentModel.systemPrompt);
    }
  }, [role]);

  const handleQuickHire = () => {
    onHire({
      companyId, mode: 'auto', role: effectiveRole,
      model: agentModel?.model,
      skills: agentModel?.skills,
      systemPrompt: agentModel?.systemPrompt,
      budgetLimit: agentModel?.budget,
    });
  };

  const handleManualHire = () => {
    const runtimeConfig = runtimeType === 'http_endpoint'
      ? { url: httpUrl }
      : runtimeType === 'bash_script'
      ? { command: bashCommand }
      : { model };
    onHire({
      companyId, mode: 'manual', role: effectiveRole,
      name: name || undefined,
      systemPrompt: systemPrompt || undefined,
      skills: selectedSkills.length > 0 ? selectedSkills : undefined,
      model, runtimeType, runtimeConfig,
      budgetLimit: parseFloat(budgetLimit) || 10,
    });
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div
        style={{
          background: '#0d1117',
          border: '1px solid var(--hud-border)',
          width: 540, maxHeight: '85vh',
          overflow: 'auto',
          fontFamily: 'var(--font-hud)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--hud-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 'var(--font-md)', color: 'var(--hud-text-h)', textTransform: 'uppercase' }}>
            Hire Agent
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#4a5568',
            cursor: 'pointer', fontSize: 16, fontFamily: 'var(--font-hud)',
          }}>x</button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--hud-border)' }}>
          {(['auto', 'manual'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '10px',
                background: mode === m ? '#1b203060' : 'transparent',
                border: 'none', borderBottom: mode === m ? '2px solid var(--neon-cyan)' : '2px solid transparent',
                color: mode === m ? 'var(--neon-cyan)' : '#4a5568',
                fontFamily: 'var(--font-hud)', fontSize: 'var(--font-sm)',
                textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              {m === 'auto' ? '\u26A1 Quick Hire' : '\u2699 Custom Hire'}
            </button>
          ))}
        </div>

        <div style={{ padding: '14px 16px' }}>
          {/* Role selector */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 6 }}>Role</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ROLES.map(r => (
                <button
                  key={r}
                  onClick={() => { setRole(r); setCustomRole(''); }}
                  style={{
                    padding: '5px 12px', fontSize: 'var(--font-xs)',
                    background: role === r && !customRole ? `${AGENT_MODELS[r].color}18` : 'transparent',
                    border: `1px solid ${role === r && !customRole ? AGENT_MODELS[r].color + '60' : '#1b2030'}`,
                    color: role === r && !customRole ? AGENT_MODELS[r].color : '#4a5568',
                    cursor: 'pointer', fontFamily: 'var(--font-hud)',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', marginTop: 6 }}>
              {agentModel?.description ?? 'Custom role'}
            </div>
          </div>

          {/* Auto mode: show agent model summary */}
          {mode === 'auto' && agentModel && (
            <div>
              <div style={{
                padding: '12px 14px', background: '#090d14',
                border: '1px solid #1b2030', marginBottom: 14,
                fontSize: 'var(--font-sm)', color: '#6a7a90', lineHeight: 1.6,
              }}>
                <div style={{ color, marginBottom: 6, fontSize: 'var(--font-md)' }}>{'\u25C6'} {effectiveRole} Agent</div>
                <div><span style={{ color: '#4a5568' }}>Model:</span> {agentModel.model}</div>
                <div><span style={{ color: '#4a5568' }}>Budget:</span> ${agentModel.budget}</div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: '#4a5568' }}>Skills:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {agentModel.skills.map(s => (
                      <span key={s} style={{
                        padding: '2px 8px', fontSize: 'var(--font-xs)',
                        background: '#00ff8810', border: '1px solid #00ff8830', color: '#00ff88',
                      }}>{s}</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: '#4a5568' }}>Rules:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {agentModel.rules.map(r => (
                      <span key={r} style={{
                        padding: '2px 8px', fontSize: 'var(--font-xs)',
                        background: '#ff880010', border: '1px solid #ff880030', color: '#ff8800',
                      }}>{r}</span>
                    ))}
                  </div>
                </div>
                {agentModel.mcpServers.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ color: '#4a5568' }}>MCP Servers:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {agentModel.mcpServers.map(m => (
                        <span key={m} style={{
                          padding: '2px 8px', fontSize: 'var(--font-xs)',
                          background: '#c084fc10', border: '1px solid #c084fc30', color: '#c084fc',
                        }}>{m}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleQuickHire}
                style={{
                  width: '100%', padding: '10px',
                  background: `${color}18`, border: `1px solid ${color}60`,
                  color, fontFamily: 'var(--font-hud)',
                  fontSize: 'var(--font-sm)', textTransform: 'uppercase',
                  cursor: 'pointer', letterSpacing: '0.1em',
                }}
              >
                {'\u26A1'} Hire {effectiveRole}
              </button>
            </div>
          )}

          {/* Manual mode: full configuration */}
          {mode === 'manual' && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Name</div>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Auto-generated if empty"
                  style={{ width: '100%', padding: '6px 10px', background: '#090d14', border: '1px solid #1b2030', color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-sm)' }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>System Prompt</div>
                <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '6px 10px', background: '#090d14', border: '1px solid #1b2030', color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-sm)', resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(agentModel?.skills ?? []).map(skill => (
                    <button key={skill} onClick={() => toggleSkill(skill)}
                      style={{
                        padding: '3px 10px', fontSize: 'var(--font-xs)',
                        background: selectedSkills.includes(skill) ? '#00ff8815' : 'transparent',
                        border: `1px solid ${selectedSkills.includes(skill) ? '#00ff8840' : '#1b2030'}`,
                        color: selectedSkills.includes(skill) ? '#00ff88' : '#4a5568',
                        cursor: 'pointer', fontFamily: 'var(--font-hud)',
                      }}>{skill}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Rules</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(agentModel?.rules ?? []).map(rule => (
                    <span key={rule} style={{
                      padding: '3px 10px', fontSize: 'var(--font-xs)',
                      background: '#ff880010', border: '1px solid #ff880030', color: '#ff8800',
                    }}>{rule}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Runtime</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[{ id: 'claude_sdk', label: 'Claude SDK' }, { id: 'http_endpoint', label: 'HTTP' }, { id: 'bash_script', label: 'Bash' }].map(rt => (
                      <button key={rt.id} onClick={() => setRuntimeType(rt.id)}
                        style={{
                          padding: '4px 12px', fontSize: 'var(--font-xs)',
                          background: runtimeType === rt.id ? '#c084fc18' : 'transparent',
                          border: `1px solid ${runtimeType === rt.id ? '#c084fc60' : '#1b2030'}`,
                          color: runtimeType === rt.id ? '#c084fc' : '#4a5568',
                          cursor: 'pointer', fontFamily: 'var(--font-hud)',
                        }}>{rt.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Budget ($)</div>
                  <input type="number" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)}
                    style={{ width: 80, padding: '4px 10px', background: '#090d14', border: '1px solid #1b2030', color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-sm)' }} />
                </div>
                {runtimeType === 'claude_sdk' && (
                  <div>
                    <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Model</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['haiku', 'sonnet', 'opus'].map(m => (
                        <button key={m} onClick={() => setModel(m)}
                          style={{
                            padding: '4px 12px', fontSize: 'var(--font-xs)',
                            background: model === m ? '#c084fc18' : 'transparent',
                            border: `1px solid ${model === m ? '#c084fc60' : '#1b2030'}`,
                            color: model === m ? '#c084fc' : '#4a5568',
                            cursor: 'pointer', fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
                          }}>{m}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleManualHire}
                style={{
                  width: '100%', padding: '10px',
                  background: `${color}18`, border: `1px solid ${color}60`,
                  color, fontFamily: 'var(--font-hud)',
                  fontSize: 'var(--font-sm)', textTransform: 'uppercase',
                  cursor: 'pointer', letterSpacing: '0.1em',
                }}>
                {'\u2699'} Hire {effectiveRole}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

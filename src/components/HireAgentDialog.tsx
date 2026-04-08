import { useState } from 'react';

const ROLES = ['PM', 'DevOps', 'Frontend', 'Backend', 'QA', 'Designer'];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  PM: 'Writes specs, user stories, acceptance criteria',
  DevOps: 'Infrastructure, CI/CD, Docker, deployment',
  Frontend: 'React components, TypeScript, Tailwind, tests',
  Backend: 'API endpoints, database, server logic, tests',
  QA: 'Test suites, bug triage, coverage reports',
  Designer: 'Design specs, mockups, color schemes, CSS',
};

const ROLE_COLORS: Record<string, string> = {
  PM: '#c084fc', DevOps: '#00ff88', Frontend: '#ff8800',
  Backend: '#3b82f6', QA: '#ef4444', Designer: '#f59e0b',
};

const DEFAULT_SKILLS: Record<string, string[]> = {
  PM: ['Requirements', 'Documentation', 'User Stories'],
  DevOps: ['CI/CD', 'Docker', 'Infrastructure'],
  Frontend: ['React', 'TypeScript', 'CSS/Tailwind'],
  Backend: ['API Design', 'Database', 'TypeScript'],
  QA: ['Testing', 'Automation', 'Bug Triage'],
  Designer: ['UI Design', 'Design Systems', 'CSS/Tailwind'],
};

const ALL_SKILLS = [
  'React', 'TypeScript', 'CSS/Tailwind', 'API Design', 'Database',
  'Testing', 'Documentation', 'CI/CD', 'Docker', 'Git',
  'Infrastructure', 'Automation', 'UI Design', 'Design Systems',
  'Requirements', 'User Stories', 'Bug Triage', 'Build Tools',
];

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
  const [httpUrl, setHttpUrl] = useState('');
  const [bashCommand, setBashCommand] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('10');

  const effectiveRole = customRole || role;
  const color = ROLE_COLORS[effectiveRole] ?? '#6a7a90';

  const handleQuickHire = () => {
    onHire({ companyId, mode: 'auto', role: effectiveRole });
  };

  const handleManualHire = () => {
    const runtimeConfig = runtimeType === 'http_endpoint'
      ? { url: httpUrl }
      : runtimeType === 'bash_script'
      ? { command: bashCommand }
      : { model };
    onHire({
      companyId,
      mode: 'manual',
      role: effectiveRole,
      name: name || undefined,
      systemPrompt: systemPrompt || undefined,
      skills: selectedSkills.length > 0 ? selectedSkills : undefined,
      model,
      runtimeType,
      runtimeConfig,
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
          width: 480, maxHeight: '80vh',
          overflow: 'auto',
          fontFamily: 'var(--font-hud)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--hud-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, color: 'var(--hud-text-h)', textTransform: 'uppercase' }}>
            Hire Agent
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#4a5568',
            cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-hud)',
          }}>×</button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--hud-border)' }}>
          {(['auto', 'manual'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '8px',
                background: mode === m ? '#1b203060' : 'transparent',
                border: 'none', borderBottom: mode === m ? '2px solid var(--neon-cyan)' : '2px solid transparent',
                color: mode === m ? 'var(--neon-cyan)' : '#4a5568',
                fontFamily: 'var(--font-hud)', fontSize: 10,
                textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              {m === 'auto' ? '⚡ Quick Hire' : '⚙ Custom Hire'}
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 14px' }}>
          {/* Role selector */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Role</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {ROLES.map(r => (
                <button
                  key={r}
                  onClick={() => { setRole(r); setCustomRole(''); setSelectedSkills(DEFAULT_SKILLS[r] ?? []); }}
                  style={{
                    padding: '4px 10px', fontSize: 9,
                    background: role === r && !customRole ? `${ROLE_COLORS[r]}18` : 'transparent',
                    border: `1px solid ${role === r && !customRole ? ROLE_COLORS[r] + '60' : '#1b2030'}`,
                    color: role === r && !customRole ? ROLE_COLORS[r] : '#4a5568',
                    cursor: 'pointer', fontFamily: 'var(--font-hud)',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            {mode === 'manual' && (
              <input
                type="text"
                value={customRole}
                onChange={e => setCustomRole(e.target.value)}
                placeholder="...or type custom role"
                style={{
                  marginTop: 6, width: '100%', padding: '4px 8px',
                  background: '#090d14', border: '1px solid #1b2030',
                  color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)',
                  fontSize: 10,
                }}
              />
            )}
            <div style={{ fontSize: 8, color: '#4a5568', marginTop: 4 }}>
              {ROLE_DESCRIPTIONS[effectiveRole] ?? 'Custom role — define skills and prompt below'}
            </div>
          </div>

          {/* Auto mode: just show summary and hire button */}
          {mode === 'auto' && (
            <div>
              <div style={{
                padding: '10px 12px', background: '#090d14',
                border: '1px solid #1b2030', marginBottom: 12,
                fontSize: 9, color: '#6a7a90', lineHeight: 1.5,
              }}>
                <div style={{ color, marginBottom: 4 }}>◆ {effectiveRole} Agent</div>
                <div>Name: Auto-generated</div>
                <div>Skills: {(DEFAULT_SKILLS[effectiveRole] ?? ['General']).join(', ')}</div>
                <div>System prompt: Role-default</div>
                <div>Model: Sonnet</div>
              </div>
              <button
                onClick={handleQuickHire}
                style={{
                  width: '100%', padding: '8px',
                  background: `${color}18`, border: `1px solid ${color}60`,
                  color, fontFamily: 'var(--font-hud)',
                  fontSize: 11, textTransform: 'uppercase',
                  cursor: 'pointer', letterSpacing: '0.1em',
                }}
              >
                ⚡ Hire {effectiveRole}
              </button>
            </div>
          )}

          {/* Manual mode: full configuration */}
          {mode === 'manual' && (
            <div>
              {/* Name */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', marginBottom: 3 }}>Name</div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Auto-generated if empty"
                  style={{
                    width: '100%', padding: '4px 8px',
                    background: '#090d14', border: '1px solid #1b2030',
                    color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)', fontSize: 10,
                  }}
                />
              </div>

              {/* System prompt */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', marginBottom: 3 }}>
                  System Prompt
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  placeholder={`Default: "${(ROLE_DESCRIPTIONS[effectiveRole] ?? 'You are a ' + effectiveRole).slice(0, 80)}..."`}
                  rows={3}
                  style={{
                    width: '100%', padding: '6px 8px',
                    background: '#090d14', border: '1px solid #1b2030',
                    color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)', fontSize: 9,
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Skills */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', marginBottom: 3 }}>
                  Skills
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {ALL_SKILLS.map(skill => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      style={{
                        padding: '2px 7px', fontSize: 8,
                        background: selectedSkills.includes(skill) ? '#00ff8815' : 'transparent',
                        border: `1px solid ${selectedSkills.includes(skill) ? '#00ff8840' : '#1b2030'}`,
                        color: selectedSkills.includes(skill) ? '#00ff88' : '#4a5568',
                        cursor: 'pointer', fontFamily: 'var(--font-hud)',
                      }}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              {/* Runtime Type */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', marginBottom: 3 }}>Runtime</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { id: 'claude_sdk', label: 'Claude SDK' },
                    { id: 'http_endpoint', label: 'HTTP' },
                    { id: 'bash_script', label: 'Bash' },
                  ].map(rt => (
                    <button
                      key={rt.id}
                      onClick={() => setRuntimeType(rt.id)}
                      style={{
                        padding: '3px 10px', fontSize: 9,
                        background: runtimeType === rt.id ? '#c084fc18' : 'transparent',
                        border: `1px solid ${runtimeType === rt.id ? '#c084fc60' : '#1b2030'}`,
                        color: runtimeType === rt.id ? '#c084fc' : '#4a5568',
                        cursor: 'pointer', fontFamily: 'var(--font-hud)',
                      }}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
                {runtimeType === 'http_endpoint' && (
                  <input type="text" value={httpUrl} onChange={e => setHttpUrl(e.target.value)}
                    placeholder="https://api.example.com/agent"
                    style={{ marginTop: 4, width: '100%', padding: '4px 8px', background: '#090d14', border: '1px solid #1b2030', color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)', fontSize: 9 }} />
                )}
                {runtimeType === 'bash_script' && (
                  <input type="text" value={bashCommand} onChange={e => setBashCommand(e.target.value)}
                    placeholder="python scripts/agent.py"
                    style={{ marginTop: 4, width: '100%', padding: '4px 8px', background: '#090d14', border: '1px solid #1b2030', color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)', fontSize: 9 }} />
                )}
              </div>

              {/* Budget */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', marginBottom: 3 }}>Budget Cap (USD)</div>
                <input type="number" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)}
                  step="1" min="0.5"
                  style={{ width: 100, padding: '4px 8px', background: '#090d14', border: '1px solid #1b2030', color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)', fontSize: 10 }} />
                <span style={{ fontSize: 8, color: '#2a3a50', marginLeft: 6 }}>Auto-throttle when exceeded</span>
              </div>

              {/* Model (Claude SDK only) */}
              {runtimeType === 'claude_sdk' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', marginBottom: 3 }}>Model</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['haiku', 'sonnet', 'opus'].map(m => (
                    <button
                      key={m}
                      onClick={() => setModel(m)}
                      style={{
                        padding: '3px 10px', fontSize: 9,
                        background: model === m ? '#c084fc18' : 'transparent',
                        border: `1px solid ${model === m ? '#c084fc60' : '#1b2030'}`,
                        color: model === m ? '#c084fc' : '#4a5568',
                        cursor: 'pointer', fontFamily: 'var(--font-hud)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              )}

              <button
                onClick={handleManualHire}
                style={{
                  width: '100%', padding: '8px',
                  background: `${color}18`, border: `1px solid ${color}60`,
                  color, fontFamily: 'var(--font-hud)',
                  fontSize: 11, textTransform: 'uppercase',
                  cursor: 'pointer', letterSpacing: '0.1em',
                }}
              >
                ⚙ Hire {effectiveRole}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  fetchConfigs, createConfig, updateConfig, deleteConfig,
  type ConfigRow,
} from '../lib/orchestratorApi';
import { useDashboardStore } from '../store/dashboardStore';

// ── Type-specific templates ──────────────────────────────────────────────────

const SKILL_TEMPLATES = [
  // Shared skills
  { key: 'quality-engineering', value: { name: 'Quality Engineering', description: 'TDD + test strategy + completion gates (RED-GREEN-REFACTOR)', autoAssignToRoles: ['Frontend', 'Backend', 'DevOps', 'QA'] } },
  { key: 'systematic-debugging', value: { name: 'Systematic Debugging', description: 'Root cause analysis before fixes — 4-phase investigation', autoAssignToRoles: ['Frontend', 'Backend', 'DevOps', 'QA'] } },
  { key: 'tavily-research', value: { name: 'Tavily Research', description: 'Web search, extract, crawl, deep research with citations', autoAssignToRoles: ['CEO', 'PM', 'Marketer', 'Sales', 'Content Writer'] } },
  { key: 'context7-docs', value: { name: 'Context7 Docs', description: 'Up-to-date library documentation — prevents API hallucination', autoAssignToRoles: ['Frontend', 'Backend', 'DevOps', 'PM'] } },
  { key: 'git-worktree', value: { name: 'Git Worktree Isolation', description: 'Isolated branches for safe feature development', autoAssignToRoles: ['Frontend', 'Backend', 'DevOps'] } },
  // Role-specific
  { key: 'strategic-delegation', value: { name: 'Strategic Delegation', description: 'Break CEO goals into subtasks for 9 agent roles', autoAssignToRoles: ['CEO'] } },
  { key: 'business-reasoning', value: { name: 'Business Reasoning', description: 'DECIDE framework + ADRs + stakeholder communication', autoAssignToRoles: ['CEO', 'PM'] } },
  { key: 'discovery', value: { name: 'Discovery', description: 'Requirements gathering + brainstorming + design exploration', autoAssignToRoles: ['PM', 'CEO'] } },
  { key: 'project-planning', value: { name: 'Project Planning', description: '8-phase planning from intake to handoff', autoAssignToRoles: ['PM'] } },
  { key: 'writing-plans', value: { name: 'Writing Plans', description: 'Bite-sized TDD implementation plans with exact code', autoAssignToRoles: ['PM'] } },
  { key: 'ui-ux-pro-max', value: { name: 'UI/UX Pro Max', description: '67 styles, 161 palettes, 57 fonts, design system generation', autoAssignToRoles: ['Frontend'] } },
  { key: 'react-development', value: { name: 'React Development', description: 'React 19 + TypeScript + hooks patterns', autoAssignToRoles: ['Frontend'] } },
  { key: 'css-tailwind', value: { name: 'CSS/Tailwind', description: 'Tailwind v4 CSS-first config and design tokens', autoAssignToRoles: ['Frontend'] } },
  { key: 'api-design', value: { name: 'API Design', description: 'RESTful patterns, error handling, Supabase integration', autoAssignToRoles: ['Backend'] } },
  { key: 'database', value: { name: 'Database', description: 'PostgreSQL schemas, migrations, RLS, Supabase', autoAssignToRoles: ['Backend', 'DevOps'] } },
  { key: 'devops-ci', value: { name: 'DevOps CI/CD', description: 'CI/CD pipelines, Vercel deployment, monitoring', autoAssignToRoles: ['DevOps'] } },
  { key: 'product-launch', value: { name: 'Product Launch', description: 'Go-to-market strategy, launch timeline, channels', autoAssignToRoles: ['Marketer'] } },
  { key: 'seo-growth', value: { name: 'SEO Growth', description: 'Keyword research, technical SEO, content optimization', autoAssignToRoles: ['Marketer', 'Content Writer'] } },
  { key: 'analytics-metrics', value: { name: 'Analytics & Metrics', description: 'KPI dashboards, funnel analysis, attribution', autoAssignToRoles: ['Marketer', 'Sales', 'Operations'] } },
  { key: 'copywriting', value: { name: 'Copywriting', description: 'AIDA/PAS frameworks, landing pages, CTAs', autoAssignToRoles: ['Content Writer'] } },
  { key: 'pricing-conversion', value: { name: 'Pricing & Conversion', description: 'Value-based pricing, tiering, funnel design', autoAssignToRoles: ['Sales'] } },
  { key: 'customer-success', value: { name: 'Customer Success', description: 'Onboarding, retention, churn prevention, feedback', autoAssignToRoles: ['Sales'] } },
  { key: 'process-finance', value: { name: 'Process & Finance', description: 'SOPs, budget tracking, automation, capacity planning', autoAssignToRoles: ['Operations'] } },
  { key: 'compliance', value: { name: 'Compliance', description: 'ToS, privacy policy, GDPR/CCPA, data handling', autoAssignToRoles: ['Operations'] } },
];

const MCP_TEMPLATES = [
  { key: 'tavily', value: { name: 'Tavily', command: 'tvly', args: [], description: 'Web search, extract, crawl, deep research for market data', autoAssignToRoles: ['CEO', 'PM', 'Marketer', 'Sales', 'Content Writer', 'Backend', 'DevOps'] } },
  { key: 'context7', value: { name: 'Context7', command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'], description: 'Up-to-date library docs — prevents API hallucination', autoAssignToRoles: ['Frontend', 'Backend', 'DevOps', 'PM'] } },
  { key: 'supabase', value: { name: 'Supabase', command: 'supabase', args: ['mcp'], description: 'Database operations, migrations, branches, edge functions', autoAssignToRoles: ['Backend', 'DevOps', 'Operations', 'Sales'] } },
];

const RULE_TEMPLATES = [
  { key: 'tdd-breaker', value: { name: 'TDD Circuit Breaker', directive: 'If a test fails 3 times in a row, HALT EXECUTION. Document in changelog.md and escalate to CEO.', category: 'safety' } },
  { key: 'mcp-fallback', value: { name: 'MCP Fallback', directive: 'If an MCP server fails, DO NOT hallucinate. Log to brain/raw/TODO-MCP-Failure.md and notify user.', category: 'safety' } },
  { key: 'pre-flight', value: { name: 'Pre-Flight Docs', directive: 'Read brain/00-Index.md before coding. Write spec first if feature lacks one.', category: 'process' } },
  { key: 'post-flight', value: { name: 'Post-Flight Update', directive: 'After completion, update spec files and append to brain/changelog.md.', category: 'process' } },
  { key: 'no-hallucinate', value: { name: 'No Hallucination', directive: 'Use Tavily for market data. Use Context7 for API syntax. Never fabricate facts.', category: 'quality' } },
  { key: 'context7-first', value: { name: 'Context7 First', directive: 'Check library docs via Context7 before writing any framework code. Do not assume API syntax.', category: 'quality' } },
  { key: 'data-first', value: { name: 'Data-First Design', directive: 'Define data contracts and schemas before designing architecture. Schema drives everything.', category: 'process' } },
  { key: 'no-secrets', value: { name: 'No Secrets in Code', directive: 'All credentials via environment variables. Never commit .env files or API keys.', category: 'security' } },
  { key: 'git-worktree', value: { name: 'Git Worktree Isolation', directive: 'Work in isolated git worktree branches: agent/{role}-{feature}. Never work directly on main.', category: 'process' } },
  { key: 'budget-awareness', value: { name: 'Budget Awareness', directive: 'Estimate token cost per subtask. Prefer focused tasks over open-ended ones. Track spend.', category: 'efficiency' } },
];

const TEMPLATES: Record<string, { key: string; value: any }[]> = {
  skill: SKILL_TEMPLATES,
  mcp_server: MCP_TEMPLATES,
  rule: RULE_TEMPLATES,
};

const TYPE_LABELS: Record<string, string> = {
  skill: 'Skills',
  mcp_server: 'MCP Servers',
  rule: 'Rules',
};

const TYPE_COLORS: Record<string, string> = {
  skill: '#00ff88',
  mcp_server: '#c084fc',
  rule: '#ff8800',
};

// ── Component ────────────────────────────────────────────────────────────────

interface ConfigManagerProps {
  type: 'skill' | 'mcp_server' | 'rule';
  scope: 'global' | 'company' | 'agent';
  scopeId?: string;
}

export function ConfigManager({ type, scope, scopeId }: ConfigManagerProps) {
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const color = TYPE_COLORS[type] ?? '#4a5568';
  const templates = TEMPLATES[type] ?? [];

  // Load configs
  const loadConfigs = async () => {
    if (!orchestratorConnected) { setLoading(false); return; }
    const data = await fetchConfigs(scope, scopeId, type);
    setConfigs(data);
    setLoading(false);
  };

  useEffect(() => { loadConfigs(); }, [scope, scopeId, type, orchestratorConnected]);

  const handleToggle = async (config: ConfigRow) => {
    await updateConfig(config.id, { enabled: !config.enabled });
    await loadConfigs();
  };

  const handleDelete = async (id: string) => {
    await deleteConfig(id);
    await loadConfigs();
  };

  const handleAddFromTemplate = async (template: { key: string; value: any }) => {
    // Check if already exists
    if (configs.some(c => c.key === template.key)) return;
    await createConfig({ scope, scope_id: scopeId, type, key: template.key, value: template.value });
    await loadConfigs();
  };

  const handleAddCustom = async () => {
    if (!newKey.trim()) return;
    let value: any;
    try {
      value = JSON.parse(newValue || '{}');
    } catch {
      value = type === 'rule'
        ? { name: newKey, directive: newValue, category: 'custom' }
        : type === 'skill'
        ? { name: newKey, description: newValue, tools: [], autoAssignToRoles: [] }
        : { name: newKey, command: newValue, args: [], description: '' };
    }
    await createConfig({ scope, scope_id: scopeId, type, key: newKey.toLowerCase().replace(/\s+/g, '-'), value });
    setNewKey('');
    setNewValue('');
    setShowAdd(false);
    await loadConfigs();
  };

  // When orchestrator is offline, show templates as read-only reference
  if (!orchestratorConnected) {
    const scopeLabel = scope === 'global' ? 'Global' : scope === 'company' ? 'Project' : 'Agent';
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)' }}>
            {scopeLabel} {TYPE_LABELS[type]}
          </div>
          <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>
            Start orchestrator to edit
          </span>
        </div>
        <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginBottom: 12 }}>
          Available templates ({templates.length}):
        </div>
        {templates.map(t => (
          <div key={t.key} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '6px 0', borderBottom: '1px solid #0a0e14',
          }}>
            <div style={{
              width: 14, height: 14, marginTop: 1, flexShrink: 0,
              border: `1px solid ${color}40`, background: `${color}10`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--font-xs)', color,
            }}>~</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)' }}>{t.value.name}</div>
              <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginTop: 2 }}>
                {(t.value.description || t.value.directive || '').slice(0, 120)}
              </div>
              {t.value.autoAssignToRoles?.length > 0 && (
                <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginTop: 2 }}>
                  Agents: {t.value.autoAssignToRoles.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const scopeLabel = scope === 'global' ? 'Global' : scope === 'company' ? 'Project' : 'Agent';

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)' }}>
          {scopeLabel} {TYPE_LABELS[type]}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{
            padding: '3px 10px', fontSize: 'var(--font-xs)',
            background: `${color}18`, border: `1px solid ${color}40`,
            color, cursor: 'pointer', fontFamily: 'var(--font-hud)',
            textTransform: 'uppercase',
          }}
        >
          + Add
        </button>
      </div>

      <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginBottom: 12 }}>
        {scope === 'global' && 'Defaults inherited by all projects and agents.'}
        {scope === 'company' && 'Overrides global defaults for this project.'}
        {scope === 'agent' && 'Overrides project + global for this agent only.'}
      </div>

      {/* Add panel */}
      {showAdd && (
        <div style={{
          background: '#090d14', border: `1px solid ${color}30`,
          padding: '10px 12px', marginBottom: 10,
        }}>
          {/* Templates */}
          <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 6 }}>
            Quick Add from Templates
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {templates.map(t => {
              const exists = configs.some(c => c.key === t.key);
              return (
                <button
                  key={t.key}
                  onClick={() => handleAddFromTemplate(t)}
                  disabled={exists}
                  style={{
                    padding: '3px 8px', fontSize: 'var(--font-xs)',
                    background: exists ? '#1b2030' : `${color}10`,
                    border: `1px solid ${exists ? '#1b2030' : color + '40'}`,
                    color: exists ? '#2a3a50' : color,
                    cursor: exists ? 'default' : 'pointer',
                    fontFamily: 'var(--font-hud)',
                  }}
                >
                  {exists ? '✓ ' : '+ '}{t.value.name}
                </button>
              );
            })}
          </div>

          {/* Custom */}
          <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>
            Or Add Custom
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="Name"
              style={{
                flex: 1, padding: '4px 6px', fontSize: 'var(--font-xs)',
                background: '#0d1117', border: '1px solid #1b2030',
                color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)',
              }}
            />
            <input
              type="text"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder={type === 'rule' ? 'Directive text' : type === 'mcp_server' ? 'Command' : 'Description'}
              style={{
                flex: 2, padding: '4px 6px', fontSize: 'var(--font-xs)',
                background: '#0d1117', border: '1px solid #1b2030',
                color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)',
              }}
            />
            <button
              onClick={handleAddCustom}
              style={{
                padding: '4px 10px', fontSize: 'var(--font-xs)',
                background: `${color}18`, border: `1px solid ${color}40`,
                color, cursor: 'pointer', fontFamily: 'var(--font-hud)',
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Config list — show saved configs, or templates as defaults when empty */}
      {loading ? (
        <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50' }}>Loading...</div>
      ) : configs.length === 0 ? (
        <div>
          <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginBottom: 8 }}>
            Available {TYPE_LABELS[type]?.toLowerCase()} ({templates.length}):
          </div>
          {templates.map(t => (
            <div key={t.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '6px 0', borderBottom: '1px solid #0a0e14',
            }}>
              <div style={{
                width: 14, height: 14, marginTop: 1, flexShrink: 0,
                border: `1px solid ${color}40`, background: `${color}10`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--font-xs)', color,
              }}>{'\u2713'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)' }}>{t.value.name}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginTop: 2 }}>
                  {(t.value.description || t.value.directive || '').slice(0, 150)}
                </div>
                {t.value.autoAssignToRoles?.length > 0 && (
                  <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginTop: 2 }}>
                    Agents: {t.value.autoAssignToRoles.join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        configs.map(config => {
          const v = config.value as any;
          const displayName = v.name ?? config.key;
          const displayDesc = type === 'rule' ? v.directive : type === 'mcp_server' ? v.description : v.description;

          return (
            <div key={config.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 0', borderBottom: '1px solid #0a0e14',
            }}>
              {/* Toggle */}
              <div
                onClick={() => handleToggle(config)}
                style={{
                  width: 14, height: 14, marginTop: 1, flexShrink: 0,
                  border: `1px solid ${config.enabled ? color : '#2a3a50'}`,
                  background: config.enabled ? `${color}20` : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--font-xs)', color, cursor: 'pointer',
                }}
              >
                {config.enabled ? '✓' : ''}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--font-sm)', color: config.enabled ? 'var(--hud-text-h)' : '#4a5568',
                }}>
                  {displayName}
                </div>
                {displayDesc && (
                  <div style={{
                    fontSize: 'var(--font-xs)', color: '#4a5568', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {displayDesc.slice(0, 120)}
                  </div>
                )}
                {type === 'skill' && v.autoAssignToRoles?.length > 0 && (
                  <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginTop: 2 }}>
                    Auto-assign: {v.autoAssignToRoles.join(', ')}
                  </div>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(config.id)}
                style={{
                  background: 'none', border: 'none', color: '#2a3a50',
                  cursor: 'pointer', fontSize: 'var(--font-sm)', fontFamily: 'var(--font-hud)',
                  padding: '0 4px',
                }}
                title="Remove"
              >
                ×
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

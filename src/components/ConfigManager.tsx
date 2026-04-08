import { useEffect, useState } from 'react';
import {
  fetchConfigs, createConfig, updateConfig, deleteConfig,
  type ConfigRow,
} from '../lib/orchestratorApi';
import { useDashboardStore } from '../store/dashboardStore';

// ── Type-specific templates ──────────────────────────────────────────────────

const SKILL_TEMPLATES = [
  { key: 'react', value: { name: 'React Development', description: 'Build React components with TypeScript', tools: ['Read', 'Edit', 'Write', 'Bash'], autoAssignToRoles: ['Frontend'] } },
  { key: 'typescript', value: { name: 'TypeScript', description: 'Strong typing and type-safe code', tools: ['Read', 'Edit'], autoAssignToRoles: ['Frontend', 'Backend'] } },
  { key: 'api-design', value: { name: 'API Design', description: 'REST/GraphQL endpoint architecture', tools: ['Read', 'Edit', 'Write', 'Bash'], autoAssignToRoles: ['Backend'] } },
  { key: 'tdd', value: { name: 'TDD', description: 'Test-driven development with vitest', tools: ['Read', 'Edit', 'Bash'], autoAssignToRoles: ['Frontend', 'Backend', 'QA'] } },
  { key: 'documentation', value: { name: 'Documentation', description: 'Write specs and docs in Obsidian markdown', tools: ['Read', 'Write'], autoAssignToRoles: ['PM'] } },
  { key: 'devops', value: { name: 'DevOps/CI', description: 'CI/CD pipelines, Docker, deployment', tools: ['Read', 'Edit', 'Bash'], autoAssignToRoles: ['DevOps'] } },
  { key: 'database', value: { name: 'Database', description: 'SQL, Supabase, schema design, migrations', tools: ['Read', 'Edit', 'Bash'], autoAssignToRoles: ['Backend'] } },
  { key: 'css-tailwind', value: { name: 'CSS/Tailwind', description: 'Styling with Tailwind v4 CSS-first', tools: ['Read', 'Edit'], autoAssignToRoles: ['Frontend', 'Designer'] } },
];

const MCP_TEMPLATES = [
  { key: 'tavily', value: { name: 'Tavily', command: 'npx', args: ['-y', 'tavily-mcp'], description: 'Web search for market research', autoAssignToRoles: ['CEO', 'PM'] } },
  { key: 'context7', value: { name: 'Context7', command: 'npx', args: ['-y', '@anthropic-ai/context7-mcp'], description: 'Live API documentation lookup', autoAssignToRoles: ['Frontend', 'Backend', 'DevOps'] } },
  { key: 'supabase', value: { name: 'Supabase', command: 'npx', args: ['-y', 'supabase-mcp'], description: 'Database operations and schema management', autoAssignToRoles: ['Backend'] } },
];

const RULE_TEMPLATES = [
  { key: 'tdd-breaker', value: { name: 'TDD Circuit Breaker', directive: 'If a test fails 3 times in a row, HALT EXECUTION. Document failure in changelog.md and ask CEO for intervention.', category: 'safety' } },
  { key: 'mcp-fallback', value: { name: 'MCP Fallback', directive: 'If an MCP server times out or fails, DO NOT hallucinate the result. Gracefully fall back, write a TODO-MCP-Failure.md log, and notify the user.', category: 'safety' } },
  { key: 'pre-flight', value: { name: 'Pre-Flight Docs', directive: 'Read brain/00-Index.md before coding. If a feature lacks a spec document in /wiki/, write it first.', category: 'process' } },
  { key: 'post-flight', value: { name: 'Post-Flight Update', directive: 'Upon completion, update the spec file and append actions to brain/changelog.md.', category: 'process' } },
  { key: 'no-hallucinate', value: { name: 'No Hallucination', directive: 'Use Tavily for market data. Use Context7 for API/framework syntax. Never fabricate facts.', category: 'quality' } },
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

  if (!orchestratorConnected) {
    return (
      <div style={{ fontSize: 9, color: '#2a3a50', fontStyle: 'italic', padding: 8 }}>
        Start the orchestrator (npm run server) to manage {TYPE_LABELS[type]?.toLowerCase()}.
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
        <div style={{ fontSize: 12, color: 'var(--hud-text-h)' }}>
          {scopeLabel} {TYPE_LABELS[type]}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{
            padding: '3px 10px', fontSize: 9,
            background: `${color}18`, border: `1px solid ${color}40`,
            color, cursor: 'pointer', fontFamily: 'var(--font-hud)',
            textTransform: 'uppercase',
          }}
        >
          + Add
        </button>
      </div>

      <div style={{ fontSize: 9, color: '#4a5568', marginBottom: 12 }}>
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
          <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', marginBottom: 6 }}>
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
                    padding: '3px 8px', fontSize: 8,
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
          <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>
            Or Add Custom
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="Name"
              style={{
                flex: 1, padding: '4px 6px', fontSize: 9,
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
                flex: 2, padding: '4px 6px', fontSize: 9,
                background: '#0d1117', border: '1px solid #1b2030',
                color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)',
              }}
            />
            <button
              onClick={handleAddCustom}
              style={{
                padding: '4px 10px', fontSize: 9,
                background: `${color}18`, border: `1px solid ${color}40`,
                color, cursor: 'pointer', fontFamily: 'var(--font-hud)',
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Config list */}
      {loading ? (
        <div style={{ fontSize: 9, color: '#2a3a50' }}>Loading...</div>
      ) : configs.length === 0 ? (
        <div style={{ fontSize: 9, color: '#2a3a50', fontStyle: 'italic', padding: '8px 0' }}>
          No {TYPE_LABELS[type]?.toLowerCase()} configured at this level. Click "+ Add" to create one.
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
                  fontSize: 8, color, cursor: 'pointer',
                }}
              >
                {config.enabled ? '✓' : ''}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10, color: config.enabled ? 'var(--hud-text-h)' : '#4a5568',
                }}>
                  {displayName}
                </div>
                {displayDesc && (
                  <div style={{
                    fontSize: 8, color: '#4a5568', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {displayDesc.slice(0, 120)}
                  </div>
                )}
                {type === 'skill' && v.autoAssignToRoles?.length > 0 && (
                  <div style={{ fontSize: 7, color: '#2a3a50', marginTop: 2 }}>
                    Auto-assign: {v.autoAssignToRoles.join(', ')}
                  </div>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(config.id)}
                style={{
                  background: 'none', border: 'none', color: '#2a3a50',
                  cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-hud)',
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

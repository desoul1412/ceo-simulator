import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { ConfigManager } from './ConfigManager';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'providers', label: 'LLM Providers' },
  { id: 'skills', label: 'Skills' },
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'rules', label: 'Rules' },
];

export function SettingsPage() {
  const { tab = 'general' } = useParams();
  const navigate = useNavigate();
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const synced = useDashboardStore(s => s.synced);

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-hud)', display: 'flex', gap: 12, height: 'calc(100% - 32px)' }}>
      {/* Tab sidebar */}
      <div style={{
        width: 160, flexShrink: 0,
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '10px 0',
      }}>
        <div style={{
          fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase',
          padding: '0 12px', marginBottom: 8, letterSpacing: '0.1em',
        }}>
          Global Settings
        </div>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => navigate(`/settings/${t.id}`)}
            style={{
              display: 'block', width: '100%',
              padding: '6px 12px', background: tab === t.id ? '#1b203060' : 'transparent',
              border: 'none', borderLeft: tab === t.id ? '2px solid var(--neon-cyan)' : '2px solid transparent',
              color: tab === t.id ? 'var(--neon-cyan)' : '#6a7a90',
              fontFamily: 'var(--font-hud)', fontSize: 'var(--font-sm)',
              textAlign: 'left', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        flex: 1, background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '16px 20px', overflow: 'auto',
      }}>
        {tab === 'general' && (
          <div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', marginBottom: 16 }}>General</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>
                Connection Status
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 10 }}>
                <span style={{ color: synced ? '#00ff88' : '#ff2244' }}>
                  Supabase: {synced ? '● Connected' : '● Disconnected'}
                </span>
                <span style={{ color: orchestratorConnected ? '#c084fc' : '#ff2244' }}>
                  Orchestrator: {orchestratorConnected ? '◆ Connected' : '○ Not running'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>
                Orchestrator URL
              </div>
              <div style={{
                padding: '6px 10px', background: '#090d14',
                border: '1px solid #1b2030', fontSize: 'var(--font-sm)', color: '#6a7a90',
              }}>
                http://localhost:3001
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginTop: 2 }}>
                Start with: npm run server
              </div>
            </div>

            <div style={{
              padding: '10px 12px', background: '#090d14',
              border: '1px solid #1b2030', fontSize: 'var(--font-xs)', color: '#4a5568',
              lineHeight: 1.6,
            }}>
              <div style={{ color: 'var(--hud-text-h)', marginBottom: 4 }}>Config Cascade</div>
              Global settings are inherited by all projects and agents.<br />
              Project-level settings override global for that project.<br />
              Agent-level settings override both for that specific agent.<br />
              Disabling a config at a lower level removes the inherited entry.
            </div>
          </div>
        )}

        {tab === 'providers' && <ProvidersPanel />}
        {tab === 'skills' && <ConfigManager type="skill" scope="global" />}
        {tab === 'mcp' && <ConfigManager type="mcp_server" scope="global" />}
        {tab === 'marketplace' && <MarketplacePanel />}
        {tab === 'rules' && <ConfigManager type="rule" scope="global" />}
      </div>
    </div>
  );
}

// ── LLM Providers Panel ──────────────────────────────────────────────────────

const PROVIDER_LIST = ['anthropic', 'openai', 'gemini', 'openrouter'] as const;
const TIERS = ['haiku', 'sonnet', 'opus'] as const;

function ProvidersPanel() {
  const [providers, setProviders] = useState<any[]>([]);
  const [preferred, setPreferred] = useState('anthropic');
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${ORCHESTRATOR_URL}/api/providers`).then(r => r.json()).then(setProviders).catch(() => {});
    fetch(`${ORCHESTRATOR_URL}/api/providers/config`).then(r => r.json()).then((configs: any[]) => {
      for (const c of configs) {
        if (c.key === 'preferred_provider') setPreferred(c.value);
        if (c.key?.startsWith('model_')) setModelOverrides(prev => ({ ...prev, [c.key.replace('model_', '')]: c.value }));
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`${ORCHESTRATOR_URL}/api/providers/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: preferred, modelOverrides }),
    }).catch(() => {});
    // Save API keys per provider
    for (const [prov, key] of Object.entries(apiKeys)) {
      if (!key) continue;
      await fetch(`${ORCHESTRATOR_URL}/api/providers/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: prov, apiKey: key }),
      }).catch(() => {});
    }
    setSaving(false);
  };

  const handleTest = async (name: string) => {
    setTestResult(null);
    const res = await fetch(`${ORCHESTRATOR_URL}/api/providers/${name}/test`, { method: 'POST' }).then(r => r.json()).catch(() => ({ healthy: false, message: 'Connection failed' }));
    setTestResult(`${name}: ${res.healthy ? '● Connected' : '○ ' + res.message}`);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '4px 8px', background: '#05080f', border: '1px solid var(--hud-border)',
    color: 'var(--hud-text)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 3, display: 'block',
  };

  return (
    <div>
      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', marginBottom: 16 }}>LLM Providers</div>

      {/* Provider status */}
      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>Registered Providers</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {providers.map(p => (
            <div key={p.name} style={{
              padding: '4px 10px', background: p.healthy ? '#00ff8810' : '#ff224410',
              border: `1px solid ${p.healthy ? '#00ff8840' : '#ff224440'}`,
              fontSize: 'var(--font-xs)', color: p.healthy ? '#00ff88' : '#ff2244',
              cursor: 'pointer',
            }} onClick={() => handleTest(p.name)}>
              {p.healthy ? '●' : '○'} {p.name} {p.enabled ? '' : '(disabled)'}
            </div>
          ))}
        </div>
        {testResult && <div style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-cyan)', marginTop: 6 }}>{testResult}</div>}
      </div>

      {/* Preferred provider */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Preferred Provider</label>
        <select value={preferred} onChange={e => setPreferred(e.target.value)} style={inputStyle}>
          <option value="auto">Auto (failover chain)</option>
          {PROVIDER_LIST.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* API Keys */}
      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>API Keys (leave empty to use env vars)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PROVIDER_LIST.filter(p => p !== 'anthropic').map(p => (
            <div key={p} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 100, fontSize: 'var(--font-xs)', color: '#6a7a90', textTransform: 'uppercase' }}>{p}</span>
              <input
                type="password"
                placeholder={`${p.toUpperCase()}_API_KEY`}
                value={apiKeys[p] ?? ''}
                onChange={e => setApiKeys(prev => ({ ...prev, [p]: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={() => handleTest(p)} style={{
                padding: '3px 8px', fontSize: 'var(--font-xs)', background: '#00ffff10',
                border: '1px solid #00ffff40', color: 'var(--neon-cyan)', cursor: 'pointer',
                fontFamily: 'var(--font-hud)',
              }}>Test</button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom model names per tier */}
      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>Custom Model Names (override defaults per tier)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {TIERS.map(tier => (
            <div key={tier} style={{ flex: 1 }}>
              <label style={{ ...labelStyle, color: tier === 'haiku' ? '#00ff88' : tier === 'sonnet' ? '#00ffff' : '#c084fc' }}>
                {tier}
              </label>
              <input
                placeholder={providers.find(p => p.name === preferred)?.[ tier] ?? `default ${tier}`}
                value={modelOverrides[tier] ?? ''}
                onChange={e => setModelOverrides(prev => ({ ...prev, [tier]: e.target.value }))}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginTop: 4 }}>
          Leave empty to use provider defaults. Examples: gpt-4o, gemini-2.5-pro, claude-sonnet-4-6
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} style={{
        padding: '6px 16px', background: '#00ff8818', border: '1px solid #00ff8840',
        color: 'var(--neon-green)', cursor: 'pointer', fontFamily: 'var(--font-hud)',
        fontSize: 'var(--font-sm)',
      }}>
        {saving ? 'Saving...' : 'Save Provider Config'}
      </button>
    </div>
  );
}

// ── Marketplace Panel ────────────────────────────────────────────────────────

function MarketplacePanel() {
  const [tab, setTab] = useState<'browse' | 'installed'>('browse');
  const [skills, setSkills] = useState<any[]>([]);
  const [installed, setInstalled] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  const fetchSkills = () => {
    setLoading(true);
    fetch(`${ORCHESTRATOR_URL}/api/marketplace/skills?search=${search}`)
      .then(r => r.json())
      .then(d => setSkills(d.skills ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchInstalled = () => {
    fetch(`${ORCHESTRATOR_URL}/api/marketplace/installed`)
      .then(r => r.json())
      .then(setInstalled)
      .catch(() => {});
  };

  useEffect(() => { fetchSkills(); fetchInstalled(); }, []);

  const handleInstall = async (skill: any) => {
    setInstalling(skill.name);
    // Try to extract repo URL and skill name from the skill data
    const repoUrl = skill.url?.replace('https://claudemarketplaces.com/skills/', '') ?? skill.slug ?? '';
    await fetch(`${ORCHESTRATOR_URL}/api/marketplace/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl, skillName: skill.name }),
    }).catch(() => {});
    setInstalling(null);
    fetchInstalled();
  };

  const handleUninstall = async (name: string) => {
    await fetch(`${ORCHESTRATOR_URL}/api/marketplace/skills/${name}`, { method: 'DELETE' }).catch(() => {});
    fetchInstalled();
  };

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', background: '#05080f', border: '1px solid var(--hud-border)',
    color: 'var(--hud-text)', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-sm)', flex: 1,
  };

  return (
    <div>
      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', marginBottom: 12 }}>
        Skill Marketplace
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['browse', 'installed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '4px 12px', fontSize: 'var(--font-xs)',
            background: tab === t ? '#00ffff18' : 'transparent',
            border: `1px solid ${tab === t ? '#00ffff40' : 'var(--hud-border)'}`,
            color: tab === t ? 'var(--neon-cyan)' : '#6a7a90',
            cursor: 'pointer', fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
          }}>
            {t === 'browse' ? `Browse (${skills.length})` : `Installed (${installed.length})`}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <>
          {/* Search */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchSkills()}
              placeholder="Search skills..."
              style={inputStyle}
            />
            <button onClick={fetchSkills} style={{
              padding: '4px 12px', background: '#00ffff18', border: '1px solid #00ffff40',
              color: 'var(--neon-cyan)', cursor: 'pointer', fontFamily: 'var(--font-hud)',
              fontSize: 'var(--font-xs)',
            }}>
              {loading ? '...' : 'Search'}
            </button>
          </div>

          {/* Embedded marketplace or skill cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflow: 'auto' }}>
            {skills.length === 0 && !loading && (
              <div style={{ color: '#4a5568', fontStyle: 'italic', fontSize: 'var(--font-xs)', padding: 12 }}>
                No skills found. Try searching or check your connection.
              </div>
            )}
            {skills.map((s, i) => (
              <div key={i} style={{
                padding: '8px 12px', background: '#090d14', border: '1px solid var(--hud-border)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)' }}>{s.name}</div>
                  {s.description && <div style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', marginTop: 2 }}>{s.description}</div>}
                </div>
                <button
                  onClick={() => handleInstall(s)}
                  disabled={installing === s.name}
                  style={{
                    padding: '3px 10px', fontSize: 'var(--font-xs)',
                    background: installed.some(inst => inst.name === s.name) ? '#00ff8818' : '#c084fc18',
                    border: `1px solid ${installed.some(inst => inst.name === s.name) ? '#00ff8840' : '#c084fc40'}`,
                    color: installed.some(inst => inst.name === s.name) ? '#00ff88' : '#c084fc',
                    cursor: 'pointer', fontFamily: 'var(--font-hud)', flexShrink: 0,
                  }}
                >
                  {installed.some(inst => inst.name === s.name) ? '✓ Installed' : installing === s.name ? 'Installing...' : 'Install'}
                </button>
              </div>
            ))}
          </div>

          {/* Direct link to marketplace */}
          <div style={{ marginTop: 12, fontSize: 'var(--font-xs)', color: '#4a5568' }}>
            Browse the full catalog at{' '}
            <a href="https://claudemarketplaces.com/skills" target="_blank" rel="noreferrer"
              style={{ color: 'var(--neon-cyan)', textDecoration: 'none' }}>
              claudemarketplaces.com
            </a>
          </div>
        </>
      )}

      {tab === 'installed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {installed.length === 0 && (
            <div style={{ color: '#4a5568', fontStyle: 'italic', fontSize: 'var(--font-xs)', padding: 12 }}>
              No skills installed. Browse the marketplace to add some.
            </div>
          )}
          {installed.map(s => (
            <div key={s.name} style={{
              padding: '8px 12px', background: '#090d14', border: '1px solid var(--hud-border)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: '#6a7a90' }}>{s.description || s.path}</div>
              </div>
              <button onClick={() => handleUninstall(s.name)} style={{
                padding: '3px 10px', fontSize: 'var(--font-xs)',
                background: '#ff224418', border: '1px solid #ff224440', color: '#ff2244',
                cursor: 'pointer', fontFamily: 'var(--font-hud)',
              }}>
                Uninstall
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

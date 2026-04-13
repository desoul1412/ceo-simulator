import { useParams, useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { ConfigManager } from './ConfigManager';
import { LLMSettings } from './LLMSettings';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'llm', label: 'LLM Models' },
  { id: 'skills', label: 'Skills' },
  { id: 'mcp', label: 'MCP Servers' },
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

        {tab === 'llm' && <LLMSettings />}
        {tab === 'skills' && <ConfigManager type="skill" scope="global" />}
        {tab === 'mcp' && <ConfigManager type="mcp_server" scope="global" />}
        {tab === 'rules' && <ConfigManager type="rule" scope="global" />}
      </div>
    </div>
  );
}

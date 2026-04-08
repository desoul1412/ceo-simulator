import { useParams, useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { ConfigManager } from './ConfigManager';

const TABS = [
  { id: 'skills', label: 'Skills' },
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'rules', label: 'Rules' },
];

export function ProjectSettings() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const companies = useDashboardStore(s => s.companies);
  const company = companies.find(c => c.id === companyId);

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') ?? 'skills';

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  const setTab = (t: string) => {
    navigate(`/company/${companyId}/settings?tab=${t}`, { replace: true });
  };

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-hud)', display: 'flex', gap: 12, height: 'calc(100% - 32px)' }}>
      {/* Tab sidebar */}
      <div style={{
        width: 160, flexShrink: 0,
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '10px 0',
      }}>
        <div style={{
          fontSize: 9, color: '#4a5568', textTransform: 'uppercase',
          padding: '0 12px', marginBottom: 4, letterSpacing: '0.1em',
        }}>
          {company.name}
        </div>
        <div style={{
          fontSize: 8, color: '#2a3a50', padding: '0 12px', marginBottom: 8,
        }}>
          Project-level overrides
        </div>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'block', width: '100%',
              padding: '6px 12px', background: tab === t.id ? '#1b203060' : 'transparent',
              border: 'none', borderLeft: tab === t.id ? '2px solid var(--neon-cyan)' : '2px solid transparent',
              color: tab === t.id ? 'var(--neon-cyan)' : '#6a7a90',
              fontFamily: 'var(--font-hud)', fontSize: 10,
              textAlign: 'left', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            {t.label}
          </button>
        ))}

        <div style={{
          borderTop: '1px solid var(--hud-border)',
          marginTop: 8, paddingTop: 8,
        }}>
          <button
            onClick={() => navigate('/settings')}
            style={{
              display: 'block', width: '100%',
              padding: '6px 12px', background: 'transparent',
              border: 'none', borderLeft: '2px solid transparent',
              color: '#4a5568',
              fontFamily: 'var(--font-hud)', fontSize: 9,
              textAlign: 'left', cursor: 'pointer',
            }}
          >
            → Global Settings
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '16px 20px', overflow: 'auto',
      }}>
        {tab === 'skills' && <ConfigManager type="skill" scope="company" scopeId={companyId} />}
        {tab === 'mcp' && <ConfigManager type="mcp_server" scope="company" scopeId={companyId} />}
        {tab === 'rules' && <ConfigManager type="rule" scope="company" scopeId={companyId} />}
      </div>
    </div>
  );
}

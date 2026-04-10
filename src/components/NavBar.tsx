import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { InboxPanel } from './InboxPanel';

function Tab({ label, to, active }: { label: string; to: string; active: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      style={{
        padding: '8px 14px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--neon-cyan)' : '2px solid transparent',
        color: active ? 'var(--neon-cyan)' : 'var(--hud-text-dim)',
        fontFamily: 'var(--font-hud)',
        fontSize: 'var(--font-sm)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        cursor: 'pointer',
        transition: 'color 0.15s',
        textShadow: active ? '0 0 6px var(--neon-cyan)' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

export function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const synced = useDashboardStore(s => s.synced);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);

  const path = location.pathname;
  const isHome = path === '/';
  const isCompanyView = !!companyId;
  const company = companies.find(c => c.id === companyId);

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 var(--pad)',
      height: 'var(--nav-h)',
      background: '#090d14',
      borderBottom: '1px solid var(--hud-border)',
      fontFamily: 'var(--font-hud)',
      fontSize: 'var(--font-sm)',
      gap: 4,
      flexShrink: 0,
      overflowX: 'auto',
      overflowY: 'hidden',
    }}>
      {/* Logo */}
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--neon-cyan)', fontSize: 'var(--font-md)',
          fontFamily: 'var(--font-hud)',
          padding: '0 10px 0 0', marginRight: 6,
          textShadow: '0 0 8px var(--neon-cyan)',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        ▣ CEO.SIM
      </button>

      <span style={{ color: '#1b2030', margin: '0 4px', flexShrink: 0 }}>│</span>

      <Tab label="Dashboard" to="/" active={isHome} />

      {isCompanyView && company && (
        <>
          <span style={{ color: '#1b2030', margin: '0 2px', flexShrink: 0 }}>│</span>
          <span style={{
            color: '#6a7a90', fontSize: 'var(--font-xs)',
            padding: '0 6px',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {company.name}
          </span>
          <Tab label="Overview" to={`/company/${companyId}/overview`} active={path.includes('/overview')} />
          <Tab label="Office" to={`/company/${companyId}`} active={path === `/company/${companyId}`} />
          <Tab label="Agents" to={`/company/${companyId}/agents`} active={path.includes('/agents')} />
          <Tab label="Goals" to={`/company/${companyId}/goals`} active={path.includes('/goals')} />
          <Tab label="Board" to={`/company/${companyId}/board`} active={path.includes('/board')} />
          <Tab label="Docs" to={`/company/${companyId}/documents`} active={path.includes('/documents')} />
          <Tab label="Costs" to={`/company/${companyId}/costs`} active={path.includes('/costs')} />
          <Tab label="Org" to={`/company/${companyId}/org-chart`} active={path.includes('/org-chart')} />
          <Tab label="Config" to={`/company/${companyId}/settings`} active={path.endsWith('/settings') || path.includes('/settings?')} />
        </>
      )}

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {orchestratorConnected && (
          <span style={{ color: 'var(--neon-purple)', fontSize: 'var(--font-xs)', letterSpacing: '0.1em' }}>
            ◆ CLAUDE
          </span>
        )}
        <span style={{
          color: synced ? 'var(--neon-green)' : 'var(--neon-orange)',
          fontSize: 'var(--font-xs)', letterSpacing: '0.1em',
        }}>
          {synced ? '● ONLINE' : '● OFFLINE'}
        </span>
        <InboxPanel />
        <button
          onClick={() => navigate('/settings')}
          style={{
            background: 'none', border: 'none',
            fontSize: 'var(--font-md)',
            padding: '4px 8px',
            color: path.startsWith('/settings') ? 'var(--neon-cyan)' : 'var(--hud-text-dim)',
            cursor: 'pointer', fontFamily: 'var(--font-hud)',
          }}
        >
          ⚙
        </button>
      </div>
    </nav>
  );
}

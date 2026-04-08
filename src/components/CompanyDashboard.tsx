import { useDashboardStore } from '../store/dashboardStore';
import { CompanyCard } from './CompanyCard';
import { CompanyDetail } from './CompanyDetail';

export function CompanyDashboard() {
  const companies = useDashboardStore(s => s.companies);
  const selectedId = useDashboardStore(s => s.selectedCompanyId);
  const selectCompany = useDashboardStore(s => s.selectCompany);
  const loading = useDashboardStore(s => s.loading);
  const synced = useDashboardStore(s => s.synced);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);

  const selectedCompany = companies.find(c => c.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="sim-root" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'monospace', color: '#00ffff', fontSize: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>▣</div>
          <div>CONNECTING TO MAINFRAME...</div>
          <div style={{ fontSize: 10, color: '#2a3a50', marginTop: 6 }}>Loading company data from Supabase</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sim-root">
      {/* Header */}
      <header className="sim-header">
        <span className="sim-header__logo">▣ CEO.SIM</span>
        <span className="sim-header__sub">
          {selectedCompany
            ? `${selectedCompany.name.toUpperCase()} — OFFICE VIEW`
            : 'GLOBAL DASHBOARD — ALL COMPANIES'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {orchestratorConnected && (
            <span style={{
              fontSize: 8, fontFamily: 'monospace', textTransform: 'uppercase',
              color: '#c084fc', letterSpacing: '0.1em',
            }}>
              ◆ CLAUDE
            </span>
          )}
          <span style={{
            fontSize: 8, fontFamily: 'monospace', textTransform: 'uppercase',
            color: synced ? '#00ff88' : '#ff8800',
            letterSpacing: '0.1em',
          }}>
            {synced ? '● ONLINE' : '● OFFLINE'}
          </span>
          <span className="sim-header__badge">
            {companies.length} {companies.length === 1 ? 'COMPANY' : 'COMPANIES'}
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="sim-body">
        {/* Sidebar — company list (always visible) */}
        <aside className="sim-sidebar">
          <div style={{
            padding: '8px 10px',
            fontSize: 9, fontFamily: 'monospace',
            color: '#4a5568', textTransform: 'uppercase',
            letterSpacing: '0.1em', borderBottom: '1px solid #1b2030',
          }}>
            Companies
          </div>
          <div style={{ padding: 6, overflowY: 'auto', flex: 1 }}>
            {companies.map(co => (
              <CompanyCard
                key={co.id}
                company={co}
                isSelected={co.id === selectedId}
                onSelect={() => selectCompany(co.id)}
              />
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="sim-content">
          {selectedCompany ? (
            <CompanyDetail company={selectedCompany} />
          ) : (
            <div className="sim-placeholder">
              <div style={{ fontSize: 20, color: '#1b2030', marginBottom: 8 }}>▣</div>
              <div style={{
                fontSize: 12, color: '#2a3a50',
                fontFamily: 'monospace', textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                Select a company to view its office
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

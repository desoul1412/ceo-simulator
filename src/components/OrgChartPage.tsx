import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';

export function OrgChartPage() {
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const company = companies.find(c => c.id === companyId);

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  const ceo = company.employees.find(e => e.role === 'CEO');
  const reports = company.employees.filter(e => e.role !== 'CEO');

  return (
    <div style={{
      padding: 16, fontFamily: 'var(--font-hud)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{
        fontSize: 9, color: '#4a5568', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 20, alignSelf: 'flex-start',
      }}>
        {company.name} — Org Chart
      </div>

      {/* CEO node */}
      {ceo && (
        <div style={{
          background: '#0d1117', border: `2px solid ${ceo.color}`,
          padding: '12px 20px', textAlign: 'center',
          boxShadow: `0 0 12px ${ceo.color}30`,
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 12, color: ceo.color, textTransform: 'uppercase' }}>{ceo.role}</div>
          <div style={{ fontSize: 11, color: 'var(--hud-text-h)', marginTop: 2 }}>{ceo.name}</div>
        </div>
      )}

      {/* Connector lines */}
      <div style={{
        width: 2, height: 20,
        background: '#1b2030',
      }} />
      <div style={{
        width: Math.min(reports.length * 160, 600),
        height: 2,
        background: '#1b2030',
      }} />

      {/* Report nodes */}
      <div style={{
        display: 'flex', gap: 16, marginTop: 0,
        justifyContent: 'center', flexWrap: 'wrap',
      }}>
        {reports.map(emp => (
          <div key={emp.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 2, height: 20, background: '#1b2030' }} />
            <div style={{
              background: '#0d1117', border: `1px solid ${emp.color}40`,
              padding: '10px 16px', textAlign: 'center',
              minWidth: 120,
            }}>
              <div style={{ fontSize: 10, color: emp.color, textTransform: 'uppercase' }}>{emp.role}</div>
              <div style={{ fontSize: 10, color: 'var(--hud-text-h)', marginTop: 2 }}>{emp.name}</div>
              <div style={{
                fontSize: 8, marginTop: 4,
                color: emp.status === 'working' ? '#00ff88' : '#4a5568',
                textTransform: 'uppercase',
              }}>
                {emp.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

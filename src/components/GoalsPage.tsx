import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';

export function GoalsPage() {
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const company = companies.find(c => c.id === companyId);

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-hud)' }}>
      <div style={{
        fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 12,
      }}>
        {company.name} — Goals
      </div>

      {/* Active goal */}
      {company.ceoGoal ? (
        <div style={{
          background: '#0d1117', border: '1px solid var(--neon-cyan)30',
          padding: '14px 16px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-cyan)', textTransform: 'uppercase', marginBottom: 6 }}>
            Active Goal
          </div>
          <div style={{ fontSize: 'var(--font-md)', color: 'var(--hud-text-h)', marginBottom: 8 }}>
            {company.ceoGoal}
          </div>
          {company.delegations.length > 0 && (
            <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>
              {company.delegations.length} delegations — avg progress: {
                Math.round(company.delegations.reduce((s, d) => s + d.progress, 0) / company.delegations.length)
              }%
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: '#0d1117', border: '1px solid var(--hud-border)',
          padding: '20px 16px', textAlign: 'center',
          fontSize: 'var(--font-sm)', color: '#2a3a50', fontStyle: 'italic',
        }}>
          No active goal — assign one from the Office view
        </div>
      )}

      {/* Delegation tree */}
      {company.delegations.length > 0 && (
        <div style={{
          background: '#0d1117', border: '1px solid var(--hud-border)',
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 10 }}>
            Delegation Tree
          </div>
          {company.delegations.map(del => {
            const emp = company.employees.find(e => e.role === del.toRole);
            const color = emp?.color ?? '#4a5568';
            return (
              <div key={del.id} style={{
                padding: '8px 0',
                borderBottom: '1px solid #0a0e14',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 6, height: 6, background: color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)' }}>
                    {del.toRole}: {del.task}
                  </div>
                  <div style={{
                    marginTop: 4, height: 3, background: '#1b2030',
                  }}>
                    <div style={{
                      width: `${del.progress}%`, height: '100%',
                      background: del.progress >= 100 ? '#4a5568' : color,
                      transition: 'width 0.5s',
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568', flexShrink: 0 }}>
                  {del.progress}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

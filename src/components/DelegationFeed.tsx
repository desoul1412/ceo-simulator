import type { Company, EmployeeRole } from '../store/dashboardStore';

const ROLE_COLOR: Record<EmployeeRole, string> = {
  CEO:      '#00ffff',
  PM:       '#c084fc',
  DevOps:   '#00ff88',
  Frontend: '#ff8800',
};

interface DelegationFeedProps {
  company: Company;
}

export function DelegationFeed({ company }: DelegationFeedProps) {
  const { delegations, employees } = company;

  if (delegations.length === 0) {
    return (
      <div style={{
        padding: '10px 12px',
        background: '#0d1117',
        border: '1px solid #1b2030',
        fontFamily: 'monospace',
        fontSize: 10,
        color: '#2a3a50',
        fontStyle: 'italic',
      }}>
        No active delegations
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px 12px',
      background: '#0d1117',
      border: '1px solid #1b2030',
      fontFamily: 'monospace',
    }}>
      <div style={{
        fontSize: 9, color: '#4a5568', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 8,
      }}>
        Delegation Feed
      </div>

      {delegations.map(del => {
        const emp = employees.find(e => e.role === del.toRole);
        const color = ROLE_COLOR[del.toRole];
        const done = del.progress >= 100;

        return (
          <div key={del.id} style={{
            padding: '6px 0',
            borderBottom: '1px solid #1b2030',
          }}>
            {/* Role + task */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{
                width: 6, height: 6,
                background: done ? '#4a5568' : color,
                boxShadow: done ? 'none' : `0 0 4px ${color}`,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 9, color: done ? '#4a5568' : color,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {del.toRole}
              </span>
              <span style={{ fontSize: 9, color: '#3a4a60', marginLeft: 'auto' }}>
                {emp?.name}
              </span>
            </div>

            {/* Task text */}
            <div style={{
              fontSize: 10, color: done ? '#2a3a50' : '#8090a8',
              lineHeight: 1.3, marginBottom: 4,
              textDecoration: done ? 'line-through' : 'none',
            }}>
              {del.task}
            </div>

            {/* Progress bar */}
            <div style={{
              height: 3,
              background: '#1b2030',
              position: 'relative',
            }}>
              <div style={{
                width: `${del.progress}%`,
                height: '100%',
                background: done ? '#4a5568' : color,
                boxShadow: done ? 'none' : `0 0 4px ${color}`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

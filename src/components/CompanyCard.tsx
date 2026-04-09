import type { Company, CompanyStatus } from '../store/dashboardStore';

const STATUS_COLOR: Record<CompanyStatus, string> = {
  bootstrapping: '#4a5568',
  growing:       '#00ff88',
  scaling:       '#00ffff',
  crisis:        '#ff2244',
};

interface CompanyCardProps {
  company: Company;
  isSelected: boolean;
  onSelect: () => void;
}

export function CompanyCard({ company, isSelected, onSelect }: CompanyCardProps) {
  const sColor = STATUS_COLOR[company.status];
  const working = company.employees.filter(e => e.status === 'working').length;
  const remaining = company.budget - company.budgetSpent;

  return (
    <button
      onClick={onSelect}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        background: isSelected ? '#111828' : '#0d1117',
        border: `1px solid ${isSelected ? '#00ffff40' : '#1b2030'}`,
        borderLeft: `3px solid ${isSelected ? '#00ffff' : '#1b2030'}`,
        cursor: 'pointer',
        fontFamily: 'monospace',
        transition: 'all 0.2s',
        marginBottom: 4,
      }}
    >
      {/* Company name */}
      <div style={{ fontSize: 'var(--font-md)', color: '#e0eaf4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {company.name}
      </div>

      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: sColor, boxShadow: `0 0 6px ${sColor}` }} />
        <span style={{ fontSize: 'var(--font-xs)', color: sColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {company.status}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)', color: '#4a6080' }}>
        <span>${(remaining / 1000).toFixed(0)}k left</span>
        <span>{working}/{company.employees.length} active</span>
      </div>

      {/* Current goal */}
      {company.ceoGoal && (
        <div style={{
          marginTop: 6, padding: '4px 6px',
          background: '#00ffff08', border: '1px solid #00ffff15',
          fontSize: 'var(--font-xs)', color: '#00ffff', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          ▸ {company.ceoGoal}
        </div>
      )}
    </button>
  );
}

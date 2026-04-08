import { useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import type { Company } from '../store/dashboardStore';

interface CeoGoalPanelProps {
  company: Company;
}

export function CeoGoalPanel({ company }: CeoGoalPanelProps) {
  const [input, setInput] = useState('');
  const assignGoal = useDashboardStore(s => s.assignGoal);
  const ceo = company.employees.find(e => e.role === 'CEO');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    assignGoal(company.id, trimmed);
    setInput('');
  };

  return (
    <div style={{
      padding: '10px 12px',
      background: '#0d1117',
      border: '1px solid #1b2030',
      fontFamily: 'monospace',
    }}>
      {/* Header */}
      <div style={{
        fontSize: 9, color: '#4a5568', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 6,
      }}>
        CEO Directive — {ceo?.name ?? 'Unknown'}
      </div>

      {/* Current goal */}
      {company.ceoGoal ? (
        <div style={{
          padding: '6px 8px',
          background: '#00ffff08',
          border: '1px solid #00ffff20',
          fontSize: 11,
          color: '#00ffff',
          lineHeight: 1.4,
          marginBottom: 6,
        }}>
          ▸ {company.ceoGoal}
        </div>
      ) : (
        <div style={{
          fontSize: 10, color: '#2a3a50', marginBottom: 6,
          fontStyle: 'italic',
        }}>
          No active goal — team idle
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Assign a goal to the CEO..."
          disabled={!!company.ceoGoal}
          style={{
            flex: 1,
            padding: '5px 8px',
            background: '#090d14',
            border: '1px solid #1b2030',
            color: '#e0eaf4',
            fontFamily: 'monospace',
            fontSize: 11,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!!company.ceoGoal || !input.trim()}
          style={{
            padding: '5px 12px',
            background: company.ceoGoal ? '#1b2030' : '#00ffff18',
            border: `1px solid ${company.ceoGoal ? '#1b2030' : '#00ffff40'}`,
            color: company.ceoGoal ? '#2a3a50' : '#00ffff',
            fontFamily: 'monospace',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: company.ceoGoal ? 'not-allowed' : 'pointer',
          }}
        >
          ASSIGN
        </button>
      </form>
    </div>
  );
}

import { useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import type { Company } from '../store/dashboardStore';

interface CeoGoalPanelProps {
  company: Company;
}

export function CeoGoalPanel({ company }: CeoGoalPanelProps) {
  const [input, setInput] = useState('');
  const assignGoal = useDashboardStore(s => s.assignGoal);
  const processingGoal = useDashboardStore(s => s.processingGoal);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const ceo = company.employees.find(e => e.role === 'CEO');

  const isThinking = processingGoal === company.id;
  const goalActive = !!company.ceoGoal;

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
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 8,
      }}>
        <span>CEO Directive — {ceo?.name ?? 'Unknown'}</span>
        {orchestratorConnected && (
          <span style={{
            fontSize: 'var(--font-xs)', color: '#00ff88', marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              background: '#00ff88', display: 'inline-block',
              boxShadow: '0 0 4px #00ff88',
            }} />
            CLAUDE
          </span>
        )}
      </div>

      {/* Thinking state */}
      {isThinking && (
        <div style={{
          padding: '8px 10px',
          background: '#00ffff08',
          border: '1px solid #00ffff20',
          fontSize: 'var(--font-sm)',
          color: '#00ffff',
          lineHeight: 1.4,
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span className="thinking-dots" style={{
            display: 'inline-block',
            animation: 'pulse 1.5s infinite',
          }}>
            ◆
          </span>
          <span>
            {orchestratorConnected
              ? 'CEO is thinking via Claude...'
              : 'CEO is analyzing the goal...'}
          </span>
        </div>
      )}

      {/* Current goal */}
      {!isThinking && goalActive && (
        <div style={{
          padding: '6px 8px',
          background: '#00ffff08',
          border: '1px solid #00ffff20',
          fontSize: 'var(--font-sm)',
          color: '#00ffff',
          lineHeight: 1.4,
          marginBottom: 6,
        }}>
          ▸ {company.ceoGoal}
        </div>
      )}

      {!isThinking && !goalActive && (
        <div style={{
          fontSize: 'var(--font-sm)', color: '#2a3a50', marginBottom: 6,
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
          placeholder={orchestratorConnected
            ? 'Assign a goal (CEO will use Claude)...'
            : 'Assign a goal to the CEO...'
          }
          disabled={goalActive || isThinking}
          style={{
            flex: 1,
            padding: '5px 8px',
            background: '#090d14',
            border: '1px solid #1b2030',
            color: '#e0eaf4',
            fontFamily: 'monospace',
            fontSize: 'var(--font-sm)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={goalActive || isThinking || !input.trim()}
          style={{
            padding: '5px 12px',
            background: (goalActive || isThinking) ? '#1b2030' : '#00ffff18',
            border: `1px solid ${(goalActive || isThinking) ? '#1b2030' : '#00ffff40'}`,
            color: (goalActive || isThinking) ? '#2a3a50' : '#00ffff',
            fontFamily: 'monospace',
            fontSize: 'var(--font-sm)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: (goalActive || isThinking) ? 'not-allowed' : 'pointer',
          }}
        >
          {isThinking ? '...' : 'ASSIGN'}
        </button>
      </form>
    </div>
  );
}

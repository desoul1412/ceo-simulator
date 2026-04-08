import { useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { IsometricOffice } from './IsometricOffice';
import { CeoGoalPanel } from './CeoGoalPanel';
import { DelegationFeed } from './DelegationFeed';
import type { Company } from '../store/dashboardStore';

interface CompanyDetailProps {
  company: Company;
}

export function CompanyDetail({ company }: CompanyDetailProps) {
  const tickCompany = useDashboardStore(s => s.tickCompany);
  const selectCompany = useDashboardStore(s => s.selectCompany);

  // Simulation tick — 3–5 s jitter per cycle
  useEffect(() => {
    if (!company.ceoGoal) return;

    let timerId: ReturnType<typeof setTimeout>;
    function scheduleNext() {
      const delay = 3000 + Math.random() * 2000;
      timerId = setTimeout(() => {
        tickCompany(company.id);
        scheduleNext();
      }, delay);
    }
    scheduleNext();
    return () => clearTimeout(timerId);
  }, [company.id, company.ceoGoal, tickCompany]);

  const remaining = company.budget - company.budgetSpent;
  const budgetPct = Math.max(0, Math.round((remaining / company.budget) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 }}>
      {/* Title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 12px',
        background: '#090d14',
        border: '1px solid #1b2030',
        fontFamily: 'monospace',
      }}>
        <button
          onClick={() => selectCompany(null)}
          style={{
            padding: '3px 8px', background: '#1b2030',
            border: '1px solid #2a3a50', color: '#6a7a90',
            fontFamily: 'monospace', fontSize: 10, cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          ← BACK
        </button>
        <span style={{
          fontSize: 14, color: '#e0eaf4',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {company.name}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          {/* Budget */}
          <div>
            <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              BUDGET
            </div>
            <div style={{
              fontSize: 13,
              color: budgetPct > 30 ? '#00ff88' : budgetPct > 10 ? '#ff8800' : '#ff2244',
              textShadow: `0 0 6px ${budgetPct > 30 ? '#00ff88' : '#ff8800'}`,
            }}>
              ${(remaining / 1000).toFixed(1)}k
            </div>
          </div>
          {/* Status */}
          <div>
            <div style={{ fontSize: 8, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              STATUS
            </div>
            <div style={{ fontSize: 13, color: '#00ffff', textTransform: 'uppercase' }}>
              {company.status}
            </div>
          </div>
        </div>
      </div>

      {/* Main layout: iso office + side panels */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* Isometric office */}
        <div style={{
          flex: 1,
          background: '#05080f',
          border: '1px solid #1b2030',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <IsometricOffice company={company} />
        </div>

        {/* Side panels */}
        <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <CeoGoalPanel company={company} />
          <DelegationFeed company={company} />
        </div>
      </div>
    </div>
  );
}

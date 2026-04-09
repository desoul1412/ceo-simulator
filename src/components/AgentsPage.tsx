import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { HireAgentDialog, type HireConfig } from './HireAgentDialog';
import { hireAgent } from '../lib/orchestratorApi';
import * as api from '../lib/api';
import { isOnline } from '../lib/supabase';
import { getRoleDisplayName } from '../lib/agentDisplay';

const STATUS_COLORS: Record<string, string> = {
  working: '#00ff88',
  meeting: '#c084fc',
  idle: '#4a5568',
  break: '#ff8800',
  blocked: '#ff2244',
};

export function AgentsPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const companies = useDashboardStore(s => s.companies);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const company = companies.find(c => c.id === companyId);
  const [showHireDialog, setShowHireDialog] = useState(false);
  const [hiring, setHiring] = useState(false);

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  const handleHire = async (config: HireConfig) => {
    setHiring(true);
    try {
      if (orchestratorConnected) {
        await hireAgent(config);
      } else if (isOnline()) {
        // Fallback: create via Supabase directly
        await api.createCompany(config.role, 0); // simplified fallback
      }

      // Reload companies from backend
      if (isOnline()) {
        const apiCompanies = await api.fetchCompanies();
        const updated = apiCompanies.find(c => c.id === companyId);
        if (updated) {
          const store = useDashboardStore.getState();
          useDashboardStore.setState({
            companies: store.companies.map(co =>
              co.id === companyId ? {
                ...co,
                employees: updated.agents.map(a => ({
                  id: a.id, name: a.name, role: a.role as any, status: a.status as any,
                  col: a.tileCol, row: a.tileRow, color: a.color,
                  assignedTask: a.assignedTask, progress: a.progress,
                })),
              } : co
            ),
          });
        }
      }
    } catch (err) {
      console.error('[hire] Failed:', err);
    }
    setHiring(false);
    setShowHireDialog(false);
  };

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-hud)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          {company.name} — Agents ({company.employees.length})
        </div>
        {orchestratorConnected && (
          <span style={{ fontSize: 'var(--font-xs)', color: '#c084fc' }}>◆ Claude-powered hiring</span>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 10,
      }}>
        {company.employees.map(emp => (
          <div
            key={emp.id}
            onClick={() => navigate(`/company/${companyId}/agents/${emp.id}`)}
            style={{
              background: '#0d1117',
              border: '1px solid var(--hud-border)',
              padding: '12px 14px',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = emp.color + '60')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--hud-border)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 8, height: 8,
                background: emp.color,
                boxShadow: `0 0 6px ${emp.color}`,
              }} />
              <span style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)' }}>
                {getRoleDisplayName(emp.role, emp.id, company.employees)}
              </span>
            </div>

            <div style={{ fontSize: 'var(--font-xs)', color: emp.color, textTransform: 'uppercase', marginBottom: 4 }}>
              {emp.role}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-xs)' }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: STATUS_COLORS[emp.status] ?? '#4a5568',
                boxShadow: `0 0 4px ${STATUS_COLORS[emp.status] ?? '#4a5568'}`,
              }} />
              <span style={{ color: STATUS_COLORS[emp.status] ?? '#4a5568' }}>
                {emp.status}
              </span>
            </div>

            {emp.assignedTask && (
              <div style={{
                marginTop: 6, fontSize: 'var(--font-xs)', color: '#6a7a90',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {emp.assignedTask}
              </div>
            )}

            <div style={{
              marginTop: 8, fontSize: 'var(--font-xs)', color: '#2a3a50',
            }}>
              Progress: {emp.progress}%
            </div>
          </div>
        ))}

        {/* Hire button */}
        <div
          onClick={() => setShowHireDialog(true)}
          style={{
            background: '#0d1117',
            border: '1px dashed #1b2030',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 140,
            cursor: hiring ? 'wait' : 'pointer',
            transition: 'border-color 0.15s',
            opacity: hiring ? 0.5 : 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#00ffff40')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1b2030')}
        >
          <div style={{ fontSize: 20, color: '#1b2030', marginBottom: 4 }}>+</div>
          <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', textTransform: 'uppercase' }}>
            {hiring ? 'Hiring...' : 'Hire Agent'}
          </div>
        </div>
      </div>

      {showHireDialog && (
        <HireAgentDialog
          companyId={companyId!}
          onHire={handleHire}
          onClose={() => setShowHireDialog(false)}
        />
      )}
    </div>
  );
}

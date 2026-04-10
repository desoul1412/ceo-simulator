import { useEffect, useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { PixelOfficeCanvas } from './PixelOfficeCanvas';
import { CeoPlanFlow } from './CeoPlanFlow';
import { AgentCard } from './AgentCard';
import { sendHeartbeat, checkStaleAgents } from '../lib/api';
import * as api from '../lib/api';
import { processQueue, fetchQueueStatus } from '../lib/orchestratorApi';
import { HireAgentDialog, type HireConfig } from './HireAgentDialog';
import { hireAgent } from '../lib/orchestratorApi';
import { isOnline } from '../lib/supabase';
import type { Company } from '../store/dashboardStore';

interface CompanyDetailProps {
  company: Company;
}

export function CompanyDetail({ company }: CompanyDetailProps) {
  const tickCompany = useDashboardStore(s => s.tickCompany);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const [queueInfo, setQueueInfo] = useState({ pending: 0, processing: 0 });
  const [showHireDialog, setShowHireDialog] = useState(false);
  const [hiring, setHiring] = useState(false);

  // Mock tick (offline only)
  useEffect(() => {
    if (!company.ceoGoal || orchestratorConnected) return;
    let timerId: ReturnType<typeof setTimeout>;
    function scheduleNext() {
      timerId = setTimeout(() => { tickCompany(company.id); scheduleNext(); }, 8000 + Math.random() * 4000);
    }
    scheduleNext();
    return () => clearTimeout(timerId);
  }, [company.id, company.ceoGoal, tickCompany, orchestratorConnected]);

  // Real mode: poll task queue
  useEffect(() => {
    if (!orchestratorConnected || !company.ceoGoal) return;
    const interval = setInterval(async () => {
      const status = await fetchQueueStatus(company.id).catch(() => null);
      if (!status) return;
      setQueueInfo({ pending: status.pending, processing: status.processing });
      if (status.pending > 0 && !status.isProcessing) await processQueue().catch(() => {});
      const companies = await api.fetchCompanies().catch(() => []);
      const updated = companies.find((c: any) => c.id === company.id);
      if (updated) {
        const store = useDashboardStore.getState();
        useDashboardStore.setState({
          companies: store.companies.map(co =>
            co.id === company.id ? {
              ...co,
              employees: (updated as any).agents.map((a: any) => ({
                id: a.id, name: a.name, role: a.role, status: a.status,
                col: a.tileCol, row: a.tileRow, color: a.color,
                assignedTask: a.assignedTask, progress: a.progress,
              })),
              delegations: (updated as any).delegations.map((d: any) => ({
                id: d.id, toRole: d.toRole, task: d.task, progress: d.progress,
              })),
              budgetSpent: (updated as any).budgetSpent,
              status: (updated as any).status,
              ceoGoal: (updated as any).ceoGoal,
            } : co
          ),
        });
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [orchestratorConnected, company.id, company.ceoGoal]);

  // Heartbeat ping
  useEffect(() => {
    const interval = setInterval(() => {
      const ids = company.employees.filter(e => e.status === 'working' || e.status === 'meeting').map(e => e.id);
      sendHeartbeat(ids).catch(() => {});
      checkStaleAgents().catch(() => {});
    }, 10_000);
    return () => clearInterval(interval);
  }, [company.employees]);

  // Hire agent
  const handleHire = async (config: HireConfig) => {
    setHiring(true);
    try {
      if (orchestratorConnected) {
        await hireAgent(config);
      } else if (isOnline()) {
        await api.createCompany(config.role, 0);
      }
      if (isOnline()) {
        const apiCompanies = await api.fetchCompanies();
        const updated = apiCompanies.find(c => c.id === company.id);
        if (updated) {
          const store = useDashboardStore.getState();
          useDashboardStore.setState({
            companies: store.companies.map(co =>
              co.id === company.id ? {
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

  // Usage
  const DAILY_CAP_USD = 3.3;
  const WEEKLY_CAP_USD = 23;
  const spent = company.budgetSpent;
  const dailyPct = Math.min(100, Math.round((spent / DAILY_CAP_USD) * 100));
  const weeklyPct = Math.min(100, Math.round((spent / WEEKLY_CAP_USD) * 100));
  const usagePct = Math.max(dailyPct, weeklyPct);
  const barColor = usagePct < 50 ? 'var(--neon-green)' : usagePct < 80 ? 'var(--neon-orange)' : 'var(--neon-red)';
  const activeCount = company.employees.filter(e => e.status === 'working' || e.status === 'meeting').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', height: '100%', minWidth: 0 }}>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        padding: '8px var(--pad)',
        background: '#090d14', border: '1px solid var(--hud-border)',
        fontSize: 'var(--font-sm)', flexShrink: 0,
      }}>
        <div>
          <span style={{ color: 'var(--hud-text-dim)', letterSpacing: '0.1em', marginRight: 8 }}>USAGE</span>
          <span style={{ color: barColor, textShadow: `0 0 4px ${barColor}`, fontSize: 'var(--font-md)' }}>{dailyPct}%</span>
          <span style={{ color: 'var(--hud-text-dim)', fontSize: 'var(--font-xs)', marginLeft: 4 }}>daily</span>
          <span style={{ color: 'var(--hud-text-dim)', margin: '0 6px' }}>/</span>
          <span style={{ color: barColor, fontSize: 'var(--font-md)' }}>{weeklyPct}%</span>
          <span style={{ color: 'var(--hud-text-dim)', fontSize: 'var(--font-xs)', marginLeft: 4 }}>weekly</span>
        </div>
        <div>
          <span style={{ color: 'var(--hud-text-dim)', letterSpacing: '0.1em', marginRight: 8 }}>STATUS</span>
          <span style={{ color: 'var(--neon-cyan)', textTransform: 'uppercase' }}>{company.status}</span>
        </div>
        <div>
          <span style={{ color: 'var(--hud-text-dim)', letterSpacing: '0.1em', marginRight: 8 }}>AGENTS</span>
          <span style={{ color: 'var(--neon-green)' }}>{activeCount}</span>
          <span style={{ color: 'var(--hud-text-dim)' }}>/{company.employees.length}</span>
        </div>
        {orchestratorConnected && (queueInfo.pending > 0 || queueInfo.processing > 0) && (
          <div>
            <span style={{ color: 'var(--hud-text-dim)', letterSpacing: '0.1em', marginRight: 8 }}>QUEUE</span>
            <span style={{ color: 'var(--neon-purple)' }}>
              {queueInfo.processing > 0 ? `▶ ${queueInfo.processing}` : ''} {queueInfo.pending > 0 ? `◇ ${queueInfo.pending}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Main area: canvas (left, larger) + agent grid (right, compact) */}
      <div style={{ display: 'flex', gap: 'var(--gap)', flex: 1, minHeight: 0 }}>
        {/* Office Canvas — takes ~65% */}
        <div style={{
          flex: '2 1 0',
          background: '#05080f',
          border: '1px solid var(--hud-border)',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 0,
        }}>
          <PixelOfficeCanvas company={company} />
        </div>

        {/* Agent grid — right side, ~35%, 3 columns */}
        <div style={{
          flex: '1 1 0',
          minWidth: 240, maxWidth: 420,
          display: 'flex', flexDirection: 'column',
          gap: 6, overflow: 'hidden', minHeight: 0,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 8px', background: '#090d14',
            border: '1px solid var(--hud-border)', flexShrink: 0,
          }}>
            <span style={{
              fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              Agents ({company.employees.length})
            </span>
            <button
              onClick={() => setShowHireDialog(true)}
              disabled={hiring}
              style={{
                padding: '2px 8px', fontSize: 'var(--font-xs)',
                background: '#00ffff10', border: '1px solid #00ffff30',
                color: 'var(--neon-cyan)', cursor: hiring ? 'wait' : 'pointer',
                fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
                opacity: hiring ? 0.5 : 1,
              }}
            >
              + Hire
            </button>
          </div>

          {/* 3-column grid of compact cards */}
          <div style={{
            flex: 1, overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6, alignContent: 'start',
            padding: '0 2px 2px',
          }}>
            {company.employees.map(emp => (
              <AgentCard
                key={emp.id}
                agent={emp}
                companyId={company.id}
                allAgents={company.employees}
              />
            ))}

            {/* Empty slots to fill 3x3 grid */}
            {company.employees.length < 9 && (
              <div
                onClick={() => setShowHireDialog(true)}
                style={{
                  border: '1px dashed #1b2030', background: '#0d1117',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', minHeight: 80,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#00ffff40')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1b2030')}
              >
                <span style={{ fontSize: 14, color: '#1b2030' }}>+</span>
                <span style={{ fontSize: 10, color: '#1b2030', textTransform: 'uppercase' }}>Hire</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: CEO Directive */}
      <div style={{ flexShrink: 0, maxHeight: 240, overflow: 'hidden' }}>
        <CeoPlanFlow company={company} />
      </div>

      {showHireDialog && (
        <HireAgentDialog companyId={company.id} onHire={handleHire} onClose={() => setShowHireDialog(false)} />
      )}
    </div>
  );
}

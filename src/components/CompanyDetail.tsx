import { useEffect, useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { PixelOfficeCanvas } from './PixelOfficeCanvas';
import { CeoPlanFlow } from './CeoPlanFlow';
import { DelegationFeed } from './DelegationFeed';
import { ActivityFeed } from './ActivityFeed';
import { ApprovalPanel } from './ApprovalPanel';
import { sendHeartbeat, checkStaleAgents } from '../lib/api';
import * as api from '../lib/api';
import { processQueue, fetchQueueStatus } from '../lib/orchestratorApi';
import type { Company } from '../store/dashboardStore';

interface CompanyDetailProps {
  company: Company;
}

export function CompanyDetail({ company }: CompanyDetailProps) {
  const tickCompany = useDashboardStore(s => s.tickCompany);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const [queueInfo, setQueueInfo] = useState({ pending: 0, processing: 0 });

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

  // Usage as % of Claude plan limits (configurable — $100/mo ≈ $3.3/day, $23/week)
  const DAILY_CAP_USD = 3.3;
  const WEEKLY_CAP_USD = 23;
  const spent = company.budgetSpent;
  const dailyPct = Math.min(100, Math.round((spent / DAILY_CAP_USD) * 100));
  const weeklyPct = Math.min(100, Math.round((spent / WEEKLY_CAP_USD) * 100));
  const usagePct = Math.max(dailyPct, weeklyPct);
  const barColor = usagePct < 50 ? 'var(--neon-green)' : usagePct < 80 ? 'var(--neon-orange)' : 'var(--neon-red)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', height: '100%', minWidth: 0 }}>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        padding: '8px var(--pad)',
        background: '#090d14',
        border: '1px solid var(--hud-border)',
        fontSize: 'var(--font-sm)',
        flexShrink: 0,
      }}>
        <div>
          <span style={{ color: 'var(--hud-text-dim)', letterSpacing: '0.1em', marginRight: 8 }}>USAGE</span>
          <span style={{ color: barColor, textShadow: `0 0 4px ${barColor}`, fontSize: 'var(--font-md)' }}>
            {dailyPct}%
          </span>
          <span style={{ color: 'var(--hud-text-dim)', fontSize: 'var(--font-xs)', marginLeft: 4 }}>daily</span>
          <span style={{ color: 'var(--hud-text-dim)', margin: '0 6px' }}>/</span>
          <span style={{ color: barColor, fontSize: 'var(--font-md)' }}>
            {weeklyPct}%
          </span>
          <span style={{ color: 'var(--hud-text-dim)', fontSize: 'var(--font-xs)', marginLeft: 4 }}>weekly</span>
        </div>
        <div>
          <span style={{ color: 'var(--hud-text-dim)', letterSpacing: '0.1em', marginRight: 8 }}>STATUS</span>
          <span style={{ color: 'var(--neon-cyan)', textTransform: 'uppercase' }}>{company.status}</span>
        </div>
        <div>
          <span style={{ color: 'var(--hud-text-dim)', letterSpacing: '0.1em', marginRight: 8 }}>AGENTS</span>
          <span style={{ color: 'var(--neon-green)' }}>
            {company.employees.filter(e => e.status === 'working' || e.status === 'meeting').length}
          </span>
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

      {/* Main: canvas + side panels */}
      <div style={{
        display: 'flex', gap: 'var(--gap)', flex: 1, minHeight: 0,
        flexDirection: 'row',
      }}>
        {/* Canvas — fills all available space */}
        <div style={{
          flex: 1,
          background: '#05080f',
          border: '1px solid var(--hud-border)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 0,
        }}>
          <PixelOfficeCanvas company={company} />
        </div>

        {/* Side panels — fixed width on desktop, full width on mobile */}
        <div style={{
          width: 'var(--panel-w)',
          maxWidth: 380,
          display: 'flex', flexDirection: 'column',
          gap: 8, flexShrink: 0,
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <CeoPlanFlow company={company} />
          <ApprovalPanel company={company} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
            <DelegationFeed company={company} />
            <ActivityFeed company={company} />
          </div>
        </div>
      </div>
    </div>
  );
}

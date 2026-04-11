import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { fetchPlans, fetchSprints, fetchTickets } from '../lib/orchestratorApi';

interface Sprint {
  id: string; name: string; goal: string | null;
  start_date: string | null; end_date: string | null; status: string;
}
interface Ticket {
  id: string; title: string; status: string; board_column: string | null;
  story_points: number | null; agent_id: string | null; sprint_id: string | null;
}

export function GoalsPage() {
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const company = companies.find(c => c.id === companyId);

  const [masterPlanPhases, setMasterPlanPhases] = useState<{ name: string; tasks: string[] }[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    const [plans, s, t] = await Promise.all([
      fetchPlans(companyId, 'master_plan').catch(() => []),
      fetchSprints(companyId).catch(() => []),
      fetchTickets(companyId).catch(() => []),
    ]);
    setSprints(s);
    setTickets(t);

    const mp = plans.find((p: any) => p.type === 'master_plan' && p.status === 'approved');
    if (mp?.content) {
      const lines = (mp.content as string).split('\n');
      const parsed: { name: string; tasks: string[] }[] = [];
      let cur: { name: string; tasks: string[] } | null = null;
      for (const line of lines) {
        const ph = line.match(/^###\s+(.+)/);
        if (ph) { if (cur) parsed.push(cur); cur = { name: ph[1], tasks: [] }; }
        else if (cur) { const tm = line.match(/^-\s+\[[ x]\]\s+(.+)/i); if (tm) cur.tasks.push(tm[1]); }
      }
      if (cur) parsed.push(cur);
      setMasterPlanPhases(parsed);
    }
  }, [companyId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  const doneTicketTitles = new Set(
    tickets.filter(t => t.status === 'completed' || t.board_column === 'done').map(t => t.title.toLowerCase().trim())
  );
  const totalTasks = masterPlanPhases.reduce((s, p) => s + p.tasks.length, 0);
  const completedTasks = masterPlanPhases.reduce((s, p) =>
    s + p.tasks.filter(t => doneTicketTitles.has(t.toLowerCase().trim())).length, 0
  );
  const overallPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const sectionStyle: React.CSSProperties = {
    background: '#0d1117', border: '1px solid var(--hud-border)', marginBottom: 12,
  };
  const headerStyle: React.CSSProperties = {
    padding: '8px 12px', borderBottom: '1px solid var(--hud-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#090d14',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)',
    textTransform: 'uppercase', letterSpacing: '0.1em',
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 'var(--pad)', fontFamily: 'var(--font-hud)' }}>
      {/* Active Goal */}
      {company.ceoGoal && (
        <div style={{ ...sectionStyle, borderColor: 'var(--neon-cyan)30' }}>
          <div style={headerStyle}>
            <span style={{ ...labelStyle, color: 'var(--neon-cyan)', textShadow: '0 0 4px var(--neon-cyan)' }}>Active Goal</span>
          </div>
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', marginBottom: 6 }}>{company.ceoGoal}</div>
            {company.delegations.length > 0 && (
              <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>
                {company.delegations.length} delegations — avg {Math.round(company.delegations.reduce((s, d) => s + d.progress, 0) / company.delegations.length)}%
              </div>
            )}
          </div>
        </div>
      )}

      {/* Master Plan Progress */}
      {masterPlanPhases.length > 0 && (
        <div style={sectionStyle}>
          <div style={headerStyle}>
            <span style={{ ...labelStyle, color: 'var(--neon-purple)', textShadow: '0 0 4px var(--neon-purple)' }}>
              Master Plan Progress
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 100, height: 4, background: '#1b2030' }}>
                <div style={{
                  width: `${overallPct}%`, height: '100%',
                  background: 'var(--neon-purple)', boxShadow: '0 0 6px var(--neon-purple)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-purple)' }}>
                {completedTasks}/{totalTasks} ({overallPct}%)
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {masterPlanPhases.map((phase, phaseIdx) => {
              const phaseDone = phase.tasks.filter(t => doneTicketTitles.has(t.toLowerCase().trim())).length;
              const phaseTotal = phase.tasks.length;
              const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;
              const isCurrent = sprints.some(s =>
                s.status !== 'completed' && (
                  s.goal?.toLowerCase().includes(phase.name.toLowerCase().replace(/^phase\s*\d+[:\s]*/i, ''))
                  || phase.name.toLowerCase().includes(s.name.toLowerCase())
                )
              );
              return (
                <div key={phaseIdx} style={{
                  flex: 1, minWidth: 180, padding: '10px 12px',
                  borderRight: phaseIdx < masterPlanPhases.length - 1 ? '1px solid var(--hud-border)' : 'none',
                  background: isCurrent ? '#c084fc08' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 'var(--font-xs)',
                      color: phasePct === 100 ? 'var(--neon-green)' : isCurrent ? 'var(--neon-purple)' : 'var(--hud-text-dim)',
                      fontWeight: isCurrent ? 600 : 400,
                    }}>
                      {phasePct === 100 ? '✓ ' : ''}{phase.name}
                    </span>
                    <span style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginLeft: 'auto' }}>{phaseDone}/{phaseTotal}</span>
                  </div>
                  <div style={{ height: 3, background: '#1b2030', marginBottom: 6 }}>
                    <div style={{ width: `${phasePct}%`, height: '100%', background: phasePct === 100 ? 'var(--neon-green)' : 'var(--neon-purple)', transition: 'width 0.5s ease' }} />
                  </div>
                  {phase.tasks.map((task, taskIdx) => {
                    const isDone = doneTicketTitles.has(task.toLowerCase().trim());
                    return (
                      <div key={taskIdx} style={{ fontSize: 'var(--font-xs)', padding: '2px 0', display: 'flex', gap: 4, opacity: isDone ? 0.5 : 1 }}>
                        <span style={{ color: isDone ? 'var(--neon-green)' : '#2a3a50', flexShrink: 0, width: 10 }}>{isDone ? '✓' : '○'}</span>
                        <span style={{ color: isDone ? '#4a5568' : '#6a7a90', textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.3 }}>{task}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delegation Tree */}
      {company.delegations.length > 0 && (
        <div style={sectionStyle}>
          <div style={headerStyle}><span style={labelStyle}>Delegation Tree</span></div>
          <div style={{ padding: '8px 12px' }}>
            {company.delegations.map(del => {
              const emp = company.employees.find(e => e.role === del.toRole);
              const color = emp?.color ?? '#4a5568';
              return (
                <div key={del.id} style={{ padding: '6px 0', borderBottom: '1px solid #0a0e14', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-h)' }}>{del.toRole}: {del.task}</div>
                    <div style={{ marginTop: 3, height: 3, background: '#1b2030' }}>
                      <div style={{ width: `${del.progress}%`, height: '100%', background: color, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568', flexShrink: 0 }}>{del.progress}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sprint History */}
      {sprints.length > 0 && (
        <div style={sectionStyle}>
          <div style={headerStyle}><span style={labelStyle}>Sprints</span></div>
          <div style={{ padding: '8px 12px' }}>
            {sprints.map(s => {
              const sprintTickets = tickets.filter(t => t.sprint_id === s.id);
              const done = sprintTickets.filter(t => t.status === 'completed' || t.board_column === 'done').length;
              return (
                <div key={s.id} style={{ padding: '6px 0', borderBottom: '1px solid #0a0e14', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 'var(--font-xs)', color: s.status === 'completed' ? 'var(--neon-green)' : 'var(--neon-purple)' }}>
                    {s.status === 'completed' ? '✓' : '▶'}
                  </span>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-h)', flex: 1 }}>{s.name}</span>
                  <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>{s.goal}</span>
                  <span style={{ fontSize: 'var(--font-xs)', color: '#2a3a50' }}>{done}/{sprintTickets.length}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!company.ceoGoal && masterPlanPhases.length === 0 && (
        <div style={{ ...sectionStyle, padding: '30px 16px', textAlign: 'center', fontSize: 'var(--font-sm)', color: '#2a3a50', fontStyle: 'italic' }}>
          No active goal — assign one from the Office view or generate plans from Overview
        </div>
      )}
    </div>
  );
}

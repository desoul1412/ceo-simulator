import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { PixelOfficeCanvas } from './PixelOfficeCanvas';
import type { Company } from '../store/dashboardStore';
import * as api from '../lib/api';
import { isOnline } from '../lib/supabase';

function CompanyTile({ company }: { company: Company }) {
  const navigate = useNavigate();
  const activeAgents = company.employees.filter(e => e.status === 'working' || e.status === 'meeting').length;
  const isWorking = activeAgents > 0;
  const DAILY_CAP = 3.3;
  const WEEKLY_CAP_TILE = 23;
  const dailyPct = Math.min(100, Math.round((company.budgetSpent / DAILY_CAP) * 100));
  const weeklyPctTile = Math.min(100, Math.round((company.budgetSpent / WEEKLY_CAP_TILE) * 100));
  const budgetColor = dailyPct < 50 ? '#00ff88' : dailyPct < 80 ? '#ff8800' : '#ff2244';

  return (
    <div
      onClick={() => navigate(`/company/${company.id}`)}
      style={{
        background: '#0d1117',
        border: '1px solid var(--hud-border)',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
        overflow: 'hidden',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#00ffff40')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--hud-border)')}
    >
      {/* Mini canvas */}
      <div style={{
        height: 220,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#05080f',
        borderBottom: '1px solid var(--hud-border)',
      }}>
        <div style={{ transform: 'scale(0.5)', transformOrigin: 'center center' }}>
          <PixelOfficeCanvas company={company} />
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{
          fontSize: 'var(--font-md)', color: 'var(--hud-text-h)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          {company.name}
        </div>

        <div style={{ display: 'flex', gap: 14, fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isWorking ? '#00ff88' : '#4a5568',
              boxShadow: isWorking ? '0 0 6px #00ff88' : 'none',
              animation: isWorking ? 'pulse 2s ease-in-out infinite' : 'none',
            }} />
            {activeAgents} active
          </span>
          <span>
            {company.employees.length} agents
          </span>
          <span style={{ color: budgetColor }}>
            {dailyPct}% <span style={{ color: 'var(--hud-text-dim)' }}>d</span>
          </span>
          <span style={{ color: budgetColor }}>
            {weeklyPctTile}% <span style={{ color: 'var(--hud-text-dim)' }}>w</span>
          </span>
        </div>

        {company.ceoGoal ? (
          <div style={{
            marginTop: 6, fontSize: 'var(--font-xs)', color: 'var(--neon-cyan)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            ▸ {company.ceoGoal}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic' }}>
            No active goal
          </div>
        )}

        {/* Status badge */}
        <div style={{
          marginTop: 8, display: 'inline-block',
          padding: '2px 8px', fontSize: 'var(--font-xs)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          background: company.status === 'scaling' ? '#00ff8818' :
                      company.status === 'growing' ? '#00ffff18' :
                      company.status === 'crisis' ? '#ff224418' : '#1b2030',
          color: company.status === 'scaling' ? '#00ff88' :
                 company.status === 'growing' ? '#00ffff' :
                 company.status === 'crisis' ? '#ff2244' : '#4a5568',
          border: `1px solid ${
            company.status === 'scaling' ? '#00ff8830' :
            company.status === 'growing' ? '#00ffff30' :
            company.status === 'crisis' ? '#ff224430' : '#1b2030'
          }`,
        }}>
          {company.status}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!confirm(`Delete "${company.name}"? This removes all agents, goals, and data.`)) return;
            if (isOnline()) {
              api.deleteCompany(company.id).then(() => {
                useDashboardStore.setState(state => ({
                  companies: state.companies.filter(c => c.id !== company.id),
                }));
              }).catch(err => console.error('[delete] Failed:', err));
            } else {
              useDashboardStore.setState(state => ({
                companies: state.companies.filter(c => c.id !== company.id),
              }));
            }
          }}
          style={{
            marginTop: 10, width: '100%', padding: '4px',
            background: 'none', border: '1px solid #ff224430',
            color: '#ff224480', fontFamily: 'var(--font-hud)',
            fontSize: 'var(--font-xs)', cursor: 'pointer',
            textTransform: 'uppercase',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ff2244'; e.currentTarget.style.borderColor = '#ff224460'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#ff224480'; e.currentTarget.style.borderColor = '#ff224430'; }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function NewCompanyTile() {
  const addCompany = useDashboardStore(s => s.addCompany);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const navigate = useNavigate();

  const handleCreate = async () => {
    const name = prompt('Company / Project name:');
    if (!name?.trim()) return;

    const repoUrl = prompt('Git repo URL (leave empty for local-only):', '');

    let token: string | null = null;
    if (repoUrl?.includes('github.com')) {
      token = prompt('GitHub PAT (leave empty for public repos):', '') || null;
    }

    // Create company in Supabase and get the real UUID back
    if (isOnline()) {
      try {
        const newCompany = await api.createCompany(name.trim(), 100000);
        const localCompany = {
          id: newCompany.id, name: newCompany.name, budget: newCompany.budget,
          budgetSpent: newCompany.budgetSpent, status: newCompany.status as any,
          ceoGoal: newCompany.ceoGoal,
          employees: newCompany.agents.map((a: any) => ({
            id: a.id, name: a.name, role: a.role, status: a.status,
            col: a.tileCol, row: a.tileRow, color: a.color,
            assignedTask: a.assignedTask, progress: a.progress,
          })),
          delegations: [],
        };
        useDashboardStore.setState(state => ({
          companies: [...state.companies, localCompany],
        }));

        // Connect repo with the REAL Supabase UUID
        if (repoUrl?.trim() && orchestratorConnected) {
          const { connectRepo } = await import('../lib/orchestratorApi');
          await connectRepo(newCompany.id, {
            repoUrl: repoUrl.trim(),
            token: token || undefined,
          }).catch(err => console.error('[repo] Connect failed:', err));
        }

        navigate(`/company/${newCompany.id}`);
      } catch (err) {
        console.error('[create] Failed:', err);
        addCompany(name.trim(), 100000); // fallback to local
      }
    } else {
      addCompany(name.trim(), 100000);
    }
  };

  return (
    <div
      onClick={handleCreate}
      style={{
        background: '#0d1117',
        border: '1px dashed #1b2030',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 280,
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#00ffff40')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1b2030')}
    >
      <div style={{ fontSize: 28, color: '#1b2030', marginBottom: 8 }}>+</div>
      <div style={{
        fontSize: 'var(--font-sm)', color: '#2a3a50',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        New Company
      </div>
    </div>
  );
}

export function MasterDashboard() {
  const companies = useDashboardStore(s => s.companies);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);

  const totalAgents = companies.reduce((s, c) => s + c.employees.length, 0);
  const activeAgents = companies.reduce((s, c) => s + c.employees.filter(e => e.status === 'working' || e.status === 'meeting').length, 0);
  const WEEKLY_CAP = 23;
  const totalSpentUsd = companies.reduce((s, c) => s + c.budgetSpent, 0);
  const weeklyPct = Math.min(100, Math.round((totalSpentUsd / WEEKLY_CAP) * 100));

  return (
    <div style={{ padding: 'var(--pad)', height: '100%', overflow: 'auto' }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex', gap: 28, marginBottom: 'var(--pad)',
        padding: '10px var(--pad)',
        background: '#090d14',
        border: '1px solid var(--hud-border)',
        fontSize: 'var(--font-sm)', fontFamily: 'var(--font-hud)',
        flexWrap: 'wrap',
      }}>
        <div>
          <span style={{ color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 6 }}>Companies</span>
          <span style={{ color: 'var(--hud-text-h)' }}>{companies.length}</span>
        </div>
        <div>
          <span style={{ color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 6 }}>Agents</span>
          <span style={{ color: '#00ff88' }}>{activeAgents}</span>
          <span style={{ color: '#4a5568' }}>/{totalAgents}</span>
        </div>
        <div>
          <span style={{ color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 6 }}>Weekly</span>
          <span style={{ color: weeklyPct < 50 ? '#00ff88' : weeklyPct < 80 ? '#ff8800' : '#ff2244' }}>{weeklyPct}%</span>
        </div>
        {orchestratorConnected && (
          <div style={{ marginLeft: 'auto', color: '#c084fc' }}>
            ◆ CLAUDE ORCHESTRATOR ACTIVE
          </div>
        )}
      </div>

      {/* Company grid — working projects first, then idle */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 'var(--gap)',
      }}>
        {[...companies].sort((a, b) => {
          const aActive = a.employees.some(e => e.status === 'working' || e.status === 'meeting') ? 1 : 0;
          const bActive = b.employees.some(e => e.status === 'working' || e.status === 'meeting') ? 1 : 0;
          return bActive - aActive;
        }).map(co => (
          <CompanyTile key={co.id} company={co} />
        ))}
        <NewCompanyTile />
      </div>
    </div>
  );
}

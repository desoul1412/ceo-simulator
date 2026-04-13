import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { getRoleDisplayName } from '../lib/agentDisplay';
import { fetchCosts } from '../lib/orchestratorApi';
import { PixelAvatar } from './AgentCard';
import { calcUsage, DAILY_BUDGET_CAP, WEEKLY_BUDGET_CAP } from '../lib/budgetConfig';

interface TokenEntry {
  id: string; agent_id: string; input_tokens: number; output_tokens: number;
  cost_usd: number; model: string; invoked_at: string;
}

export function OrgChartPage() {
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const company = companies.find(c => c.id === companyId);
  const [tokenEntries, setTokenEntries] = useState<TokenEntry[]>([]);
  const [totalRealCost, setTotalRealCost] = useState(0);

  useEffect(() => {
    if (!companyId || !orchestratorConnected) return;
    const load = () => {
      fetchCosts(companyId).then(data => {
        setTokenEntries(data.entries ?? []);
        setTotalRealCost(data.totalCostUsd ?? 0);
      }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [companyId, orchestratorConnected]);

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  const ceo = company.employees.find(e => e.role === 'CEO');
  const reports = company.employees.filter(e => e.role !== 'CEO');

  const agentCosts = new Map<string, number>();
  for (const entry of tokenEntries) {
    agentCosts.set(entry.agent_id, (agentCosts.get(entry.agent_id) ?? 0) + entry.cost_usd);
  }
  const DAILY_CAP = DAILY_BUDGET_CAP;
  const WEEKLY_CAP = WEEKLY_BUDGET_CAP;
  const totalTokensIn = tokenEntries.reduce((s, e) => s + e.input_tokens, 0);
  const totalTokensOut = tokenEntries.reduce((s, e) => s + e.output_tokens, 0);
  const { dailyPct: dailyTotalPct } = calcUsage(totalRealCost);

  const sectionStyle: React.CSSProperties = {
    background: '#0d1117', border: '1px solid var(--hud-border)', marginBottom: 16,
  };
  const headerStyle: React.CSSProperties = {
    padding: '10px 16px', borderBottom: '1px solid var(--hud-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#090d14',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-sm)', color: 'var(--hud-text-dim)',
    textTransform: 'uppercase', letterSpacing: '0.1em',
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 'var(--pad)', fontFamily: 'var(--font-hud)' }}>

      {/* ── Org Chart ────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={headerStyle}>
          <span style={labelStyle}>Org Chart</span>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* CEO node */}
          {ceo && (
            <div style={{
              background: '#0a0e14', border: `2px solid ${ceo.color}`,
              padding: '14px 28px', textAlign: 'center',
              boxShadow: `0 0 16px ${ceo.color}30`,
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <PixelAvatar role={ceo.role} status={ceo.status} scale={2.5} />
              <div>
                <div style={{ fontSize: 'var(--font-md)', color: ceo.color, textTransform: 'uppercase', fontWeight: 600 }}>{ceo.role}</div>
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', marginTop: 3 }}>{ceo.name}</div>
              </div>
            </div>
          )}
          <div style={{ width: 2, height: 20, background: '#1b2030' }} />
          <div style={{ width: Math.min(reports.length * 150, 700), height: 2, background: '#1b2030' }} />
          {/* Report nodes */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {reports.map(emp => (
              <div key={emp.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 2, height: 20, background: '#1b2030' }} />
                <div style={{
                  background: '#0a0e14', border: `1px solid ${emp.color}40`,
                  padding: '10px 16px', textAlign: 'center', minWidth: 110,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <PixelAvatar role={emp.role} status={emp.status} scale={2} />
                  <div>
                    <div style={{ fontSize: 'var(--font-sm)', color: emp.color, textTransform: 'uppercase', fontWeight: 600 }}>{emp.role}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-h)', marginTop: 2 }}>{getRoleDisplayName(emp.role, emp.id, company.employees)}</div>
                    <div style={{
                      fontSize: 'var(--font-xs)', marginTop: 3,
                      color: emp.status === 'working' ? '#00ff88' : '#4a5568',
                      textTransform: 'uppercase',
                    }}>
                      {emp.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Budget Overview ───────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={headerStyle}>
          <span style={labelStyle}>Budget & Costs</span>
          <span style={{ fontSize: 'var(--font-md)', color: 'var(--neon-purple)' }}>
            Total: ${totalRealCost.toFixed(4)}
          </span>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 32, marginBottom: 12, fontSize: 'var(--font-sm)' }}>
            <div>
              <span style={{ color: '#6a7a90' }}>DAILY </span>
              <span style={{ color: dailyTotalPct < 50 ? '#00ff88' : '#ff8800', fontSize: 'var(--font-md)', fontWeight: 600 }}>
                {dailyTotalPct}%
              </span>
              <span style={{ color: '#4a5568' }}> of ${DAILY_CAP}</span>
            </div>
            <div>
              <span style={{ color: '#6a7a90' }}>WEEKLY </span>
              <span style={{
                color: (totalRealCost / WEEKLY_CAP) < 0.5 ? '#00ff88' : '#ff8800',
                fontSize: 'var(--font-md)', fontWeight: 600,
              }}>
                {Math.min(100, Math.round((totalRealCost / WEEKLY_CAP) * 100))}%
              </span>
              <span style={{ color: '#4a5568' }}> of ${WEEKLY_CAP}</span>
            </div>
            <div>
              <span style={{ color: '#6a7a90' }}>TOKENS </span>
              <span style={{ color: 'var(--hud-text-h)', fontSize: 'var(--font-md)' }}>
                {totalTokensIn.toLocaleString()}↓ {totalTokensOut.toLocaleString()}↑
              </span>
            </div>
          </div>
          <div style={{ height: 6, background: '#1b2030' }}>
            <div style={{
              width: `${dailyTotalPct}%`, height: '100%',
              background: dailyTotalPct < 50 ? '#00ff88' : dailyTotalPct < 80 ? '#ff8800' : '#ff2244',
              boxShadow: `0 0 6px ${dailyTotalPct < 50 ? '#00ff88' : '#ff8800'}`,
              transition: 'width 0.5s',
            }} />
          </div>
        </div>
      </div>

      {/* ── Agent Cost Cards ─────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={headerStyle}>
          <span style={labelStyle}>Agent Costs</span>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 10, padding: 14,
        }}>
          {company.employees.map(emp => {
            const cost = agentCosts.get(emp.id) ?? 0;
            const dailyPct = DAILY_CAP > 0 ? Math.min(100, Math.round((cost / DAILY_CAP) * 100)) : 0;
            const weeklyPct = WEEKLY_CAP > 0 ? Math.min(100, Math.round((cost / WEEKLY_CAP) * 100)) : 0;
            const barColor = dailyPct < 30 ? '#00ff88' : dailyPct < 60 ? '#ff8800' : '#ff2244';
            return (
              <div key={emp.id} style={{
                background: '#0a0e14', border: '1px solid var(--hud-border)',
                padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center',
              }}>
                <PixelAvatar role={emp.role} status={emp.status} scale={2.5} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', fontWeight: 600, marginBottom: 3 }}>
                    {getRoleDisplayName(emp.role, emp.id, company.employees)}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: '#6a7a90', marginBottom: 4 }}>
                    Limit: ${DAILY_CAP.toFixed(1)}/day &middot; ${WEEKLY_CAP}/week
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 'var(--font-xs)', marginBottom: 4 }}>
                    <span>Daily: <span style={{ color: barColor, fontWeight: 600 }}>{dailyPct}%</span></span>
                    <span>Weekly: <span style={{ color: '#6a7a90', fontWeight: 600 }}>{weeklyPct}%</span></span>
                  </div>
                  <div style={{ height: 4, background: '#1b2030' }}>
                    <div style={{ width: `${dailyPct}%`, height: '100%', background: barColor, transition: 'width 0.5s' }} />
                  </div>
                  {cost > 0 && (
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-purple)', marginTop: 3, fontWeight: 600 }}>
                      ${cost.toFixed(4)} spent
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent API Calls ─────────────────────────────────────────── */}
      {tokenEntries.length > 0 && (
        <div style={sectionStyle}>
          <div style={headerStyle}>
            <span style={labelStyle}>Recent API Calls</span>
            <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>{tokenEntries.length} total</span>
          </div>
          <div style={{ padding: '8px 16px', maxHeight: 240, overflowY: 'auto' }}>
            {tokenEntries.slice(0, 15).map(entry => {
              const agent = company.employees.find(e => e.id === entry.agent_id);
              return (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0', borderBottom: '1px solid #0a0e14', fontSize: 'var(--font-xs)',
                }}>
                  <span style={{ width: 6, height: 6, background: agent?.color ?? '#4a5568', flexShrink: 0 }} />
                  <span style={{ color: agent?.color ?? '#6a7a90', width: 70, fontWeight: 600 }}>{agent?.role ?? '?'}</span>
                  <span style={{ color: '#6a7a90' }}>{entry.input_tokens.toLocaleString()}↓ {entry.output_tokens.toLocaleString()}↑</span>
                  <span style={{ color: 'var(--neon-purple)', marginLeft: 'auto', fontWeight: 600 }}>${entry.cost_usd.toFixed(4)}</span>
                  <span style={{ color: '#4a5568' }}>{new Date(entry.invoked_at).toLocaleTimeString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

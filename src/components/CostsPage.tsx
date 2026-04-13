import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { fetchCosts } from '../lib/orchestratorApi';
import { DAILY_BUDGET_CAP, WEEKLY_BUDGET_CAP, calcUsage } from '../lib/budgetConfig';

interface TokenEntry {
  id: string;
  agent_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string;
  invoked_at: string;
}

export function CostsPage() {
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const company = companies.find(c => c.id === companyId);
  const [tokenEntries, setTokenEntries] = useState<TokenEntry[]>([]);
  const [totalRealCost, setTotalRealCost] = useState(0);

  // Load real token usage from orchestrator/Supabase
  useEffect(() => {
    if (!companyId) return;
    if (orchestratorConnected) {
      fetchCosts(companyId).then(data => {
        setTokenEntries(data.entries ?? []);
        setTotalRealCost(data.totalCostUsd ?? 0);
      }).catch(() => {});
    }
  }, [companyId, orchestratorConnected]);

  // Also poll periodically for live updates
  useEffect(() => {
    if (!companyId || !orchestratorConnected) return;
    const interval = setInterval(() => {
      fetchCosts(companyId).then(data => {
        setTokenEntries(data.entries ?? []);
        setTotalRealCost(data.totalCostUsd ?? 0);
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [companyId, orchestratorConnected]);

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  // Usage as % of Claude Team Premium limits
  const spent = totalRealCost;
  const { dailyPct, weeklyPct, barColor } = calcUsage(spent);

  // Per-agent cost aggregation from real token data
  const agentCosts = new Map<string, number>();
  for (const entry of tokenEntries) {
    const prev = agentCosts.get(entry.agent_id) ?? 0;
    agentCosts.set(entry.agent_id, prev + entry.cost_usd);
  }

  const totalTokensIn = tokenEntries.reduce((s, e) => s + e.input_tokens, 0);
  const totalTokensOut = tokenEntries.reduce((s, e) => s + e.output_tokens, 0);

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-hud)', maxWidth: 700 }}>
      <div style={{
        fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 12,
      }}>
        {company.name} — Budget & Costs
      </div>

      {/* Budget overview */}
      <div style={{
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '14px 16px', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--font-sm)', color: '#4a5568' }}>DAILY USAGE</span>
          <span style={{ fontSize: 'var(--font-md)', color: barColor }}>{dailyPct}% <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>of ${DAILY_BUDGET_CAP}/day</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--font-sm)', color: '#4a5568' }}>WEEKLY USAGE</span>
          <span style={{ fontSize: 'var(--font-md)', color: barColor }}>{weeklyPct}% <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>of ${WEEKLY_BUDGET_CAP}/week</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 'var(--font-sm)', color: '#4a5568' }}>TOTAL SPENT</span>
          <span style={{ fontSize: 'var(--font-md)', color: '#c084fc' }}>${spent.toFixed(4)}</span>
        </div>
        <div style={{ height: 6, background: '#1b2030' }}>
          <div style={{
            width: `${Math.min(100, dailyPct)}%`, height: '100%',
            background: barColor, boxShadow: `0 0 6px ${barColor}`,
            transition: 'width 0.5s',
          }} />
        </div>
        <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginTop: 4, textAlign: 'right' }}>
          {100 - dailyPct}% daily capacity remaining
        </div>
      </div>

      {/* Real Claude API costs */}
      {(tokenEntries.length > 0 || orchestratorConnected) && (
        <div style={{
          background: '#0d1117', border: '1px solid #c084fc30',
          padding: '14px 16px', marginBottom: 12,
        }}>
          <div style={{
            fontSize: 'var(--font-xs)', color: '#c084fc', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 10,
          }}>
            ◆ Claude API Token Usage
          </div>

          <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 'var(--font-sm)' }}>
            <div>
              <div style={{ color: '#4a5568', fontSize: 'var(--font-xs)' }}>TOTAL COST</div>
              <div style={{ color: '#c084fc', fontSize: 'var(--font-md)' }}>${totalRealCost.toFixed(4)}</div>
            </div>
            <div>
              <div style={{ color: '#4a5568', fontSize: 'var(--font-xs)' }}>INPUT TOKENS</div>
              <div style={{ color: 'var(--hud-text-h)' }}>{totalTokensIn.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ color: '#4a5568', fontSize: 'var(--font-xs)' }}>OUTPUT TOKENS</div>
              <div style={{ color: 'var(--hud-text-h)' }}>{totalTokensOut.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ color: '#4a5568', fontSize: 'var(--font-xs)' }}>INVOCATIONS</div>
              <div style={{ color: 'var(--hud-text-h)' }}>{tokenEntries.length}</div>
            </div>
          </div>

          {/* Per-invocation log */}
          {tokenEntries.slice(0, 10).map(entry => {
            const agent = company.employees.find(e => e.id === entry.agent_id);
            return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 0', borderBottom: '1px solid #0a0e14',
                fontSize: 'var(--font-xs)',
              }}>
                <span style={{
                  width: 5, height: 5, background: agent?.color ?? '#4a5568', flexShrink: 0,
                }} />
                <span style={{ color: '#6a7a90', width: 60 }}>{agent?.role ?? '?'}</span>
                <span style={{ color: '#4a5568' }}>
                  {entry.input_tokens}↓ {entry.output_tokens}↑
                </span>
                <span style={{ color: '#c084fc', marginLeft: 'auto' }}>
                  ${entry.cost_usd.toFixed(4)}
                </span>
                <span style={{ color: '#2a3a50', fontSize: 'var(--font-xs)' }}>
                  {new Date(entry.invoked_at).toLocaleTimeString()}
                </span>
              </div>
            );
          })}

          {tokenEntries.length === 0 && (
            <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic' }}>
              No Claude API calls yet. Assign a goal with orchestrator running.
            </div>
          )}
        </div>
      )}

      {/* Per-agent cost breakdown */}
      <div style={{
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '14px 16px',
      }}>
        <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 10 }}>
          Per-Agent Cost Breakdown
        </div>
        {company.employees.map(emp => {
          const agentCost = agentCosts.get(emp.id) ?? 0;
          return (
            <div key={emp.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 0', borderBottom: '1px solid #0a0e14',
            }}>
              <div style={{ width: 5, height: 5, background: emp.color, flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', flex: 1 }}>
                {emp.role}
              </span>
              <span style={{ fontSize: 'var(--font-sm)', color: agentCost > 0 ? '#c084fc' : '#2a3a50' }}>
                {agentCost > 0 ? `$${agentCost.toFixed(4)}` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

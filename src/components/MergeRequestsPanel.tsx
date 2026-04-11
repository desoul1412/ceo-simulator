import { useEffect, useState, useCallback } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { fetchMergeRequests, mergeMR, rejectMR } from '../lib/orchestratorApi';
import type { Company } from '../store/dashboardStore';

interface MergeRequest {
  id: string;
  branch_name: string;
  target_branch: string;
  agent_id: string | null;
  status: string;
  files_changed: number;
  insertions: number;
  deletions: number;
  title: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: '#ff8800',
  approved: '#00ff88',
  merged: '#00ffff',
  rejected: '#ff2244',
};

const ROLE_COLORS: Record<string, string> = {
  CEO: '#00ffff', PM: '#c084fc', DevOps: '#00ff88', Frontend: '#ff8800',
  Backend: '#3b82f6', QA: '#ef4444', Designer: '#f59e0b',
};

interface MergeRequestsPanelProps {
  company: Company;
}

export function MergeRequestsPanel({ company }: MergeRequestsPanelProps) {
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const [mrs, setMrs] = useState<MergeRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orchestratorConnected) return;
    const data = await fetchMergeRequests(company.id);
    setMrs(data);
  }, [company.id, orchestratorConnected]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  const handleMerge = async (mrId: string) => {
    setLoading(true);
    await mergeMR(mrId);
    await load();
    setLoading(false);
  };

  const handleReject = async (mrId: string) => {
    setLoading(true);
    await rejectMR(mrId);
    await load();
    setLoading(false);
  };

  if (!orchestratorConnected || mrs.length === 0) return null;

  const agentRole = (agentId: string | null) => {
    if (!agentId) return null;
    return company.employees.find(e => e.id === agentId)?.role ?? null;
  };

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid var(--hud-border)',
      fontFamily: 'var(--font-hud)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '6px 10px',
        borderBottom: '1px solid var(--hud-border)',
        background: '#090d14',
      }}>
        <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Merge Requests
          <span style={{ color: 'var(--neon-orange)', marginLeft: 6 }}>
            ({mrs.filter(m => m.status === 'open').length} open)
          </span>
        </span>
      </div>

      <div style={{ maxHeight: 220, overflow: 'auto', padding: '4px 8px' }}>
        {mrs.map(mr => {
          const role = agentRole(mr.agent_id);
          const color = STATUS_COLORS[mr.status] ?? '#4a5568';
          return (
            <div key={mr.id} style={{
              padding: '6px 0', borderBottom: '1px solid #0a0e14',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                {role && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: ROLE_COLORS[role] ?? '#4a5568',
                    boxShadow: `0 0 4px ${ROLE_COLORS[role] ?? '#4a5568'}`,
                    flexShrink: 0,
                  }} />
                )}
                <span style={{ fontSize: 'var(--font-xs)', color: '#8090a8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mr.branch_name}
                </span>
                <span style={{
                  fontSize: '10px', padding: '1px 6px',
                  background: `${color}18`, border: `1px solid ${color}40`,
                  color, textTransform: 'uppercase',
                }}>
                  {mr.status}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', marginBottom: 4 }}>
                <span>{mr.files_changed} files</span>
                <span style={{ color: '#00ff88' }}>+{mr.insertions}</span>
                <span style={{ color: '#ff2244' }}>-{mr.deletions}</span>
              </div>

              {mr.status === 'open' && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => handleMerge(mr.id)}
                    disabled={loading}
                    style={{
                      padding: '2px 10px', fontSize: 'var(--font-xs)',
                      background: '#00ffff10', border: '1px solid #00ffff30',
                      color: 'var(--neon-cyan)', cursor: 'pointer', fontFamily: 'var(--font-hud)',
                    }}
                  >
                    Merge to Main
                  </button>
                  <button
                    onClick={() => handleReject(mr.id)}
                    disabled={loading}
                    style={{
                      padding: '2px 10px', fontSize: 'var(--font-xs)',
                      background: '#ff224418', border: '1px solid #ff224440',
                      color: '#ff2244', cursor: 'pointer', fontFamily: 'var(--font-hud)',
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

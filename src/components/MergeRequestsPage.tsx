import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import {
  fetchMergeRequests,
  mergeMR,
  rejectMR,
  getMRDiff,
} from '../lib/orchestratorApi';

interface MR {
  id: string;
  branch_name: string;
  target_branch: string;
  title: string;
  description: string | null;
  status: string;
  files_changed: number;
  insertions: number;
  deletions: number;
  diff_summary: string | null;
  agent_id: string | null;
  ticket_id: string | null;
  reviewed_by: string | null;
  merged_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: '#ff8800',
  reviewing: '#c084fc',
  approved: '#00ff88',
  merged: '#00ffff',
  rejected: '#ff2244',
  conflicted: '#ff2244',
};

const STATUS_ICONS: Record<string, string> = {
  open: '○',
  reviewing: '◇',
  approved: '✓',
  merged: '◆',
  rejected: '×',
  conflicted: '⚠',
};

export function MergeRequestsPage() {
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const company = companies.find(c => c.id === companyId);
  const [mrs, setMrs] = useState<MR[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !orchestratorConnected) return;
    const data = await fetchMergeRequests(companyId);
    setMrs(data);
  }, [companyId, orchestratorConnected]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!orchestratorConnected) return;
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [load, orchestratorConnected]);

  const handleViewDiff = async (mrId: string) => {
    if (diffContent[mrId]) {
      setExpandedId(expandedId === mrId ? null : mrId);
      return;
    }
    const data = await getMRDiff(mrId);
    setDiffContent(prev => ({ ...prev, [mrId]: data.diff || 'No diff available' }));
    setExpandedId(mrId);
  };

  const handleMerge = async (mrId: string) => {
    if (!confirm('Merge this branch to main?')) return;
    setLoading(mrId);
    const result = await mergeMR(mrId);
    if (result.error) alert(`Merge failed: ${result.error}`);
    await load();
    setLoading(null);
  };

  const handleReject = async (mrId: string) => {
    if (!confirm('Reject this merge request?')) return;
    setLoading(mrId);
    await rejectMR(mrId);
    await load();
    setLoading(null);
  };

  const handleRevert = async (mrId: string) => {
    const mr = mrs.find(m => m.id === mrId);
    if (!mr) return;
    if (!confirm(`Revert "${mr.branch_name}"? This will create a revert commit on main.`)) return;
    setLoading(mrId);
    const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';
    const res = await fetch(`${ORCHESTRATOR_URL}/api/merge-requests/${mrId}/revert`, { method: 'POST' });
    const result = await res.json();
    if (result.error) alert(`Revert failed: ${result.error}`);
    await load();
    setLoading(null);
  };

  const agentName = (agentId: string | null) => {
    if (!agentId || !company) return '?';
    const agent = company.employees.find(e => e.id === agentId);
    return agent ? `${agent.role} (${agent.name})` : '?';
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  const openMRs = mrs.filter(m => m.status === 'open' || m.status === 'reviewing' || m.status === 'approved');
  const mergedMRs = mrs.filter(m => m.status === 'merged');
  const otherMRs = mrs.filter(m => m.status === 'rejected' || m.status === 'conflicted');

  return (
    <div style={{ padding: 'var(--pad)', fontFamily: 'var(--font-hud)', height: '100%', overflow: 'auto' }}>
      <div style={{
        fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 12,
      }}>
        {company.name} — Merge Requests ({mrs.length})
      </div>

      {!orchestratorConnected && (
        <div style={{ fontSize: 'var(--font-sm)', color: '#2a3a50', fontStyle: 'italic', padding: '20px 0' }}>
          Start the orchestrator to manage merge requests.
        </div>
      )}

      {mrs.length === 0 && orchestratorConnected && (
        <div style={{ fontSize: 'var(--font-sm)', color: '#2a3a50', fontStyle: 'italic', padding: '20px 0' }}>
          No merge requests yet. Approve tickets on the Board — agents will create branches and MRs.
        </div>
      )}

      {/* Open MRs */}
      {openMRs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-orange)', marginBottom: 8, textTransform: 'uppercase' }}>
            Open ({openMRs.length})
          </div>
          {openMRs.map(mr => renderMR(mr))}
        </div>
      )}

      {/* Merged MRs */}
      {mergedMRs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-cyan)', marginBottom: 8, textTransform: 'uppercase' }}>
            Merged ({mergedMRs.length})
          </div>
          {mergedMRs.map(mr => renderMR(mr))}
        </div>
      )}

      {/* Rejected/Conflicted */}
      {otherMRs.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--neon-red)', marginBottom: 8, textTransform: 'uppercase' }}>
            Closed ({otherMRs.length})
          </div>
          {otherMRs.map(mr => renderMR(mr))}
        </div>
      )}
    </div>
  );

  function renderMR(mr: MR) {
    const isExpanded = expandedId === mr.id;
    const isLoading = loading === mr.id;
    const color = STATUS_COLORS[mr.status] ?? '#4a5568';
    const icon = STATUS_ICONS[mr.status] ?? '·';

    return (
      <div key={mr.id} style={{
        background: '#0d1117', border: `1px solid ${color}30`,
        marginBottom: 8, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          cursor: 'pointer',
        }} onClick={() => handleViewDiff(mr.id)}>
          <span style={{ color, fontSize: 'var(--font-md)', flexShrink: 0 }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', marginBottom: 2 }}>
              {mr.title}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>{mr.branch_name} → {mr.target_branch}</span>
              <span>{agentName(mr.agent_id)}</span>
              <span style={{ color: 'var(--neon-green)' }}>+{mr.insertions}</span>
              <span style={{ color: 'var(--neon-red)' }}>-{mr.deletions}</span>
              <span>{mr.files_changed} files</span>
              <span>{formatDate(mr.created_at)}</span>
            </div>
          </div>
          <span style={{
            fontSize: 'var(--font-xs)', color, textTransform: 'uppercase',
            padding: '2px 8px', border: `1px solid ${color}40`, background: `${color}10`,
          }}>
            {mr.status}
          </span>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 6, padding: '0 14px 10px 14px',
        }}>
          {(mr.status === 'open' || mr.status === 'approved') && (
            <>
              <button onClick={() => handleMerge(mr.id)} disabled={isLoading} style={{
                padding: '4px 12px', fontSize: 'var(--font-xs)',
                background: '#00ffff10', border: '1px solid #00ffff40',
                color: 'var(--neon-cyan)', cursor: 'pointer', fontFamily: 'var(--font-hud)',
              }}>
                {isLoading ? '...' : '◆ Merge to Main'}
              </button>
              <button onClick={() => handleReject(mr.id)} disabled={isLoading} style={{
                padding: '4px 12px', fontSize: 'var(--font-xs)',
                background: '#ff224410', border: '1px solid #ff224440',
                color: 'var(--neon-red)', cursor: 'pointer', fontFamily: 'var(--font-hud)',
              }}>
                × Reject
              </button>
            </>
          )}
          {mr.status === 'merged' && (
            <button onClick={() => handleRevert(mr.id)} disabled={isLoading} style={{
              padding: '4px 12px', fontSize: 'var(--font-xs)',
              background: '#ff880010', border: '1px solid #ff880040',
              color: 'var(--neon-orange)', cursor: 'pointer', fontFamily: 'var(--font-hud)',
            }}>
              {isLoading ? '...' : '↩ Revert'}
            </button>
          )}
          <span style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginLeft: 'auto' }}>
            ID: {mr.id.slice(0, 8)}
          </span>
        </div>

        {/* Expanded diff */}
        {isExpanded && diffContent[mr.id] && (
          <div style={{
            padding: '10px 14px', borderTop: '1px solid var(--hud-border)',
            background: '#05080f',
          }}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', marginBottom: 6, textTransform: 'uppercase' }}>
              Diff Summary
            </div>
            <pre style={{
              fontSize: 'var(--font-xs)', color: 'var(--hud-text)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              lineHeight: 1.5, margin: 0, fontFamily: 'var(--font-hud)',
            }}>
              {diffContent[mr.id]}
            </pre>
          </div>
        )}

        {/* Merged info */}
        {mr.merged_at && (
          <div style={{
            padding: '6px 14px', borderTop: '1px solid var(--hud-border)',
            fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)',
          }}>
            Merged: {formatDate(mr.merged_at)}
            {mr.reviewed_by && ` by ${mr.reviewed_by}`}
          </div>
        )}
      </div>
    );
  }
}

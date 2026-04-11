/**
 * AuditTrailPage — pixel RPG styled tool call audit log viewer.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AuditEntry {
  id: string;
  agent_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output_summary: string | null;
  cost_usd: number;
  latency_ms: number;
  blocked: boolean;
  block_reason: string | null;
  proof: string;
  created_at: string;
}

interface AuditSummary {
  totalCalls: number;
  blockedCalls: number;
  totalCostUsd: number;
  topTools: { tool: string; count: number }[];
}

export function AuditTrailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState({ toolName: '', blocked: '' });
  const [proofStatus, setProofStatus] = useState<{ valid: boolean; verified: number } | null>(null);

  const PAGE_SIZE = 25;

  const loadEntries = useCallback(async () => {
    if (!companyId) return;
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (filter.toolName) params.set('toolName', filter.toolName);
    if (filter.blocked) params.set('blocked', filter.blocked);

    const res = await fetch(`${API}/company/${companyId}/audit?${params}`);
    const data = await res.json();
    setEntries(data.entries ?? []);
    setTotal(data.total ?? 0);
  }, [companyId, page, filter]);

  const loadSummary = useCallback(async () => {
    if (!companyId) return;
    const res = await fetch(`${API}/company/${companyId}/audit/summary`);
    setSummary(await res.json());
  }, [companyId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const verifyChain = async () => {
    if (!companyId) return;
    const res = await fetch(`${API}/company/${companyId}/audit/verify`);
    setProofStatus(await res.json());
  };

  const cellStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderBottom: '1px solid #1a1a3a',
    fontSize: 9,
    fontFamily: '"VT323", monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 200,
  };

  return (
    <div style={{ padding: 20, color: '#c0c0c0', fontFamily: '"Press Start 2P", monospace' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 12, color: '#00ffd5', margin: 0 }}>AUDIT TRAIL</h1>
        <button
          onClick={verifyChain}
          style={{
            background: '#1a1a3a',
            color: '#00ffd5',
            border: '2px solid #00ffd5',
            padding: '6px 12px',
            fontFamily: 'inherit',
            fontSize: 8,
            cursor: 'pointer',
          }}
        >
          VERIFY PROOF CHAIN
        </button>
      </div>

      {/* Proof chain status */}
      {proofStatus && (
        <div style={{
          padding: '8px 12px',
          marginBottom: 12,
          border: `2px solid ${proofStatus.valid ? '#00ff88' : '#ff4444'}`,
          fontSize: 8,
          color: proofStatus.valid ? '#00ff88' : '#ff4444',
        }}>
          {proofStatus.valid
            ? `CHAIN VALID — ${proofStatus.verified} entries verified`
            : `CHAIN BROKEN at entry ${(proofStatus as any).brokenAt}`}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <StatCard label="TOTAL CALLS" value={summary.totalCalls} color="#00ffd5" />
          <StatCard label="BLOCKED" value={summary.blockedCalls} color="#ff4444" />
          <StatCard label="COST" value={`$${summary.totalCostUsd.toFixed(2)}`} color="#ffaa00" />
          <StatCard label="TOP TOOL" value={summary.topTools[0]?.tool ?? '-'} color="#aa88ff" />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Filter tool..."
          value={filter.toolName}
          onChange={(e) => { setFilter(f => ({ ...f, toolName: e.target.value })); setPage(0); }}
          style={{
            background: '#0a0a1a', border: '1px solid #333', color: '#00ffd5',
            padding: '4px 8px', fontFamily: '"VT323", monospace', fontSize: 11,
          }}
        />
        <select
          value={filter.blocked}
          onChange={(e) => { setFilter(f => ({ ...f, blocked: e.target.value })); setPage(0); }}
          style={{
            background: '#0a0a1a', border: '1px solid #333', color: '#00ffd5',
            padding: '4px 8px', fontFamily: '"VT323", monospace', fontSize: 11,
          }}
        >
          <option value="">All</option>
          <option value="true">Blocked</option>
          <option value="false">Allowed</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '2px solid #1a1a3a' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#111127' }}>
              <th style={{ ...cellStyle, color: '#666', textAlign: 'left' }}>TIME</th>
              <th style={{ ...cellStyle, color: '#666', textAlign: 'left' }}>TOOL</th>
              <th style={{ ...cellStyle, color: '#666', textAlign: 'left' }}>AGENT</th>
              <th style={{ ...cellStyle, color: '#666', textAlign: 'right' }}>COST</th>
              <th style={{ ...cellStyle, color: '#666', textAlign: 'right' }}>MS</th>
              <th style={{ ...cellStyle, color: '#666', textAlign: 'center' }}>STATUS</th>
              <th style={{ ...cellStyle, color: '#666', textAlign: 'left' }}>OUTPUT</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ background: e.blocked ? 'rgba(255,0,0,0.05)' : 'transparent' }}>
                <td style={cellStyle}>{new Date(e.created_at).toLocaleTimeString()}</td>
                <td style={{ ...cellStyle, color: '#00ffd5' }}>{e.tool_name}</td>
                <td style={cellStyle}>{e.agent_id?.slice(0, 8) ?? '-'}</td>
                <td style={{ ...cellStyle, textAlign: 'right', color: '#ffaa00' }}>
                  {e.cost_usd > 0 ? `$${e.cost_usd.toFixed(4)}` : '-'}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{e.latency_ms || '-'}</td>
                <td style={{ ...cellStyle, textAlign: 'center', color: e.blocked ? '#ff4444' : '#00ff88' }}>
                  {e.blocked ? 'BLOCKED' : 'OK'}
                </td>
                <td style={{ ...cellStyle, color: '#888' }}>
                  {e.blocked ? e.block_reason : e.tool_output_summary?.slice(0, 60) ?? '-'}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: '#444', padding: 20 }}>
                  NO AUDIT ENTRIES
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            style={{
              background: '#1a1a3a', color: page === 0 ? '#333' : '#00ffd5',
              border: '1px solid #333', padding: '4px 12px', fontFamily: 'inherit', fontSize: 8, cursor: 'pointer',
            }}
          >
            PREV
          </button>
          <span style={{ fontSize: 8, color: '#666', lineHeight: '24px' }}>
            {page + 1} / {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage(p => p + 1)}
            style={{
              background: '#1a1a3a', color: (page + 1) * PAGE_SIZE >= total ? '#333' : '#00ffd5',
              border: '1px solid #333', padding: '4px 12px', fontFamily: 'inherit', fontSize: 8, cursor: 'pointer',
            }}
          >
            NEXT
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      border: `2px solid ${color}33`,
      padding: '10px 14px',
      minWidth: 100,
      background: '#0a0a1a',
    }}>
      <div style={{ fontSize: 7, color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color, fontFamily: '"VT323", monospace' }}>{value}</div>
    </div>
  );
}

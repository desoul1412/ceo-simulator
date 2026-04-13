import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';

const ORCHESTRATOR_URL = (() => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('orchestrator_url');
    if (stored) return stored;
  }
  return import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';
})();

interface BrainDoc {
  id: string;
  path: string;
  doc_type: string;
  company_id: string | null;
  agent_id: string | null;
  updated_at: string;
}

interface BrainDocFull extends BrainDoc {
  content: string;
}

const TYPE_ICONS: Record<string, string> = {
  soul: '◆', context: '●', memory: '▶', plan: '◇', wiki: '▣',
  changelog: '▤', index: '▦', summary: '▧', sprint: '▥', general: '·',
};

const TYPE_COLORS: Record<string, string> = {
  soul: '#c084fc', context: '#00ffff', memory: '#00ff88', plan: '#ff8800',
  wiki: '#3b82f6', changelog: '#4a5568', summary: '#f59e0b', sprint: '#ef4444',
};

export function DocumentsPage() {
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const company = companies.find(c => c.id === companyId);
  const [docs, setDocs] = useState<BrainDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<BrainDocFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const loadDocs = useCallback(async () => {
    if (!companyId) return;
    try {
      const params = new URLSearchParams();
      if (companyId) params.set('company_id', companyId);
      if (filter !== 'all') params.set('doc_type', filter);
      const res = await fetch(`${ORCHESTRATOR_URL}/api/brain/documents?${params}`);
      if (res.ok) setDocs(await res.json());
    } catch { /* offline */ }
  }, [companyId, filter]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleSelect = async (doc: BrainDoc) => {
    setLoading(true);
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/api/brain/documents/${doc.id}`);
      if (res.ok) {
        setSelectedDoc(await res.json());
      }
    } catch { /* */ }
    setLoading(false);
  };

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  // Group docs by path prefix (first directory segment)
  const groups = new Map<string, BrainDoc[]>();
  for (const doc of docs) {
    const parts = doc.path.split('/');
    const group = parts.length > 1 ? parts[0] : 'root';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(doc);
  }

  const docTypes = [...new Set(docs.map(d => d.doc_type))];

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-hud)', display: 'flex', gap: 12, height: 'calc(100% - 32px)' }}>
      {/* Sidebar */}
      <div style={{
        width: 300, flexShrink: 0,
        background: '#0d1117', border: '1px solid var(--hud-border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header + filter */}
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid var(--hud-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Documents ({docs.length})
          </span>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              background: '#05080f', border: '1px solid #1b2030', color: '#6a7a90',
              fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)', padding: '2px 6px',
            }}
          >
            <option value="all">All Types</option>
            {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Document list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {docs.length === 0 ? (
            <div style={{ padding: '20px 12px', fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic', textAlign: 'center' }}>
              No documents yet. Brain documents are created when agents work on tasks, plans are approved, or sprints complete.
            </div>
          ) : (
            [...groups.entries()].map(([group, groupDocs]) => (
              <div key={group}>
                <div style={{
                  padding: '6px 12px', fontSize: 'var(--font-xs)', color: '#4a5568',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderBottom: '1px solid #0a0e14', background: '#090d14',
                }}>
                  {group}/
                </div>
                {groupDocs.map(doc => {
                  const filename = doc.path.split('/').pop() ?? doc.path;
                  const isSelected = selectedDoc?.id === doc.id;
                  const color = TYPE_COLORS[doc.doc_type] ?? '#4a5568';
                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleSelect(doc)}
                      style={{
                        padding: '5px 12px 5px 20px',
                        cursor: 'pointer',
                        background: isSelected ? '#1b203080' : 'transparent',
                        borderLeft: isSelected ? `2px solid ${color}` : '2px solid transparent',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span style={{ color, fontSize: 'var(--font-xs)', flexShrink: 0 }}>
                        {TYPE_ICONS[doc.doc_type] ?? '·'}
                      </span>
                      <span style={{
                        fontSize: 'var(--font-xs)',
                        color: isSelected ? '#fff' : '#8090a8',
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {filename}
                      </span>
                      <span style={{ fontSize: 10, color: '#2a3a50' }}>
                        {doc.doc_type}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Document viewer */}
      <div style={{
        flex: 1, background: '#0d1117', border: '1px solid var(--hud-border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 20, fontSize: 'var(--font-sm)', color: 'var(--neon-cyan)', fontStyle: 'italic' }}>
            Loading...
          </div>
        ) : selectedDoc ? (
          <>
            {/* Doc header */}
            <div style={{
              padding: '8px 16px', borderBottom: '1px solid var(--hud-border)',
              display: 'flex', alignItems: 'center', gap: 8, background: '#090d14', flexShrink: 0,
            }}>
              <span style={{ color: TYPE_COLORS[selectedDoc.doc_type] ?? '#4a5568', fontSize: 'var(--font-sm)' }}>
                {TYPE_ICONS[selectedDoc.doc_type] ?? '·'}
              </span>
              <span style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', flex: 1 }}>
                {selectedDoc.path}
              </span>
              <span style={{
                fontSize: 'var(--font-xs)', color: TYPE_COLORS[selectedDoc.doc_type] ?? '#4a5568',
                padding: '2px 8px', border: `1px solid ${TYPE_COLORS[selectedDoc.doc_type] ?? '#4a5568'}30`,
                textTransform: 'uppercase',
              }}>
                {selectedDoc.doc_type}
              </span>
              <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>
                {new Date(selectedDoc.updated_at).toLocaleString()}
              </span>
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              <pre style={{
                fontSize: 'var(--font-sm)', color: '#c0d0e0',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                lineHeight: 1.7, margin: 0,
                fontFamily: 'var(--font-hud)',
              }}>
                {selectedDoc.content}
              </pre>
            </div>
          </>
        ) : (
          <div style={{
            fontSize: 'var(--font-sm)', color: '#2a3a50', fontStyle: 'italic',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%',
          }}>
            Select a document to view. Brain content is stored in PostgreSQL.
          </div>
        )}
      </div>
    </div>
  );
}

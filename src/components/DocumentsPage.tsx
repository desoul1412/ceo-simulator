import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';

interface DocItem {
  name: string;
  path?: string;
  type: 'file' | 'dir';
  children?: DocItem[];
}

export function DocumentsPage() {
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const company = companies.find(c => c.id === companyId);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  // Document tree structure (mirrors brain/ vault)
  const docTree: DocItem[] = [
    { name: '00-Index.md', path: 'brain/00-Index.md', type: 'file' },
    { name: 'changelog.md', path: 'brain/changelog.md', type: 'file' },
    { name: 'wiki/', type: 'dir', children: [
      { name: 'Factory-Operations-Manual.md', path: 'brain/wiki/Factory-Operations-Manual.md', type: 'file' },
      { name: 'Office-Simulator-Architecture.md', path: 'brain/wiki/Office-Simulator-Architecture.md', type: 'file' },
      { name: 'UI-Design-System.md', path: 'brain/wiki/UI-Design-System.md', type: 'file' },
    ]},
    { name: 'raw/', type: 'dir', children: [
      { name: 'asset-TODO.md', path: 'brain/raw/asset-TODO.md', type: 'file' },
    ]},
    { name: 'agents/', type: 'dir', children: [] },
  ];

  const handleSelect = async (path: string) => {
    setSelectedPath(path);
    setLoading(true);
    try {
      const res = await fetch(`/${path}`);
      if (res.ok) {
        const text = await res.text();
        setContent(text);
      } else {
        setContent(`Error loading file: ${res.status} ${res.statusText}`);
      }
    } catch {
      setContent('Failed to load file. The file may not be served by the dev server.');
    }
    setLoading(false);
  };

  const renderItem = (item: DocItem, depth = 0) => (
    <div key={item.name}>
      <div
        onClick={() => item.type === 'file' && item.path && handleSelect(item.path)}
        style={{
          padding: '5px 0', fontSize: 'var(--font-xs)',
          paddingLeft: depth * 16,
          color: item.type === 'dir' ? '#6a7a90'
            : selectedPath === item.path ? '#fff' : 'var(--neon-cyan)',
          cursor: item.type === 'file' ? 'pointer' : 'default',
          background: selectedPath === item.path ? '#1b203080' : 'transparent',
        }}
      >
        {item.type === 'dir' ? '\u{1F4C1} ' : '\u{1F4C4} '}{item.name}
      </div>
      {item.type === 'dir' && item.children?.map(child => renderItem(child, depth + 1))}
    </div>
  );

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-hud)', display: 'flex', gap: 12, height: 'calc(100% - 32px)' }}>
      {/* Tree sidebar */}
      <div style={{
        width: 260, flexShrink: 0,
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '10px 12px', overflow: 'auto',
      }}>
        <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 8 }}>
          brain/ — Obsidian Vault
        </div>
        {docTree.map(item => renderItem(item))}
      </div>

      {/* Document viewer */}
      <div style={{
        flex: 1, background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '16px 20px', overflow: 'auto',
      }}>
        {loading ? (
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neon-cyan)', fontStyle: 'italic' }}>
            Loading...
          </div>
        ) : content !== null ? (
          <div>
            <div style={{
              fontSize: 'var(--font-xs)', color: '#4a5568', marginBottom: 12,
              textTransform: 'uppercase', borderBottom: '1px solid var(--hud-border)', paddingBottom: 8,
            }}>
              {selectedPath}
            </div>
            <pre style={{
              fontSize: 'var(--font-lg)', color: 'var(--hud-text)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              lineHeight: 1.7, margin: 0,
              fontFamily: 'var(--font-pixel)',
            }}>
              {content}
            </pre>
          </div>
        ) : (
          <div style={{
            fontSize: 'var(--font-sm)', color: '#2a3a50', fontStyle: 'italic',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%',
          }}>
            Select a document to view. Agents will write specs and memory here when working on tasks.
          </div>
        )}
      </div>
    </div>
  );
}

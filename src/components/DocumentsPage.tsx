import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';

export function DocumentsPage() {
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const company = companies.find(c => c.id === companyId);

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  // Document tree structure (mirrors brain/ vault)
  const docTree = [
    { name: '00-Index.md', path: 'brain/00-Index.md', type: 'file' as const },
    { name: 'changelog.md', path: 'brain/changelog.md', type: 'file' as const },
    { name: 'wiki/', type: 'dir' as const, children: [
      { name: 'Factory-Operations-Manual.md', path: 'brain/wiki/Factory-Operations-Manual.md' },
      { name: 'Office-Simulator-Architecture.md', path: 'brain/wiki/Office-Simulator-Architecture.md' },
      { name: 'UI-Design-System.md', path: 'brain/wiki/UI-Design-System.md' },
    ]},
    { name: 'raw/', type: 'dir' as const, children: [
      { name: 'asset-TODO.md', path: 'brain/raw/asset-TODO.md' },
    ]},
    { name: 'agents/', type: 'dir' as const, children: [] },
  ];

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-hud)', display: 'flex', gap: 12, height: 'calc(100% - 32px)' }}>
      {/* Tree sidebar */}
      <div style={{
        width: 220, flexShrink: 0,
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '10px 12px', overflow: 'auto',
      }}>
        <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', marginBottom: 8 }}>
          brain/ — Obsidian Vault
        </div>
        {docTree.map(item => (
          <div key={item.name}>
            <div style={{
              padding: '4px 0', fontSize: 10,
              color: item.type === 'dir' ? '#6a7a90' : 'var(--neon-cyan)',
              cursor: item.type === 'file' ? 'pointer' : 'default',
            }}>
              {item.type === 'dir' ? '📁 ' : '📄 '}{item.name}
            </div>
            {item.type === 'dir' && item.children?.map((child: any) => (
              <div key={child.name} style={{
                padding: '3px 0 3px 16px', fontSize: 9,
                color: 'var(--neon-cyan)', cursor: 'pointer',
              }}>
                📄 {child.name}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Document viewer */}
      <div style={{
        flex: 1, background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '16px 20px', overflow: 'auto',
      }}>
        <div style={{
          fontSize: 10, color: '#2a3a50', fontStyle: 'italic',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%',
        }}>
          Select a document to view. Agents will write specs and memory here when working on tasks.
        </div>
      </div>
    </div>
  );
}

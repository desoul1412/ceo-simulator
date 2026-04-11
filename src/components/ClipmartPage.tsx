/**
 * ClipmartPage — pixel RPG styled template marketplace.
 */

import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  version: string;
  downloads: number;
  rating: number;
  config: {
    agents: { name: string; role: string }[];
    defaultGoal?: string;
    budget?: number;
  };
}

const CATEGORIES = ['all', 'saas', 'ecommerce', 'gamedev', 'data', 'devtools', 'general'];

export function ClipmartPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [category, setCategory] = useState('all');
  const [importing, setImporting] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    const params = category !== 'all' ? `?category=${category}` : '';
    const res = await fetch(`${API}/clipmart${params}`);
    setTemplates(await res.json());
  }, [category]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleImport = async (template: Template) => {
    setImporting(template.id);
    try {
      const res = await fetch(`${API}/clipmart/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (data.companyId) {
        window.location.href = `/company/${data.companyId}`;
      }
    } catch {
      // Handle error
    } finally {
      setImporting(null);
    }
  };

  return (
    <div style={{ padding: 20, color: '#c0c0c0', fontFamily: '"Press Start 2P", monospace' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 14, color: '#ff00aa', margin: '0 0 8px 0' }}>CLIPMART</h1>
        <p style={{ fontSize: 8, color: '#666', margin: 0 }}>Company templates marketplace</p>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              background: category === cat ? '#ff00aa' : '#1a1a3a',
              color: category === cat ? '#0a0a1a' : '#666',
              border: `2px solid ${category === cat ? '#ff00aa' : '#333'}`,
              padding: '4px 10px',
              fontFamily: 'inherit',
              fontSize: 7,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {templates.map(t => (
          <div
            key={t.id}
            style={{
              border: '2px solid #1a1a3a',
              background: '#0a0a1a',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: '#00ffd5' }}>{t.name}</span>
              <span style={{ fontSize: 7, color: '#666' }}>v{t.version}</span>
            </div>

            <p style={{ fontSize: 8, color: '#888', margin: '0 0 8px 0', fontFamily: '"VT323", monospace', lineHeight: 1.4 }}>
              {t.description || 'No description'}
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 7, color: '#555' }}>
              <span>{t.config.agents?.length ?? 0} agents</span>
              <span>{t.downloads} downloads</span>
              <span>by {t.author}</span>
            </div>

            {/* Agent list */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              {(t.config.agents ?? []).slice(0, 4).map((a, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 7,
                    padding: '2px 6px',
                    border: '1px solid #333',
                    color: '#aa88ff',
                  }}
                >
                  {a.role}
                </span>
              ))}
            </div>

            <button
              onClick={() => handleImport(t)}
              disabled={importing === t.id}
              style={{
                width: '100%',
                background: importing === t.id ? '#333' : '#ff00aa',
                color: '#0a0a1a',
                border: '2px solid #ff00aa',
                padding: '6px',
                fontFamily: 'inherit',
                fontSize: 8,
                cursor: importing === t.id ? 'wait' : 'pointer',
              }}
            >
              {importing === t.id ? 'IMPORTING...' : '> DEPLOY'}
            </button>
          </div>
        ))}

        {templates.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: '#333', fontSize: 9 }}>
            NO TEMPLATES AVAILABLE
          </div>
        )}
      </div>
    </div>
  );
}

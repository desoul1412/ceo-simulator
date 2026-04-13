import { useEffect, useState, useCallback } from 'react';
import {
  fetchLLMProviders, createLLMProvider, updateLLMProvider, deleteLLMProvider,
  fetchLLMModels, createLLMModel, updateLLMModel, deleteLLMModel,
  fetchGlobalRouting, setGlobalRouting,
} from '../lib/orchestratorApi';

interface Provider { id: string; slug: string; name: string; provider_type: string; config: any; is_active: boolean; }
interface Model { id: string; slug: string; name: string; model_id: string; tier: string; provider_id: string; provider?: Provider; supports_tools: boolean; is_active: boolean; cost_per_1k_input: number | null; cost_per_1k_output: number | null; }
interface RoutingEntry { id: string; model_id: string; priority: number; model?: Model; }

const TIER_COLORS: Record<string, string> = { fast: '#00ff88', mid: '#c084fc', premium: '#ff8800' };
const TYPE_LABELS: Record<string, string> = { sdk: 'SDK (filesystem)', http: 'HTTP (text only)' };

export function LLMSettings() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [routing, setRouting] = useState<RoutingEntry[]>([]);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddModel, setShowAddModel] = useState<string | null>(null);
  const [newP, setNewP] = useState({ slug: '', name: '', provider_type: 'http', config: '{}' });
  const [newM, setNewM] = useState({ slug: '', name: '', model_id: '', tier: 'mid', cost_in: '', cost_out: '' });

  const load = useCallback(async () => {
    const [p, m, r] = await Promise.all([fetchLLMProviders(), fetchLLMModels(), fetchGlobalRouting()]);
    setProviders(p); setModels(m); setRouting(r);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddProvider = async () => {
    if (!newP.slug || !newP.name) return;
    let config = {};
    try { config = JSON.parse(newP.config); } catch { /* */ }
    await createLLMProvider({ slug: newP.slug, name: newP.name, provider_type: newP.provider_type, config });
    setShowAddProvider(false); setNewP({ slug: '', name: '', provider_type: 'http', config: '{}' });
    load();
  };

  const handleAddModel = async (providerId: string) => {
    if (!newM.slug || !newM.name || !newM.model_id) return;
    await createLLMModel({
      provider_id: providerId, slug: newM.slug, name: newM.name, model_id: newM.model_id,
      tier: newM.tier,
      cost_per_1k_input: newM.cost_in ? Number(newM.cost_in) : null,
      cost_per_1k_output: newM.cost_out ? Number(newM.cost_out) : null,
    });
    setShowAddModel(null); setNewM({ slug: '', name: '', model_id: '', tier: 'mid', cost_in: '', cost_out: '' });
    load();
  };

  const handleToggleModel = async (m: Model) => {
    await updateLLMModel(m.id, { is_active: !m.is_active });
    load();
  };

  const handleDeleteModel = async (id: string) => {
    if (!confirm('Delete this model?')) return;
    await deleteLLMModel(id);
    load();
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Delete this provider and all its models?')) return;
    await deleteLLMProvider(id);
    load();
  };

  // Routing: add model to global chain
  const addToRouting = async (modelId: string) => {
    const updated = [...routing.map(r => ({ model_id: r.model_id ?? (r.model as any)?.id, priority: r.priority })), { model_id: modelId, priority: routing.length }];
    await setGlobalRouting(updated);
    load();
  };

  const removeFromRouting = async (modelId: string) => {
    const updated = routing
      .filter(r => (r.model_id ?? (r.model as any)?.id) !== modelId)
      .map((r, i) => ({ model_id: r.model_id ?? (r.model as any)?.id, priority: i }));
    await setGlobalRouting(updated);
    load();
  };

  const moveRouting = async (idx: number, dir: -1 | 1) => {
    const arr = [...routing];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    await setGlobalRouting(arr.map((r, i) => ({ model_id: r.model_id ?? (r.model as any)?.id, priority: i })));
    load();
  };

  const inputStyle: React.CSSProperties = {
    background: '#05080f', border: '1px solid #1b2030', color: '#e0eaf4',
    fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)', padding: '5px 8px', width: '100%', boxSizing: 'border-box',
  };
  const btnStyle = (color: string): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 'var(--font-xs)', background: `${color}15`,
    border: `1px solid ${color}40`, color, cursor: 'pointer',
    fontFamily: 'var(--font-hud)', textTransform: 'uppercase',
  });

  return (
    <div>
      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', marginBottom: 16 }}>LLM Providers & Models</div>

      {/* ── Providers + Models ─────────────────────────────────────── */}
      {providers.map(p => (
        <div key={p.id} style={{ marginBottom: 16, background: '#090d14', border: '1px solid #1b2030', overflow: 'hidden' }}>
          {/* Provider header */}
          <div style={{
            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
            borderBottom: '1px solid #1b2030',
          }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--neon-cyan)', fontWeight: 600, flex: 1 }}>{p.name}</span>
            <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>{TYPE_LABELS[p.provider_type] ?? p.provider_type}</span>
            <span style={{ fontSize: 'var(--font-xs)', color: '#2a3a50' }}>{p.slug}</span>
            <button onClick={() => handleDeleteProvider(p.id)} style={btnStyle('#ff2244')}>Del</button>
          </div>

          {/* Models list */}
          <div style={{ padding: '6px 12px' }}>
            {models.filter(m => m.provider_id === p.id).map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                borderBottom: '1px solid #0a0e14', opacity: m.is_active ? 1 : 0.4,
              }}>
                <span style={{
                  fontSize: 'var(--font-xs)', color: TIER_COLORS[m.tier] ?? '#4a5568',
                  padding: '1px 6px', border: `1px solid ${TIER_COLORS[m.tier] ?? '#4a5568'}40`,
                  textTransform: 'uppercase',
                }}>{m.tier}</span>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-h)', flex: 1 }}>{m.name}</span>
                <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>{m.model_id}</span>
                {m.cost_per_1k_input != null && (
                  <span style={{ fontSize: 10, color: '#2a3a50' }}>
                    ${m.cost_per_1k_input}/1k in · ${m.cost_per_1k_output}/1k out
                  </span>
                )}
                <button onClick={() => handleToggleModel(m)} style={btnStyle(m.is_active ? '#4a5568' : '#00ff88')}>
                  {m.is_active ? 'Disable' : 'Enable'}
                </button>
                {/* Add to routing */}
                {!routing.some(r => (r.model_id ?? (r.model as any)?.id) === m.id) && m.is_active && (
                  <button onClick={() => addToRouting(m.id)} style={btnStyle('#c084fc')}>+ Route</button>
                )}
                <button onClick={() => handleDeleteModel(m.id)} style={btnStyle('#ff2244')}>×</button>
              </div>
            ))}

            {/* Add model button */}
            {showAddModel === p.id ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <input value={newM.name} onChange={e => setNewM(v => ({ ...v, name: e.target.value }))} placeholder="Display name" style={{ ...inputStyle, width: 120 }} />
                <input value={newM.model_id} onChange={e => setNewM(v => ({ ...v, model_id: e.target.value, slug: e.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase() }))} placeholder="model-id" style={{ ...inputStyle, width: 150 }} />
                <select value={newM.tier} onChange={e => setNewM(v => ({ ...v, tier: e.target.value }))} style={{ ...inputStyle, width: 70 }}>
                  <option value="fast">Fast</option><option value="mid">Mid</option><option value="premium">Premium</option>
                </select>
                <input value={newM.cost_in} onChange={e => setNewM(v => ({ ...v, cost_in: e.target.value }))} placeholder="$/1k in" style={{ ...inputStyle, width: 70 }} />
                <input value={newM.cost_out} onChange={e => setNewM(v => ({ ...v, cost_out: e.target.value }))} placeholder="$/1k out" style={{ ...inputStyle, width: 70 }} />
                <button onClick={() => handleAddModel(p.id)} style={btnStyle('#00ff88')}>Add</button>
                <button onClick={() => setShowAddModel(null)} style={btnStyle('#ff2244')}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowAddModel(p.id)} style={{ ...btnStyle('#00ffff'), marginTop: 6 }}>+ Add Model</button>
            )}
          </div>
        </div>
      ))}

      {/* Add provider */}
      {showAddProvider ? (
        <div style={{ background: '#090d14', border: '1px solid #1b2030', padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 8 }}>New Provider</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={newP.name} onChange={e => setNewP(v => ({ ...v, name: e.target.value, slug: e.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase() }))} placeholder="Name (e.g. OpenRouter)" style={{ ...inputStyle, width: 150 }} />
            <select value={newP.provider_type} onChange={e => setNewP(v => ({ ...v, provider_type: e.target.value }))} style={{ ...inputStyle, width: 120 }}>
              <option value="http">HTTP (text only)</option><option value="sdk">SDK (filesystem)</option>
            </select>
            <input value={newP.config} onChange={e => setNewP(v => ({ ...v, config: e.target.value }))} placeholder='{"api_key": "..."}' style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
            <button onClick={handleAddProvider} style={btnStyle('#00ff88')}>Create</button>
            <button onClick={() => setShowAddProvider(false)} style={btnStyle('#ff2244')}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddProvider(true)} style={{ ...btnStyle('#00ffff'), marginBottom: 16 }}>+ Add Provider</button>
      )}

      {/* ── Global Routing Chain ─────────────────────────────────── */}
      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', marginBottom: 8, marginTop: 16 }}>Global Routing (Priority Order)</div>
      <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginBottom: 8 }}>
        Models are tried in order. First success wins. Code tasks auto-filter to SDK providers.
      </div>
      <div style={{ background: '#090d14', border: '1px solid #1b2030', padding: '8px 12px' }}>
        {routing.length === 0 ? (
          <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic', padding: 8 }}>
            No routing configured. Add models above and click "+ Route".
          </div>
        ) : routing.map((r, idx) => {
          const m = (r as any).model ?? models.find(mm => mm.id === r.model_id);
          if (!m) return null;
          const prov = providers.find(pp => pp.id === m.provider_id) ?? (m as any).provider;
          return (
            <div key={r.id ?? idx} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
              borderBottom: '1px solid #0a0e14',
            }}>
              <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568', width: 20, textAlign: 'center' }}>#{idx + 1}</span>
              <span style={{
                fontSize: 'var(--font-xs)', color: TIER_COLORS[m.tier] ?? '#4a5568',
                padding: '1px 5px', border: `1px solid ${TIER_COLORS[m.tier] ?? '#4a5568'}30`, textTransform: 'uppercase',
              }}>{m.tier}</span>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--hud-text-h)', flex: 1 }}>{m.name}</span>
              <span style={{ fontSize: 'var(--font-xs)', color: '#4a5568' }}>{prov?.name ?? '?'}</span>
              <span style={{ fontSize: 10, color: prov?.provider_type === 'sdk' ? '#00ff88' : '#ff8800' }}>
                {prov?.provider_type === 'sdk' ? 'SDK' : 'HTTP'}
              </span>
              <button onClick={() => moveRouting(idx, -1)} disabled={idx === 0} style={{ ...btnStyle('#4a5568'), opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
              <button onClick={() => moveRouting(idx, 1)} disabled={idx === routing.length - 1} style={{ ...btnStyle('#4a5568'), opacity: idx === routing.length - 1 ? 0.3 : 1 }}>▼</button>
              <button onClick={() => removeFromRouting(m.id)} style={btnStyle('#ff2244')}>×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

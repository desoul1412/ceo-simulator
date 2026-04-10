import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { ConfigManager } from './ConfigManager';
import { getRepoStatus, connectRepo, syncRepoApi, disconnectRepo, type RepoStatus } from '../lib/orchestratorApi';

const TABS = [
  { id: 'repo', label: 'Repository' },
  { id: 'skills', label: 'Skills' },
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'rules', label: 'Rules' },
];

export function ProjectSettings() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const companies = useDashboardStore(s => s.companies);
  const company = companies.find(c => c.id === companyId);

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') ?? 'skills';

  if (!company) return <div style={{ padding: 16, color: '#2a3a50' }}>Company not found</div>;

  const setTab = (t: string) => {
    navigate(`/company/${companyId}/settings?tab=${t}`, { replace: true });
  };

  return (
    <div style={{ padding: 16, fontFamily: 'var(--font-hud)', display: 'flex', gap: 12, height: 'calc(100% - 32px)' }}>
      {/* Tab sidebar */}
      <div style={{
        width: 160, flexShrink: 0,
        background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '10px 0',
      }}>
        <div style={{
          fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase',
          padding: '0 12px', marginBottom: 4, letterSpacing: '0.1em',
        }}>
          {company.name}
        </div>
        <div style={{
          fontSize: 'var(--font-xs)', color: '#2a3a50', padding: '0 12px', marginBottom: 8,
        }}>
          Project-level overrides
        </div>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'block', width: '100%',
              padding: '6px 12px', background: tab === t.id ? '#1b203060' : 'transparent',
              border: 'none', borderLeft: tab === t.id ? '2px solid var(--neon-cyan)' : '2px solid transparent',
              color: tab === t.id ? 'var(--neon-cyan)' : '#6a7a90',
              fontFamily: 'var(--font-hud)', fontSize: 'var(--font-sm)',
              textAlign: 'left', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            {t.label}
          </button>
        ))}

        <div style={{
          borderTop: '1px solid var(--hud-border)',
          marginTop: 8, paddingTop: 8,
        }}>
          <button
            onClick={() => navigate('/settings')}
            style={{
              display: 'block', width: '100%',
              padding: '6px 12px', background: 'transparent',
              border: 'none', borderLeft: '2px solid transparent',
              color: '#4a5568',
              fontFamily: 'var(--font-hud)', fontSize: 'var(--font-xs)',
              textAlign: 'left', cursor: 'pointer',
            }}
          >
            → Global Settings
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, background: '#0d1117', border: '1px solid var(--hud-border)',
        padding: '16px 20px', overflow: 'auto',
      }}>
        {tab === 'repo' && <RepoPanel companyId={companyId!} />}
        {tab === 'skills' && <ConfigManager type="skill" scope="company" scopeId={companyId} />}
        {tab === 'mcp' && <ConfigManager type="mcp_server" scope="company" scopeId={companyId} />}
        {tab === 'rules' && <ConfigManager type="rule" scope="company" scopeId={companyId} />}
      </div>
    </div>
  );
}

// ── Repo Connection Panel ────────────────────────────────────────────────────

function RepoPanel({ companyId }: { companyId: string }) {
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);
  const [repo, setRepo] = useState<RepoStatus | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRepo = async () => {
    if (!orchestratorConnected) return;
    const status = await getRepoStatus(companyId);
    setRepo(status);
    if (status.repo_url) setRepoUrl(status.repo_url);
    if (status.repo_branch) setBranch(status.repo_branch);
  };

  useEffect(() => { loadRepo(); }, [companyId, orchestratorConnected]);

  const handleConnect = async () => {
    if (!repoUrl.trim()) return;
    setLoading(true);
    await connectRepo(companyId, { repoUrl: repoUrl.trim(), branch, token: token || undefined });
    await loadRepo();
    setLoading(false);
  };

  const handleSync = async () => {
    setLoading(true);
    await syncRepoApi(companyId);
    await loadRepo();
    setLoading(false);
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect this repo? Agents will work in the default directory.')) return;
    setLoading(true);
    await disconnectRepo(companyId);
    setRepoUrl('');
    setToken('');
    await loadRepo();
    setLoading(false);
  };

  if (!orchestratorConnected) {
    return (
      <div>
        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', marginBottom: 8 }}>Repository Connection</div>
        <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', fontStyle: 'italic' }}>
          Start the orchestrator (npm run server) to connect repositories.
        </div>
      </div>
    );
  }

  const isConnected = repo?.repo_status === 'ready';
  const statusColor = repo?.repo_status === 'ready' ? '#00ff88'
    : repo?.repo_status === 'cloning' ? '#ff8800'
    : repo?.repo_status === 'error' ? '#ff2244' : '#4a5568';

  return (
    <div>
      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', marginBottom: 8 }}>Repository Connection</div>
      <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginBottom: 16 }}>
        Connect this company to a Git repository. Agents will read, write, and test code in this repo.
      </div>

      {/* Status */}
      {repo?.repo_url && (
        <div style={{
          background: '#090d14', border: `1px solid ${statusColor}30`,
          padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: statusColor, boxShadow: `0 0 4px ${statusColor}`,
            }} />
            <span style={{ fontSize: 'var(--font-xs)', color: statusColor, textTransform: 'uppercase' }}>
              {repo.repo_status}
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--hud-text-h)', wordBreak: 'break-all' }}>
            {repo.repo_url}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginTop: 4 }}>
            Branch: {repo.repo_branch} — Auth: {repo.git_auth_method}
          </div>
          {repo.repo_path && (
            <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginTop: 2 }}>
              Local: {repo.repo_path}
            </div>
          )}
          {repo.repo_last_synced_at && (
            <div style={{ fontSize: 'var(--font-xs)', color: '#2a3a50', marginTop: 2 }}>
              Last synced: {new Date(repo.repo_last_synced_at).toLocaleString()}
            </div>
          )}
          {repo.repo_error && (
            <div style={{ fontSize: 'var(--font-xs)', color: '#ff2244', marginTop: 4 }}>
              Error: {repo.repo_error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button onClick={handleSync} disabled={loading} style={{
              padding: '4px 12px', fontSize: 'var(--font-xs)',
              background: '#00ff8818', border: '1px solid #00ff8840',
              color: '#00ff88', cursor: 'pointer', fontFamily: 'var(--font-hud)',
            }}>
              {loading ? 'Syncing...' : '↻ Pull Latest'}
            </button>
            <button onClick={handleDisconnect} disabled={loading} style={{
              padding: '4px 12px', fontSize: 'var(--font-xs)',
              background: '#ff224418', border: '1px solid #ff224440',
              color: '#ff2244', cursor: 'pointer', fontFamily: 'var(--font-hud)',
            }}>
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Connect form */}
      {!isConnected && (
        <div style={{
          background: '#090d14', border: '1px solid var(--hud-border)',
          padding: '12px 14px',
        }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginBottom: 3 }}>GIT REPO URL</div>
            <input
              type="text"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/project.git"
              style={{
                width: '100%', padding: '6px 10px', fontSize: 'var(--font-sm)',
                background: '#0d1117', border: '1px solid #1b2030',
                color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginBottom: 3 }}>BRANCH</div>
              <input
                type="text"
                value={branch}
                onChange={e => setBranch(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 'var(--font-sm)',
                  background: '#0d1117', border: '1px solid #1b2030',
                  color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)',
                }}
              />
            </div>
            <div style={{ flex: 2 }}>
              <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginBottom: 3 }}>GITHUB PAT (optional)</div>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="ghp_xxxxx (for private repos)"
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 'var(--font-sm)',
                  background: '#0d1117', border: '1px solid #1b2030',
                  color: 'var(--hud-text-h)', fontFamily: 'var(--font-hud)',
                }}
              />
            </div>
          </div>
          <button onClick={handleConnect} disabled={loading || !repoUrl.trim()} style={{
            width: '100%', padding: '8px',
            background: '#00ffff18', border: '1px solid #00ffff40',
            color: 'var(--neon-cyan)', fontFamily: 'var(--font-hud)',
            fontSize: 'var(--font-sm)', textTransform: 'uppercase',
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1,
          }}>
            {loading ? 'Connecting...' : 'Connect Repository'}
          </button>
        </div>
      )}
    </div>
  );
}

import type { Agent, AgentStatus } from '../hooks/useAgentPolling';

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle:    '#4a5568',
  working: '#00ff88',
  meeting: '#00ffff',
  break:   '#ff8800',
};

function AgentRow({ agent }: { agent: Agent }) {
  const color = STATUS_COLOR[agent.status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #1b2030' }}>
      <div style={{ width: 8, height: 8, background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)', color: '#e0eaf4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {agent.name}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {agent.role}
        </div>
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)', color, textTransform: 'uppercase', letterSpacing: '0.05em', textShadow: `0 0 4px ${color}` }}>
        {agent.status}
      </div>
    </div>
  );
}

interface HudPanelProps {
  agents: Agent[];
  tick: number;
}

export function HudPanel({ agents, tick }: HudPanelProps) {
  const working = agents.filter(a => a.status === 'working').length;
  const productivity = Math.round((working / agents.length) * 100);

  return (
    <div style={{
      width: 200,
      background: '#0d1117',
      border: '1px solid #1b2030',
      boxShadow: '0 0 20px rgba(0,255,255,0.06)',
      fontFamily: 'monospace',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1b2030', background: '#090d14' }}>
        <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          CEO Simulator
        </div>
        <div style={{ fontSize: 'var(--font-md)', color: '#00ffff', textTransform: 'uppercase', letterSpacing: '0.05em', textShadow: '0 0 8px #00ffff' }}>
          HUD v1.0
        </div>
      </div>

      {/* KPIs */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1b2030' }}>
        <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
          Productivity
        </div>
        <div style={{ fontSize: 24, color: '#00ff88', textShadow: '0 0 10px #00ff88', lineHeight: 1 }}>
          {productivity}%
        </div>
        <div style={{ marginTop: 4, height: 4, background: '#1b2030', position: 'relative' }}>
          <div style={{ width: `${productivity}%`, height: '100%', background: '#00ff88', boxShadow: '0 0 6px #00ff88', transition: 'width 0.8s ease' }} />
        </div>
      </div>

      {/* Agents */}
      <div style={{ padding: '8px 12px', flex: 1 }}>
        <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Agents [{agents.length}]
        </div>
        {agents.map(agent => <AgentRow key={agent.id} agent={agent} />)}
      </div>

      {/* Tick counter */}
      <div style={{ padding: '6px 12px', borderTop: '1px solid #1b2030', background: '#090d14' }}>
        <div style={{ fontSize: 'var(--font-xs)', color: '#1e3060', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          TICK #{String(tick).padStart(5, '0')}
        </div>
      </div>
    </div>
  );
}

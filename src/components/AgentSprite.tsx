import type { Agent, AgentStatus } from '../hooks/useAgentPolling';

const TILE_SIZE = 32;

const STATUS_DOT: Record<AgentStatus, { color: string; char: string }> = {
  idle:    { color: '#4a5568', char: '◌' },
  working: { color: '#00ff88', char: '●' },
  meeting: { color: '#00ffff', char: '◈' },
  break:   { color: '#ff8800', char: '◉' },
};

interface AgentSpriteProps {
  agent: Agent;
}

export function AgentSprite({ agent }: AgentSpriteProps) {
  const { col, row, color, name, role, status } = agent;
  const dot = STATUS_DOT[status];

  return (
    <div
      data-agent-id={agent.id}
      data-agent-status={status}
      style={{
        position: 'absolute',
        left: col * TILE_SIZE,
        top: row * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
        transition: 'left 0.8s cubic-bezier(0.4,0,0.2,1), top 0.8s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 10,
        imageRendering: 'pixelated',
      }}
      title={`${name} (${role}) — ${status}`}
    >
      {/* Sprite image */}
      <img
        src="/assets/sprites/agent-1.svg"
        alt={name}
        width={TILE_SIZE}
        height={TILE_SIZE}
        style={{
          imageRendering: 'pixelated',
          filter: `drop-shadow(0 0 4px ${color}) hue-rotate(${hueForColor(color)}deg)`,
          display: 'block',
        }}
      />

      {/* Status badge */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          fontSize: 8,
          lineHeight: 1,
          color: dot.color,
          textShadow: `0 0 4px ${dot.color}`,
        }}
      >
        {dot.char}
      </span>
    </div>
  );
}

/** Approximate hue rotation so each agent's cyan sprite shifts to their team color */
function hueForColor(hex: string): number {
  const map: Record<string, number> = {
    '#00ffff': 0,    // cyan → no shift (CEO)
    '#00ff88': 150,  // cyan → green (Dev)
    '#ff8800': 210,  // cyan → orange (QA)
  };
  return map[hex] ?? 0;
}

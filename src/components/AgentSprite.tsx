import type { Agent, AgentStatus } from '../hooks/useAgentPolling';

const TILE_SIZE = 32;
const SPRITE_FRAMES = 4;

const STATUS_DOT: Record<AgentStatus, { color: string; char: string }> = {
  idle:    { color: '#4a5568', char: '◌' },
  working: { color: '#00ff88', char: '●' },
  meeting: { color: '#00ffff', char: '◈' },
  break:   { color: '#ff8800', char: '◉' },
};

// Each agent gets a unique walk-cycle animation name so they animate independently
const WALK_KEYFRAMES = `
@keyframes walk-cycle {
  from { background-position-x: 0px; }
  to   { background-position-x: -${TILE_SIZE * SPRITE_FRAMES}px; }
}
`;

// Inject keyframes once into the document
if (typeof document !== 'undefined') {
  const styleId = 'agent-sprite-keyframes';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = WALK_KEYFRAMES;
    document.head.appendChild(style);
  }
}

interface AgentSpriteProps {
  agent: Agent;
}

export function AgentSprite({ agent }: AgentSpriteProps) {
  const { col, row, color, name, role, status } = agent;
  const dot = STATUS_DOT[status];
  const isMoving = status !== 'idle';

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
      {/* Sprite — PNG sprite sheet with walk-cycle animation */}
      <div
        style={{
          width: TILE_SIZE,
          height: TILE_SIZE,
          backgroundImage: `url('/assets/sprites/agent-1.png')`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${TILE_SIZE * SPRITE_FRAMES}px ${TILE_SIZE}px`,
          imageRendering: 'pixelated',
          filter: `drop-shadow(0 0 4px ${color}) hue-rotate(${hueForColor(color)}deg)`,
          animation: isMoving
            ? `walk-cycle 0.5s steps(${SPRITE_FRAMES}) infinite`
            : 'none',
          backgroundPositionX: isMoving ? undefined : '0px',
          backgroundPositionY: '0px',
        }}
        role="img"
        aria-label={`${name} sprite`}
      />

      {/* Status badge */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          fontSize: 'var(--font-xs)',
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

/** Hue rotation to tint the shared sprite sheet to each agent's team color */
function hueForColor(hex: string): number {
  const map: Record<string, number> = {
    '#00ffff': 0,    // CEO — cyan (no shift)
    '#00ff88': 150,  // Backend Dev — green
    '#ff8800': 210,  // QA — orange
  };
  return map[hex] ?? 0;
}

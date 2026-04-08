import type { Employee, AgentStatus } from '../store/dashboardStore';
import { TILE_W, TILE_H } from '../utils/isoProjection';

const STATUS_BADGE: Record<AgentStatus, { color: string; char: string }> = {
  idle:    { color: '#4a5568', char: '◌' },
  working: { color: '#00ff88', char: '●' },
  meeting: { color: '#00ffff', char: '◈' },
  break:   { color: '#ff8800', char: '◉' },
};

interface IsometricCharacterProps {
  employee: Employee;
}

export function IsometricCharacter({ employee }: IsometricCharacterProps) {
  const { col, row, color, name, role, status } = employee;
  const badge = STATUS_BADGE[status];

  return (
    <div
      data-agent-id={employee.id}
      data-agent-role={role}
      data-agent-status={status}
      className="iso-character"
      style={{
        position: 'absolute',
        left: col * TILE_W,
        top: row * TILE_H,
        width: TILE_W,
        height: TILE_H,
        /* Reverse parent iso transforms so sprite faces camera */
        transform: 'rotateZ(45deg) rotateX(-60deg) translateZ(1px)',
        transition: 'left 1s cubic-bezier(0.4,0,0.2,1), top 1s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 10 + col + row,
        pointerEvents: 'auto',
      }}
      title={`${name} (${role}) — ${status}`}
    >
      {/* Sprite container */}
      <div
        style={{
          width: TILE_W,
          height: TILE_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Character body — pixel art placeholder rendered with CSS */}
        <div
          style={{
            width: 28,
            height: 36,
            background: `linear-gradient(to bottom, ${color} 0%, ${color} 35%, #1a2a4a 35%, #1a2a4a 100%)`,
            border: `2px solid ${color}`,
            borderRadius: '4px 4px 0 0',
            boxShadow: `0 0 8px ${color}40, inset 0 -8px 0 #162040`,
            imageRendering: 'pixelated',
            position: 'relative',
          }}
        >
          {/* Eyes */}
          <div style={{
            position: 'absolute', top: 6, left: 5,
            width: 4, height: 4, background: '#fff',
            boxShadow: `10px 0 0 #fff, 0 0 4px ${color}`,
          }} />
          {/* Role label */}
          <div style={{
            position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)',
            fontSize: 8, fontFamily: 'monospace', color: color,
            textShadow: `0 0 4px ${color}`, whiteSpace: 'nowrap',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            {role}
          </div>
        </div>

        {/* Status badge */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 2,
            right: 6,
            fontSize: 10,
            lineHeight: 1,
            color: badge.color,
            textShadow: `0 0 6px ${badge.color}`,
          }}
        >
          {badge.char}
        </span>
      </div>
    </div>
  );
}

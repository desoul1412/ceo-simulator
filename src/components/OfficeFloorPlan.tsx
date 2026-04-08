import { AgentSprite } from './AgentSprite';
import type { Agent } from '../hooks/useAgentPolling';

const COLS = 15;
const ROWS = 15;
const TILE_SIZE = 32;

type CellType = 'wall' | 'floor' | 'desk' | 'kitchen' | 'meeting';

// ── Build static 15×15 office map ────────────────────────────────────────────

function buildOfficeMap(): CellType[][] {
  const map: CellType[][] = Array.from({ length: ROWS }, () =>
    Array<CellType>(COLS).fill('floor')
  );

  // Border walls
  for (let c = 0; c < COLS; c++) { map[0][c] = 'wall'; map[14][c] = 'wall'; }
  for (let r = 0; r < ROWS; r++) { map[r][0] = 'wall'; map[r][14] = 'wall'; }

  // Desk rows: even cols 2–12 at rows 2, 5, 8
  for (const r of [2, 5, 8]) {
    for (let c = 2; c <= 12; c += 2) map[r][c] = 'desk';
  }

  // Meeting room: cols 1–4, rows 11–13
  for (let r = 11; r <= 13; r++) for (let c = 1; c <= 4; c++) map[r][c] = 'meeting';

  // Kitchen: cols 10–13, rows 11–13
  for (let r = 11; r <= 13; r++) for (let c = 10; c <= 13; c++) map[r][c] = 'kitchen';

  return map;
}

const OFFICE_MAP = buildOfficeMap();

// ── Tile visuals ──────────────────────────────────────────────────────────────

const TILE_BG: Record<CellType, string> = {
  wall:    '#08090e',
  floor:   '#0d1117',
  desk:    '#111c3a',
  kitchen: '#13120a',
  meeting: '#0a1318',
};

const TILE_BORDER: Record<CellType, string> = {
  wall:    '#12151e',
  floor:   '#161b22',
  desk:    '#1e2f60',
  kitchen: '#252208',
  meeting: '#103030',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function DeskIcon() {
  return (
    <img
      src="/assets/tiles/desk.svg"
      alt=""
      aria-hidden="true"
      width={TILE_SIZE}
      height={TILE_SIZE}
      style={{ position: 'absolute', inset: 0, imageRendering: 'pixelated' }}
    />
  );
}

function ZoneLabel({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        position: 'absolute',
        bottom: 1,
        left: 1,
        fontSize: 5,
        fontFamily: 'monospace',
        color,
        opacity: 0.6,
        lineHeight: 1,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        pointerEvents: 'none',
      }}
    >
      {text}
    </span>
  );
}

function TileCell({ type, col, row }: { type: CellType; col: number; row: number }) {
  return (
    <div
      data-cell-type={type}
      data-col={col}
      data-row={row}
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
        backgroundColor: TILE_BG[type],
        borderRight:  `1px solid ${TILE_BORDER[type]}`,
        borderBottom: `1px solid ${TILE_BORDER[type]}`,
        boxSizing: 'border-box',
        position: 'relative',
        imageRendering: 'pixelated',
      }}
    >
      {type === 'desk'    && <DeskIcon />}
      {type === 'meeting' && <ZoneLabel text="MTG" color="#00ffff" />}
      {type === 'kitchen' && <ZoneLabel text="KIT" color="#ff8800" />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface OfficeFloorPlanProps {
  agents: Agent[];
}

export function OfficeFloorPlan({ agents }: OfficeFloorPlanProps) {
  const totalWidth  = COLS * TILE_SIZE;
  const totalHeight = ROWS * TILE_SIZE;

  return (
    <div
      className="crt-overlay"
      style={{
        position: 'relative',
        width: totalWidth,
        height: totalHeight,
        border: '1px solid #1b2030',
        boxShadow: '0 0 20px rgba(0,255,255,0.08)',
        flexShrink: 0,
      }}
    >
      {/* Background tile grid */}
      <div
        data-testid="office-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`,
          gridTemplateRows:    `repeat(${ROWS}, ${TILE_SIZE}px)`,
          width: totalWidth,
          height: totalHeight,
          imageRendering: 'pixelated',
        }}
      >
        {OFFICE_MAP.map((row, r) =>
          row.map((cellType, c) => (
            <TileCell key={`${c}-${r}`} type={cellType} col={c} row={r} />
          ))
        )}
      </div>

      {/* Agent sprites (absolute, layered above grid) */}
      {agents.map(agent => (
        <AgentSprite key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

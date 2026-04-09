import { useMemo } from 'react';
import { IsometricCharacter } from './IsometricCharacter';
import { buildOfficeGrid, sortByDepth, TILE_W, TILE_H, GRID_COLS, GRID_ROWS } from '../utils/isoProjection';
import type { ZoneType } from '../utils/isoProjection';
import type { Company } from '../store/dashboardStore';

// ── Tile visuals ──────────────────────────────────────────────────────────────

const ZONE_BG: Record<ZoneType, string> = {
  'floor':         '#13171f',
  'ceo-desk':      '#111c3a',
  'pm-desk':       '#1a1040',
  'devops-desk':   '#0a1a18',
  'frontend-desk': '#1a1508',
  'meeting':       '#0a1318',
  'kitchen':       '#151208',
};

const ZONE_BORDER: Record<ZoneType, string> = {
  'floor':         '#1e2430',
  'ceo-desk':      '#1e3060',
  'pm-desk':       '#2a1860',
  'devops-desk':   '#104030',
  'frontend-desk': '#302a10',
  'meeting':       '#103030',
  'kitchen':       '#2a2208',
};

const DESK_ZONES = new Set<ZoneType>(['ceo-desk', 'pm-desk', 'devops-desk', 'frontend-desk']);

// ── Tile component ────────────────────────────────────────────────────────────

function IsoTile({ zone, col, row }: { zone: ZoneType; col: number; row: number }) {
  const isDesk = DESK_ZONES.has(zone);

  return (
    <div
      data-cell-type={zone}
      data-col={col}
      data-row={row}
      style={{
        width: TILE_W,
        height: TILE_H,
        backgroundColor: ZONE_BG[zone],
        border: `1px solid ${ZONE_BORDER[zone]}`,
        boxSizing: 'border-box',
        position: 'relative',
        imageRendering: 'pixelated',
      }}
    >
      {isDesk && (
        <img
          src="/assets/tiles/iso-desk.png"
          alt=""
          aria-hidden="true"
          width={TILE_W}
          height={TILE_H}
          style={{
            position: 'absolute',
            inset: 0,
            imageRendering: 'pixelated',
            display: 'block',
            opacity: 0.7,
          }}
        />
      )}
      {zone === 'meeting' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--font-xs)', fontFamily: 'monospace', color: '#00ffff30',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          MTG
        </div>
      )}
      {zone === 'kitchen' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--font-xs)', fontFamily: 'monospace', color: '#ff880030',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          BREAK
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface IsometricOfficeProps {
  company: Company;
}

export function IsometricOffice({ company }: IsometricOfficeProps) {
  const tiles = useMemo(() => buildOfficeGrid(), []);
  const sortedEmployees = useMemo(
    () => sortByDepth(company.employees),
    [company.employees]
  );

  const gridW = GRID_COLS * TILE_W;
  const gridH = GRID_ROWS * TILE_H;

  return (
    <div
      className="iso-viewport"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 500,
        perspective: 800,
        perspectiveOrigin: '50% 30%',
        overflow: 'visible',
      }}
    >
      <div
        className="iso-grid-wrapper"
        data-testid="iso-grid"
        style={{
          /* The isometric CSS 3D transform */
          transform: 'rotateX(60deg) rotateZ(-45deg)',
          transformStyle: 'preserve-3d',
          position: 'relative',
          width: gridW,
          height: gridH,
        }}
      >
        {/* Tile grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, ${TILE_W}px)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, ${TILE_H}px)`,
            width: gridW,
            height: gridH,
          }}
        >
          {tiles.map(({ col, row, zone }) => (
            <IsoTile key={`${col}-${row}`} zone={zone} col={col} row={row} />
          ))}
        </div>

        {/* Agent sprites — absolute, layered above tiles */}
        {sortedEmployees.map(emp => (
          <IsometricCharacter key={emp.id} employee={emp} />
        ))}
      </div>
    </div>
  );
}

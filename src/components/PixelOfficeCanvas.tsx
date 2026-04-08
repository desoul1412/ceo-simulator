import { useRef, useEffect, useState, useCallback } from 'react';
import { loadAllAssets, type LoadedAssets } from '../engine/assetLoader';
import {
  renderFrame,
  TILE_SIZE,
  CHAR_FRAMES_PER_ROW,
  type OfficeLayout,
  type CharacterRenderState,
  type CharDirection,
} from '../engine/canvasRenderer';
import { buildWalkableGrid, bfsPath, type WalkableGrid } from '../engine/pathfinding';
import type { Company, Employee } from '../store/dashboardStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const SCALE = 2;           // Render at 2x for crisp pixel art
const WALK_SPEED = 30;     // pixels per second (at native resolution)
const ANIM_FPS = 6;        // sprite animation frames per second

// ── Character index per role ──────────────────────────────────────────────────

const ROLE_CHAR_INDEX: Record<string, number> = {
  CEO: 0,
  PM: 1,
  DevOps: 2,
  Frontend: 3,
  Backend: 4,
  QA: 5,
};

// ── Seat positions (col, row) for each agent role in the default layout ──────
// Maps to desks in the default-layout-1.json
const ROLE_SEATS: Record<string, { col: number; row: number }> = {
  CEO:      { col: 3, row: 13 },   // left desk
  PM:       { col: 7, row: 13 },   // right desk
  DevOps:   { col: 5, row: 17 },   // lower-left
  Frontend: { col: 5, row: 19 },   // lower-right
};

const BREAK_POSITIONS = [
  { col: 15, row: 14 },  // sofa area
  { col: 15, row: 15 },
  { col: 14, row: 15 },
];

const IDLE_POSITIONS = [
  { col: 4, row: 15 },
  { col: 8, row: 15 },
  { col: 12, row: 12 },
  { col: 16, row: 12 },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentState {
  id: string;
  charIndex: number;
  tileCol: number;
  tileRow: number;
  pixelX: number;
  pixelY: number;
  targetCol: number;
  targetRow: number;
  path: [number, number][];
  pathIdx: number;
  direction: CharDirection;
  isWalking: boolean;
  frameIndex: number;
  frameTick: number;
  label: string;
  labelColor: string;
  speechBubble: string | null;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PixelOfficeCanvasProps {
  company: Company;
}

export function PixelOfficeCanvas({ company }: PixelOfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<LoadedAssets | null>(null);
  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [tileColors, setTileColors] = useState<(any | null)[]>([]);
  const walkableRef = useRef<WalkableGrid | null>(null);
  const agentsRef = useRef<Map<string, AgentState>>(new Map());
  const companyRef = useRef(company);
  companyRef.current = company;

  // ── Load assets + layout ────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      loadAllAssets(),
      fetch('/assets/default-layout-1.json').then(r => r.json()),
    ]).then(([loadedAssets, layoutData]) => {
      setAssets(loadedAssets);
      const officeLayout: OfficeLayout = {
        cols: layoutData.cols,
        rows: layoutData.rows,
        tiles: layoutData.tiles,
        furniture: layoutData.furniture || [],
      };
      setLayout(officeLayout);
      setTileColors(layoutData.tileColors || []);
      walkableRef.current = buildWalkableGrid(
        layoutData.tiles, layoutData.cols, layoutData.rows
      );
    });
  }, []);

  // ── Sync employees → agent render states ────────────────────────────────
  const syncAgents = useCallback((employees: Employee[]) => {
    const map = agentsRef.current;
    const grid = walkableRef.current;

    for (const emp of employees) {
      let agent = map.get(emp.id);
      if (!agent) {
        // Initialize new agent at their desk
        const seat = ROLE_SEATS[emp.role] ?? pickRandom(IDLE_POSITIONS);
        agent = {
          id: emp.id,
          charIndex: ROLE_CHAR_INDEX[emp.role] ?? 0,
          tileCol: seat.col,
          tileRow: seat.row,
          pixelX: seat.col * TILE_SIZE,
          pixelY: seat.row * TILE_SIZE,
          targetCol: seat.col,
          targetRow: seat.row,
          path: [],
          pathIdx: 0,
          direction: 'down',
          isWalking: false,
          frameIndex: 0,
          frameTick: 0,
          label: emp.role,
          labelColor: emp.color,
          speechBubble: null,
        };
        map.set(emp.id, agent);
      }

      // Update target based on employee status
      let targetPos: { col: number; row: number };
      switch (emp.status) {
        case 'working':
          targetPos = ROLE_SEATS[emp.role] ?? { col: agent.tileCol, row: agent.tileRow };
          agent.speechBubble = emp.assignedTask
            ? emp.assignedTask.slice(0, 25)
            : 'Working...';
          break;
        case 'meeting':
          targetPos = { col: 5, row: 16 }; // meeting table area
          agent.speechBubble = 'In meeting';
          break;
        case 'break':
          targetPos = pickRandom(BREAK_POSITIONS);
          agent.speechBubble = 'On break';
          break;
        default:
          targetPos = pickRandom(IDLE_POSITIONS);
          agent.speechBubble = null;
          break;
      }

      // If target changed, compute new path
      if (grid && (targetPos.col !== agent.targetCol || targetPos.row !== agent.targetRow)) {
        agent.targetCol = targetPos.col;
        agent.targetRow = targetPos.row;
        const newPath = bfsPath(
          grid,
          [agent.tileCol, agent.tileRow],
          [targetPos.col, targetPos.row]
        );
        if (newPath.length > 1) {
          agent.path = newPath;
          agent.pathIdx = 0;
          agent.isWalking = true;
        }
      }
    }
  }, []);

  // ── Game loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!assets || !layout) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Disable image smoothing for pixel art
    ctx.imageSmoothingEnabled = false;

    let lastTime = performance.now();
    let rafId: number;

    function loop(now: number) {
      const dt = (now - lastTime) / 1000; // seconds
      lastTime = now;

      // Sync company employees into agent states
      syncAgents(companyRef.current.employees);

      // Update agent positions (interpolate along BFS path)
      for (const agent of agentsRef.current.values()) {
        if (agent.isWalking && agent.path.length > 0) {
          const [targetC, targetR] = agent.path[agent.pathIdx];
          const targetPx = targetC * TILE_SIZE;
          const targetPy = targetR * TILE_SIZE;

          const dx = targetPx - agent.pixelX;
          const dy = targetPy - agent.pixelY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 1) {
            // Reached waypoint
            agent.pixelX = targetPx;
            agent.pixelY = targetPy;
            agent.tileCol = targetC;
            agent.tileRow = targetR;
            agent.pathIdx++;

            if (agent.pathIdx >= agent.path.length) {
              agent.isWalking = false;
              agent.path = [];
              agent.pathIdx = 0;
              agent.direction = 'down';
            }
          } else {
            // Move toward waypoint
            const speed = WALK_SPEED * dt;
            agent.pixelX += (dx / dist) * Math.min(speed, dist);
            agent.pixelY += (dy / dist) * Math.min(speed, dist);

            // Update direction
            if (Math.abs(dx) > Math.abs(dy)) {
              agent.direction = dx > 0 ? 'right' : 'right'; // 'left' handled by mirror
              if (dx < 0) (agent as any).direction = 'left';
            } else {
              agent.direction = dy > 0 ? 'down' : 'up';
            }
          }

          // Animate walk frames
          agent.frameTick += dt;
          if (agent.frameTick >= 1 / ANIM_FPS) {
            agent.frameTick = 0;
            agent.frameIndex = (agent.frameIndex + 1) % CHAR_FRAMES_PER_ROW;
          }
        }
      }

      // Build character render states
      const charStates: CharacterRenderState[] = [];
      for (const agent of agentsRef.current.values()) {
        charStates.push({
          id: agent.id,
          charIndex: agent.charIndex,
          pixelX: agent.pixelX,
          pixelY: agent.pixelY,
          direction: agent.direction,
          frameIndex: agent.frameIndex,
          isWalking: agent.isWalking,
          label: agent.label,
          labelColor: agent.labelColor,
          speechBubble: agent.speechBubble,
        });
      }

      // Render
      renderFrame(ctx!, layout!, charStates, assets!, tileColors.length > 0 ? tileColors : undefined);

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [assets, layout, tileColors, syncAgents]);

  if (!layout) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 300, color: '#2a3a50', fontFamily: 'monospace', fontSize: 12,
      }}>
        Loading office...
      </div>
    );
  }

  const nativeW = layout.cols * TILE_SIZE;
  const nativeH = layout.rows * TILE_SIZE;

  return (
    <canvas
      ref={canvasRef}
      width={nativeW}
      height={nativeH}
      style={{
        width: nativeW * SCALE,
        height: nativeH * SCALE,
        imageRendering: 'pixelated',
        display: 'block',
      }}
    />
  );
}

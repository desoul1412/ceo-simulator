import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
// Top-left: CEO Office, Top-right: Product/PM, Bottom-left: DevOps, Bottom-right: Lounge
const ROLE_SEATS: Record<string, { col: number; row: number }> = {
  CEO:      { col: 4, row: 3 },    // CEO office (top-left)
  PM:       { col: 18, row: 3 },   // Product room (top-right)
  DevOps:   { col: 4, row: 14 },   // DevOps room (bottom-left)
  Frontend: { col: 9, row: 3 },    // CEO office second desk
  Backend:  { col: 24, row: 3 },   // Product room second desk
  QA:       { col: 9, row: 14 },   // DevOps room second desk
};

const BREAK_POSITIONS = [
  { col: 21, row: 14 },  // lounge sofa area (bottom-right)
  { col: 21, row: 16 },
  { col: 19, row: 15 },
];

const IDLE_POSITIONS = [
  { col: 20, row: 15 },  // lounge center
  { col: 22, row: 14 },  // lounge right
  { col: 24, row: 16 },  // lounge far right
  { col: 17, row: 15 },  // lounge left
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
  heartbeat: 'alive' | 'stale' | 'dead';
  lastHeartbeatTime: number;
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
          label: emp.role, // Display role, not name
          labelColor: emp.color,
          speechBubble: null,
          heartbeat: 'alive',
          lastHeartbeatTime: performance.now(),
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
          targetPos = { col: 7, row: 6 }; // CEO office meeting area
          agent.speechBubble = 'In meeting';
          break;
        case 'break':
          // Only pick a new break position if not already walking
          if (!agent.isWalking && agent.tileCol === agent.targetCol && agent.tileRow === agent.targetRow) {
            targetPos = pickRandom(BREAK_POSITIONS);
          } else {
            targetPos = { col: agent.targetCol, row: agent.targetRow };
          }
          agent.speechBubble = 'On break';
          break;
        default:
          // Idle — only pick a new wander target if stationary
          if (!agent.isWalking && agent.tileCol === agent.targetCol && agent.tileRow === agent.targetRow) {
            // Occasionally wander (1 in 180 frames ≈ every 3 seconds at 60fps)
            if (Math.random() < 1 / 180) {
              targetPos = pickRandom(IDLE_POSITIONS);
            } else {
              targetPos = { col: agent.targetCol, row: agent.targetRow };
            }
          } else {
            targetPos = { col: agent.targetCol, row: agent.targetRow };
          }
          agent.speechBubble = null;
          break;
      }

      // Update heartbeat based on status
      const now = performance.now();
      if (emp.status === 'working' || emp.status === 'meeting') {
        agent.heartbeat = 'alive';
        agent.lastHeartbeatTime = now;
      } else if (emp.status === 'break') {
        agent.heartbeat = (now - agent.lastHeartbeatTime > 15000) ? 'stale' : 'alive';
      } else {
        // idle
        agent.heartbeat = (now - agent.lastHeartbeatTime > 30000) ? 'dead'
          : (now - agent.lastHeartbeatTime > 10000) ? 'stale' : 'alive';
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
          heartbeat: agent.heartbeat,
        });
      }

      // Render at scaled resolution for crisp text
      ctx!.save();
      ctx!.setTransform(scale, 0, 0, scale, 0, 0);
      ctx!.imageSmoothingEnabled = false;
      renderFrame(ctx!, layout!, charStates, assets!, tileColors.length > 0 ? tileColors : undefined);
      ctx!.restore();

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [assets, layout, tileColors, syncAgents]);

  // Dynamic scaling: measure container and scale canvas to fit
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Internal rendering scale (integer for crisp pixels)
  const renderScale = SCALE;

  // CSS display: fit canvas into container (contain — no cropping), using fractional scale to avoid gaps
  const displaySize = useMemo(() => {
    if (!layout || containerSize.w === 0) return { w: 0, h: 0 };
    const nw = layout.cols * TILE_SIZE * renderScale;
    const nh = layout.rows * TILE_SIZE * renderScale;
    const sx = containerSize.w / nw;
    const sy = containerSize.h / nh;
    const s = Math.min(sx, sy); // contain — fit fully, no cropping
    return { w: Math.round(nw * s), h: Math.round(nh * s) };
  }, [layout, containerSize, renderScale]);

  // keep old `scale` name for rendering code
  const scale = renderScale;

  if (!layout) {
    return (
      <div ref={containerRef} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%',
        color: '#2a3a50', fontFamily: 'var(--font-hud)', fontSize: 'var(--font-sm)',
      }}>
        Loading office...
      </div>
    );
  }

  const nativeW = layout.cols * TILE_SIZE;
  const nativeH = layout.rows * TILE_SIZE;
  const canvasW = nativeW * scale;
  const canvasH = nativeH * scale;

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{
          width: displaySize.w || canvasW,
          height: displaySize.h || canvasH,
          imageRendering: 'pixelated',
          display: 'block',
        }}
      />
    </div>
  );
}

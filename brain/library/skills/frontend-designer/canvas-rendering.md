---
tags: [skill, library, frontend, canvas, game]
id: frontend-canvas-rendering
role: Frontend
status: active
date: 2026-04-08
---

# Canvas Rendering

**Description:** Canvas 2D rendering, pixel art sprite animation, game loops, and BFS pathfinding for the CEO Simulator's isometric/pixel office view. This project uses a Canvas 2D engine for the office simulation — not WebGL, not a framework like Phaser.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** Frontend

## System Prompt Injection

```
You build the Canvas 2D pixel office engine. Follow these patterns exactly.

ARCHITECTURE (from brain/wiki/architecture-v3.md):
The game uses a hybrid approach:
1. React manages HUD/UI overlays (panels, menus, stats)
2. Canvas 2D renders the pixel office (agents, furniture, pathfinding visualization)
3. Zustand bridges both: game state is shared, Canvas reads from store

GAME LOOP PATTERN:
```ts
class GameLoop {
  private lastTime = 0;
  private running = false;

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (currentTime: number) => {
    if (!this.running) return;
    const deltaTime = (currentTime - this.lastTime) / 1000; // seconds
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame(this.tick);
  };

  private update(dt: number) { /* physics, AI, state */ }
  private render() { /* draw to canvas */ }

  stop() { this.running = false; }
}
```

CANVAS RENDERING RULES:
1. Clear canvas each frame: ctx.clearRect(0, 0, width, height)
2. Use requestAnimationFrame — never setInterval for rendering
3. Separate update() from render() — update handles logic, render handles drawing
4. Pixel-perfect rendering: set ctx.imageSmoothingEnabled = false
5. Use integer coordinates to avoid sub-pixel blurring
6. Layer rendering: background → furniture → agents → effects → UI overlay

SPRITE SYSTEM:
- Sprites stored at public/assets/sprites/
- Sprite sheets: uniform grid (16x16 or 32x32 tiles)
- Load sprites once, cache in a Map<string, HTMLImageElement>
- Draw with ctx.drawImage(sprite, sx, sy, sw, sh, dx, dy, dw, dh)
- Animation: cycle through sprite sheet frames based on elapsed time

SPRITE ANIMATION:
```ts
interface SpriteAnimation {
  spriteSheet: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameDuration: number; // seconds per frame
  currentFrame: number;
  elapsed: number;
}

function updateAnimation(anim: SpriteAnimation, dt: number) {
  anim.elapsed += dt;
  if (anim.elapsed >= anim.frameDuration) {
    anim.elapsed -= anim.frameDuration;
    anim.currentFrame = (anim.currentFrame + 1) % anim.frameCount;
  }
}
```

BFS PATHFINDING:
The office uses a tile-based grid. Agents navigate using BFS:
1. Grid: 2D array where 0 = walkable, 1 = obstacle
2. BFS from start tile to target tile
3. Return path as array of [x, y] coordinates
4. Agent follows path one tile per movement tick
5. Re-path if obstacle appears (desk placed, door closed)

REACT-CANVAS BRIDGE:
```tsx
const CanvasOffice: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<GameLoop>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false; // pixel art!
    gameLoopRef.current = new GameLoop(ctx);
    gameLoopRef.current.start();

    return () => gameLoopRef.current?.stop(); // cleanup!
  }, []);

  return <canvas ref={canvasRef} width={800} height={600} />;
};
```

PERFORMANCE:
- Dirty rect optimization: only redraw changed regions
- Object pooling for particles/effects (avoid GC pressure)
- Offscreen canvas for static backgrounds (render once, blit each frame)
- Target 60fps — if dropping below, reduce draw calls
- Profile with Chrome DevTools Performance tab

COORDINATE SYSTEMS:
- Grid coords: (col, row) in tile units
- Pixel coords: (x, y) in canvas pixels
- Screen coords: (x, y) relative to viewport
- Convert between them with tileSize multiplier
- Isometric conversion (if used): screenX = (col - row) * tileW/2, screenY = (col + row) * tileH/2
```

## Anti-patterns

- **setInterval for game loop:** Creates drift and doesn't sync with display refresh. Always use requestAnimationFrame.
- **No cleanup on unmount:** Canvas game loop MUST be stopped in useEffect cleanup. Memory leaks otherwise.
- **Floating point coordinates:** Causes blurry pixel art. Math.floor() all draw coordinates.
- **Loading sprites every frame:** Load once, cache in a Map. Drawing should only reference cached images.
- **Mixing game logic in render:** Update() handles logic, render() handles drawing. Never modify state during render.
- **Ignoring imageSmoothingEnabled:** Without disabling smoothing, pixel art looks blurry when scaled.
- **No delta time:** Without dt, animation speed depends on frame rate. Always multiply movement by deltaTime.

## Verification Steps

1. Game loop uses requestAnimationFrame (not setInterval)
2. ctx.imageSmoothingEnabled = false is set for pixel-art rendering
3. All draw coordinates use Math.floor() (no sub-pixel rendering)
4. useEffect cleanup stops the game loop on component unmount
5. Sprites are loaded once and cached (no per-frame loading)
6. Update and render are separate functions
7. Delta time is used for all time-dependent calculations
8. Canvas renders at target resolution without stretching artifacts

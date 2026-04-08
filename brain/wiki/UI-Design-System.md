---
tags: [design, ui, hud, pixel-art]
date: 2026-04-08
status: active
---

# UI Design System — Office Agents Simulator

Linked from: [[00-Index]]

## Design Language

**Theme:** Pixel Art / HUD / Sci-Fi — dark cockpit aesthetic, monochrome base with neon accent hits.
No rounded corners. No gradients. No shadows (except hard pixel-offset drop shadows).

---

## Color Tokens

| Token             | Value       | Usage                           |
|-------------------|-------------|---------------------------------|
| `--hud-bg`        | `#05080f`   | App background                  |
| `--hud-surface`   | `#0d1117`   | Panel, tile surface             |
| `--hud-border`    | `#1b2030`   | Grid lines, panel edges         |
| `--hud-wall`      | `#0a0c10`   | Impassable wall tiles           |
| `--hud-desk`      | `#111c3a`   | Desk tile tint                  |
| `--hud-meeting`   | `#0a1a1a`   | Meeting room tint               |
| `--hud-kitchen`   | `#151500`   | Kitchen zone tint               |
| `--neon-cyan`     | `#00ffff`   | CEO agent / primary accent      |
| `--neon-green`    | `#00ff88`   | Backend Dev / active state      |
| `--neon-orange`   | `#ff8800`   | QA agent / warning              |
| `--neon-red`      | `#ff2244`   | Alert / critical                |
| `--hud-text`      | `#a0b4c8`   | Body text, labels               |
| `--hud-text-h`    | `#e0eaf4`   | Headings, values                |
| `--scanline`      | `rgba(0,0,0,0.12)` | CRT scanline overlay     |

---

## Typography

- **Display / HUD Values:** `"Share Tech Mono"`, `"Courier New"`, monospace — ALL CAPS, letter-spacing 0.1em
- **Labels:** same family, 11px, `#a0b4c8`, uppercase
- **Status Badges:** 10px monospace, tight padding, neon color border

---

## Grid / Tile System

- **Tile size:** 32×32 px (matches sprite sheet frame size)
- **Grid:** 15 × 15 tiles = 480 × 480 px canvas
- **CSS approach:** CSS Grid for tile background; `position: absolute` agents layered on top
- **Agent transition:** `transition: left 0.8s cubic-bezier(0.4,0,0.2,1), top 0.8s cubic-bezier(0.4,0,0.2,1)`

---

## Component Rules

### `<OfficeFloorPlan />`
- Container: `position: relative`, fixed `480×480px`, `image-rendering: pixelated`
- Background: CSS Grid of `TileCell` components
- CRT overlay: `::after` pseudo with repeating scanline gradient at 2px intervals

### `<AgentSprite />`
- `position: absolute`, `width/height: 32px`, transitions on `left`/`top`
- Sprite image: `image-rendering: pixelated`
- Status badge: absolute, bottom-right, 8px neon dot

### HUD Panel
- Background: `--hud-surface`
- Border: `1px solid --hud-border`
- Header: uppercase monospace, neon accent color
- Stats row: flex, gap 16px, right-aligned values in neon green

---

## CRT / Scanline Effect

```css
.crt-overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 1px,
    var(--scanline) 1px,
    var(--scanline) 2px
  );
  pointer-events: none;
  z-index: 100;
}
```

---

## Status Color Map

| Status    | Color          | Badge char |
|-----------|----------------|------------|
| `idle`    | `#4a5568`      | `◌`        |
| `working` | `--neon-green` | `●`        |
| `meeting` | `--neon-cyan`  | `◈`        |
| `break`   | `--neon-orange`| `◉`        |

---

## Assets Reference

| Asset                              | Path                              | Status      |
|------------------------------------|-----------------------------------|-------------|
| Server floor tile (32×32)          | `public/assets/tiles/server-floor.svg` | SVG placeholder |
| Desk tile top-down (32×32)         | `public/assets/tiles/desk.svg`    | SVG placeholder |
| Agent sprite sheet (32×32, 4fr)    | `public/assets/sprites/agent-1.svg` | SVG placeholder |

See [[asset-TODO]] for PNG generation queue.

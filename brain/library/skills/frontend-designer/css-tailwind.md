---
name: css-tailwind
description: "Use when styling components. Tailwind CSS v4 with CSS-first config and design tokens."
source: internal
applies_to: [Frontend]
---

# CSS / Tailwind v4

Style components using Tailwind CSS v4 with the project's design system.

## Setup
- Tailwind v4 uses CSS-first config: `@import "tailwindcss"` in `src/index.css`
- No `tailwind.config.js` — everything configured via CSS
- `@tailwindcss/vite` plugin handles compilation

## Design Tokens (from src/index.css)
```css
--hud-bg:      #05080f;
--hud-surface: #0d1117;
--hud-border:  #1b2030;
--neon-cyan:   #00ffff;
--neon-green:  #00ff88;
--neon-orange: #ff8800;
--neon-red:    #ff2244;
--neon-purple: #c084fc;
--font-hud:    "Share Tech Mono", monospace;
```

## Style Guidelines
- Pixel Art / HUD / Sci-Fi aesthetic
- Blocky terminal fonts, CRT scanlines, sharp edges
- No rounded corners, no generic corporate UI
- Neon colors with glow effects (`box-shadow`, `text-shadow`)
- Dark backgrounds with high-contrast text

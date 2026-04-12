---
tags: [design, tailwind, vnsir, tokens]
date: 2026-04-12
status: active
---

# VNSIR Design Tokens — Tailwind CSS v4 Configuration

Linked from: [[UI-Design-System]], [[00-Index]]

## Overview
Configure Tailwind CSS v4 with VNSIR (corporate) design tokens using CSS-first approach via `@theme` in `src/index.css`. No `tailwind.config.js` required.

## Palette Definition

### Navy Base (VNSIR Primary)
| Token | Value | Usage |
|-------|-------|-------|
| `--navy-950` | `#0a0e1a` | Darkest backgrounds |
| `--navy-900` | `#0f1629` | Dark surfaces |
| `--navy-800` | `#1a2332` | Medium-dark accents |

### Neutral & Accent
| Token | Value | Usage |
|-------|-------|-------|
| `--white` | `#ffffff` | Primary text, high contrast |
| `--charcoal` | `#2d2d2d` | Medium gray, borders |
| `--gold` | `#c9a84c` | Accent highlight (premium) |

## Implementation

### CSS-First Approach
- Define tokens in `:root` or inline with `@theme`
- Tailwind reads `@import "tailwindcss"` and scans for CSS custom properties
- No `tailwind.config.js` — config lives entirely in `src/index.css`
- Supports color scale variants: `navy-50` through `navy-950`

### File: `src/index.css`
```css
@import "tailwindcss";

@theme {
  --navy-50: #f5f7fb;
  --navy-100: #e8ecf5;
  --navy-200: #d0dce8;
  --navy-300: #b8cddb;
  --navy-400: #7fa3bd;
  --navy-500: #5a7fa5;
  --navy-600: #455a80;
  --navy-700: #2d3e5a;
  --navy-800: #1a2332;
  --navy-900: #0f1629;
  --navy-950: #0a0e1a;
  
  --white: #ffffff;
  --charcoal: #2d2d2d;
  --gold: #c9a84c;
}
```

## Tailwind Integration
- Use as Tailwind utilities: `bg-navy-950`, `text-gold`, `border-charcoal`
- Fallback to existing HUD tokens for compatibility
- Example class: `<div class="bg-navy-900 text-white border border-charcoal">`

## Status
- ✅ Spec created
- [ ] CSS updated with @theme
- [ ] Tests passing
- [ ] Deployed

## Related
- [[UI-Design-System]] — Existing HUD design system (neon theme)
- [[Office-Simulator-Architecture]] — Component specs

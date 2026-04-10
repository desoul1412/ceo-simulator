---
tags: [skill, library, designer, design-tokens, tailwind]
id: designer-design-tokens
role: Designer
status: active
date: 2026-04-08
---

# Design Tokens

**Description:** CSS custom properties as design tokens, Tailwind v4 CSS-first configuration, and component style consistency. Ensures a single source of truth for colors, spacing, typography, and effects across the entire application.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** Designer, Frontend

## System Prompt Injection

```
You maintain the design token system. All visual decisions flow from tokens, never from inline values.

DESIGN TOKEN ARCHITECTURE:
Single source of truth: src/index.css
Tokens are CSS custom properties consumed by Tailwind v4 and direct CSS.

TOKEN DEFINITION IN src/index.css:
```css
@import "tailwindcss";

@theme {
  /* === COLORS === */
  --color-bg-primary: #0a0e17;
  --color-bg-secondary: #111827;
  --color-bg-tertiary: #1e293b;
  --color-bg-elevated: #0f172a;

  --color-accent-cyan: #06b6d4;
  --color-accent-green: #10b981;
  --color-accent-amber: #f59e0b;
  --color-accent-red: #ef4444;
  --color-accent-purple: #a855f7;

  --color-text-primary: #e2e8f0;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;

  --color-border-default: rgba(6, 182, 212, 0.2);
  --color-border-active: rgba(6, 182, 212, 0.5);
  --color-border-glow: rgba(6, 182, 212, 0.8);

  /* === SPACING === */
  --spacing-panel: 1rem;
  --spacing-panel-lg: 1.5rem;
  --spacing-gap: 0.5rem;
  --spacing-gap-lg: 1rem;

  /* === TYPOGRAPHY === */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
  --font-size-xs: 0.625rem;    /* 10px — tiny labels */
  --font-size-sm: 0.75rem;     /* 12px — body text */
  --font-size-base: 0.875rem;  /* 14px — standard text */
  --font-size-lg: 1.125rem;    /* 18px — headings */
  --font-size-xl: 1.5rem;      /* 24px — titles */

  /* === EFFECTS === */
  --glow-cyan: 0 0 4px rgba(6, 182, 212, 0.3), 0 0 8px rgba(6, 182, 212, 0.15);
  --glow-green: 0 0 4px rgba(16, 185, 129, 0.3), 0 0 8px rgba(16, 185, 129, 0.15);
  --glow-red: 0 0 4px rgba(239, 68, 68, 0.3), 0 0 8px rgba(239, 68, 68, 0.15);

  /* === BORDERS === */
  --border-width: 1px;
  --border-radius-pixel: 2px;  /* only "rounding" allowed */

  /* === TRANSITIONS === */
  --transition-fast: 100ms;
  --transition-normal: 200ms;
  --transition-slow: 400ms;

  /* === Z-INDEX === */
  --z-canvas: 0;
  --z-hud: 10;
  --z-panel: 20;
  --z-modal: 30;
  --z-tooltip: 40;
  --z-overlay: 50;
}
```

TAILWIND v4 CUSTOM UTILITIES:
```css
@utility panel {
  border: var(--border-width) solid var(--color-border-default);
  background: var(--color-bg-secondary);
  padding: var(--spacing-panel);
  font-family: var(--font-mono);
}

@utility panel-glow {
  border-color: var(--color-border-active);
  box-shadow: var(--glow-cyan);
}

@utility text-heading {
  font-family: var(--font-mono);
  color: var(--color-accent-cyan);
  font-size: var(--font-size-lg);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

@utility status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}
```

USING TOKENS IN COMPONENTS:
```tsx
// GOOD: Using token-based utilities
<div className="panel">
  <h2 className="text-heading">Company Overview</h2>
  <p className="font-mono text-slate-300 text-sm">Revenue: $12,500</p>
</div>

// GOOD: Using CSS custom properties for dynamic values
<div style={{ boxShadow: `var(--glow-${statusColor})` }}>

// BAD: Hardcoded values
<div style={{ color: '#06b6d4', padding: '16px', fontFamily: 'monospace' }}>
```

TOKEN CHANGE PROCESS:
1. ALL visual changes start with token modification in src/index.css
2. Never add one-off colors/sizes in components — add them as tokens first
3. After changing tokens, visually verify ALL components that use them
4. Update brain/wiki/design-system.md with any new tokens

COMPONENT STYLE AUDIT:
Periodically scan for style consistency:
```bash
# Find hardcoded hex colors in TSX files (should be tokens instead)
grep -rn '#[0-9a-fA-F]\{6\}' src/components/ --include="*.tsx"

# Find inline style usage (should be minimal)
grep -rn 'style={{' src/components/ --include="*.tsx"

# Find non-mono font usage (everything should be mono)
grep -rn 'font-sans\|font-serif' src/components/ --include="*.tsx"
```

DARK MODE:
The entire app is dark mode. There is no light mode toggle.
All tokens are designed for dark backgrounds. Do not add light mode variants.
```

## Anti-patterns

- **Hardcoded values in components:** `style={{ color: '#06b6d4' }}` bypasses the token system. Use tokens.
- **Creating tailwind.config.js:** Tailwind v4 uses CSS-first config. The config file doesn't exist and shouldn't be created.
- **Inconsistent spacing:** Using p-3 in one panel and p-5 in another. Use --spacing-panel token via the panel utility.
- **Multiple font families:** The entire app uses monospace. Adding a sans-serif font breaks the aesthetic.
- **One-off colors:** Adding a new hex color in one component. If you need a new color, add it as a token first.
- **Magic z-index values:** `z-[999]` in components. Use the z-index token scale.
- **Implicit design decisions:** Making visual decisions in component code without updating the token system. Tokens are the source of truth.

## Verification Steps

1. All design tokens are defined in src/index.css under @theme
2. No hardcoded hex colors in component files (use tokens or Tailwind palette)
3. No tailwind.config.js exists
4. Custom @utility directives are used for repeated component patterns
5. All text uses var(--font-mono) or Tailwind's font-mono
6. Spacing follows the token scale (--spacing-panel, --spacing-gap)
7. Z-index uses the defined token scale (no arbitrary values)
8. Any new visual element introduced also adds its tokens to the system

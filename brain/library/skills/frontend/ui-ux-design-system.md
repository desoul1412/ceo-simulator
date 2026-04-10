---
tags: [skill, library, frontend, ui-ux, design-system]
id: frontend-ui-ux-design-system
role: Frontend
status: active
date: 2026-04-08
---

# UI/UX Design System

**Description:** Design system consistency, responsive patterns, and accessibility enforcement. Based on the "UI/UX Pro Max" skill pattern: enforces design tokens, component consistency, responsive behavior, and WCAG compliance. Tailored to this project's pixel-art / HUD / sci-fi aesthetic with Tailwind v4 CSS-first configuration.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** Frontend, Designer

## System Prompt Injection

```
You enforce the design system. Every UI component must follow these rules.

DESIGN LANGUAGE: Pixel Art / HUD / Sci-Fi
- Blocky terminal fonts (font-mono everywhere)
- CRT scanline effects (CSS pseudo-elements with repeating-linear-gradient)
- Sharp edges (no border-radius unless explicitly 2px for "pixel" rounding)
- Neon accent colors on dark backgrounds
- Glowing borders (box-shadow with color spread)
- No generic corporate UI — this is a game, not a SaaS dashboard

COLOR SYSTEM (CSS Custom Properties in src/index.css):
:root {
  --color-bg-primary: #0a0e17;      /* Deep space black */
  --color-bg-secondary: #111827;    /* Panel background */
  --color-bg-tertiary: #1e293b;     /* Elevated surface */
  --color-accent-cyan: #06b6d4;     /* Primary accent */
  --color-accent-green: #10b981;    /* Success / money */
  --color-accent-amber: #f59e0b;    /* Warning / attention */
  --color-accent-red: #ef4444;      /* Error / danger */
  --color-accent-purple: #a855f7;   /* Special / rare */
  --color-text-primary: #e2e8f0;    /* Main text */
  --color-text-secondary: #94a3b8;  /* Muted text */
  --color-border: rgba(6, 182, 212, 0.3);  /* Subtle cyan border */
}

TAILWIND v4 CSS-FIRST:
- Config lives in src/index.css via @import "tailwindcss"
- Custom utilities defined with @utility directive
- Theme extensions via @theme directive
- NO tailwind.config.js — it does not exist in this project
- Use Tailwind classes directly, referencing CSS custom properties where needed

COMPONENT PATTERNS:

Panel (container):
  className="border border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm p-4 font-mono"

Button (primary):
  className="border border-cyan-500 bg-cyan-500/10 px-4 py-2 font-mono text-cyan-400
             hover:bg-cyan-500/20 active:bg-cyan-500/30 transition-colors"

Text (heading):
  className="font-mono text-cyan-400 text-lg tracking-wider uppercase"

Text (body):
  className="font-mono text-slate-300 text-sm leading-relaxed"

Status indicator:
  className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"

RESPONSIVE DESIGN:
- Mobile-first: default styles for mobile, then sm: md: lg: xl: breakpoints
- Game canvas: fixed aspect ratio with max-width container
- HUD panels: stack vertically on mobile, grid on desktop
- Touch targets: minimum 44x44px on mobile
- Test at: 375px (phone), 768px (tablet), 1024px (laptop), 1440px (desktop)

ACCESSIBILITY:
- Semantic HTML: use <nav>, <main>, <section>, <button>, not div-soup
- ARIA labels on interactive elements without visible text
- Focus indicators: visible focus rings (outline-2 outline-cyan-500)
- Color contrast: 4.5:1 minimum for text (test neon-on-dark combos)
- Keyboard navigation: all interactive elements reachable via Tab
- Screen reader text: sr-only class for icon-only buttons
- Reduced motion: respect prefers-reduced-motion for animations

ANIMATION:
- Use Tailwind transition-* utilities for simple transitions
- CSS @keyframes for complex animations (scanlines, glowing pulses)
- Always gate animations behind prefers-reduced-motion media query
- Keep animations subtle — this is a HUD, not a fireworks show

BEFORE WRITING ANY UI:
1. Check if design tokens are defined in src/index.css
2. Read existing components for visual consistency
3. Test the component at all 4 breakpoints mentally
4. Verify color contrast for text on backgrounds
```

## Anti-patterns

- **Generic corporate UI:** No rounded-xl, no pastel gradients, no friendly sans-serif. This is a sci-fi game.
- **Hardcoded colors:** Use CSS custom properties or Tailwind color palette. Never `style={{ color: '#06b6d4' }}`.
- **tailwind.config.js:** Does not exist. This project uses Tailwind v4 CSS-first. Don't create one.
- **Div soup:** Use semantic HTML elements. Screen readers and keyboard users depend on it.
- **Ignoring mobile:** Every component must work at 375px width. Test mentally before submitting.
- **Inconsistent spacing:** Use Tailwind's spacing scale (p-2, p-4, p-6). Don't mix arbitrary values.
- **Animation without motion gate:** Always add `motion-safe:` prefix or `@media (prefers-reduced-motion: no-preference)`.

## Verification Steps

1. All components use the defined color system (CSS custom properties or Tailwind equivalents)
2. No tailwind.config.js exists in the project
3. Components use semantic HTML elements (<button>, <nav>, etc.)
4. Interactive elements have visible focus indicators
5. Text meets 4.5:1 contrast ratio against backgrounds
6. Components render correctly at 375px, 768px, 1024px, and 1440px
7. Animations respect prefers-reduced-motion
8. The visual style is pixel-art/HUD/sci-fi — not generic corporate

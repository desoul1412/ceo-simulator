---
tags: [skill, library, designer, responsive]
id: designer-responsive-design
role: Designer
status: active
date: 2026-04-08
---

# Responsive Design

**Description:** Mobile-first responsive design patterns, breakpoint strategy, touch targets, and viewport scaling. Ensures the CEO Simulator is playable on all screen sizes while maintaining the pixel-art HUD aesthetic.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** Designer, Frontend

## System Prompt Injection

```
You ensure all UI works across screen sizes. Mobile-first, then scale up.

BREAKPOINT STRATEGY (Tailwind defaults):
- Default (0px+): Mobile phone portrait — single column, stacked panels
- sm (640px+): Large phone landscape — minor adjustments
- md (768px+): Tablet — 2-column layouts, side panels appear
- lg (1024px+): Laptop — full HUD layout, canvas + side panels
- xl (1280px+): Desktop — expanded panels, more data visible
- 2xl (1536px+): Large monitor — luxury spacing, additional panels

LAYOUT PATTERNS:

Mobile (default):
```
┌──────────────┐
│  Game Canvas  │
│  (full width) │
├──────────────┤
│  Stats Bar    │
├──────────────┤
│  Panel 1      │
├──────────────┤
│  Panel 2      │
└──────────────┘
```

Tablet (md):
```
┌──────────┬─────────┐
│  Canvas  │ Stats   │
│          │ Panel   │
│          ├─────────┤
│          │ Panel 2 │
└──────────┴─────────┘
```

Desktop (lg+):
```
┌────┬──────────────┬─────┐
│Side│   Canvas     │Stats│
│Nav │              │Panel│
│    │              ├─────┤
│    │              │Panel│
└────┴──────────────┴─────┘
```

TAILWIND RESPONSIVE CLASSES:
```tsx
// Mobile-first: default = mobile, then add breakpoint prefixes
<div className="
  flex flex-col          /* mobile: stack vertically */
  md:flex-row            /* tablet: side by side */
  lg:grid lg:grid-cols-[200px_1fr_300px]  /* desktop: 3-column grid */
  gap-2 md:gap-4
  p-2 md:p-4 lg:p-6
">
```

GAME CANVAS SCALING:
```tsx
// Canvas maintains aspect ratio and scales to container
const CanvasContainer: FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      // Maintain 4:3 aspect ratio
      setCanvasSize({
        width: Math.floor(width),
        height: Math.floor(width * 0.75),
      });
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        width={canvasSize.width}
        height={canvasSize.height}
        className="w-full h-auto"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
};
```

TOUCH TARGETS:
- Minimum 44x44px for all interactive elements (buttons, links, toggles)
- Add padding to small elements to meet the target: `p-3` minimum on buttons
- Spacing between targets: at least 8px gap to prevent mis-taps
- Use `@media (pointer: coarse)` for touch-specific styles if needed

TYPOGRAPHY SCALING:
- Base: text-xs (mobile) → text-sm (md) → text-base (lg)
- Headings: text-sm (mobile) → text-lg (md) → text-xl (lg)
- Monospace text is naturally wider — account for this in layouts
- Line height: leading-relaxed for readability on all sizes

HIDING/SHOWING ELEMENTS:
```tsx
// Hide on mobile, show on desktop
<div className="hidden lg:block">
  {/* Desktop-only side panel */}
</div>

// Mobile-only compact view
<div className="block lg:hidden">
  {/* Collapsed stats bar */}
</div>
```

SCROLL BEHAVIOR:
- Game canvas: never scroll (fixed in viewport)
- HUD panels: scroll independently if content overflows
- Mobile: panels below canvas scroll naturally
- Desktop: side panels use overflow-y-auto with max-height

VIEWPORT META:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```
Disable zoom on game screens (canvas interaction conflicts with pinch-zoom).

TESTING RESPONSIVE:
1. Chrome DevTools device toolbar at: 375px, 768px, 1024px, 1440px
2. Check: no horizontal overflow, no text truncation, no overlapping elements
3. Check: touch targets are 44px minimum
4. Check: canvas scales without distortion
5. Check: all panels are accessible (scrollable or visible)
```

## Anti-patterns

- **Desktop-first:** Writing for 1440px then trying to shrink. Always start with mobile layout.
- **Fixed widths:** `width: 800px` breaks on mobile. Use w-full, max-w-*, and responsive containers.
- **Tiny touch targets:** 24px buttons are impossible to tap accurately on phones. 44px minimum.
- **Hidden content without alternative:** `hidden md:block` means mobile users lose features. Provide a compact alternative.
- **Horizontal scroll:** Horizontal overflow on mobile is always a bug. Nothing should exceed viewport width.
- **Canvas stretching:** Canvas without aspect ratio maintenance distorts the pixel art. Use ResizeObserver.
- **Ignoring landscape phone:** 667x375 landscape is a common viewport. Test it.

## Verification Steps

1. Layout is mobile-first (default styles for mobile, breakpoints for larger screens)
2. No horizontal overflow at 375px width
3. All interactive elements meet 44x44px minimum touch target
4. Game canvas maintains aspect ratio across all viewports
5. Panels are accessible on all screen sizes (visible or navigable)
6. Typography is readable on mobile (text-xs minimum, not text-[8px])
7. Tested at 375px, 768px, 1024px, and 1440px with no layout breaks
8. Canvas uses imageRendering: pixelated and integer scaling

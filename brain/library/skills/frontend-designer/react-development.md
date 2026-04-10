---
name: react-development
description: "Use when building React components. Expert patterns for React 19 + TypeScript + hooks."
source: internal
applies_to: [Frontend]
---

# React Development

Build React components with TypeScript, hooks, and modern patterns.

## Stack
- React 19 with functional components and hooks
- TypeScript with strict types
- Tailwind CSS v4 (CSS-first config)
- Zustand for state management
- Vite for bundling

## Patterns
- Functional components only (no class components)
- Custom hooks for shared logic (`useXxx` naming)
- Zustand stores for global state
- `useMemo`/`useCallback` only when measurably needed
- Prefer composition over inheritance

## Component Structure
```typescript
interface Props { /* typed props */ }

export function ComponentName({ prop1, prop2 }: Props) {
  // hooks first
  // derived state
  // handlers
  // early returns
  // render
}
```

## Rules
- Read existing components in `src/components/` for style reference
- Follow the project's design system (pixel art / HUD / sci-fi)
- Write unit tests with vitest for all new components
- Use CSS variables from `src/index.css` for theming

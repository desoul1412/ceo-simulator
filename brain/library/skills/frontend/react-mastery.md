---
tags: [skill, library, frontend, react]
id: frontend-react-mastery
role: Frontend
status: active
date: 2026-04-08
---

# React Mastery

**Description:** React 19 patterns, hooks, state management with Zustand, and component architecture. Enforces project-specific conventions: functional components only, TypeScript strict mode, Zustand for global state, and the project's pixel-art HUD design language.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** Frontend

## System Prompt Injection

```
You are a React 19 expert building a CEO Simulator game. Follow these patterns exactly.

REACT 19 CONVENTIONS:
- Functional components ONLY — no class components
- Use React 19 features: use() hook, Server Components awareness (though this is client-side Vite)
- TypeScript strict mode: explicit return types, no `any`, interfaces over types for objects
- Props: destructure in function signature with typed interface
- Keys: never use array index as key

COMPONENT STRUCTURE:
src/components/
  [Feature]/
    [Feature].tsx          — main component
    [Feature].test.tsx     — Vitest tests
    use[Feature].ts        — custom hook (if complex state)
    [Feature].types.ts     — TypeScript interfaces

COMPONENT TEMPLATE:
```tsx
import { type FC } from 'react';

interface FeatureProps {
  /** JSDoc every prop */
  value: string;
}

export const Feature: FC<FeatureProps> = ({ value }) => {
  return (
    <div className="font-mono border border-cyan-500/50 bg-slate-900/80 p-4">
      {value}
    </div>
  );
};
```

STATE MANAGEMENT — ZUSTAND:
- Global state: Zustand stores in src/stores/
- Local state: useState for component-scoped state
- Derived state: useMemo, NOT duplicate state
- NEVER put derived data in the store — compute it

ZUSTAND STORE TEMPLATE:
```ts
import { create } from 'zustand';

interface GameState {
  score: number;
  incrementScore: (amount: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  score: 0,
  incrementScore: (amount) => set((state) => ({ score: state.score + amount })),
}));
```

HOOKS RULES:
- Custom hooks for any logic used in 2+ components
- Custom hooks start with `use` prefix
- Keep hooks pure: no side effects outside useEffect
- useEffect: always specify deps array, always cleanup subscriptions
- Avoid useEffect for derived state — use useMemo instead

PERFORMANCE:
- React.memo() for components receiving stable props but re-rendering from parent
- useCallback for event handlers passed to memoized children
- useMemo for expensive computations
- Do NOT prematurely optimize — measure first with React DevTools Profiler

BEFORE WRITING ANY COMPONENT:
1. Read existing components in src/components/ to match style
2. Read the relevant Zustand store if state interaction is needed
3. Check if a similar component already exists (avoid duplication)
4. Write the test file FIRST (TDD)
```

## Anti-patterns

- **Class components:** This project uses functional components exclusively.
- **Redux patterns in Zustand:** Don't use action creators or reducers. Zustand is simpler — mutate directly in set().
- **useEffect for everything:** useEffect is for synchronization with external systems, not for derived state computation.
- **Prop drilling 3+ levels:** If props pass through 3+ components, use Zustand or React Context.
- **Inline styles:** Use Tailwind classes. Inline styles only for truly dynamic values (canvas dimensions, calculated positions).
- **any type:** TypeScript strict mode means no `any`. Use `unknown` and narrow, or define proper types.
- **Giant components:** If a component exceeds 150 lines, split it. Extract hooks and sub-components.

## Verification Steps

1. All components are functional with TypeScript interfaces for props
2. No `any` types in component code
3. Zustand stores follow the template pattern (no Redux-style boilerplate)
4. Custom hooks exist for shared logic (no copy-paste between components)
5. useEffect has dependency arrays and cleanup functions where needed
6. Component tests exist alongside component files
7. Components use Tailwind classes consistent with the pixel-art HUD theme

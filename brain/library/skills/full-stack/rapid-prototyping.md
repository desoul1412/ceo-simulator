---
tags: [skill, library, fullstack, prototyping]
id: rapid-prototyping
role: Full-Stack
status: active
date: 2026-04-10
---

# Rapid Prototyping

**Description:** Ship working features fast with React 19 + Vite + Supabase. "Rapid" means tested code delivered quickly, not throwaway code without tests. TDD still applies -- it is faster, not slower.

**Tools:** Read, Edit, Write, Bash, Glob, Grep, Context7 MCP, Supabase MCP

**System Prompt Injection:**
```
When rapid prototyping:
1. READ FIRST: Scan existing codebase structure, component patterns, and conventions. Check recent commits. Follow established patterns -- do not invent new ones.
2. SCOPE: Define the smallest version that demonstrates the feature. Cut scope aggressively. "What is the one thing this needs to do?" Ship that. Iterate later.
3. STACK:
   - React 19 + TypeScript + Vite (dev server, HMR)
   - Tailwind CSS v4 (CSS-first: @import "tailwindcss" in src/index.css, no tailwind.config.js)
   - Supabase: PostgreSQL, Auth, Edge Functions, Realtime subscriptions
   - Use Context7 to verify current API syntax for all libraries
4. TDD (yes, even for prototypes):
   - Write a failing test for the core behavior.
   - Implement minimum code to pass.
   - Ship. The test IS the spec. If behavior changes later, the test catches it.
   - Use vitest + @testing-library/react.
5. COMPONENT STRUCTURE:
   - One component per file. File name matches component name.
   - Props typed with TypeScript interfaces. No any/unknown without justification.
   - Hooks for state and side effects. No class components.
   - Responsive by default (mobile-first Tailwind).
6. DATA LAYER:
   - Supabase client initialized once (src/lib/supabase.ts).
   - Custom hooks for data fetching (useQuery pattern).
   - Optimistic updates for perceived speed.
   - Handle loading, error, and empty states in every data-fetching component.
7. COMMIT FREQUENTLY: Working test + working code = commit. Do not batch multiple features into one commit.
```

**Anti-Patterns:**
- Prototyping without tests ("it's just a prototype")
- Inventing new patterns instead of following existing codebase conventions
- Over-engineering scope ("while I'm here, let me also add...")
- Skipping loading/error/empty states in UI components
- Using any/unknown TypeScript types as shortcuts
- Large commits with multiple features bundled together

**Verification Steps:**
- [ ] Existing codebase patterns read and followed
- [ ] Scope defined as minimum viable feature
- [ ] Failing test written before implementation
- [ ] Test passes with minimal code
- [ ] Loading, error, and empty states handled in UI
- [ ] Context7 consulted for current API syntax
- [ ] Each working increment committed separately

---
tags: [vnsir, nextjs, setup, infrastructure]
date: 2026-04-12
status: active
---

# VNSIR — Next.js 14 Project Setup

## Overview
Initialize the VNSIR project as a Next.js 14 application with App Router, TypeScript, Tailwind CSS, and ESLint.

## Task 1.1.2 — Next.js 14 Initialization

### Scaffold Command
```bash
npx create-next-app@latest vnsir --typescript --tailwind --eslint --app --src-dir
```

### Flags
| Flag | Purpose |
|------|---------|
| `--typescript` | TypeScript support |
| `--tailwind` | Tailwind CSS v3 integration |
| `--eslint` | ESLint configuration |
| `--app` | App Router (Next.js 13+) |
| `--src-dir` | Place source files under `src/` |

### Path Aliases (`tsconfig.json`)
- `@/` → `src/` — configured via `paths` in `compilerOptions`

### Directory Structure
```
vnsir/
├── src/
│   ├── app/
│   │   ├── globals.css      ← Task 1.1.3: VNSIR design tokens
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   └── lib/
├── public/
├── tsconfig.json
├── next.config.ts
└── package.json
```

## Related
- [[VNSIR-Design-Tokens]] — Task 1.1.3: navy palette, gold accent

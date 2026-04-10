---
name: context7-docs
description: "Use when needing up-to-date library/framework documentation. Prevents API hallucination."
source: context7
applies_to: [Frontend, Backend, DevOps]
---

# Context7 — Up-to-Date Library Docs

Query version-specific documentation for any library/framework. Prevents hallucinating outdated APIs.

## MCP Setup (Claude Code)
```bash
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp --api-key YOUR_API_KEY
```

## CLI Usage
```bash
npx ctx7 setup                          # One-time auth + install
ctx7 library react                      # Find library ID
ctx7 docs /facebook/react "useEffect"   # Query specific docs
```

## MCP Tools (when configured)
- `resolve-library-id` — Find the Context7 ID for a library name
- `query-docs` — Get current documentation for a library topic

## When to Use
- Before writing code that uses any external library API
- When unsure about function signatures, hook behavior, or config syntax
- Per CLAUDE.md: use `resolve-library-id` > `get-library-docs` before writing framework code
- Especially important for: React 19, Tailwind v4, Supabase, Zustand, Vite

## Rule
**ALWAYS check docs before writing framework code.** Do not assume API syntax from training data — it may be outdated.

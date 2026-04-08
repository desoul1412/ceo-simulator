# CORE DIRECTIVES: THE FACTORY

## 1. THE OBSIDIAN BRAIN (STRICT DOC CONTROL)
You are integrated with an Obsidian vault at `./brain/`. You are the Technical Lead.
- **Syntax:** Always use Obsidian Wikilinks (e.g., `[[Architecture]]`).
- **Frontmatter:** Every `.md` file in `/wiki/` must have YAML: `tags:`, `date:`, and `status: [draft/active/archived]`.
- **PRE-FLIGHT (Read Before Coding):** Read `./brain/00-Index.md`. If a feature lacks a spec document in `/wiki/`, you MUST write it first.
- **POST-FLIGHT (Write After Coding):** Upon completion, you MUST update the spec file and append your actions to `./brain/changelog.md`. Do not ask permission — just do it.

## 2. THE TRUTH ENGINE (TAVILY & CONTEXT7)
Do not hallucinate.
- **Market Data:** Use the `tavily` MCP tool FIRST for any business logic, competitor data, or external real-world context. Save findings to `./brain/raw/`.
- **API Specs:** Use `resolve-library-id` -> `get-library-docs` via Context7 before writing framework code (React, Tailwind, APIs) to ensure syntax is current.

## 3. ASSETS & UI
- For 2D game assets, use the `game-assets` MCP if available, otherwise generate SVG placeholders and note them in `./brain/raw/asset-TODO.md`.
- UI style: Pixel Art / HUD / Sci-Fi. Blocky terminal fonts, CRT scanlines, sharp edges. No generic corporate UI.
- Tailwind v4 is in use — CSS-first config via `@import "tailwindcss"` in `src/index.css`. No `tailwind.config.js`.

## 4. EXECUTION
- Enforce the loop: Read Docs -> Context7 API Check -> Git Worktree -> Subagent Execution -> TDD -> Post-Flight Doc Update.
- Use git worktrees for feature branches. Keep `main` clean.
- **TDD CIRCUIT BREAKER:** If a test fails 3 times in a row, HALT EXECUTION immediately. Document the failure in `changelog.md` and ask the CEO for intervention. Do not burn tokens in an infinite retry loop.
- **MCP FALLBACK:** If an MCP server (Tavily, Context7, game-assets) times out or fails, DO NOT hallucinate the result. Gracefully fall back, write a `TODO-MCP-Failure.md` log in `brain/raw/`, and notify the user.

## 5. STACK
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- Supabase (PostgreSQL + Realtime + RLS) — project: `paperclip` (qdhengvarelfdtmycnti)
- Vercel (SPA deployment) — config in `vercel.json`
- Brain/docs at `./brain/` (Obsidian vault)
- Sprites/tiles at `public/assets/`

## 6. OPERATIONS MANUAL
- Full SOPs documented in `[[Factory-Operations-Manual]]`
- This dashboard is the real control plane for a Zero-Human Software Factory
- Companies in Supabase = real projects. Agent statuses = real task states.
- See `brain/wiki/Factory-Operations-Manual.md` for SOPs, failure modes, token optimization

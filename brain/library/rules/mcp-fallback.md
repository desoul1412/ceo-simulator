---
tags: [rule, library, safety]
id: mcp-fallback
category: safety
status: active
---

# MCP Server Fallback

**Directive:** If an MCP server (Tavily, Context7, game-assets, etc.) times out or fails, DO NOT hallucinate the result. Gracefully fall back, write a `TODO-MCP-Failure.md` log in `brain/raw/`, and notify the user.

**Why:** Prevents agents from fabricating facts when external tools are unavailable.

**Scope:** Global

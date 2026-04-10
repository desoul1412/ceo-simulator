---
tags: [skill, library, ai, llm, api]
id: llm-integration
role: AI Engineer
status: active
date: 2026-04-10
---

# LLM Integration

**Description:** Integrate Claude and other LLMs into applications via the Anthropic SDK. Handle streaming, tool use, caching, rate limits, and cost management.

**Tools:** Read, Edit, Write, Bash, Grep, WebFetch, Context7 MCP (resolve-library-id, get-library-docs)

**System Prompt Injection:**
```
When integrating LLMs:
1. SDK SETUP: Use @anthropic-ai/sdk (TypeScript) or anthropic (Python). Import Anthropic client. Set API key via ANTHROPIC_API_KEY environment variable -- never hardcode.
2. MODEL SELECTION: Match model to task complexity:
   - Haiku: Classification, extraction, simple Q&A (cheapest, fastest)
   - Sonnet: General coding, summarization, moderate reasoning
   - Opus: Complex reasoning, multi-step analysis, architecture decisions
   Track cost per model per use case. Default to cheapest that meets quality bar.
3. TOOL USE: Use structured tool_use (not free-form function calling). Define tools with: name, description, input_schema (JSON Schema). Handle tool_use responses in a loop until the model stops requesting tools.
4. STREAMING: Use streaming for responses > 500 tokens. Handle stream events: message_start, content_block_delta, message_stop. Show partial results to users for perceived responsiveness.
5. PROMPT CACHING: Cache system prompts and large context blocks. Use cache_control: {"type": "ephemeral"} on cacheable content blocks. Monitor cache hit rates.
6. RATE LIMITS: Implement exponential backoff with jitter. Respect Retry-After headers. Set per-minute and per-day budget limits. Log all API calls with token counts.
7. ERROR HANDLING: Handle: 401 (auth), 429 (rate limit), 500 (server), 529 (overloaded). Retry transient errors (429, 500, 529). Fail fast on auth errors.
8. Use Context7 to verify current SDK syntax before writing integration code.
```

**Anti-Patterns:**
- Hardcoding API keys in source code
- Using Opus for tasks Haiku can handle (cost waste)
- Synchronous responses for long completions (use streaming)
- No retry logic for rate limits
- Inline prompt strings (use versioned prompt files)
- Ignoring token usage tracking

**Verification Steps:**
- [ ] API key loaded from environment variable, not hardcoded
- [ ] Model selection justified by task complexity
- [ ] Streaming implemented for long responses
- [ ] Retry logic handles 429, 500, 529 errors
- [ ] Token usage logged per request
- [ ] Cost estimated and within budget
- [ ] Context7 consulted for current SDK API syntax

---
tags: [skill, library, ai, agent, orchestration]
id: agent-orchestration
role: AI Engineer
status: active
date: 2026-04-10
---

# Agent Orchestration

**Description:** Design and build multi-agent systems using Claude Agent SDK. Define roles, handoffs, tool permissions, and coordination patterns. Fresh context per agent, parallel dispatch for independent tasks.

**Tools:** Read, Edit, Write, Bash, Grep, WebFetch, TodoWrite, Context7 MCP

**System Prompt Injection:**
```
When orchestrating agents:
1. ROLE DEFINITION: Each agent has ONE clear role with: name, description, allowed tools, system prompt, model selection. Agents must not overlap in responsibility.
2. CONTEXT ISOLATION: Each agent gets fresh, crafted context. NEVER pass session history between agents. The orchestrator constructs exactly what each agent needs: task description, relevant file contents, constraints, expected output format.
3. DISPATCH PATTERNS:
   - Sequential: Task B depends on Task A output. Orchestrator passes A's result to B.
   - Parallel: Tasks are independent. Dispatch simultaneously. Review and integrate results.
   - Pipeline: Output of one agent feeds directly into the next (A -> B -> C).
4. MODEL SELECTION PER AGENT:
   - Mechanical tasks (1-2 files, clear spec): cheapest model
   - Integration tasks (multi-file, judgment): standard model
   - Architecture/review tasks: most capable model
5. HANDOFF PROTOCOL: Agents report status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED. Orchestrator handles each:
   - DONE: proceed to next step
   - DONE_WITH_CONCERNS: read concerns, address if correctness-related
   - NEEDS_CONTEXT: provide missing info, re-dispatch
   - BLOCKED: assess blocker, escalate if architectural
6. REVIEW GATES: Two-stage review per task: spec compliance first, code quality second. Never skip. Never reverse order.
7. TOOL PERMISSIONS: Each agent gets only the tools it needs. Reader agents get Read/Grep. Writer agents get Read/Edit/Write/Bash. Review agents get Read/Grep/Bash.
```

**Anti-Patterns:**
- Sharing session context between agents (leads to context pollution)
- Dispatching parallel agents on tasks with shared state (causes conflicts)
- Using the most expensive model for every agent
- Skipping review gates (spec compliance AND code quality required)
- Agents with overlapping responsibilities (unclear ownership)
- Ignoring BLOCKED/NEEDS_CONTEXT statuses (forcing retry without changes)

**Verification Steps:**
- [ ] Each agent has a single, well-defined role
- [ ] Context is crafted per agent (no shared session history)
- [ ] Parallel dispatch only for truly independent tasks
- [ ] Model selection matches task complexity
- [ ] Handoff statuses handled appropriately
- [ ] Two-stage review gates in place (spec then quality)
- [ ] Tool permissions scoped to minimum needed per agent

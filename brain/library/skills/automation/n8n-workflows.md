---
tags: [skill, library, automation, n8n, workflow]
id: n8n-workflows
role: Automation
status: active
date: 2026-04-10
---

# n8n Workflows

**Description:** Build automation workflows in n8n (self-hosted). Design trigger-action sequences with error handling, monitoring, and sub-workflow decomposition. Keep workflows under 7 nodes.

**Tools:** Read, Edit, Write, Bash, Grep, WebFetch, Context7 MCP

**System Prompt Injection:**
```
When building n8n workflows:
1. TRIGGER SELECTION:
   - Webhook: for real-time events (form submissions, API calls, Stripe events). Validate payload schema. Verify HMAC signatures.
   - Cron/Schedule: for recurring tasks (daily reports, weekly syncs). Use UTC. Document schedule in human-readable form.
   - Manual: for on-demand workflows triggered by operators.
2. WORKFLOW DESIGN:
   - Maximum 7 nodes per workflow. If more needed, split into sub-workflows.
   - Name nodes descriptively: "Fetch New Orders" not "HTTP Request 1".
   - Use Set nodes to transform data between steps. Document each transformation.
   - Use IF nodes for branching logic. Keep branches shallow (max 2 levels deep).
3. ERROR HANDLING:
   - Add Error Workflow trigger to every workflow. Route to a notification workflow (Slack/email).
   - Use retry logic on HTTP nodes: 3 retries, exponential backoff.
   - Add timeout limits to prevent hung workflows.
   - Log errors with: workflow name, node name, input data, error message, timestamp.
4. DATA FLOW:
   - Pass minimal data between nodes (only what the next node needs).
   - Use expressions to reference previous node output: {{ $json.fieldName }}.
   - Validate data types at each step. Fail fast on unexpected shapes.
5. TESTING:
   - Test with real data (not mocked). Use n8n's execution history to inspect each node's input/output.
   - Test error paths: disconnect an API, send malformed data, trigger rate limits.
   - Verify idempotency: run the workflow twice with the same input.
6. DOCUMENTATION:
   - Add a Sticky Note node at the top of every workflow explaining its purpose, trigger, and expected outcome.
   - Document the workflow as an SOP (use sop-builder discipline).
```

**Anti-Patterns:**
- Workflows with 10+ nodes (split into sub-workflows)
- Missing error handling (every workflow needs an Error Workflow)
- Generic node names ("HTTP Request 1", "Function 3")
- Testing only the happy path (must test error paths too)
- Hardcoded credentials in node configuration (use n8n credentials store)
- Workflows without documentation (add Sticky Note + SOP)

**Verification Steps:**
- [ ] Workflow has 7 or fewer nodes (or split into sub-workflows)
- [ ] Error Workflow configured with notification routing
- [ ] All nodes named descriptively
- [ ] Tested with real data (not just mocked inputs)
- [ ] Error paths tested (API failure, malformed data, rate limits)
- [ ] Idempotency verified (running twice produces same result)
- [ ] Sticky Note node documents purpose and trigger

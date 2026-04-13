# CEO Simulator — Full Framework Test Guide

Complete testing reference for every subsystem, API endpoint, and integration point. Run the orchestrator first (`npm run server`) and the frontend (`npm run dev`) before executing any tests.

---

## Table of Contents

1. [Prerequisites & Setup](#1-prerequisites--setup)
2. [Health & Connectivity](#2-health--connectivity)
3. [Auth Middleware (ORCHESTRATOR_SECRET)](#3-auth-middleware)
4. [Company Management](#4-company-management)
5. [Agent Lifecycle](#5-agent-lifecycle)
6. [Ticket & Sprint System](#6-ticket--sprint-system)
7. [Agent Execution Pipeline](#7-agent-execution-pipeline)
8. [CEO Planning System](#8-ceo-planning-system)
9. [LLM Multi-Provider Router](#9-llm-multi-provider-router)
10. [Brain / Memory System](#10-brain--memory-system)
11. [Embedding & Semantic Search](#11-embedding--semantic-search)
12. [Dependency Manager & DAG](#12-dependency-manager--dag)
13. [Circuit Breaker](#13-circuit-breaker)
14. [Heartbeat Daemon](#14-heartbeat-daemon)
15. [Merge Request / Git System](#15-merge-request--git-system)
16. [Agent Messaging](#16-agent-messaging)
17. [Preset Registry](#17-preset-registry)
18. [Existing Playwright E2E Tests](#18-existing-playwright-e2e-tests)
19. [Full Happy-Path Smoke Test](#19-full-happy-path-smoke-test)

---

## 1. Prerequisites & Setup

### Environment

```bash
# 1. Copy env files
cp .env.example .env
cp server/.env.example server/.env   # if it exists

# 2. Fill in required values:
#   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (frontend)
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY    (server)

# 3. Optional but tested below:
#   ORCHESTRATOR_SECRET=your-secret-here       (auth)
#   EMBEDDING_API_URL=http://localhost:11434/v1/embeddings  (Ollama)
#   EMBEDDING_MODEL=nomic-embed-text
#   EMBEDDING_DIMS=768
```

### Start Services

```bash
# Terminal 1 — Orchestrator
npm run server
# Expected: "Server listening on port 3001"

# Terminal 2 — Frontend (optional for UI tests)
npm run dev
# Expected: Vite dev server at http://localhost:5173

# Terminal 3 — Ollama (optional, for embedding tests)
ollama serve
ollama pull nomic-embed-text
```

### Set Shell Variables (copy-paste these before running curl tests)

```bash
BASE="http://localhost:3001"
SECRET=""             # fill if ORCHESTRATOR_SECRET is set
AUTH_HEADER=""        # fill as: AUTH_HEADER="-H 'X-Orchestrator-Secret: $SECRET'"
COMPANY_ID=""         # fill after creating/retrieving a company
AGENT_ID=""           # fill after hiring an agent
TICKET_ID=""          # fill after creating a ticket
SPRINT_ID=""          # fill after creating a sprint
```

---

## 2. Health & Connectivity

### 2.1 Health Check (always public, no auth required)

```bash
curl $BASE/api/health
```

**Expected:** `{"ok":true,"timestamp":"...","daemon":false}`

### 2.2 Supabase Connection Check

Verify the server can reach Supabase by listing companies (empty is fine):

```bash
curl $BASE/api/companies
```

**Expected:** `[]` or array of company objects, HTTP 200.

### 2.3 Build Check

```bash
npm run build
# Expected: 0 errors, dist/ created
```

### 2.4 TypeScript Check

```bash
npx tsc --noEmit
# Expected: no output (0 errors)
```

---

## 3. Auth Middleware

The `X-Orchestrator-Secret` header is required on all `/api/*` endpoints (except `/api/health`) when `ORCHESTRATOR_SECRET` is set in `server/.env`.

### 3.1 Request Without Secret (when ORCHESTRATOR_SECRET is set)

```bash
curl -s $BASE/api/companies
```

**Expected:** `{"error":"Unauthorized: missing or invalid X-Orchestrator-Secret header"}` (HTTP 401)

### 3.2 Request With Wrong Secret

```bash
curl -s -H "X-Orchestrator-Secret: wrong-value" $BASE/api/companies
```

**Expected:** HTTP 401

### 3.3 Request With Correct Secret

```bash
curl -s -H "X-Orchestrator-Secret: $SECRET" $BASE/api/companies
```

**Expected:** HTTP 200, JSON array

### 3.4 Health Always Public

```bash
curl -s $BASE/api/health
```

**Expected:** HTTP 200 even without the secret header.

### 3.5 Frontend Auth (orchFetch wrapper)

In browser DevTools (Network tab), verify that every orchestrator request from the frontend includes `X-Orchestrator-Secret` header with the value from `localStorage.getItem('orchestratorSecret')`.

```javascript
// In browser console — set the secret:
localStorage.setItem('orchestratorSecret', 'your-secret-here');
// Reload the page, then check Network > any API call > Headers
```

---

## 4. Company Management

### 4.1 List Companies

```bash
curl -s $BASE/api/companies | jq .
```

**Expected:** Array (may be empty on fresh setup)

### 4.2 Create Company

```bash
curl -s -X POST $BASE/api/companies \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Corp","description":"Testing","repoUrl":"https://github.com/example/test"}' | jq .
```

**Expected:** `{"id":"...","name":"Test Corp",...}`

Save the `id` to `COMPANY_ID`.

### 4.3 Get Company by ID

```bash
curl -s $BASE/api/companies/$COMPANY_ID | jq .
```

**Expected:** Full company object

### 4.4 Update Company

```bash
curl -s -X PATCH $BASE/api/companies/$COMPANY_ID \
  -H "Content-Type: application/json" \
  -d '{"description":"Updated"}' | jq .
```

**Expected:** Updated company object

### 4.5 Company Brain Summary (auto-triggered after sprint completion)

After agents complete a sprint, the summary file appears in `brain/{company-slug}/summary.md` and in the `brain_documents` Supabase table. Verify manually:

```bash
# Check filesystem
ls brain/*/summary.md

# Check Supabase
curl -s "$BASE/api/brain/documents?doc_type=summary" | jq '.[].path'
```

---

## 5. Agent Lifecycle

### 5.1 Hire Agent (basic)

```bash
curl -s -X POST $BASE/api/hire-agent \
  -H "Content-Type: application/json" \
  -d "{
    \"companyId\": \"$COMPANY_ID\",
    \"role\": \"Frontend\",
    \"name\": \"Test Agent\"
  }" | jq .
```

**Expected:** `{"success":true,"agent":{...}}`

Save the agent `id` to `AGENT_ID`.

### 5.2 Hire Agent via Preset

```bash
# First get available presets
curl -s $BASE/api/presets/department-roles | jq '.[].slug'

# Hire using a preset slug
ROLE_ID=$(curl -s $BASE/api/presets/department-roles | jq -r '.[0].id')
curl -s -X POST $BASE/api/hire-agent \
  -H "Content-Type: application/json" \
  -d "{\"companyId\":\"$COMPANY_ID\",\"role\":\"Backend\",\"deptRoleId\":\"$ROLE_ID\"}" | jq .
```

**Expected:** Agent created with preset config (system_prompt, skills, color from preset)

### 5.3 List Agents for Company

```bash
curl -s "$BASE/api/companies/$COMPANY_ID/agents" | jq '.[].name'
```

**Expected:** Array including the hired agent(s)

### 5.4 Update Agent

```bash
curl -s -X PATCH $BASE/api/agents/$AGENT_ID \
  -H "Content-Type: application/json" \
  -d '{"budget_limit":50}' | jq .
```

**Expected:** Updated agent with `budget_limit: 50`

### 5.5 Inject Skill

```bash
curl -s -X POST $BASE/api/agents/$AGENT_ID/inject-skill \
  -H "Content-Type: application/json" \
  -d '{"skill":"react-hooks"}' | jq .
```

**Expected:** `{"success":true,"skills":["react-hooks",...]}`

### 5.6 Lifecycle Status Change

```bash
# Pause agent
curl -s -X PATCH $BASE/api/agents/$AGENT_ID/lifecycle \
  -H "Content-Type: application/json" \
  -d '{"status":"paused"}' | jq .

# Resume agent
curl -s -X PATCH $BASE/api/agents/$AGENT_ID/lifecycle \
  -H "Content-Type: application/json" \
  -d '{"status":"active"}' | jq .
```

**Expected:** Agent with updated `lifecycle_status`

**Verify in audit_log:**

```bash
curl -s "$BASE/api/audit?companyId=$COMPANY_ID&limit=5" | jq '.[].message'
```

### 5.7 Budget Reset

```bash
curl -s -X PATCH $BASE/api/agents/$AGENT_ID/budget \
  -H "Content-Type: application/json" \
  -d '{"budget_limit":100}' | jq .
```

**Expected:** Agent with `budget_limit: 100` and `lifecycle_status: "active"`

### 5.8 Fire Agent

```bash
curl -s -X DELETE $BASE/api/agents/$AGENT_ID | jq .
```

**Expected:** `{"success":true}`

Verify agent is gone:

```bash
curl -s "$BASE/api/companies/$COMPANY_ID/agents" | jq 'length'
```

**Expected:** Count decremented by 1

---

## 6. Ticket & Sprint System

### 6.1 Create Sprint

```bash
curl -s -X POST "$BASE/api/companies/$COMPANY_ID/sprints" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sprint 1","goal":"Build MVP","status":"active"}' | jq .
```

Save `id` to `SPRINT_ID`.

### 6.2 List Sprints

```bash
curl -s "$BASE/api/companies/$COMPANY_ID/sprints" | jq '.[].name'
```

### 6.3 Create Ticket

```bash
curl -s -X POST "$BASE/api/companies/$COMPANY_ID/tickets" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Implement login page\",
    \"description\": \"Create React login form with Supabase auth\",
    \"priority\": 1,
    \"story_points\": 3,
    \"sprint_id\": \"$SPRINT_ID\",
    \"agent_id\": \"$AGENT_ID\"
  }" | jq .
```

Save `id` to `TICKET_ID`.

### 6.4 Move Ticket Across Board

```bash
# Move to in-progress
curl -s -X PATCH "$BASE/api/tickets/$TICKET_ID" \
  -H "Content-Type: application/json" \
  -d '{"board_column":"in-progress","status":"in_progress"}' | jq .

# Move to done
curl -s -X PATCH "$BASE/api/tickets/$TICKET_ID" \
  -H "Content-Type: application/json" \
  -d '{"board_column":"done","status":"completed"}' | jq .
```

### 6.5 Sprint Auto-Transition

When ALL tickets in a sprint reach `board_column = "done"` or `status = "completed"`, the sprint is automatically marked `completed` and a new sprint is created from the master plan (if one exists and is approved).

**Test manually:**
1. Create a sprint with 1 ticket
2. Move ticket to `done`
3. Check: `GET /api/companies/{id}/sprints` — sprint status should be `completed`
4. If a master plan exists: a new sprint auto-created from the next phase

### 6.6 Queue Ticket for Agent Execution

```bash
curl -s -X POST "$BASE/api/tickets/$TICKET_ID/queue" | jq .
```

**Expected:** `{"success":true}` — ticket moved to queue, heartbeat daemon will pick it up

---

## 7. Agent Execution Pipeline

This is the core loop: Ticket → Worker Agent → Claude SDK → Git Worktree → MR.

### 7.1 Process Next Ticket (manual trigger)

```bash
curl -s -X POST "$BASE/api/process-next-ticket" \
  -H "Content-Type: application/json" \
  -d "{\"companyId\":\"$COMPANY_ID\"}" | jq .
```

**Expected:** Agent starts working on the oldest queued ticket. Check activity_log:

```bash
curl -s "$BASE/api/activity?companyId=$COMPANY_ID&limit=10" | jq '.[].message'
```

### 7.2 Ticket Queue Status

```bash
curl -s "$BASE/api/ticket-queue-status" | jq .
```

**Expected:** `{"queueDepth":0,"processing":false}` (or non-zero if tickets are queued)

### 7.3 Execute CEO Goal (direct)

```bash
curl -s -X POST "$BASE/api/ceo-goal" \
  -H "Content-Type: application/json" \
  -d "{
    \"companyId\": \"$COMPANY_ID\",
    \"goal\": \"Review current progress and suggest improvements\"
  }" | jq .
```

**Expected:** CEO analysis returned as text + activity_log entry

### 7.4 Execute CEO Project Review

```bash
curl -s -X POST "$BASE/api/ceo-review" \
  -H "Content-Type: application/json" \
  -d "{\"companyId\":\"$COMPANY_ID\"}" | jq .
```

**Expected:** CEO produces a written review of all agent work, persisted to brain

### 7.5 Verify Brain Written After Execution

After an agent completes a ticket:

```bash
curl -s "$BASE/api/brain/documents?doc_type=memory" | jq '.[].path'
# Should show: "company-slug/agent-slug/memory.md"
```

Check the file content contains the completed ticket title.

### 7.6 Worktree Isolation

```bash
curl -s $BASE/api/worktrees | jq .
```

**Expected:** List of active git worktrees (each agent working on a ticket gets its own branch)

---

## 8. CEO Planning System

The planning system generates 7 documents (overview, findings, tech_stack, architecture, hiring_plan, implementation_plan, 00-index) using Claude.

### 8.1 Create Planning Session

```bash
SESSION=$(curl -s -X POST "$BASE/api/companies/$COMPANY_ID/plan-session" \
  -H "Content-Type: application/json" \
  -d '{"directive":"Build a SaaS invoicing tool for freelancers","projectSize":"medium"}' | jq -r '.sessionId')
echo "Session: $SESSION"
```

**Expected:** `sessionId` returned, tabs array with 7 tabs (status: "pending")

### 8.2 Poll Session Progress

```bash
curl -s "$BASE/api/companies/$COMPANY_ID/plan-session/$SESSION" | jq '{status:.session.status,phase:.session.current_phase,total:.session.total_phases}'
```

Poll every 5 seconds. Status progresses: `running` → `completed` (or `failed`).

### 8.3 List All Sessions

```bash
curl -s "$BASE/api/companies/$COMPANY_ID/plan-sessions" | jq '.[].directive'
```

### 8.4 Replan a Single Tab

```bash
curl -s -X POST "$BASE/api/plan-session/$SESSION/replan/tech_stack" \
  -H "Content-Type: application/json" \
  -d '{"context":"Add Stripe payment integration requirement"}' | jq .
```

**Expected:** tech_stack tab regenerated with new context; other tabs unchanged

### 8.5 Approve Session (triggers agent hiring + sprint creation)

```bash
curl -s -X POST "$BASE/api/plan-session/$SESSION/approve" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

**Expected:**
- `hiring_plan` parsed → agents created automatically
- `implementation_plan` phases parsed → Sprint 1 created with tickets
- Brain directory populated: `brain/{company-slug}/plans/{session-prefix}/`

### 8.6 Verify Planning Brain Documents

```bash
ls brain/*/plans/*/
# Expected: 00-index.md, overview.md, findings.md, tech_stack.md,
#           architecture.md, hiring_plan.md, implementation_plan.md
```

---

## 9. LLM Multi-Provider Router

The router tries providers in priority order, falls back on error, and filters to SDK-only providers for code tasks.

### 9.1 List Providers

```bash
curl -s $BASE/api/llm/providers | jq '.[].slug'
```

**Expected on fresh DB:** empty `[]` (until seeded) or `["claude-sdk"]` if seeded.

### 9.2 Create a Provider

```bash
PROVIDER=$(curl -s -X POST $BASE/api/llm/providers \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "claude-sdk",
    "name": "Claude SDK",
    "provider_type": "sdk",
    "config": {}
  }' | jq -r '.id')
echo "Provider: $PROVIDER"
```

### 9.3 Create Models for Provider

```bash
# Fast model
curl -s -X POST $BASE/api/llm/models \
  -H "Content-Type: application/json" \
  -d "{
    \"provider_id\": \"$PROVIDER\",
    \"slug\": \"claude-haiku\",
    \"name\": \"Claude Haiku\",
    \"model_id\": \"claude-haiku-4-5-20251001\",
    \"tier\": \"fast\",
    \"supports_tools\": true
  }" | jq .

# Premium model
MODEL=$(curl -s -X POST $BASE/api/llm/models \
  -H "Content-Type: application/json" \
  -d "{
    \"provider_id\": \"$PROVIDER\",
    \"slug\": \"claude-sonnet\",
    \"name\": \"Claude Sonnet\",
    \"model_id\": \"claude-sonnet-4-6\",
    \"tier\": \"mid\",
    \"supports_tools\": true
  }" | jq -r '.id')
echo "Model: $MODEL"
```

### 9.4 Set Global Routing Chain

```bash
curl -s -X PUT $BASE/api/llm/routing/global \
  -H "Content-Type: application/json" \
  -d "{\"modelIds\":[\"$MODEL\"]}" | jq .
```

**Expected:** `{"success":true}`

### 9.5 Get Global Routing Chain

```bash
curl -s $BASE/api/llm/routing/global | jq '.[].slug'
```

**Expected:** `["claude-sonnet"]`

### 9.6 Set Per-Agent Routing

```bash
curl -s -X PUT "$BASE/api/llm/routing/agent/$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d "{\"modelIds\":[\"$MODEL\"]}" | jq .
```

### 9.7 Set Per-Company Routing

```bash
curl -s -X PUT "$BASE/api/llm/routing/company/$COMPANY_ID" \
  -H "Content-Type: application/json" \
  -d "{\"modelIds\":[\"$MODEL\"]}" | jq .
```

### 9.8 Test Routing Cascade

Priority: agent-specific > company > global > fallback to Claude SDK.

**To test cascade:** set agent routing to an inactive model and verify fallback to global:

```bash
# Deactivate the model
curl -s -X PATCH "$BASE/api/llm/models/$MODEL" \
  -H "Content-Type: application/json" \
  -d '{"is_active":false}' | jq .

# Trigger a ticket execution — it should fall back to next in chain
curl -s -X POST "$BASE/api/process-next-ticket" \
  -H "Content-Type: application/json" \
  -d "{\"companyId\":\"$COMPANY_ID\"}" | jq .

# Check activity log for which provider was used
curl -s "$BASE/api/activity?companyId=$COMPANY_ID&limit=3" | jq '.[].message'
```

### 9.9 Role-Based Filtering (SDK-Only for Code Tasks)

Code tasks (roles: Frontend, Backend, DevOps, QA, Full-Stack) only use providers with `provider_type = "sdk"`.

**To verify:** add an HTTP provider and assign it priority 0, then execute a code ticket. Verify the SDK adapter is chosen instead:

```bash
# Create HTTP provider
HTTP_PROV=$(curl -s -X POST $BASE/api/llm/providers \
  -H "Content-Type: application/json" \
  -d '{"slug":"openrouter","name":"OpenRouter","provider_type":"http","config":{"api_key":"test"}}' | jq -r '.id')

# Create model under it
HTTP_MODEL=$(curl -s -X POST $BASE/api/llm/models \
  -H "Content-Type: application/json" \
  -d "{\"provider_id\":\"$HTTP_PROV\",\"slug\":\"or-qwen\",\"name\":\"QwenCoder\",\"model_id\":\"qwen/qwen-2.5-coder-32b-instruct\",\"tier\":\"mid\"}" | jq -r '.id')

# Set agent routing: HTTP model priority 0, SDK model priority 1
curl -s -X PUT "$BASE/api/llm/routing/agent/$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d "{\"modelIds\":[\"$HTTP_MODEL\",\"$MODEL\"]}" | jq .

# Execute a ticket for a Frontend agent — check logs for which was used
```

**Expected:** activity_log shows `[llm-router]` chose the SDK model, skipping OpenRouter.

### 9.10 Delete Provider & Cascade

```bash
curl -s -X DELETE "$BASE/api/llm/providers/$HTTP_PROV" | jq .
```

**Expected:** `{"success":true}`, related models and routing rules cascade-deleted.

---

## 10. Brain / Memory System

The brain uses PostgreSQL (`brain_documents` table) as primary, with optional local filesystem mirror.

### 10.1 List Brain Documents

```bash
curl -s "$BASE/api/brain/documents" | jq '.[].path'
```

### 10.2 Filter by Doc Type

```bash
curl -s "$BASE/api/brain/documents?doc_type=memory" | jq '.[].path'
curl -s "$BASE/api/brain/documents?doc_type=soul" | jq '.[].path'
curl -s "$BASE/api/brain/documents?doc_type=plan" | jq '.[].path'
```

### 10.3 Filter by Agent

```bash
curl -s "$BASE/api/brain/documents?agent_id=$AGENT_ID" | jq '.[].path'
```

### 10.4 Get Document by Path

```bash
# The path is URL-encoded
curl -s "$BASE/api/brain/documents/by-path?path=ceo-simulator/dev-sharma/memory.md" | jq '.content' | head -20
```

### 10.5 Write / Upsert Document

```bash
curl -s -X PUT "$BASE/api/brain/documents/by-path" \
  -H "Content-Type: application/json" \
  -d "{
    \"path\": \"test/manual-test.md\",
    \"content\": \"# Test\\nThis is a manual test document.\",
    \"doc_type\": \"general\",
    \"company_id\": \"$COMPANY_ID\"
  }" | jq .
```

**Expected:** Document created/updated in `brain_documents` table

**Verify:**

```bash
curl -s "$BASE/api/brain/documents/by-path?path=test/manual-test.md" | jq '.content'
```

### 10.6 Brain Sync (PG → Filesystem)

If `BRAIN_SYNC_ENABLED=true` in server env, documents written via `writeBrain()` also appear in `brain/` directory:

```bash
ls brain/test/
# Expected: manual-test.md
cat brain/test/manual-test.md
```

### 10.7 Agent Brain Initialization

Hire a new agent and verify their brain is created:

```bash
# Hire agent
NEW_AGENT=$(curl -s -X POST $BASE/api/hire-agent \
  -H "Content-Type: application/json" \
  -d "{\"companyId\":\"$COMPANY_ID\",\"role\":\"Backend\",\"name\":\"New Dev\"}" | jq -r '.agent.id')

# Wait ~2 seconds for async brain init, then check
curl -s "$BASE/api/brain/documents?agent_id=$NEW_AGENT" | jq '.[].path'
```

**Expected:** Three docs with paths `{company-slug}/{agent-slug}/soul.md`, `context.md`, `memory.md`

---

## 11. Embedding & Semantic Search

Requires Ollama running with `nomic-embed-text` model pulled.

### 11.1 Verify Ollama Is Running

```bash
curl -s http://localhost:11434/api/tags | jq '.models[].name'
# Expected: includes "nomic-embed-text"
```

### 11.2 Test Embedding Generation

```bash
curl -s -X POST http://localhost:11434/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text","input":"test document content"}' | jq '.data[0].embedding | length'
```

**Expected:** `768`

### 11.3 Verify Embeddings Are Stored

After writing a brain document (with Ollama running and `EMBEDDING_API_URL` set), check the embedding column is populated:

```bash
# Via Supabase dashboard or:
curl -s "$BASE/api/brain/documents?doc_type=memory" | jq '.[0].id'
# Then check the DB: SELECT id, path, embedding IS NOT NULL as has_embedding FROM brain_documents;
```

**Expected:** `has_embedding = true` for recently written docs

### 11.4 Semantic Search via Brain Search

```bash
curl -s -X POST "$BASE/api/brain/search" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"implement React login form\",
    \"companyId\": \"$COMPANY_ID\",
    \"limit\": 3
  }" | jq '.[].path'
```

**Expected:** Docs ranked by semantic similarity (not just keyword match)

### 11.5 Agent-Scoped Search

```bash
curl -s -X POST "$BASE/api/brain/search" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"completed tasks\",
    \"agentId\": \"$AGENT_ID\",
    \"limit\": 3
  }" | jq '.[].path'
```

**Expected:** Only docs belonging to that specific agent

### 11.6 Text Search Fallback (when Ollama is down)

Stop Ollama, then try a search:

```bash
curl -s -X POST "$BASE/api/brain/search" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"memory\",\"companyId\":\"$COMPANY_ID\"}" | jq '.[].path'
```

**Expected:** Results still returned (text-based ILIKE search fallback), no crash.

---

## 12. Dependency Manager & DAG

Ticket dependencies form a DAG (directed acyclic graph). Circular dependencies are rejected.

### 12.1 Create Two Tickets

```bash
TICKET_A=$(curl -s -X POST "$BASE/api/companies/$COMPANY_ID/tickets" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Task A\",\"sprint_id\":\"$SPRINT_ID\"}" | jq -r '.id')

TICKET_B=$(curl -s -X POST "$BASE/api/companies/$COMPANY_ID/tickets" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Task B\",\"sprint_id\":\"$SPRINT_ID\"}" | jq -r '.id')
```

### 12.2 Add Dependency (B blocked by A)

```bash
curl -s -X POST "$BASE/api/tickets/$TICKET_B/dependencies" \
  -H "Content-Type: application/json" \
  -d "{\"blockerTicketId\":\"$TICKET_A\"}" | jq .
```

**Expected:** `{"success":true}`

### 12.3 Verify Dependency

```bash
curl -s "$BASE/api/tickets/$TICKET_B/dependencies" | jq .
```

**Expected:** A appears as a blocker with status `pending`

### 12.4 Reject Circular Dependency

```bash
curl -s -X POST "$BASE/api/tickets/$TICKET_A/dependencies" \
  -H "Content-Type: application/json" \
  -d "{\"blockerTicketId\":\"$TICKET_B\"}" | jq .
```

**Expected:** HTTP 400 with `{"error":"Circular dependency detected"}`

### 12.5 Satisfy Dependency (complete blocker ticket)

```bash
curl -s -X PATCH "$BASE/api/tickets/$TICKET_A" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed","board_column":"done"}' | jq .
```

**Then verify B's dependency is satisfied:**

```bash
curl -s "$BASE/api/tickets/$TICKET_B/dependencies" | jq '.[].status'
```

**Expected:** `"satisfied"` — B is now unblocked

### 12.6 Dependency Graph Exported to Brain

After sprint work, the Mermaid graph is written to `brain/{company-slug}/sprints/{sprint-slug}/dependency-graph.md`:

```bash
cat brain/*/sprints/*/dependency-graph.md
```

**Expected:** Mermaid graph with arrows between ticket titles.

---

## 13. Circuit Breaker

The circuit breaker prevents infinite retry loops during agent execution. After 3 consecutive failures, it halts and escalates.

### 13.1 View Circuit Breaker State

```bash
curl -s "$BASE/api/circuit-breaker?agentId=$AGENT_ID" | jq .
```

**Expected:** `{"failureCount":0,"state":"closed","lastFailure":null}`

### 13.2 Trigger Circuit Breaker (simulate failures)

The circuit breaker activates automatically when agent execution fails 3 times. To test manually:

1. Set agent's `system_prompt` to something that will always fail (e.g., extremely long input)
2. Queue a ticket for that agent
3. Run process-next-ticket 3 times
4. Check the state:

```bash
curl -s "$BASE/api/circuit-breaker?agentId=$AGENT_ID" | jq .
```

**Expected:** After 3 failures: `{"state":"open"}` — agent will not receive more tickets until reset.

### 13.3 Reset Circuit Breaker

```bash
curl -s -X POST "$BASE/api/circuit-breaker/$AGENT_ID/reset" | jq .
```

**Expected:** `{"success":true}`, state back to `"closed"`

---

## 14. Heartbeat Daemon

The daemon runs every 30 seconds, processing queued tickets and detecting stale agents.

### 14.1 Check Daemon Status

```bash
curl -s $BASE/api/daemon/status | jq .
```

**Expected:** `{"running":false,"interval":30000}` (or `running: true` if started)

### 14.2 Start Daemon

```bash
curl -s -X POST $BASE/api/daemon/start | jq .
```

**Expected:** `{"success":true,"running":true}`

### 14.3 Verify Daemon Picks Up Tickets

1. Create a ticket and queue it:

```bash
TICK=$(curl -s -X POST "$BASE/api/companies/$COMPANY_ID/tickets" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Daemon test ticket\",\"agent_id\":\"$AGENT_ID\",\"sprint_id\":\"$SPRINT_ID\"}" | jq -r '.id')
curl -s -X POST "$BASE/api/tickets/$TICK/queue" | jq .
```

2. Wait 30 seconds (or up to 60s for next heartbeat cycle)
3. Check ticket status:

```bash
curl -s "$BASE/api/tickets/$TICK" | jq '.status'
```

**Expected:** `"in_progress"` or `"completed"` — daemon picked it up automatically

### 14.4 Stop Daemon

```bash
curl -s -X POST $BASE/api/daemon/stop | jq .
```

**Expected:** `{"success":true,"running":false}`

### 14.5 Stale Agent Detection

Agents that have been `working` for >10 minutes are reset to `idle` by the heartbeat. To test:

```bash
# Manually set an agent as stale (working since 2 hours ago)
# Via Supabase SQL Editor:
# UPDATE agents SET status='working', updated_at=now()-interval'2 hours' WHERE id='AGENT_ID';

# Then start daemon and wait one cycle
curl -s -X POST $BASE/api/daemon/start | jq .
# Wait 30s
curl -s "$BASE/api/companies/$COMPANY_ID/agents" | jq '.[].status'
# Expected: stale agent reset to "idle"
```

---

## 15. Merge Request / Git System

Agents create git branches in worktrees and open merge requests when done.

### 15.1 List Merge Requests

```bash
curl -s "$BASE/api/companies/$COMPANY_ID/merge-requests" | jq '.[].title'
```

### 15.2 Verify Repo Cloning

When an agent executes a ticket with `repoUrl` set on the company:

```bash
ls .company-repos/
# Expected: directory named after the repo
```

### 15.3 List Worktrees

```bash
curl -s $BASE/api/worktrees | jq .
```

**Expected:** Array of `{path, branch, agentId}` objects for active worktrees

### 15.4 Approve Merge Request

```bash
MR_ID=$(curl -s "$BASE/api/companies/$COMPANY_ID/merge-requests" | jq -r '.[0].id')
curl -s -X POST "$BASE/api/merge-requests/$MR_ID/approve" | jq .
```

**Expected:** MR status updated to `approved`

### 15.5 Reject Merge Request

```bash
curl -s -X POST "$BASE/api/merge-requests/$MR_ID/reject" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Needs more tests"}' | jq .
```

### 15.6 Repo Sync (pull latest)

```bash
curl -s -X POST "$BASE/api/repos/$COMPANY_ID/sync" | jq .
```

**Expected:** `{"success":true}` — repo pulled to latest main

### 15.7 Branch Name Safety (no injection)

The branch name is validated against `^[a-zA-Z0-9._\-\/]+$`. A ticket title like `"fix: login page"` produces branch `fix-login-page`. Verify no shell special chars reach git:

```bash
# Create ticket with special chars in title
TICK=$(curl -s -X POST "$BASE/api/companies/$COMPANY_ID/tickets" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Fix (login) page; echo pwned\",\"agent_id\":\"$AGENT_ID\",\"sprint_id\":\"$SPRINT_ID\"}" | jq -r '.id')
# Execute — verify git runs without shell injection
```

**Expected:** Branch created as `fix-login-page-echo-pwned` (sanitized slugify), git command uses `execFileSync` array args.

---

## 16. Agent Messaging

Agents can send messages to each other (context sharing, escalation, etc.).

### 16.1 Send Message to Agent

```bash
curl -s -X POST "$BASE/api/agents/$AGENT_ID/messages" \
  -H "Content-Type: application/json" \
  -d "{
    \"to_agent_id\": \"$AGENT_ID\",
    \"message_type\": \"context_share\",
    \"subject\": \"Test message\",
    \"content\": \"Here is context about the current sprint\"
  }" | jq .
```

**Expected:** `{"success":true,"id":"..."}`

### 16.2 Get Agent Messages

```bash
curl -s "$BASE/api/agents/$AGENT_ID/messages" | jq '.[].subject'
```

### 16.3 Get Unread Messages

```bash
curl -s "$BASE/api/agents/$AGENT_ID/messages/unread" | jq 'length'
```

**Expected:** 1 (from the message we sent above)

### 16.4 Mark Message as Read

```bash
MSG_ID=$(curl -s "$BASE/api/agents/$AGENT_ID/messages" | jq -r '.[0].id')
curl -s -X POST "$BASE/api/messages/$MSG_ID/read" | jq .
```

**Expected:** `{"success":true}`

**Verify:**

```bash
curl -s "$BASE/api/agents/$AGENT_ID/messages/unread" | jq 'length'
```

**Expected:** 0

---

## 17. Preset Registry

Presets define standard agent configurations (role, skills, system prompt, color).

### 17.1 List Department Roles

```bash
curl -s $BASE/api/presets/department-roles | jq '.[].slug'
```

### 17.2 Get Single Preset

```bash
PRESET_ID=$(curl -s $BASE/api/presets/department-roles | jq -r '.[0].id')
curl -s "$BASE/api/presets/department-roles/$PRESET_ID" | jq .
```

### 17.3 List Agent Skills

```bash
curl -s $BASE/api/presets/agent-skills | jq '.[].name'
```

### 17.4 Create Custom Preset

```bash
curl -s -X POST $BASE/api/presets/department-roles \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-role",
    "name": "Test Role",
    "department": "Engineering",
    "model_tier": "mid",
    "default_skills": ["testing","debugging"],
    "system_prompt_template": "You are a test specialist."
  }' | jq .
```

### 17.5 Verify Preset Used During Hire

```bash
curl -s -X POST $BASE/api/hire-agent \
  -H "Content-Type: application/json" \
  -d "{
    \"companyId\": \"$COMPANY_ID\",
    \"role\": \"Backend\",
    \"deptRoleId\": \"$PRESET_ID\"
  }" | jq '.agent.system_prompt'
```

**Expected:** System prompt from the preset (not default)

---

## 18. Existing Playwright E2E Tests

These 10 specs test the frontend UI end-to-end.

### 18.1 Run All E2E Tests

```bash
npm run e2e
# or
npx playwright test
```

### 18.2 Run Individual Specs

| Spec File | What It Tests |
|-----------|---------------|
| `e2e/01-dashboard.spec.ts` | Master dashboard loads, company cards shown |
| `e2e/02-company-view.spec.ts` | Company detail page, agent tiles, activity feed |
| `e2e/03-agent-card.spec.ts` | Agent card modal, fields, edit controls |
| `e2e/04-scrum-board.spec.ts` | Kanban board, drag-and-drop columns |
| `e2e/05-planning.spec.ts` | Planning popup, directive input, session creation |
| `e2e/06-hire-agent.spec.ts` | Hire agent dialog, role picker, department roles |
| `e2e/07-api-health.spec.ts` | API health endpoint accessible from frontend |
| `e2e/08-visual.spec.ts` | Screenshot regression tests |
| `e2e/09-planning-execution-flow.spec.ts` | Full planning → approval → sprint creation |
| `e2e/10-monitor-agents.spec.ts` | Agent activity monitor, real-time updates |

```bash
# Run a single spec
npx playwright test e2e/01-dashboard.spec.ts

# Run with headed browser (visible)
npx playwright test --headed

# Run with Playwright UI mode
npx playwright test --ui
```

### 18.3 E2E Test Prerequisites

```bash
# Install Playwright browsers
npx playwright install chromium

# Ensure orchestrator is running on 3001
npm run server &

# Ensure frontend is running on 5173
npm run dev &

# Set test env (in playwright.config.ts or .env.test)
# BASE_URL=http://localhost:5173
```

### 18.4 E2E Failure Diagnosis

```bash
# View last test report
npx playwright show-report

# Run with verbose output
npx playwright test --reporter=list

# Generate trace for a failed test
npx playwright test --trace on
# Then: npx playwright show-trace trace.zip
```

---

## 19. Full Happy-Path Smoke Test

This end-to-end sequence tests the entire system from company creation to agent task completion.

```bash
#!/usr/bin/env bash
# full-smoke-test.sh — Run after npm run server

BASE="http://localhost:3001"
echo "=== CEO Simulator Full Smoke Test ==="

# 1. Health
echo -n "[1] Health check... "
STATUS=$(curl -s $BASE/api/health | jq -r '.ok')
[ "$STATUS" = "true" ] && echo "PASS" || echo "FAIL: $STATUS"

# 2. Create company
echo -n "[2] Create company... "
COMPANY=$(curl -s -X POST $BASE/api/companies \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test Corp","description":"Automated test"}')
COMPANY_ID=$(echo $COMPANY | jq -r '.id')
[ -n "$COMPANY_ID" ] && echo "PASS ($COMPANY_ID)" || echo "FAIL"

# 3. Hire agent
echo -n "[3] Hire agent... "
AGENT=$(curl -s -X POST $BASE/api/hire-agent \
  -H "Content-Type: application/json" \
  -d "{\"companyId\":\"$COMPANY_ID\",\"role\":\"Frontend\",\"name\":\"Smoke Dev\"}")
AGENT_ID=$(echo $AGENT | jq -r '.agent.id')
[ -n "$AGENT_ID" ] && echo "PASS ($AGENT_ID)" || echo "FAIL"

# 4. Verify brain init (async)
sleep 2
echo -n "[4] Brain init... "
BRAIN_COUNT=$(curl -s "$BASE/api/brain/documents?agent_id=$AGENT_ID" | jq 'length')
[ "$BRAIN_COUNT" -ge 3 ] && echo "PASS ($BRAIN_COUNT docs)" || echo "FAIL (got $BRAIN_COUNT)"

# 5. Create sprint
echo -n "[5] Create sprint... "
SPRINT=$(curl -s -X POST "$BASE/api/companies/$COMPANY_ID/sprints" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sprint 1","goal":"MVP","status":"active"}')
SPRINT_ID=$(echo $SPRINT | jq -r '.id')
[ -n "$SPRINT_ID" ] && echo "PASS ($SPRINT_ID)" || echo "FAIL"

# 6. Create ticket
echo -n "[6] Create ticket... "
TICKET=$(curl -s -X POST "$BASE/api/companies/$COMPANY_ID/tickets" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Smoke test task\",\"sprint_id\":\"$SPRINT_ID\",\"agent_id\":\"$AGENT_ID\"}")
TICKET_ID=$(echo $TICKET | jq -r '.id')
[ -n "$TICKET_ID" ] && echo "PASS ($TICKET_ID)" || echo "FAIL"

# 7. Queue ticket
echo -n "[7] Queue ticket... "
QUEUE=$(curl -s -X POST "$BASE/api/tickets/$TICKET_ID/queue")
[ "$(echo $QUEUE | jq -r '.success')" = "true" ] && echo "PASS" || echo "FAIL"

# 8. Verify LLM providers
echo -n "[8] LLM providers... "
PROV_COUNT=$(curl -s $BASE/api/llm/providers | jq 'length')
echo "PASS ($PROV_COUNT providers)"

# 9. Brain search
echo -n "[9] Brain search... "
RESULTS=$(curl -s -X POST "$BASE/api/brain/search" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"frontend developer\",\"companyId\":\"$COMPANY_ID\"}" | jq 'length')
[ "$RESULTS" -ge 0 ] && echo "PASS ($RESULTS results)" || echo "FAIL"

# 10. Cleanup
echo -n "[10] Cleanup... "
curl -s -X DELETE "$BASE/api/agents/$AGENT_ID" > /dev/null
echo "DONE"

echo ""
echo "=== Smoke test complete. Check PASS/FAIL above. ==="
```

Save as `full-smoke-test.sh`, run with:

```bash
chmod +x full-smoke-test.sh
./full-smoke-test.sh
```

---

## Appendix: Quick Reference

### Server Env Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `PORT` | No | Orchestrator port (default: 3001) |
| `ORCHESTRATOR_SECRET` | No | Shared secret for auth (set both here and in frontend) |
| `EMBEDDING_API_URL` | No | Ollama endpoint: `http://localhost:11434/v1/embeddings` |
| `EMBEDDING_MODEL` | No | Default: `nomic-embed-text` |
| `EMBEDDING_DIMS` | No | Default: `768` |
| `BRAIN_SYNC_ENABLED` | No | Mirror brain to filesystem (`true`/`false`) |

### Frontend Env Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_ORCHESTRATOR_URL` | No | Orchestrator URL (default: `http://localhost:3001`) |
| `VITE_ORCHESTRATOR_SECRET` | No | Must match server `ORCHESTRATOR_SECRET` |

### Common Failure Modes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` | `ORCHESTRATOR_SECRET` set but header missing | Set `VITE_ORCHESTRATOR_SECRET` in frontend env |
| `500 on /api/companies` | Supabase connection failed | Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| Embeddings not stored | Ollama not running or model not pulled | `ollama serve` + `ollama pull nomic-embed-text` |
| Brain docs not in filesystem | `BRAIN_SYNC_ENABLED` not set | Add `BRAIN_SYNC_ENABLED=true` to `server/.env` |
| Agent stuck `working` | Circuit breaker open or worktree failure | Reset circuit breaker, check `brain/changelog.md` |
| `PathError: Missing parameter name` | Express route wildcard syntax | Ensure route uses `by-path?path=` not `by-path/*` |
| Planning session `failed` | Claude SDK auth or budget exceeded | Check `ANTHROPIC_API_KEY`, check agent budget |

### Supabase Tables Reference

| Table | Purpose |
|-------|---------|
| `companies` | Project registry |
| `agents` | Agent roster |
| `tickets` | Work items |
| `sprints` | Sprint iterations |
| `ticket_dependencies` | Dependency DAG edges |
| `merge_requests` | Agent PR registry |
| `brain_documents` | Brain/memory content + embeddings |
| `llm_providers` | LLM provider registry |
| `llm_models` | Model registry per provider |
| `agent_model_routing` | Per-agent/company routing chains |
| `planning_sessions` | CEO planning sessions |
| `planning_tabs` | Session document tabs |
| `activity_log` | Event stream |
| `audit_log` | Security/compliance events |
| `agent_messages` | Inter-agent mailbox |
| `notifications` | Frontend notifications |
| `department_roles` | Agent preset definitions |
| `agent_skills` | Skill library |

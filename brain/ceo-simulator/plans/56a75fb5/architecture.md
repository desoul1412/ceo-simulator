---
tags: [plan, architecture]
date: 2026-04-11
status: active
---

# Architecture

> Directive: "Review this project, this is a multi agents framework that can help me work with any project, it still in testing but I want it to be an open-source ready product that uses can use with their own server, databases and LLM models. Please start planning with this approach"
> Size: medium | Cost: $4.8351

Now I have a comprehensive understanding of the entire codebase. Let me compile the solution architecture document.

---

# 🏗️ Solution Architecture — CEO Simulator → Open-Source Multi-Agent Framework

## Executive Summary

CEO Simulator is a **multi-agent orchestration framework** that manages autonomous AI agents (Claude, HTTP endpoints, Bash scripts) across multiple software projects. Currently hardcoded to Supabase + Anthropic Claude, the OSS transformation requires abstracting all vendor dependencies behind pluggable interfaces so users can bring their own database, LLM, and deployment infrastructure.

This document defines the complete target architecture.

---

## 1. System Design — High-Level Component Diagram

```mermaid
graph TB
    subgraph "Browser Client (SPA)"
        UI[React 19 + Zustand + Tailwind v4]
        RT[Realtime Sync Hook]
        API_CLIENT[API Client Layer]
    end

    subgraph "Orchestrator Server (Node.js)"
        GW[Express API Gateway<br/>50+ endpoints]
        AUTH[Auth Middleware<br/>JWT / API Key]
        
        subgraph "Core Engine"
            HD[Heartbeat Daemon<br/>30s tick loop]
            TP[Ticket Processor<br/>claim → execute → commit → MR]
            CEO_E[CEO Reasoning Engine<br/>plan generation + delegation]
            MM[Memory Manager<br/>short-term → long-term promotion]
        end
        
        subgraph "Agent Runtimes (Pluggable)"
            AR[Agent Runner<br/>Universal Dispatcher]
            CR[Claude Runner<br/>@anthropic-ai/claude-agent-sdk]
            HR[HTTP Runner<br/>Any POST endpoint]
            BR[Bash Runner<br/>Shell scripts]
            LR[🆕 LLM Adapter Interface<br/>OpenAI / Ollama / etc.]
        end
        
        subgraph "Infrastructure Services"
            RM[Repo Manager<br/>Git clone/pull/sync]
            WM[Worktree Manager<br/>Per-agent branch isolation]
            CM[Config Manager<br/>3-level cascade]
        end
    end

    subgraph "Data Layer (Pluggable)"
        DB_ADAPTER[🆕 Database Adapter Interface]
        SB[(Supabase<br/>PostgreSQL + Realtime)]
        PG[(🆕 Raw PostgreSQL)]
        SQLITE[(🆕 SQLite<br/>single-user)]
        MYSQL[(🆕 MySQL)]
    end

    subgraph "External Services"
        GIT[GitHub / GitLab / Bitbucket]
        LLM_API[LLM APIs<br/>Anthropic / OpenAI / Ollama]
        MCP[MCP Servers<br/>Tavily, Context7, etc.]
    end

    subgraph "File System"
        BRAIN[brain/<br/>Obsidian Vault]
        REPOS[.company-repos/<br/>Cloned project repos]
        WT[.agent-worktrees/<br/>Per-agent isolated copies]
    end

    UI --> API_CLIENT
    RT --> DB_ADAPTER
    API_CLIENT --> GW
    GW --> AUTH
    AUTH --> HD
    AUTH --> TP
    AUTH --> CEO_E
    TP --> AR
    AR --> CR
    AR --> HR
    AR --> BR
    AR --> LR
    CR --> LLM_API
    LR --> LLM_API
    TP --> WM
    WM --> GIT
    RM --> GIT
    HD --> TP
    MM --> DB_ADAPTER
    GW --> DB_ADAPTER
    DB_ADAPTER --> SB
    DB_ADAPTER --> PG
    DB_ADAPTER --> SQLITE
    MM --> BRAIN
    RM --> REPOS
    WM --> WT
```

### Key Architectural Decisions

| Decision | Current State | OSS Target | Rationale |
|----------|--------------|------------|-----------|
| Database | Hardcoded Supabase client in `server/supabaseAdmin.ts` and `src/lib/supabase.ts` | Adapter pattern — `DatabaseAdapter` interface | Users run Postgres, SQLite, MySQL, or Supabase |
| LLM Provider | `@anthropic-ai/claude-agent-sdk` in `claudeRunner.ts` | `LLMAdapter` interface with provider implementations | Users choose Claude, GPT-4, Ollama, etc. |
| Auth | None — `server/supabaseAdmin.ts` uses service role key, bypasses RLS | JWT + API key auth middleware | Multi-tenant security is critical for self-hosted |
| Realtime | Supabase Realtime channels in `useRealtimeSync.ts` | SSE/WebSocket fallback when not using Supabase | Server-Sent Events work everywhere |
| Config | `.env` files only | YAML/TOML config file + env override + CLI wizard | Better DX for self-hosted setup |

---

## 2. Data Model — Entity Relationships

### 2.1 Current Schema (Inferred from Code)

From `database.types.ts`, `server/index.ts` (all insert/select calls), and `ticketProcessor.ts`:

```mermaid
erDiagram
    USERS ||--o{ COMPANIES : owns
    COMPANIES ||--o{ AGENTS : employs
    COMPANIES ||--o{ GOALS : has
    COMPANIES ||--o{ DELEGATIONS : tracks
    COMPANIES ||--o{ TICKETS : contains
    COMPANIES ||--o{ SPRINTS : schedules
    COMPANIES ||--o{ MERGE_REQUESTS : reviews
    COMPANIES ||--o{ PROJECT_PLANS : has
    COMPANIES ||--o{ ACTIVITY_LOG : logs
    COMPANIES ||--o{ AUDIT_LOG : audits
    COMPANIES ||--o{ NOTIFICATIONS : sends
    COMPANIES ||--o{ ENV_VARS : stores
    COMPANIES ||--o{ CONFIGS : configures

    AGENTS ||--o{ TICKETS : assigned
    AGENTS ||--o{ AGENT_SESSIONS : runs
    AGENTS ||--o{ TOKEN_USAGE : consumes
    AGENTS ||--o{ DELEGATIONS : receives
    AGENTS ||--o{ MERGE_REQUESTS : creates

    TICKETS ||--o{ TICKET_COMMENTS : has
    TICKETS ||--o| MERGE_REQUESTS : produces
    TICKETS }o--|| SPRINTS : belongs_to

    GOALS ||--o{ GOALS : parent_child

    PROJECT_PLANS ||--o{ PLAN_COMMENTS : has

    USERS {
        uuid id PK
        string email
        string password_hash
        string display_name
        jsonb settings
        timestamp created_at
    }

    COMPANIES {
        uuid id PK
        uuid user_id FK
        string name
        int budget
        int budget_spent
        enum status
        string ceo_goal
        string repo_url
        string repo_branch
        string repo_path
        string repo_status
        string repo_error
        timestamp repo_last_synced_at
        string git_auth_method
        string git_token_encrypted
        string office_layout_id
        boolean auto_approve
        int heartbeat_interval_ms
        timestamp created_at
        timestamp updated_at
    }

    AGENTS {
        uuid id PK
        uuid company_id FK
        string name
        string role
        enum status
        string color
        int tile_col
        int tile_row
        int monthly_cost
        uuid reports_to FK
        string assigned_task
        int progress
        int sprite_index
        string system_prompt
        jsonb skills
        jsonb memory
        string runtime_type
        jsonb runtime_config
        string active_session_id
        float budget_limit
        float budget_spent
        float total_cost_usd
        enum lifecycle_status
        timestamp last_heartbeat
        string heartbeat_status
        timestamp created_at
    }

    TICKETS {
        uuid id PK
        uuid company_id FK
        uuid agent_id FK
        uuid sprint_id FK
        uuid merge_request_id FK
        string title
        text description
        enum status
        int priority
        string board_column
        int story_points
        jsonb goal_ancestry
        jsonb result
        string error_message
        timestamp completed_at
        timestamp created_at
    }

    SPRINTS {
        uuid id PK
        uuid company_id FK
        string name
        string goal
        enum status
        timestamp created_at
    }

    MERGE_REQUESTS {
        uuid id PK
        uuid company_id FK
        uuid ticket_id FK
        uuid agent_id FK
        string branch_name
        string target_branch
        enum status
        int files_changed
        int insertions
        int deletions
        text diff_summary
        string title
        timestamp created_at
    }

    GOALS {
        uuid id PK
        uuid company_id FK
        uuid parent_goal_id FK
        string title
        text description
        uuid assigned_to FK
        enum status
        int progress
        timestamp created_at
    }

    DELEGATIONS {
        uuid id PK
        uuid company_id FK
        uuid goal_id FK
        uuid to_agent_id FK
        string to_role
        string task
        int progress
        timestamp created_at
    }

    TOKEN_USAGE {
        uuid id PK
        uuid agent_id FK
        uuid company_id FK
        int input_tokens
        int output_tokens
        float cost_usd
        string model
        timestamp invoked_at
    }

    AGENT_SESSIONS {
        uuid id PK
        uuid agent_id FK
        uuid company_id FK
        text system_prompt
        enum status
        timestamp last_invoked_at
        int total_input_tokens
        int total_output_tokens
        float total_cost_usd
    }

    CONFIGS {
        uuid id PK
        enum scope
        uuid scope_id FK
        string type
        string key
        jsonb value
        boolean enabled
        timestamp created_at
    }

    PROJECT_PLANS {
        uuid id PK
        uuid company_id FK
        string type
        string title
        text content
        enum status
        string author_type
        timestamp created_at
        timestamp updated_at
    }

    ACTIVITY_LOG {
        uuid id PK
        uuid company_id FK
        uuid agent_id FK
        string type
        text message
        timestamp created_at
    }

    AUDIT_LOG {
        uuid id PK
        uuid company_id FK
        uuid agent_id FK
        uuid ticket_id FK
        string event_type
        text message
        float cost_usd
        timestamp created_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid company_id FK
        string type
        string title
        text message
        string link
        boolean read
        timestamp created_at
    }

    ENV_VARS {
        uuid id PK
        uuid company_id FK
        string key
        string value_encrypted
        timestamp created_at
    }

    TICKET_COMMENTS {
        uuid id PK
        uuid ticket_id FK
        uuid agent_id FK
        string author_type
        text content
        timestamp created_at
    }

    PLAN_COMMENTS {
        uuid id PK
        uuid plan_id FK
        text content
        timestamp created_at
    }
```

### 2.2 New Table: `users` (Required for OSS Multi-Tenancy)

Currently absent from the codebase — `server/supabaseAdmin.ts` uses a service role key that bypasses all RLS. The `USERS` table must be added:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add user_id FK to companies
ALTER TABLE companies ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX idx_companies_user ON companies(user_id);
```

### 2.3 Postgres RPC Functions (Referenced in Code)

The codebase calls these Supabase RPC functions that need SQL definitions for self-hosted:

```sql
-- Referenced in ticketProcessor.ts line 17
CREATE OR REPLACE FUNCTION claim_next_ticket(p_company_id UUID)
RETURNS UUID AS $$
DECLARE v_ticket_id UUID;
BEGIN
  SELECT id INTO v_ticket_id FROM tickets
  WHERE company_id = p_company_id AND status = 'approved'
  ORDER BY priority ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_ticket_id IS NOT NULL THEN
    UPDATE tickets SET status = 'in_progress' WHERE id = v_ticket_id;
  END IF;
  
  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql;

-- Referenced in heartbeatDaemon.ts line 47 and api.ts line 455
CREATE OR REPLACE FUNCTION check_stale_agents()
RETURNS VOID AS $$
BEGIN
  UPDATE agents SET heartbeat_status = 'stale'
  WHERE heartbeat_status = 'alive'
    AND last_heartbeat < now() - interval '2 minutes';
    
  UPDATE agents SET heartbeat_status = 'dead', status = 'offline'
  WHERE heartbeat_status = 'stale'
    AND last_heartbeat < now() - interval '5 minutes';
END;
$$ LANGUAGE plpgsql;
```

---

## 3. API Design — RESTful Endpoint Architecture

### 3.1 Current Endpoints (from `server/index.ts` + `orchestratorApi.ts`)

Organized by domain, with request/response shapes derived from actual code:

#### **System**
| Method | Path | Request | Response | Source |
|--------|------|---------|----------|--------|
| `GET` | `/api/health` | — | `{ status, timestamp, services }` | `index.ts:405` |
| `GET` | `/api/daemon/status` | — | `{ running: boolean }` | `index.ts` |
| `POST` | `/api/daemon/start` | — | `{ success: true }` | `index.ts` |
| `POST` | `/api/daemon/stop` | — | `{ success: true }` | `index.ts` |

#### **Companies**
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/companies` | — | `CompanyRow[]` (via Supabase client) |
| `POST` | `/api/companies` | `{ name, budget }` | `CompanyRow` |
| `DELETE` | `/api/companies/:id` | — | `{ success }` |
| `POST` | `/api/companies/:id/review` | `{ requirements? }` | `ProjectOverviewResult` |

#### **Goals & Delegation**
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/assign-goal` | `{ companyId, goal }` | `{ success, plan: DelegationPlan, cost, sessionId }` |

#### **Agents**
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/hire-agent` | `{ companyId, mode, role, name?, systemPrompt?, skills?, model?, runtimeType?, budgetLimit? }` | `{ success, agent }` |
| `DELETE` | `/api/agents/:id` | — | `{ success }` |
| `PATCH` | `/api/agents/:id/lifecycle` | `{ status: 'active'\|'paused'\|'throttled'\|'terminated' }` | `{ success }` |
| `PATCH` | `/api/agents/:id/budget` | `{ budget_limit: number }` | `{ success }` |
| `POST` | `/api/agents/:id/inject-skill` | `{ skill: string }` | `{ success }` |

#### **Tickets & Approvals**
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/tickets/:companyId` | — | `Ticket[]` |
| `GET` | `/api/ticket-status/:companyId` | — | `Record<string, number>` |
| `PATCH` | `/api/tickets/:id` | `{ ...updates }` | `Ticket` |
| `PATCH` | `/api/tickets/:id/column` | `{ board_column }` | `Ticket` |
| `POST` | `/api/approve/:id` | `{ approvedBy }` | `{ success }` |
| `POST` | `/api/reject/:id` | `{ reason? }` | `{ success }` |
| `POST` | `/api/approve-all/:companyId` | — | `{ approved: number }` |

#### **Merge Requests**
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/companies/:id/merge-requests` | — | `MergeRequest[]` |
| `POST` | `/api/merge-requests/:id/merge` | — | `{ success, message }` |
| `POST` | `/api/merge-requests/:id/reject` | — | `{ success }` |
| `GET` | `/api/merge-requests/:id/diff` | — | `{ diff: string }` |

#### **Sprints**
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/companies/:id/sprints` | — | `Sprint[]` |
| `POST` | `/api/companies/:id/sprints` | `{ name, goal, status? }` | `Sprint` |
| `POST` | `/api/sprints/:id/complete` | — | `{ success }` |

#### **Plans**
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/companies/:id/plans` | `?type=` | `ProjectPlan[]` |
| `POST` | `/api/companies/:id/plans` | `{ type, title, content, status?, author_type? }` | `ProjectPlan` |
| `PATCH` | `/api/plans/:id` | `{ content }` | `ProjectPlan` |
| `POST` | `/api/plans/:id/approve` | — | `{ success }` |
| `POST` | `/api/plans/:id/comments` | `{ content }` | `PlanComment` |
| `GET` | `/api/plans/:id/comments` | — | `PlanComment[]` |

#### **Repository**
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/companies/:id/repo` | `{ repoUrl, branch?, authMethod?, token? }` | `{ success, repoPath }` |
| `GET` | `/api/companies/:id/repo` | — | `RepoStatus` |
| `POST` | `/api/companies/:id/repo/sync` | — | `{ success }` |
| `DELETE` | `/api/companies/:id/repo` | — | `{ success }` |

#### **Configs (3-Level Cascade)**
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/configs` | `?scope=&scope_id=&type=` | `Config[]` |
| `GET` | `/api/configs/effective/:agentId` | — | `Config[]` (merged cascade) |
| `POST` | `/api/configs` | `{ scope, scope_id?, type, key, value, enabled? }` | `Config` |
| `PATCH` | `/api/configs/:id` | `{ value?, enabled?, key? }` | `Config` |
| `DELETE` | `/api/configs/:id` | — | `{ success }` |

#### **Notifications**
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/notifications` | — | `Notification[]` |
| `GET` | `/api/notifications/count` | — | `{ count: number }` |
| `POST` | `/api/notifications/:id/read` | — | `{ success }` |
| `POST` | `/api/notifications/read-all` | — | `{ success }` |

### 3.2 New Endpoints for OSS (Phase 1)

```
POST   /api/auth/register     { email, password, displayName }
POST   /api/auth/login         { email, password } → { token, user }
POST   /api/auth/refresh       { refreshToken } → { token }
GET    /api/auth/me             → { user }

GET    /api/setup/status       → { configured: boolean, dbType, llmProviders[] }
POST   /api/setup/init         { dbConfig, llmConfig } → { success }

GET    /api/providers           → { llm: [], db: string, realtime: string }
POST   /api/providers/test     { type, config } → { success, latencyMs }
```

---

## 4. Security Architecture

### 4.1 Current State — Critical Gaps

| Vulnerability | Location | Severity |
|---------------|----------|----------|
| **No authentication** | `server/index.ts` — no auth middleware | 🔴 Critical |
| **Service role key on server** | `server/supabaseAdmin.ts:16` — bypasses all RLS | 🔴 Critical |
| **Anon key exposed to browser** | `src/lib/supabase.ts:3-4` — `VITE_SUPABASE_ANON_KEY` | 🟡 Medium (expected for Supabase, but no RLS) |
| **Git PAT stored as plaintext** | `repoManager.ts:39` — `git_token_encrypted` is not actually encrypted | 🔴 Critical |
| **No CORS origin validation** | `index.ts:395-400` — regex allows any localhost port | 🟡 Medium |
| **No rate limiting** | All endpoints | 🟡 Medium |
| **No input validation** | All `req.body` destructuring has minimal checks | 🟡 Medium |

### 4.2 Target Security Architecture

```mermaid
graph LR
    subgraph "Client"
        B[Browser]
    end
    
    subgraph "API Gateway"
        RL[Rate Limiter<br/>express-rate-limit]
        CORS_V[CORS Validator<br/>allowlist-based]
        AUTH_MW[Auth Middleware<br/>JWT verification]
        RBAC[RBAC Guard<br/>owner/admin/viewer]
        VAL[Input Validator<br/>zod schemas]
    end
    
    subgraph "Server"
        ROUTES[Express Routes]
        CRYPTO[Encryption Service<br/>AES-256-GCM]
    end
    
    subgraph "Database"
        RLS[Row-Level Security<br/>user_id = auth.uid()]
    end
    
    B -->|HTTPS| RL --> CORS_V --> AUTH_MW --> RBAC --> VAL --> ROUTES
    ROUTES --> CRYPTO
    ROUTES --> RLS
```

#### Authentication Flow

```typescript
// NEW: server/middleware/auth.ts
interface AuthConfig {
  type: 'jwt' | 'api_key' | 'supabase_auth';
  jwtSecret?: string;
  apiKeys?: string[];  // for CLI / programmatic access
}

// Middleware chain:
// 1. Extract token from Authorization header (Bearer) or X-API-Key
// 2. Verify JWT signature / lookup API key in DB
// 3. Attach user to req.user
// 4. RBAC: check req.user.id === company.user_id for company-scoped routes
```

#### Row-Level Security (for Supabase deployments)

```sql
-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
-- ... (all 16 tables)

-- Policy: users see only their companies
CREATE POLICY "Users see own companies" ON companies
  FOR ALL USING (user_id = auth.uid());

-- Policy: cascade to agents via company
CREATE POLICY "Users see own agents" ON agents
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
  );
```

#### Secrets Encryption

```typescript
// NEW: server/services/encryption.ts — replaces plaintext git_token_encrypted
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(plaintext: string): string { /* ... */ }
export function decrypt(ciphertext: string): string { /* ... */ }
```

---

## 5. Deployment Topology

### 5.1 Current Deployment

```
┌──────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Vercel (SPA)    │────▶│  localhost:3001    │────▶│  Supabase Cloud │
│  React frontend  │     │  Express server    │     │  PostgreSQL     │
│  vercel.json     │     │  (manual start)    │     │  Realtime       │
└──────────────────┘     └───────────────────┘     └─────────────────┘
```

**Problems:** Server is local-only. No Docker. No reverse proxy. No TLS on orchestrator.

### 5.2 Target Deployment — Self-Hosted

```mermaid
graph TB
    subgraph "Option A: Docker Compose (recommended)"
        DC[docker-compose.yml]
        
        subgraph "Containers"
            NGINX[Nginx Reverse Proxy<br/>:443 TLS termination]
            WEB[ceo-sim-web<br/>Vite built SPA<br/>served by Nginx]
            SERVER[ceo-sim-server<br/>Express orchestrator<br/>+ heartbeat daemon]
            DB[PostgreSQL 16<br/>or SQLite volume mount]
        end
        
        NGINX --> WEB
        NGINX --> SERVER
        SERVER --> DB
    end
    
    subgraph "Option B: Single Binary (future)"
        BIN[ceo-sim binary<br/>embedded frontend + server + SQLite]
    end
    
    subgraph "Option C: Cloud PaaS"
        VCL[Vercel / Netlify<br/>frontend]
        RW[Railway / Render / Fly.io<br/>server]
        SUP[Supabase / Neon<br/>database]
    end
```

### 5.3 Docker Compose Specification

```yaml
# docker-compose.yml
version: '3.9'
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    ports: ["3000:80"]
    
  server:
    build:
      context: .
      dockerfile: Dockerfile.server
    ports: ["3001:3001"]
    environment:
      - DATABASE_URL=postgresql://ceo:${DB_PASSWORD}@db:5432/ceosim
      - LLM_PROVIDER=${LLM_PROVIDER:-anthropic}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    volumes:
      - repos:/app/.company-repos
      - brain:/app/brain
    depends_on: [db]
    
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ceosim
      POSTGRES_USER: ceo
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d

volumes:
  pgdata:
  repos:
  brain:
```

### 5.4 CI/CD Pipeline

```mermaid
graph LR
    PR[Pull Request] --> LINT[ESLint + TypeCheck]
    LINT --> TEST[Vitest 36 tests]
    TEST --> BUILD[Vite Build]
    BUILD --> DOCKER[Docker Build + Push]
    DOCKER --> STAGE[Staging Deploy]
    STAGE --> E2E[E2E Smoke Tests]
    E2E --> PROD[Production Release<br/>GitHub Release + Docker Hub]
```

**GitHub Actions** workflow:
- `main` → Build + publish Docker images to GitHub Container Registry
- Tags (`v*`) → GitHub Release + npm publish for CLI
- PRs → Lint + test + type-check only

---

## 6. Observability — Logging, Monitoring, Alerting

### 6.1 Current State

The codebase uses only `console.log/warn/error`:
- `heartbeatDaemon.ts:15` — `console.log('[heartbeat] Daemon started')`
- `ticketProcessor.ts` — `console.warn('[git] Post-processing failed')`
- `repoManager.ts:71` — `console.log('[repo] Cloning...')`

The `audit_log` table in Supabase stores structured events (heartbeat pulses, budget checks), and `activity_log` stores agent-level events.

### 6.2 Target Observability Stack

```mermaid
graph TB
    subgraph "Application"
        LOG[Structured Logger<br/>pino / winston]
        METRICS[Metrics Collector<br/>prom-client]
        TRACES[Request Tracer<br/>correlation IDs]
    end
    
    subgraph "Storage (pluggable)"
        STDOUT[stdout / file<br/>default]
        PROM[Prometheus<br/>optional]
        LOKI[Loki / ELK<br/>optional]
    end
    
    subgraph "Dashboards"
        GRAFANA[Grafana<br/>optional]
        BUILTIN[Built-in /api/metrics<br/>JSON endpoint]
    end
    
    LOG --> STDOUT
    LOG --> LOKI
    METRICS --> BUILTIN
    METRICS --> PROM
    PROM --> GRAFANA
    LOKI --> GRAFANA
```

#### Key Metrics to Expose

| Metric | Type | Source |
|--------|------|--------|
| `ceosim_tickets_processed_total` | Counter | `ticketProcessor.ts` |
| `ceosim_ticket_processing_duration_seconds` | Histogram | `ticketProcessor.ts` |
| `ceosim_agent_cost_usd_total` | Counter | `agentRunner.ts:78` |
| `ceosim_agent_tokens_total` | Counter | `agentRunner.ts:78` |
| `ceosim_heartbeat_cycle_duration_seconds` | Histogram | `heartbeatDaemon.ts` |
| `ceosim_active_agents` | Gauge | `agents` table count |
| `ceosim_merge_requests_open` | Gauge | `merge_requests` table count |
| `ceosim_git_operations_total` | Counter | `repoManager.ts`, `worktreeManager.ts` |
| `ceosim_errors_total` | Counter | All catch blocks |

#### Structured Logging Format

```typescript
// Replace: console.log('[heartbeat] Daemon started')
// With:
logger.info({ 
  component: 'heartbeat', 
  event: 'daemon_started', 
  intervalMs: 30000,
  companiesCount: companies.length 
});
```

#### Built-in Health Dashboard

New endpoint `GET /api/metrics` returns:

```json
{
  "uptime_seconds": 3600,
  "daemon": { "running": true, "last_tick": "2026-04-11T10:00:00Z", "cycles": 120 },
  "companies": { "total": 5, "active": 3 },
  "agents": { "total": 15, "working": 4, "idle": 8, "blocked": 2, "dead": 1 },
  "tickets": { "queued": 12, "in_progress": 3, "completed_today": 8, "failed_today": 1 },
  "costs": { "total_usd": 42.50, "today_usd": 3.20 },
  "git": { "repos_cloned": 5, "worktrees_active": 3 }
}
```

---

## 7. Scalability Plan

### 7.1 Current Bottlenecks

| Bottleneck | Location | Impact |
|------------|----------|--------|
| **Sequential ticket processing** | `heartbeatDaemon.ts:28-41` — iterates companies serially, processes 1 ticket per company per tick | Blocks at ~10 concurrent agents |
| **No connection pooling** | `supabaseAdmin.ts` — single Supabase client | DB connection exhaustion |
| **Sync git operations** | `execSync` calls in `ticketProcessor.ts`, `worktreeManager.ts`, `repoManager.ts` | Blocks event loop during clone/push |
| **Memory: all data in Zustand** | `dashboardStore.ts` — loads ALL companies + ALL agents on init | Browser crashes at scale |
| **No caching** | Every API call hits DB directly | Unnecessary load |

### 7.2 Scaling Architecture

```mermaid
graph TB
    subgraph "Phase 1: Single Server (1-10 projects)"
        SS_API[Express Server]
        SS_HD[Heartbeat Daemon<br/>in-process]
        SS_DB[(PostgreSQL)]
        SS_API --> SS_DB
        SS_HD --> SS_DB
    end
    
    subgraph "Phase 2: Worker Separation (10-50 projects)"
        P2_API[API Server<br/>stateless]
        P2_QUEUE[Redis / BullMQ<br/>job queue]
        P2_W1[Worker 1<br/>agent execution]
        P2_W2[Worker 2<br/>agent execution]
        P2_DB[(PostgreSQL<br/>+ connection pool)]
        
        P2_API --> P2_QUEUE
        P2_QUEUE --> P2_W1
        P2_QUEUE --> P2_W2
        P2_W1 --> P2_DB
        P2_W2 --> P2_DB
    end
    
    subgraph "Phase 3: Distributed (50+ projects)"
        P3_LB[Load Balancer]
        P3_API1[API Server 1]
        P3_API2[API Server 2]
        P3_QUEUE[Redis Cluster]
        P3_WN[N Workers<br/>auto-scale]
        P3_DB[(PostgreSQL<br/>read replicas)]
        P3_S3[S3 / Minio<br/>repo storage]
        
        P3_LB --> P3_API1
        P3_LB --> P3_API2
        P3_API1 --> P3_QUEUE
        P3_QUEUE --> P3_WN
        P3_WN --> P3_DB
        P3_WN --> P3_S3
    end
```

### 7.3 Specific Optimization Plan

#### Caching Strategy

```typescript
// NEW: server/cache.ts
interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// Implementations: InMemoryCache (default), RedisCache (optional)

// Cache targets with TTLs:
// - Company list:         30s  (invalidate on create/delete)
// - Agent list per company: 10s (invalidate on hire/fire/status change)
// - Config effective:      60s (invalidate on config CRUD)
// - Sprint list:           30s (invalidate on sprint create/complete)
// - Notification count:     5s (invalidate on new notification)
```

#### Async Git Operations

```typescript
// REFACTOR: Replace execSync → exec (promisified) in:
// - worktreeManager.ts:39  (createWorktree)
// - worktreeManager.ts:69  (removeWorktree)  
// - repoManager.ts:56,72   (git fetch/clone)
// - ticketProcessor.ts:119-128 (git rebase/merge)
// - ticketProcessor.ts:170-210 (git add/commit/push/diff)

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
```

#### Parallel Ticket Processing

```typescript
// REFACTOR heartbeatDaemon.ts — process companies in parallel
const CONCURRENCY_LIMIT = 5;

// Replace serial loop:
// for (const co of companies) { await processNextTicket(...) }

// With bounded parallelism:
import pLimit from 'p-limit';
const limit = pLimit(CONCURRENCY_LIMIT);
await Promise.allSettled(
  companies.map(co => limit(() => processNextTicket(co.id, companyCwd)))
);
```

#### Database Connection Pooling

```typescript
// For raw PostgreSQL (non-Supabase) deployments:
import { Pool } from 'pg';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,              // max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### Frontend Pagination

```typescript
// REFACTOR: dashboardStore.ts loadFromBackend
// Current: loads ALL companies + ALL agents on init
// Target: paginated loading with virtualization

// API: GET /api/companies?page=1&limit=20&status=active
// Frontend: React-virtualized for the company grid
```

---

## 8. Pluggable Provider Architecture (OSS Core)

The most critical architectural change for open-source readiness — every vendor dependency must be behind an interface.

### 8.1 Database Adapter

```typescript
// NEW: server/adapters/database.ts
export interface DatabaseAdapter {
  // Core CRUD
  query<T>(table: string, filters: Filter[]): Promise<T[]>;
  insert<T>(table: string, data: Partial<T>): Promise<T>;
  update<T>(table: string, filters: Filter[], data: Partial<T>): Promise<T>;
  delete(table: string, filters: Filter[]): Promise<void>;
  
  // Transactions
  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  
  // RPC (for claim_next_ticket, check_stale_agents)
  rpc<T>(functionName: string, params: Record<string, any>): Promise<T>;
  
  // Realtime (optional)
  subscribe?(table: string, event: string, callback: (payload: any) => void): Subscription;
  
  // Migrations
  migrate(direction: 'up' | 'down'): Promise<void>;
}

// Implementations:
// - SupabaseAdapter (current, wraps @supabase/supabase-js)
// - PostgresAdapter (pg + node-pg-migrate)
// - SQLiteAdapter (better-sqlite3, single-user mode)
```

### 8.2 LLM Adapter

```typescript
// NEW: server/adapters/llm.ts
export interface LLMAdapter {
  execute(request: LLMRequest): AsyncIterable<LLMEvent>;
  estimateCost(inputTokens: number, outputTokens: number, model: string): number;
  listModels(): Promise<ModelInfo[]>;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt: string;
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
  cwd: string;
  tools: string[];
  persistSession?: boolean;
  resumeSessionId?: string;
}

export interface LLMEvent {
  type: 'assistant' | 'tool_use' | 'result' | 'error';
  content?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  sessionId?: string;
}

// Implementations:
// - ClaudeAgentSDKAdapter (current, wraps @anthropic-ai/claude-agent-sdk)
// - OpenAIAdapter (openai SDK + function calling)
// - OllamaAdapter (local models via HTTP)
// - LiteLLMAdapter (proxy to 100+ models)
```

### 8.3 Realtime Adapter

```typescript
// NEW: server/adapters/realtime.ts
export interface RealtimeAdapter {
  subscribe(channel: string, tables: string[], callback: (event: RealtimeEvent) => void): Subscription;
  broadcast(channel: string, event: RealtimeEvent): void;
}

// Implementations:
// - SupabaseRealtimeAdapter (current Supabase Realtime channels)
// - SSEAdapter (Server-Sent Events via Express, universal fallback)
// - WebSocketAdapter (ws library)
```

### 8.4 Configuration File

```yaml
# ceo-simulator.config.yaml (NEW — replaces .env for structured config)
server:
  port: 3001
  cors_origins: ["http://localhost:5173"]

database:
  provider: "postgresql"  # postgresql | supabase | sqlite
  url: "postgresql://ceo:password@localhost:5432/ceosim"
  # OR for Supabase:
  # provider: "supabase"
  # url: "https://project.supabase.co"
  # anon_key: "..."
  # service_role_key: "..."

llm:
  default_provider: "anthropic"
  providers:
    anthropic:
      api_key: "${ANTHROPIC_API_KEY}"
      default_model: "claude-sonnet-4-20250514"
    openai:
      api_key: "${OPENAI_API_KEY}"
      default_model: "gpt-4o"
    ollama:
      base_url: "http://localhost:11434"
      default_model: "llama3"

auth:
  type: "jwt"  # jwt | api_key | none (dev only)
  jwt_secret: "${JWT_SECRET}"

encryption:
  key: "${ENCRYPTION_KEY}"

heartbeat:
  interval_ms: 30000
  concurrency: 5

git:
  repos_dir: "./.company-repos"
  worktrees_dir: "./.agent-worktrees"
```

---

## 9. Migration Plan — Phased Implementation

### Phase 0: Foundation (Week 1-2)
- [ ] Create `migrations/` directory with raw SQL for all 16 tables + 2 RPC functions
- [ ] Add `DatabaseAdapter` interface + `SupabaseAdapter` (wrapping current code)
- [ ] Add structured logging (pino) replacing all `console.log`
- [ ] Add `zod` schemas for all API request validation
- [ ] Add `ceo-simulator.config.yaml` loader with env override

### Phase 1: Auth & Security (Week 3-4)
- [ ] Add `users` table + JWT auth middleware
- [ ] Add RBAC — company ownership check on all routes
- [ ] Encrypt `git_token_encrypted` field with AES-256-GCM
- [ ] Add rate limiting (express-rate-limit)
- [ ] Write RLS policies for Supabase deployments

### Phase 2: Provider Abstraction (Week 5-8)
- [ ] `LLMAdapter` interface + `ClaudeAgentSDKAdapter`
- [ ] `PostgresAdapter` (raw pg, no Supabase dependency)
- [ ] `SQLiteAdapter` for zero-config local development
- [ ] `SSERealtimeAdapter` as universal fallback
- [ ] Refactor `claudeRunner.ts` → uses `LLMAdapter` from config

### Phase 3: Developer Experience (Week 9-10)
- [ ] `npx create-ceo-simulator` CLI scaffolding
- [ ] Docker Compose (web + server + postgres)
- [ ] `npm run setup` interactive wizard
- [ ] GitHub Actions CI/CD pipeline
- [ ] Comprehensive README + docs site (Docusaurus/VitePress)

### Phase 4: Scale & Polish (Week 11-12)
- [ ] Async git operations (replace `execSync`)
- [ ] Parallel ticket processing with concurrency limit
- [ ] In-memory cache with configurable Redis backend
- [ ] `/api/metrics` endpoint + Prometheus export
- [ ] E2E test suite (Playwright)

---

## 10. Key Code Refactors Required

| File | Current Pattern | Target Pattern | Effort |
|------|----------------|----------------|--------|
| `server/supabaseAdmin.ts` | Direct Supabase client | `DatabaseAdapter` factory | Medium |
| `server/agents/claudeRunner.ts` | Hardcoded `@anthropic-ai/claude-agent-sdk` | `LLMAdapter` dispatch | Large |
| `server/agents/agentRunner.ts` | Direct `supabase.from()` calls (lines 39-109) | Inject `DatabaseAdapter` | Medium |
| `server/ticketProcessor.ts` | `execSync` git calls (16 instances) | `execAsync` + error handling | Medium |
| `server/heartbeatDaemon.ts` | Serial company loop | Parallel with p-limit | Small |
| `server/index.ts` | 800+ line monolith | Split into route modules | Medium |
| `server/repoManager.ts` | `git_token_encrypted` is plaintext | AES-256-GCM encryption | Small |
| `src/lib/supabase.ts` | Direct Supabase client | Config-driven (Supabase OR fetch→server) | Medium |
| `src/hooks/useRealtimeSync.ts` | Supabase Realtime only | SSE fallback when Supabase unavailable | Medium |
| `src/store/dashboardStore.ts` | Loads all data on init | Paginated + lazy loading | Medium |

---

This architecture transforms CEO Simulator from a **single-vendor prototype** into a **portable, self-hosted multi-agent framework** where users bring their own database, LLM provider, and deployment infrastructure — while keeping the current Supabase + Claude stack as a first-class default.

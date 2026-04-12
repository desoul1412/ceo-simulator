---
tags: [database, abstraction, adapter, supabase, postgresql, sqlite, backend, infrastructure, api]
date: 2026-04-12
status: active
---

# Database Abstraction Spec

**Linked from:** [[00-Index]], [[Migration-Spec]], [[Docker-Deployment-Spec]], [[Auth-System-Spec]], [[Factory-Operations-Manual]]

**Version:** 1.0  
**Author:** Liam Chen (Project Manager)  
**Status:** Active specification — source of truth for the `DatabaseAdapter` interface and backend-switching architecture

---

## 1. Overview

This spec defines a `DatabaseAdapter` interface that abstracts every Supabase API call pattern present in the CEO Simulator codebase. The abstraction enables three interchangeable backends gated by a single `DATABASE_MODE` environment variable:

| Backend | Mode Value | Use Case |
|---------|-----------|----------|
| Supabase JS Client (`@supabase/supabase-js`) | `supabase` | Production (Vercel + Supabase cloud) — default |
| Raw PostgreSQL (`pg` driver) | `postgres` | Self-hosted Docker deployment — see [[Docker-Deployment-Spec]] |
| SQLite (`better-sqlite3`) | `sqlite` | Local dev / offline / unit tests — no network required |

**Core principle:** all server-side code and `src/lib/api.ts` must reference `DatabaseAdapter`, never the Supabase client directly. The concrete adapter is resolved once at startup and injected.

**Scope of this document:**
- Section 2: `QueryBuilder` interface — fluent chain methods (mirrors Supabase PostgREST DSL)
- Section 3: `DatabaseAdapter` interface — top-level entry points (`.from()`, `.rpc()`, `.channel()`)
- Section 4: Call-pattern catalog — every distinct pattern found in the codebase, with source references
- Section 5: Repository interfaces — per-table typed wrappers on top of `DatabaseAdapter`
- Section 6: Backend implementations — notes per adapter
- Section 7: `DATABASE_MODE` env gate and startup resolution
- Section 8: Error handling and `AdapterError` type
- Section 9: Realtime abstraction
- Section 10: Acceptance criteria

---

## 2. `QueryBuilder<T>` Interface

The `QueryBuilder<T>` mirrors the Supabase PostgREST fluent chain. Every method returns `this` (for chaining) except terminal methods that return `Promise<AdapterResult<T>>`.

```typescript
// src/lib/db/QueryBuilder.ts

export interface AdapterResult<T> {
  data: T | null;
  error: AdapterError | null;
}

/**
 * Fluent query builder — mirrors Supabase PostgREST chaining.
 * All filter/modifier methods return `this` for chaining.
 * Terminal methods return a Promise that executes the query.
 */
export interface QueryBuilder<T = any> extends Promise<AdapterResult<T[]>> {

  // ── Column selection ──────────────────────────────────────────────────────
  /**
   * Specify which columns to return.
   * Pass '*' for all columns (default), or a comma-separated string.
   * Nested selects (e.g. 'id, agents(*)') are Supabase-native;
   * non-Supabase backends may flatten or error.
   *
   * Source patterns: P-01, P-02, P-03, P-04, P-05, P-06, P-07, P-08, P-09, P-10, P-11
   */
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): QueryBuilder<T>;

  // ── Mutations ─────────────────────────────────────────────────────────────
  /**
   * Insert one row or an array of rows.
   * Chain .select() after insert to return inserted rows.
   *
   * Source patterns: P-12 (single + .single()), P-13 (array + .select()), P-14 (no return)
   */
  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T>;

  /**
   * Update rows matching the current filter set.
   * MUST be combined with at least one filter (.eq / .in) before execution.
   *
   * Source patterns: P-15 (single filter), P-16 (two filters), P-17 (null value)
   */
  update(data: Partial<T>): QueryBuilder<T>;

  /**
   * Delete rows matching the current filter set.
   * MUST be combined with at least one filter (.eq / .in) before execution.
   *
   * Source patterns: P-18 (equality), P-19 (in-set)
   */
  delete(): QueryBuilder<T>;

  // ── Equality filters ──────────────────────────────────────────────────────
  /**
   * Filter rows where column = value.
   * Multiple .eq() calls are ANDed together.
   *
   * Source patterns: P-01 through P-19 (most common filter — used everywhere)
   */
  eq<K extends keyof T>(column: K, value: T[K]): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;

  /**
   * Filter rows where column != value.
   *
   * Source pattern: P-08 — .neq('id', ticketId) excludes current ticket
   * when checking if agent has another in-progress ticket.
   */
  neq<K extends keyof T>(column: K, value: T[K]): QueryBuilder<T>;
  neq(column: string, value: unknown): QueryBuilder<T>;

  // ── Set membership filters ────────────────────────────────────────────────
  /**
   * Filter rows where column value is in the provided array.
   * SQL: WHERE column IN (v1, v2, ...)
   *
   * Source patterns:
   *   P-02 — .in('company_id', companyIds)  batch-load agents/delegations
   *   P-10 — .in('status', ['approved','open'])  pending task check
   *   P-11 — .in('status', ['open','awaiting_approval','approved','in_progress'])
   *   P-19 — .in('agent_id', agentIds)  bulk delete token_usage/agent_sessions
   */
  in<K extends keyof T>(column: K, values: T[K][]): QueryBuilder<T>;
  in(column: string, values: unknown[]): QueryBuilder<T>;

  // ── Sorting and pagination ────────────────────────────────────────────────
  /**
   * Sort results by column.
   *
   * Source patterns:
   *   P-01 — .order('created_at', { ascending: true })   companies list
   *   P-07 — .order('created_at', { ascending: false })  activity log (newest first)
   */
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryBuilder<T>;

  /**
   * Cap the number of rows returned.
   *
   * Source patterns:
   *   P-07 — .limit(20)   activity log cap
   *   P-08 — .limit(1)    in-progress ticket existence probe
   *   P-10 — .limit(1)    pending task existence probe
   */
  limit(count: number): QueryBuilder<T>;

  // ── Terminal modifiers ────────────────────────────────────────────────────
  /**
   * Assert exactly one row is returned.
   * Resolves with AdapterResult<T> (singular, not T[]).
   * Returns AdapterError (status 404) if 0 rows; error if >1 rows.
   *
   * Source patterns: P-06, P-12 (insert + .single()), P-03 (budget_spent)
   * Used in: api.ts createCompany, assignGoal (goal), tickCompany (budget);
   *          ticketProcessor.ts (ticket, agent, MR, budget_spent fetch)
   */
  single(): Promise<AdapterResult<T>>;
}
```

---

## 3. `DatabaseAdapter` Interface

```typescript
// src/lib/db/DatabaseAdapter.ts

import type { QueryBuilder } from './QueryBuilder';
import type { RealtimeChannel } from './RealtimeChannel';
import type { AdapterResult } from './QueryBuilder';

/**
 * Top-level adapter — resolved once at startup via DATABASE_MODE.
 * Inject everywhere; NEVER import the Supabase client directly
 * in server code or src/lib/api.ts.
 */
export interface DatabaseAdapter {
  /**
   * Start a fluent query chain for a named table.
   * Equivalent to supabase.from('table_name').
   *
   * The generic T should be the Row type from database.types.ts
   * (e.g. CompanyRow, AgentRow, TicketRow).
   *
   * Source: every Supabase call in src/lib/api.ts and server/
   */
  from<T = any>(table: string): QueryBuilder<T>;

  /**
   * Invoke a PostgreSQL stored function (RPC).
   * Translates to: SELECT fn_name(params) or CALL fn_name(params)
   *
   * Source:
   *   api.ts checkStaleAgents()        — rpc('check_stale_agents')
   *   ticketProcessor.ts claimNext()   — rpc('claim_next_ticket', { p_company_id })
   */
  rpc<T = any>(
    fn: string,
    params?: Record<string, unknown>
  ): Promise<AdapterResult<T>>;

  /**
   * Open a Realtime channel for Postgres change notifications.
   * Returns a fluent RealtimeChannel builder.
   *
   * Supabase backend   : native WebSocket multiplexed channel
   * PostgreSQL backend : LISTEN/NOTIFY via dedicated pg.Client connection
   * SQLite backend     : no-op stub (offline/test mode)
   *
   * Source: src/hooks/useRealtimeSync.ts
   */
  channel(name: string): RealtimeChannel;

  /**
   * Remove a previously subscribed Realtime channel.
   *
   * Source: src/hooks/useRealtimeSync.ts — useEffect cleanup callback
   */
  removeChannel(channel: RealtimeChannel): void;
}
```

---

## 4. Call-Pattern Catalog

Every distinct Supabase call pattern found in the codebase, with source reference and SQL equivalent.

### 4.1 Pattern Index

| # | Pattern | Tables | Source File |
|---|---------|--------|------------|
| P-01 | `.from().select('*').order()` | companies | `api.ts:fetchCompanies` |
| P-02 | `.from().select('*').in()` | agents, delegations | `api.ts:fetchCompanies` |
| P-03 | `.from().select('col').eq().single()` | companies, agents | `api.ts:deleteCompany`, `tickCompany` |
| P-04 | `.from().select('col1,col2,...').eq().single()` | agents | `ticketProcessor.ts` |
| P-05 | `.from().select('*').eq()` | agents, delegations, tickets | `api.ts:assignGoal`, `tickCompany` |
| P-06 | `.from().select('*').eq().single()` | tickets, agents | `ticketProcessor.ts` |
| P-07 | `.from().select('*').eq().order().limit()` | activity_log | `api.ts:fetchActivityLog` |
| P-08 | `.from().select('id').eq().eq().neq().limit()` | tickets | `ticketProcessor.ts` |
| P-09 | `.from().select('col1,col2,col3').eq().eq()` | merge_requests | `ticketProcessor.ts` |
| P-10 | `.from().select('id').eq().eq().in().limit()` | tickets | `ticketProcessor.ts` |
| P-11 | `.from().select('id').eq().in()` | tickets | `ticketProcessor.ts` |
| P-12 | `.from().insert({}).select().single()` | companies, goals, merge_requests | `api.ts:createCompany`, `assignGoal` |
| P-13 | `.from().insert([]).select()` | agents, delegations | `api.ts:createCompany`, `assignGoal` |
| P-14 | `.from().insert({})` | activity_log, audit_log, notifications, ticket_comments | multiple |
| P-15 | `.from().update({}).eq()` | companies, agents, delegations, tickets | `api.ts`, `ticketProcessor.ts` |
| P-16 | `.from().update({}).eq().eq()` | goals, delegations | `api.ts:tickCompany`, `ticketProcessor.ts` |
| P-17 | `.from().update({ col: null }).eq()` | tickets | `api.ts:deleteCompany` |
| P-18 | `.from().delete().eq()` | agents, configs, delegations, task_queue, companies | `api.ts:deleteCompany`, `tickCompany` |
| P-19 | `.from().delete().in()` | token_usage, agent_sessions | `api.ts:deleteCompany` |
| P-20 | `.rpc(fn)` | — (DB function) | `api.ts:checkStaleAgents` |
| P-21 | `.rpc(fn, params)` | — (DB function) | `ticketProcessor.ts:processNextTicket` |
| P-22 | `.channel().on('postgres_changes', ...).subscribe()` | agents, companies, delegations | `useRealtimeSync.ts` |
| P-23 | `.removeChannel(channel)` | — | `useRealtimeSync.ts` |

---

### 4.2 Pattern Details

#### P-01 — Select All with Sort
```typescript
// src/lib/api.ts → fetchCompanies()
db.from('companies')
  .select('*')
  .order('created_at', { ascending: true });

// SQL: SELECT * FROM companies ORDER BY created_at ASC;
```

#### P-02 — Select All with Set Membership Filter (batch load)
```typescript
// src/lib/api.ts → fetchCompanies() — load related rows for N companies in 2 queries
db.from('agents').select('*').in('company_id', companyIds);
db.from('delegations').select('*').in('company_id', companyIds);

// SQL: SELECT * FROM agents WHERE company_id IN ('id1','id2',...);
```

#### P-03 — Select Single Column, Single Row
```typescript
// src/lib/api.ts → deleteCompany() — IDs for cascade
db.from('agents').select('id').eq('company_id', companyId);

// src/lib/api.ts → tickCompany() — budget read
db.from('companies').select('budget_spent').eq('id', companyId).single();

// SQL: SELECT id FROM agents WHERE company_id = $1;
// SQL: SELECT budget_spent FROM companies WHERE id = $1 LIMIT 1;
```

#### P-04 — Select Named Columns (scalar projection)
```typescript
// server/ticketProcessor.ts — agent budget check before execution
supabase.from('agents')
  .select('budget_limit, budget_spent, lifecycle_status, name, role')
  .eq('id', agentId)
  .single();

// SQL:
// SELECT budget_limit, budget_spent, lifecycle_status, name, role
// FROM agents WHERE id = $1 LIMIT 1;
```

#### P-05 — Select All Rows for a Parent Entity
```typescript
// src/lib/api.ts → assignGoal(), tickCompany()
db.from('agents').select('*').eq('company_id', companyId);
db.from('delegations').select('*').eq('company_id', companyId);

// SQL: SELECT * FROM agents WHERE company_id = $1;
```

#### P-06 — Fetch Single Row by Primary Key
```typescript
// server/ticketProcessor.ts — fetch claimed ticket
supabase.from('tickets').select('*').eq('id', ticketId).single();

// SQL: SELECT * FROM tickets WHERE id = $1 LIMIT 1;
// → AdapterError status:404 if 0 rows
```

#### P-07 — Select with Sort + Limit (paginated log)
```typescript
// src/lib/api.ts → fetchActivityLog(companyId, limit = 20)
db.from('activity_log')
  .select('*')
  .eq('company_id', companyId)
  .order('created_at', { ascending: false })
  .limit(limit);

// SQL:
// SELECT * FROM activity_log
// WHERE company_id = $1
// ORDER BY created_at DESC
// LIMIT $2;
```

#### P-08 — Multi-Filter Existence Check (neq)
```typescript
// server/ticketProcessor.ts — ensure agent not already processing another ticket
supabase.from('tickets')
  .select('id')
  .eq('agent_id', agentId)
  .eq('status', 'in_progress')
  .neq('id', ticketId)
  .limit(1);

// SQL:
// SELECT id FROM tickets
// WHERE agent_id = $1 AND status = 'in_progress' AND id != $2
// LIMIT 1;
```

#### P-09 — Select Named Columns with Two Equality Filters
```typescript
// server/ticketProcessor.ts — conflict avoidance: list open MRs
supabase.from('merge_requests')
  .select('branch_name, agent_id, diff_summary')
  .eq('company_id', companyId)
  .eq('status', 'open');

// SQL:
// SELECT branch_name, agent_id, diff_summary FROM merge_requests
// WHERE company_id = $1 AND status = 'open';
```

#### P-10 — In-Set Filter with Limit (existence probe)
```typescript
// server/ticketProcessor.ts — check if agent has more pending tasks
supabase.from('tickets')
  .select('id')
  .eq('company_id', companyId)
  .eq('agent_id', agentId)
  .in('status', ['approved', 'open'])
  .limit(1);

// SQL:
// SELECT id FROM tickets
// WHERE company_id = $1 AND agent_id = $2
//   AND status IN ('approved','open')
// LIMIT 1;
```

#### P-11 — In-Set Filter (multi-value status check)
```typescript
// server/ticketProcessor.ts — check all tickets complete for company
supabase.from('tickets')
  .select('id')
  .eq('company_id', companyId)
  .in('status', ['open', 'awaiting_approval', 'approved', 'in_progress']);

// SQL:
// SELECT id FROM tickets
// WHERE company_id = $1
//   AND status IN ('open','awaiting_approval','approved','in_progress');
```

#### P-12 — Insert Single Row, Return Inserted Record
```typescript
// src/lib/api.ts → createCompany(), assignGoal() (goal record)
// server/ticketProcessor.ts → merge_requests
db.from('companies').insert({ name, budget }).select().single();
db.from('goals').insert({ company_id, title, ... }).select().single();
db.from('merge_requests').insert({ ... }).select().single();

// SQL: INSERT INTO companies (name, budget) VALUES ($1,$2) RETURNING *;
// → AdapterError if not exactly 1 row inserted
```

#### P-13 — Insert Multiple Rows, Return All Inserted
```typescript
// src/lib/api.ts → createCompany() (seed agents), assignGoal() (delegations)
db.from('agents').insert(agentInserts).select();
db.from('delegations').insert(delInserts).select();

// SQL: INSERT INTO agents (...) VALUES (...),(...) RETURNING *;
```

#### P-14 — Insert Single Row, No Return (fire-and-forget)
```typescript
// src/lib/api.ts — activity_log events (multiple locations)
// server/ticketProcessor.ts — audit_log, notifications, ticket_comments
db.from('activity_log').insert({ company_id, type, message });
db.from('audit_log').insert({ company_id, agent_id, event_type, message, cost_usd });
db.from('notifications').insert({ company_id, type, title, message, link });
db.from('ticket_comments').insert({ ticket_id, agent_id, author_type, content });

// SQL: INSERT INTO activity_log (company_id, type, message) VALUES ($1,$2,$3);
// (No RETURNING clause)
```

#### P-15 — Update with Single Equality Filter
```typescript
// src/lib/api.ts (most updates), server/ticketProcessor.ts
db.from('tickets').update({ agent_id: null }).eq('company_id', companyId);
db.from('agents').update({ status: 'idle', ... }).eq('id', agentId);
db.from('companies').update({ budget_spent: newSpent }).eq('id', companyId);

// SQL: UPDATE agents SET status=$1, ... WHERE id=$2;
```

#### P-16 — Update with Two Equality Filters
```typescript
// src/lib/api.ts → tickCompany() — complete all in-progress goals
db.from('goals')
  .update({ status: 'completed', progress: 100 })
  .eq('company_id', companyId)
  .eq('status', 'in-progress');

// server/ticketProcessor.ts — set delegation to 100% when ticket done
supabase.from('delegations')
  .update({ progress: 100 })
  .eq('company_id', companyId)
  .eq('to_agent_id', agentId);

// SQL:
// UPDATE goals SET status='completed', progress=100
// WHERE company_id=$1 AND status='in-progress';
```

#### P-17 — Update to Null (soft-nullify FK reference)
```typescript
// src/lib/api.ts → deleteCompany() — preserve tickets but remove agent FK
db.from('tickets').update({ agent_id: null }).eq('company_id', companyId);

// SQL: UPDATE tickets SET agent_id=NULL WHERE company_id=$1;
```

#### P-18 — Delete with Equality Filter
```typescript
// src/lib/api.ts → deleteCompany(), tickCompany()
db.from('agents').delete().eq('company_id', companyId);
db.from('delegations').delete().eq('company_id', companyId);
db.from('companies').delete().eq('id', companyId);

// SQL: DELETE FROM agents WHERE company_id=$1;
```

#### P-19 — Delete with In-Set Filter (bulk delete by FK list)
```typescript
// src/lib/api.ts → deleteCompany()
db.from('token_usage').delete().in('agent_id', agentIds);
db.from('agent_sessions').delete().in('agent_id', agentIds);

// SQL: DELETE FROM token_usage WHERE agent_id IN ($1,$2,...);
```

#### P-20 — RPC with No Parameters
```typescript
// src/lib/api.ts → checkStaleAgents()
db.rpc('check_stale_agents');

// SQL: SELECT check_stale_agents();
// Function: marks agents stale (>5 min) or dead (>30 min) by heartbeat age
// See [[Migration-Spec]] §5 for function DDL
```

#### P-21 — RPC with Parameters
```typescript
// server/ticketProcessor.ts → processNextTicket()
supabase.rpc('claim_next_ticket', { p_company_id: companyId });

// SQL: SELECT claim_next_ticket($1);
// Function: FOR UPDATE SKIP LOCKED — atomic ticket claim, prevents race conditions
```

#### P-22 — Realtime Postgres Change Subscription
```typescript
// src/hooks/useRealtimeSync.ts
supabase
  .channel('realtime-sync')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agents' }, cb)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'companies' }, cb)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'delegations' }, cb)
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'delegations' }, cb)
  .subscribe();

// PostgreSQL equivalent: LISTEN realtime_agents; LISTEN realtime_companies; ...
// Requires pg_notify() trigger functions on each table (see §9.3)
```

#### P-23 — Remove Realtime Channel (cleanup)
```typescript
// src/hooks/useRealtimeSync.ts — useEffect cleanup
supabase.removeChannel(channel);

// PostgreSQL equivalent: UNLISTEN realtime_agents; UNLISTEN realtime_companies; ...
```

---

## 5. Repository Interfaces

Per-table typed wrappers providing domain-semantic method names on top of `DatabaseAdapter`. All application code should use repositories — they hide raw query building.

```typescript
// ── Companies ──────────────────────────────────────────────────────────────

export interface CompanyRepository {
  /** P-01 */ listAll(): Promise<CompanyRow[]>;
  /** P-12 */ create(data: CompanyInsert): Promise<CompanyRow>;
  /** P-15 */ update(id: string, data: CompanyUpdate): Promise<void>;
  /** P-03 */ getBudgetSpent(id: string): Promise<number>;
  /** P-18 */ delete(id: string): Promise<void>;
}

// ── Agents ─────────────────────────────────────────────────────────────────

export interface AgentRepository {
  /** P-02 */ listForCompanies(companyIds: string[]): Promise<AgentRow[]>;
  /** P-05 */ listForCompany(companyId: string): Promise<AgentRow[]>;
  /** P-06 */ getById(id: string): Promise<AgentRow | null>;
  /** P-04 */ getBudgetInfo(id: string): Promise<AgentBudgetInfo | null>;
  /** P-03 */ getIds(companyId: string): Promise<string[]>;
  /** P-13 */ createMany(data: AgentInsert[]): Promise<AgentRow[]>;
  /** P-15 */ update(id: string, data: AgentUpdate): Promise<void>;
  /** P-18 */ deleteForCompany(companyId: string): Promise<void>;
  /** P-20 */ checkStale(): Promise<void>;
}

// ── Goals ──────────────────────────────────────────────────────────────────

export interface GoalRepository {
  /** P-12 */ create(data: GoalInsert): Promise<GoalRow>;
  /** P-16 */ completeAllForCompany(companyId: string): Promise<void>;
}

// ── Delegations ────────────────────────────────────────────────────────────

export interface DelegationRepository {
  /** P-02 */ listForCompanies(companyIds: string[]): Promise<DelegationRow[]>;
  /** P-05 */ listForCompany(companyId: string): Promise<DelegationRow[]>;
  /** P-13 */ createMany(data: DelegationInsert[]): Promise<DelegationRow[]>;
  /** P-15 */ updateProgress(id: string, progress: number): Promise<void>;
  /** P-16 */ completeForAgent(companyId: string, agentId: string): Promise<void>;
  /** P-18 */ deleteForCompany(companyId: string): Promise<void>;
}

// ── Activity Log ───────────────────────────────────────────────────────────

export interface ActivityLogRepository {
  /** P-07 */ listForCompany(companyId: string, limit?: number): Promise<ActivityRow[]>;
  /** P-14 */ insert(data: ActivityInsert): Promise<void>;
}

// ── Tickets ────────────────────────────────────────────────────────────────

export interface TicketRepository {
  /** P-21 */ claimNext(companyId: string): Promise<string | null>;
  /** P-06 */ getById(id: string): Promise<TicketRow | null>;
  /** P-08 */ hasInProgress(agentId: string, excludeTicketId: string): Promise<boolean>;
  /** P-11 */ listOpen(companyId: string): Promise<Pick<TicketRow, 'id'>[]>;
  /** P-10 */ hasPending(companyId: string, agentId: string): Promise<boolean>;
  /** P-15 */ update(id: string, data: TicketUpdate): Promise<void>;
  /** P-17 */ nullifyAgent(companyId: string): Promise<void>;
}

// ── Merge Requests ─────────────────────────────────────────────────────────

export interface MergeRequestRepository {
  /** P-09 */ listOpen(companyId: string): Promise<MRConflictInfo[]>;
  /** P-12 */ create(data: MergeRequestInsert): Promise<MergeRequestRow>;
}

// ── Supporting tables (fire-and-forget inserts) ────────────────────────────

export interface NotificationRepository {
  /** P-14 */ insert(data: NotificationInsert): Promise<void>;
}

export interface AuditLogRepository {
  /** P-14 */ insert(data: AuditLogInsert): Promise<void>;
}

export interface TicketCommentRepository {
  /** P-14 */ insert(data: TicketCommentInsert): Promise<void>;
}
```

---

## 6. Backend Implementations

### 6.1 Supabase Backend (`DATABASE_MODE=supabase`)

**Package:** `@supabase/supabase-js`  
**Auth:** Anon key (client-side, RLS-enforced) OR Service Role key (server-side, bypasses RLS)  
**Realtime:** Native WebSocket channel multiplexing — zero extra infrastructure required

```typescript
// src/lib/db/adapters/SupabaseAdapter.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseAdapter implements DatabaseAdapter {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  from<T>(table: string): QueryBuilder<T> {
    // Zero translation — delegates directly to Supabase client
    return this.client.from(table) as unknown as QueryBuilder<T>;
  }

  rpc<T>(fn: string, params?: Record<string, unknown>) {
    return this.client.rpc(fn, params) as Promise<AdapterResult<T>>;
  }

  channel(name: string): RealtimeChannel {
    return this.client.channel(name) as unknown as RealtimeChannel;
  }

  removeChannel(channel: RealtimeChannel) {
    this.client.removeChannel(channel as any);
  }
}
```

**Two client instances exist:**
- `src/lib/supabase.ts` — anon key, browser client, RLS enforced
- `server/supabaseAdmin.ts` — service role key, bypasses RLS (server only)

Both are wrapped by `SupabaseAdapter` with the appropriate key injected at construction time.

---

### 6.2 PostgreSQL Backend (`DATABASE_MODE=postgres`)

**Package:** `pg` (node-postgres)  
**Connection:** `DATABASE_URL` env var (`postgresql://user:pass@host:5432/db`)  
**Realtime:** `LISTEN`/`NOTIFY` via dedicated `pg.Client` (separate from the Pool)

```typescript
// src/lib/db/adapters/PostgresAdapter.ts
import { Pool } from 'pg';

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  from<T>(table: string): QueryBuilder<T> {
    return new PostgresQueryBuilder<T>(this.pool, table);
  }

  async rpc<T>(fn: string, params?: Record<string, unknown>): Promise<AdapterResult<T>> {
    // Named params → positional $N placeholders
    const keys = Object.keys(params ?? {});
    const values = keys.map(k => params![k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const sql = keys.length
      ? `SELECT * FROM ${fn}(${placeholders})`
      : `SELECT * FROM ${fn}()`;
    const res = await this.pool.query(sql, values);
    return { data: res.rows[0] ?? null, error: null };
  }

  channel(name: string): RealtimeChannel {
    return new PostgresListenChannel(this.pool, name);
  }

  removeChannel(channel: RealtimeChannel): void {
    (channel as PostgresListenChannel).unlisten();
  }
}
```

**`PostgresQueryBuilder` translation rules:**

| QueryBuilder method | SQL output |
|---------------------|-----------|
| `.select('*')` | `SELECT *` |
| `.select('a, b, c')` | `SELECT a, b, c` |
| `.eq(col, val)` | `WHERE col = $N` (ANDed) |
| `.neq(col, val)` | `WHERE col != $N` |
| `.in(col, vals)` | `WHERE col = ANY($N)` or `WHERE col IN ($1,$2,...)` |
| `.order(col, { ascending: true })` | `ORDER BY col ASC` |
| `.limit(n)` | `LIMIT n` |
| `.insert(data)` | `INSERT INTO t (...) VALUES (...) RETURNING *` |
| `.update(data)` | `UPDATE t SET ... WHERE ... RETURNING *` |
| `.delete()` | `DELETE FROM t WHERE ...` |
| `.single()` | Execute + assert exactly 1 row; `status:404` if 0 |

**Security rule:** All values must be bound as parameterized `$N` — NO string concatenation of user input.

---

### 6.3 SQLite Backend (`DATABASE_MODE=sqlite`)

**Package:** `better-sqlite3` (synchronous API)  
**File path:** `DATABASE_SQLITE_PATH` env var (default: `./dev.db`)  
**Realtime:** `NoopRealtimeChannel` — all `.on()` and `.subscribe()` calls are no-ops; callbacks never fire  
**Use case:** Vitest unit tests, offline local dev, CI environments without Supabase access

```typescript
// src/lib/db/adapters/SQLiteAdapter.ts
import Database from 'better-sqlite3';

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._initSchema(); // create tables if db file is new
  }

  from<T>(table: string): QueryBuilder<T> {
    return new SQLiteQueryBuilder<T>(this.db, table);
  }

  async rpc<T>(fn: string, params?: Record<string, unknown>): Promise<AdapterResult<T>> {
    // Map known RPCs to inline SQL stubs
    const RPC_MAP: Record<string, (p: any) => any> = {
      check_stale_agents: () =>
        this.db.prepare(`UPDATE agents SET heartbeat_status='stale'
          WHERE datetime(last_heartbeat) < datetime('now','-5 minutes')
            AND heartbeat_status='alive'`).run(),
      claim_next_ticket: (p) =>
        this.db.prepare(`UPDATE tickets SET status='in_progress'
          WHERE id=(SELECT id FROM tickets WHERE company_id=? AND status='approved'
                    ORDER BY created_at LIMIT 1) RETURNING id`)
          .get(p.p_company_id),
    };
    const fn_impl = RPC_MAP[fn];
    if (!fn_impl) throw new Error(`SQLiteAdapter: RPC '${fn}' not mapped`);
    return { data: fn_impl(params) as T ?? null, error: null };
  }

  channel(_name: string): RealtimeChannel {
    return new NoopRealtimeChannel();
  }

  removeChannel(_channel: RealtimeChannel): void { /* no-op */ }

  private _initSchema(): void {
    // Run embedded schema DDL if tables don't exist yet
    // DDL mirrors Migration-Spec §2 — see src/lib/db/schema.sql
  }
}
```

**Schema init for SQLite:**  
On first construction, `_initSchema()` runs a bundled `schema.sql` (mirroring the Supabase schema from [[Migration-Spec]] §2). Vitest tests always start against a clean, schema-complete database at `./test.db` (overridden via `DATABASE_SQLITE_PATH=./test.db`).

---

## 7. `DATABASE_MODE` Environment Gate

```typescript
// src/lib/db/index.ts  (and  server/db/index.ts for server-side)

let _adapter: DatabaseAdapter | null = null;

export function getAdapter(): DatabaseAdapter {
  if (_adapter) return _adapter;  // singleton — resolved once at startup

  const mode = process.env.DATABASE_MODE ?? 'supabase';

  switch (mode) {
    case 'supabase': {
      const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
      const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error('[db] DATABASE_MODE=supabase but SUPABASE_URL/KEY missing');
      _adapter = new SupabaseAdapter(url, key);
      break;
    }
    case 'postgres': {
      const connStr = process.env.DATABASE_URL;
      if (!connStr) throw new Error('[db] DATABASE_MODE=postgres but DATABASE_URL missing');
      _adapter = new PostgresAdapter(connStr);
      break;
    }
    case 'sqlite': {
      const path = process.env.DATABASE_SQLITE_PATH ?? './dev.db';
      _adapter = new SQLiteAdapter(path);
      break;
    }
    default:
      throw new Error(`[db] Unknown DATABASE_MODE: '${mode}'. Valid: supabase | postgres | sqlite`);
  }

  console.log(`[db] Adapter initialized: ${mode}`);
  return _adapter;
}

/** Convenience — use this everywhere instead of raw adapter access */
export const db = () => getAdapter();
```

**Environment variable matrix:**

| Variable | Required when | Default | Example |
|----------|--------------|---------|---------|
| `DATABASE_MODE` | Always | `supabase` | `sqlite` |
| `VITE_SUPABASE_URL` | `mode=supabase` (client) | — | `https://qdhengvarelfdtmycnti.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `mode=supabase` (client) | — | `eyJ...` |
| `SUPABASE_URL` | `mode=supabase` (server) | — | same URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `mode=supabase` (server) | — | `eyJ...` (NEVER `VITE_` prefix) |
| `DATABASE_URL` | `mode=postgres` | — | `postgresql://ceo:pass@localhost:5432/ceo` |
| `DATABASE_SQLITE_PATH` | `mode=sqlite` | `./dev.db` | `./test.db` |

---

## 8. Error Handling

### 8.1 `AdapterError` Type

```typescript
export interface AdapterError {
  /** Human-readable error message — always present */
  message: string;

  /**
   * Standardized error code:
   * - 'PGRST116' — .single() matched 0 rows (mirrors Supabase)
   * - '23505'    — unique constraint violation
   * - '23503'    — foreign key violation
   * - 'TIMEOUT'  — query exceeded timeout threshold
   */
  code?: string;

  /**
   * HTTP-equivalent status for client-facing error mapping:
   * - 400 Bad Request (malformed query)
   * - 404 Not Found (.single() with 0 rows)
   * - 409 Conflict (unique constraint violation)
   * - 500 Internal (unexpected adapter error)
   */
  status?: number;

  /** Raw driver error for debugging logs */
  cause?: unknown;
}
```

### 8.2 Conventions

```typescript
// ✅ Always destructure and check error before data
const { data, error } = await db().from('companies').select('*');
if (error) throw new Error(`[companies] fetch failed: ${error.message}`);

// ✅ .single() returns error when 0 rows — always guard
const { data: ticket, error: ticketError } = await db()
  .from('tickets').select('*').eq('id', ticketId).single();
if (ticketError || !ticket) return { processed: false, error: 'Ticket not found' };

// ✅ Fire-and-forget inserts must still be awaited (so errors surface in logs)
await db().from('activity_log').insert({ company_id, type, message });

// ❌ Never access .data without first confirming .error is null
const { data } = await db().from('companies').select('*');
return data; // ← unsafe: may be null when error is non-null
```

---

## 9. Realtime Abstraction

### 9.1 `RealtimeChannel` Interface

```typescript
// src/lib/db/RealtimeChannel.ts

export type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface PostgresChangeFilter {
  event: PostgresChangeEvent;
  schema: string;
  table: string;
  filter?: string;  // e.g. 'company_id=eq.abc123'
}

export interface RealtimeChannel {
  /**
   * Register a listener for Postgres change events.
   * Chainable — all .on() calls on one channel are multiplexed.
   *
   * Source: src/hooks/useRealtimeSync.ts — 4 listeners on one 'realtime-sync' channel
   *   event:UPDATE table:agents
   *   event:UPDATE table:companies
   *   event:UPDATE table:delegations
   *   event:DELETE table:delegations
   */
  on(
    type: 'postgres_changes',
    filter: PostgresChangeFilter,
    callback: (payload: { new: unknown; old: unknown }) => void
  ): this;

  /** Activate subscription. Call after all .on() registrations. */
  subscribe(): this;
}

/** SQLite / offline stub — all methods no-op, callbacks never fire */
export class NoopRealtimeChannel implements RealtimeChannel {
  on(_type: any, _filter: any, _cb: any): this { return this; }
  subscribe(): this { return this; }
}
```

### 9.2 Backend Comparison

| Aspect | Supabase | PostgreSQL | SQLite |
|--------|----------|-----------|--------|
| Mechanism | WebSocket (multiplexed) | `LISTEN/NOTIFY` + dedicated pg.Client | No-op stub |
| Infrastructure | None (Supabase manages) | Trigger functions + dedicated listener conn | None |
| Latency | ~100ms | ~50ms (local) | N/A |
| Payload shape | `{ new, old, eventType, schema, table }` | Must match via trigger | N/A |

### 9.3 PostgreSQL Trigger Convention

Triggers must emit `pg_notify()` with a JSON payload matching the Supabase realtime shape:

```sql
-- Example: agents table realtime trigger
CREATE OR REPLACE FUNCTION notify_agent_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'realtime_agents',
    json_build_object(
      'event',  TG_OP,
      'schema', TG_TABLE_SCHEMA,
      'table',  TG_TABLE_NAME,
      'new',    row_to_json(NEW),
      'old',    row_to_json(OLD)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_realtime_trigger
AFTER INSERT OR UPDATE OR DELETE ON agents
FOR EACH ROW EXECUTE FUNCTION notify_agent_change();
```

Tables requiring triggers: `agents`, `companies`, `delegations`  
(matching the three tables subscribed in `useRealtimeSync.ts`)

These triggers belong in `docker/postgres/init/05-functions.sql` per [[Docker-Deployment-Spec]] §8.

---

## 10. Acceptance Criteria

| ID | Criterion | Priority |
|----|-----------|----------|
| DA-01 | `DatabaseAdapter` and `QueryBuilder<T>` interfaces compile with zero TypeScript errors against `database.types.ts` | 🔴 MUST |
| DA-02 | `SupabaseAdapter.from()` delegates directly to `@supabase/supabase-js` client with no translation layer; all 23 patterns work identically to current `src/lib/api.ts` behavior | 🔴 MUST |
| DA-03 | All 23 call patterns catalogued in Section 4 are expressible via `QueryBuilder<T>` — no pattern requires bypassing the interface | 🔴 MUST |
| DA-04 | `getAdapter()` calls `process.exit(1)` (or throws) with a descriptive message on startup if `DATABASE_MODE` is invalid or required env vars are missing | 🔴 MUST |
| DA-05 | `DATABASE_MODE=sqlite`: all repository methods work; `check_stale_agents` and `claim_next_ticket` RPCs are stubbed correctly | 🔴 MUST |
| DA-06 | `DATABASE_MODE=postgres`: `PostgresQueryBuilder` uses parameterized queries only — zero string concatenation of user-provided values | 🔴 MUST |
| DA-07 | `.single()` returns `AdapterError` with `code:'PGRST116'` and `status:404` when 0 rows match — consistent across all 3 backends | 🔴 MUST |
| DA-08 | `AdapterError.message` is always a non-empty string; `cause` contains the raw driver error | 🔴 MUST |
| DA-09 | `RealtimeChannel` interface is satisfied by all 3 backends; `NoopRealtimeChannel` never throws on any method call | 🔴 MUST |
| DA-10 | All existing Vitest tests in `src/` pass with `DATABASE_MODE=sqlite` (zero network calls, zero Supabase dependency) | 🔴 MUST |
| DA-11 | Repository interfaces exist for all tables referenced in `src/lib/api.ts` and `server/ticketProcessor.ts` | 🟡 SHOULD |
| DA-12 | `PostgresAdapter` uses `pg.Pool` — no per-request `Client` construction; connection pool size is configurable via `DATABASE_POOL_SIZE` env var | 🟡 SHOULD |
| DA-13 | `SQLiteAdapter._initSchema()` runs DDL automatically on first boot if `dev.db` does not exist | 🟡 SHOULD |
| DA-14 | PostgreSQL realtime triggers for `agents`, `companies`, `delegations` are included in `docker/postgres/init/05-functions.sql` | 🟢 NICE |
| DA-15 | Zod insert schemas for all repositories defined in `src/lib/db/schemas/` | 🟢 NICE |

---

## 11. Proposed File Structure

```
src/lib/db/
├── index.ts                    ← getAdapter() factory + db() shorthand
├── DatabaseAdapter.ts          ← DatabaseAdapter interface
├── QueryBuilder.ts             ← QueryBuilder<T> + AdapterResult<T>
├── AdapterError.ts             ← AdapterError type
├── RealtimeChannel.ts          ← RealtimeChannel + NoopRealtimeChannel
├── schema.sql                  ← embedded DDL for SQLite init
├── adapters/
│   ├── SupabaseAdapter.ts      ← wraps @supabase/supabase-js
│   ├── PostgresAdapter.ts      ← wraps pg Pool + PostgresQueryBuilder
│   └── SQLiteAdapter.ts        ← wraps better-sqlite3 + SQLiteQueryBuilder
├── repositories/
│   ├── CompanyRepository.ts
│   ├── AgentRepository.ts
│   ├── GoalRepository.ts
│   ├── DelegationRepository.ts
│   ├── ActivityLogRepository.ts
│   ├── TicketRepository.ts
│   ├── MergeRequestRepository.ts
│   ├── NotificationRepository.ts
│   ├── AuditLogRepository.ts
│   └── TicketCommentRepository.ts
└── schemas/
    ├── company.schema.ts
    ├── agent.schema.ts
    ├── ticket.schema.ts
    └── ...

server/db/
└── index.ts                    ← server adapter init (service role key)
```

---

## 12. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| OQ-01 | Refactor `src/lib/api.ts` to use `db()` + repositories immediately, or defer to a dedicated migration sprint? | CEO | OPEN |
| OQ-02 | PostgreSQL LISTEN/NOTIFY latency acceptable for the canvas simulation game loop (target: 16ms tick)? Polling fallback needed? | Tech Lead | OPEN |
| OQ-03 | Should `SupabaseAdapter` expose the raw client for auth operations (`.auth.signIn`, etc.)? Auth is out of scope for `DatabaseAdapter` per [[Auth-System-Spec]] §3 — confirm separation. | Auth Lead | OPEN |
| OQ-04 | `better-sqlite3` is synchronous — potential conflict with Vitest's async test runner. Consider `@databases/sqlite` (async) as alternative. | Dev | OPEN |

---

## 13. Related Documents

- [[Migration-Spec]] — canonical column-level schema for all 17 tables; `check_stale_agents` DDL
- [[Docker-Deployment-Spec]] — Docker Compose service topology; env var Zod schema; PostgreSQL init scripts
- [[Auth-System-Spec]] — RLS policies, JWT, `users` table (auth is separate from `DatabaseAdapter`)
- [[Factory-Operations-Manual]] — execution pipeline, TDD requirements, token optimization

---

*Document written by Liam Chen (Project Manager) — 2026-04-12*  
*Source patterns catalogued from: `src/lib/api.ts`, `src/hooks/useRealtimeSync.ts`, `server/ticketProcessor.ts`, `server/supabaseAdmin.ts`, `src/lib/supabase.ts`*  
*Next review: when any new Supabase call pattern is added to the codebase*

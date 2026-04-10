---
name: database
description: "Use when working with database schemas, migrations, and queries. Supabase PostgreSQL patterns."
source: internal
applies_to: [Backend, DevOps]
---

# Database (Supabase PostgreSQL)

## Project
- Supabase project: `paperclip` (qdhengvarelfdtmycnti)
- 12 tables: companies, agents, goals, delegations, activity_log, agent_sessions, task_queue, token_usage, configs, tickets, ticket_comments, audit_log

## Patterns
- Use Supabase client for CRUD: `supabase.from('table').select/insert/update/delete`
- Use RPC for complex operations: `supabase.rpc('function_name', params)`
- Atomic task claiming: `FOR UPDATE SKIP LOCKED` prevents race conditions
- Realtime subscriptions for live updates

## Schema Rules
- Every table has `id` (UUID), `created_at` (timestamptz)
- Foreign keys with `ON DELETE CASCADE` where appropriate
- Indexes on frequently queried columns (company_id, status)
- RLS policies for data isolation per company

## Migration Safety
- Always test migrations on a branch first: `supabase branch create`
- Never drop columns in production without deprecation period
- Use `ALTER TABLE ... ADD COLUMN ... DEFAULT` for safe additions

---
name: api-design
description: "Use when designing APIs. RESTful patterns, error handling, and Supabase integration."
source: internal
applies_to: [Backend]
---

# API Design

Design and implement APIs with consistent patterns.

## Stack
- Supabase (PostgreSQL + Realtime + RLS)
- Express.js for orchestrator endpoints
- Claude Agent SDK for agent execution

## Patterns
- RESTful resource naming (`/api/agents/:id`, not `/api/getAgent`)
- Consistent error responses: `{ error: string, code?: string }`
- Use Supabase RPC for atomic operations (`FOR UPDATE SKIP LOCKED`)
- Row Level Security (RLS) for data isolation
- Type all request/response shapes with TypeScript interfaces

## Error Handling
```typescript
try {
  const { data, error } = await supabase.from('table').select('*');
  if (error) throw error;
  return data;
} catch (err) {
  console.error('[context] Failed:', err);
  return { error: err.message };
}
```

## Database Conventions
- Snake_case for column names (`created_at`, `company_id`)
- UUID primary keys
- Always include `created_at` and `updated_at` timestamps
- Use enums for status fields

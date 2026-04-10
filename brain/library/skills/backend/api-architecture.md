---
tags: [skill, library, backend, api]
id: backend-api-architecture
role: Backend
status: active
date: 2026-04-08
---

# API Architecture

**Description:** REST API design, Supabase Edge Functions, error handling patterns, and request/response contracts. Ensures consistent API design across all endpoints with proper validation, error codes, and documentation.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** Backend

## System Prompt Injection

```
You design and implement APIs. Follow these patterns for consistency and reliability.

API STACK:
- Supabase Edge Functions (Deno runtime) for serverless endpoints
- Supabase PostgREST for direct database CRUD (auto-generated REST API)
- Supabase Realtime for WebSocket subscriptions
- Use PostgREST when possible — only create Edge Functions for custom logic

EDGE FUNCTION TEMPLATE:
Location: supabase/functions/[function-name]/index.ts

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Validate input
    const body = await req.json();
    if (!body.requiredField) {
      return new Response(
        JSON.stringify({ error: 'requiredField is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Business logic here
    const { data, error } = await supabase.from('table').select('*');
    if (error) throw error;

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

ERROR RESPONSE FORMAT (consistent across all endpoints):
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}  // optional, for validation errors
}
```

HTTP STATUS CODES:
- 200: Success (GET, PUT, PATCH)
- 201: Created (POST that creates a resource)
- 204: No Content (DELETE success)
- 400: Bad Request (validation failure, missing fields)
- 401: Unauthorized (missing or invalid auth token)
- 403: Forbidden (valid auth but insufficient permissions — RLS will handle most of these)
- 404: Not Found
- 409: Conflict (duplicate, version mismatch)
- 500: Internal Server Error (unexpected — always log these)

API CONTRACT DOCUMENTATION:
Before implementing an endpoint, write the contract:
```
## POST /functions/v1/create-company
### Request
{ "name": string, "industry": string, "initialBudget": number }
### Response 201
{ "data": { "id": string, "name": string, ... } }
### Response 400
{ "error": "name is required", "code": "VALIDATION_ERROR" }
```

INPUT VALIDATION:
1. Validate EVERY input field — never trust client data
2. Check types (string vs number), ranges (positive numbers), formats (email, UUID)
3. Return 400 with specific error messages (not "invalid input")
4. Validate early, fail fast — don't process half the request before checking inputs

AUTHENTICATION:
- Use Supabase Auth JWT tokens
- Extract user from Authorization header via supabase.auth.getUser()
- Never expose endpoints without auth unless explicitly public
- Use RLS policies as the primary access control layer
```

## Anti-patterns

- **No input validation:** Trust nothing from the client. Validate every field, every request.
- **Generic error messages:** "Something went wrong" helps nobody. Return specific, actionable error messages.
- **Edge Function for CRUD:** If you just need SELECT/INSERT/UPDATE/DELETE, use PostgREST directly. Edge Functions are for custom logic.
- **Inconsistent response shapes:** Every endpoint must return the same error format. Don't mix `{ error }` and `{ message }` and `{ err }`.
- **Missing CORS headers:** Edge Functions need CORS headers AND the OPTIONS preflight handler. Without them, browser requests fail silently.
- **Swallowing errors:** `catch (e) { return new Response('ok') }` hides bugs. Always return the error with appropriate status code.
- **No API contract:** Implementing without a documented request/response contract causes frontend/backend mismatch.

## Verification Steps

1. Every Edge Function has CORS headers and OPTIONS handler
2. Every endpoint validates all input fields and returns 400 for invalid input
3. Error responses follow the standard format: `{ error, code, details? }`
4. API contracts are documented before implementation
5. Authentication is enforced (no unprotected endpoints unless explicitly public)
6. PostgREST is used for simple CRUD (Edge Functions only for custom logic)
7. HTTP status codes are correct (not 200 for everything)

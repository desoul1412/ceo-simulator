---
tags: [skill, library, automation, webhook, api]
id: webhook-integration
role: Automation
status: active
date: 2026-04-10
---

# Webhook Integration

**Description:** Build webhook endpoints that receive external events and trigger automated workflows. Validate payloads, verify signatures, process async, and handle failures gracefully.

**Tools:** Read, Edit, Write, Bash, Grep, Supabase MCP (deploy_edge_function, execute_sql), Context7 MCP

**System Prompt Injection:**
```
When building webhook integrations:
1. ENDPOINT DESIGN:
   - Deploy as Supabase Edge Function or n8n Webhook node.
   - Accept POST only. Return 200 immediately with acknowledgment body. Process async.
   - URL path should be descriptive: /webhooks/stripe-payment, not /webhook1.
2. PAYLOAD VALIDATION:
   - Define expected schema (TypeScript interface or JSON Schema).
   - Validate required fields on receipt. Reject malformed payloads with 400 and descriptive error.
   - Log raw payload before processing (for debugging failed events).
3. SIGNATURE VERIFICATION:
   - Verify HMAC signatures for all external webhooks (Stripe, GitHub, Slack, etc.).
   - Store webhook secrets in environment variables. Never hardcode.
   - Reject requests with invalid or missing signatures (return 401).
4. ASYNC PROCESSING:
   - Return 200 immediately. Enqueue event for processing.
   - Use a queue table in Supabase: id, event_type, payload, status (pending/processing/done/failed), created_at, processed_at, error_message.
   - Process queue with a scheduled worker (cron every 1-5 minutes).
5. IDEMPOTENCY:
   - Store event IDs. Deduplicate on event ID before processing.
   - If the same event arrives twice, skip processing and return 200.
6. ERROR HANDLING:
   - Retry failed events: 3 attempts with exponential backoff (1min, 5min, 30min).
   - After 3 failures, move to dead letter queue. Alert the team.
   - Log: event_id, event_type, error_message, retry_count, last_attempt_at.
7. MONITORING:
   - Track: events received, events processed, events failed, processing latency.
   - Alert on: spike in failures, processing lag > 5 minutes, unknown event types.
```

**Anti-Patterns:**
- Processing synchronously before returning 200 (causes timeout for sender)
- Missing signature verification (security vulnerability)
- No idempotency handling (duplicate events cause duplicate actions)
- Hardcoded webhook secrets in source code
- No dead letter queue (failed events disappear silently)
- Accepting GET requests for webhooks (should be POST only)

**Verification Steps:**
- [ ] Endpoint returns 200 immediately (async processing)
- [ ] Payload validated against expected schema
- [ ] HMAC signature verification implemented
- [ ] Webhook secret loaded from environment variable
- [ ] Event IDs stored for idempotency/deduplication
- [ ] Retry logic: 3 attempts with exponential backoff
- [ ] Dead letter queue for persistent failures
- [ ] Monitoring tracks received, processed, and failed events

---
tags: [skill, library, data, etl, pipeline]
id: etl-architecture
role: Data Architect
status: active
date: 2026-04-10
---

# ETL Architecture

**Description:** Design Extract-Transform-Load pipelines that move data between systems reliably. Focus on idempotency, observability, and incremental processing.

**Tools:** Read, Edit, Write, Bash, Grep, Supabase MCP (execute_sql), CronCreate

**System Prompt Injection:**
```
When designing ETL pipelines:
1. EXTRACT: Define source systems, connection methods, and extraction strategy (full vs. incremental). Use watermark columns (updated_at) for incremental. Log row counts at extraction.
2. TRANSFORM: Define transformation rules as pure functions (same input = same output). Validate data types, handle nulls explicitly, normalize formats. Log transformation stats (rows in, rows out, rows rejected).
3. LOAD: Use UPSERT (INSERT ON CONFLICT UPDATE) on natural keys. Never raw INSERT for idempotency. Verify row counts: extracted = loaded +/- known filters. Log load stats.
4. IDEMPOTENCY: Every pipeline MUST be safe to re-run. Use upserts, track processed watermarks, deduplicate on natural keys. Test by running twice -- output must be identical.
5. SCHEDULING: Define cron schedule in UTC. Document frequency rationale. Use dead letter queues for failed records.
6. MONITORING: Alert on: row count anomalies (>20% deviation), schema drift, pipeline failures, latency exceeding SLA.
7. Design pipelines as DAGs (directed acyclic graphs). No circular dependencies.
```

**Anti-Patterns:**
- INSERT without deduplication (must always UPSERT)
- Pipelines that fail silently (every step needs logging and alerting)
- Full table scans when incremental extraction is possible
- Mixing extraction and transformation in the same step
- Hardcoded connection strings (use environment variables)
- Pipelines without idempotency (must be safe to re-run)

**Verification Steps:**
- [ ] Pipeline is idempotent: running twice produces identical results
- [ ] Row counts are logged at extract, transform, and load stages
- [ ] Watermark/incremental strategy is documented and tested
- [ ] Error handling exists for every step (retry + dead letter queue)
- [ ] Monitoring alerts configured for failures and anomalies
- [ ] Cron schedule documented in human-readable form alongside expression

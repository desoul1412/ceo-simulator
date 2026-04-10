---
tags: [skill, library, automation, pipeline, etl]
id: pipeline-automation
role: Automation
status: active
date: 2026-04-10
---

# Pipeline Automation

**Description:** Automate data pipelines and scheduled tasks. Cron scheduling, ETL orchestration, process monitoring, and ROI calculation. Every pipeline is idempotent and monitored.

**Tools:** Read, Edit, Write, Bash, Grep, CronCreate, CronList, CronDelete, Supabase MCP (execute_sql)

**System Prompt Injection:**
```
When automating pipelines:
1. PROCESS MAPPING: Document the manual process BEFORE automating. Use the SOP-builder approach: what are the steps, decision points, failure modes? Never automate a broken process -- fix the process first.
2. CRON SCHEDULING:
   - Write cron expressions in UTC. Always document the human-readable equivalent: "0 6 * * 1" = "Every Monday at 6:00 AM UTC".
   - Test cron expressions at crontab.guru before deploying.
   - Use CronCreate tool for scheduling. Track all active schedules with CronList.
   - For critical pipelines, add a "heartbeat" check: if the pipeline hasn't run in 2x the expected interval, alert.
3. ETL EXECUTION:
   - Extract: Log row counts. Use incremental extraction (watermark columns) when possible.
   - Transform: Pure functions. Same input = same output. Log rows in/out/rejected.
   - Load: UPSERT on natural keys. Verify row counts match.
   - Every pipeline MUST be idempotent: running twice with the same input produces identical output.
4. MONITORING:
   - Log: start time, end time, duration, rows processed, errors encountered.
   - Alert on: failures, duration exceeding 2x average, row count anomalies (>20% deviation).
   - Dead letter queue: failed records go to a separate table for manual review.
5. ROI CALCULATION:
   - Time saved per run x frequency per month = hours saved.
   - Subtract: tool costs + maintenance time.
   - Document ROI in the pipeline SOP.
6. MAINTENANCE:
   - Review pipeline health monthly. Check: error rates, duration trends, data quality.
   - Archive or decommission pipelines that are no longer needed.
```

**Anti-Patterns:**
- Automating a broken manual process (fix first, automate second)
- Pipelines without idempotency (INSERT instead of UPSERT)
- Missing monitoring (silent failures are invisible failures)
- Cron schedules without human-readable documentation
- No ROI tracking (automations that cost more than they save)
- Abandoned pipelines running indefinitely without review

**Verification Steps:**
- [ ] Manual process documented as SOP before automation
- [ ] Cron expression tested and documented in human-readable form
- [ ] Pipeline is idempotent (running twice = same result)
- [ ] Row counts logged at extract, transform, and load stages
- [ ] Monitoring alerts configured for failures and anomalies
- [ ] Dead letter queue exists for failed records
- [ ] ROI calculated and documented

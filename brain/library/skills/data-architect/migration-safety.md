---
tags: [skill, library, data, database, migration]
id: migration-safety
role: Data Architect
status: active
date: 2026-04-10
---

# Migration Safety

**Description:** Execute database schema migrations with zero downtime, mandatory rollbacks, and verification at every step. Every migration is reversible.

**Tools:** Read, Edit, Write, Bash, Supabase MCP (apply_migration, list_migrations, create_branch, execute_sql)

**System Prompt Injection:**
```
When executing database migrations:
1. PLAN: Write a migration plan document FIRST. Include: what changes, why, rollback strategy, verification queries, estimated impact.
2. BRANCH: Create a Supabase branch database. Apply migration to branch first. Verify on branch before touching staging/production.
3. FORWARD MIGRATION: Write the up migration SQL. Rules:
   - Never mix DDL (ALTER TABLE) and DML (UPDATE data) in the same migration.
   - Use CREATE INDEX CONCURRENTLY (not CREATE INDEX) to avoid table locks.
   - Add new columns as nullable first, backfill, then add NOT NULL constraint in a separate migration.
   - Use IF NOT EXISTS / IF EXISTS guards for idempotency.
4. ROLLBACK MIGRATION: Write the down migration SQL. Every forward migration MUST have a corresponding rollback. Test the rollback on the branch database.
5. VERIFY: After applying migration, run verification queries:
   - Schema check: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '...';
   - Data integrity: SELECT COUNT(*) checks, constraint validation.
   - Application health: Verify the application still works with the new schema.
6. DEPLOY ORDER: Branch -> Staging -> Production. Never skip stages.
7. ZERO DOWNTIME: All migrations must be backward-compatible. Old code must work with new schema during rollout window.
```

**Anti-Patterns:**
- Migrations without rollback scripts
- Mixing DDL and DML in the same transaction
- CREATE INDEX (blocking) instead of CREATE INDEX CONCURRENTLY
- Adding NOT NULL columns without a default or multi-step migration
- Applying migrations directly to production without branch testing
- Claiming migration success without running verification queries

**Verification Steps:**
- [ ] Migration plan document written and reviewed
- [ ] Forward migration SQL tested on branch database
- [ ] Rollback migration SQL tested on branch database
- [ ] Verification queries confirm schema state post-migration
- [ ] Data integrity checks pass (row counts, constraints)
- [ ] Application health verified with new schema
- [ ] No table locks or downtime during migration

---
tags: [skill, library, data, database]
id: data-modeling
role: Data Architect
status: active
date: 2026-04-10
---

# Data Modeling

**Description:** Design relational and dimensional data models. Start at 3NF for transactional, star/snowflake for analytics. Document every entity, relationship, and constraint.

**Tools:** Read, Edit, Write, Bash, Grep, Supabase MCP (execute_sql, list_tables)

**System Prompt Injection:**
```
When designing data models:
1. Identify entities and their relationships from business requirements.
2. Normalize to 3NF for transactional schemas. Denormalize only with measured query evidence.
3. Use star schema for analytics: fact tables (append-only, numeric measures) surrounded by dimension tables (descriptive attributes, SCD Type 2 for history).
4. Snowflake only when a dimension exceeds 50 columns -- split into sub-dimensions.
5. Document every table with: purpose, primary key, foreign keys, indexes, partition strategy, expected row count.
6. Use UUID for primary keys. Timestamp columns: created_at (DEFAULT now()), updated_at (trigger-managed).
7. Name tables as plural nouns (orders, users). Name columns as snake_case. Foreign keys as {referenced_table_singular}_id.
8. Every model change requires a written design doc BEFORE implementation.
```

**Anti-Patterns:**
- Designing schemas without understanding query access patterns first
- Using JSON columns as a substitute for proper relational modeling
- Missing foreign key constraints ("we'll enforce it in the app")
- Denormalizing without performance evidence
- Tables without created_at/updated_at timestamps
- Using auto-increment IDs for distributed systems

**Verification Steps:**
- [ ] ER diagram or table list matches business requirements
- [ ] 3NF validation: no transitive dependencies in transactional tables
- [ ] Star schema validation: fact tables have only FKs and measures
- [ ] All foreign keys have corresponding indexes
- [ ] Partition strategy defined for tables expected to exceed 10M rows
- [ ] Design doc written and committed before implementation

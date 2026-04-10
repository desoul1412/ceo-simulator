---
tags: [skill, library, qa, data, validation]
id: qa-data-validation
role: QA
status: active
date: 2026-04-08
---

# Data Validation

**Description:** Pipeline data validation, shape verification after transforms, and duplicate detection. Based on critical friction: pandas groupby issues caused silent data drops, column loss, and >100% share values that went undetected. This skill enforces validation at every data transformation step.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** QA, Data Engineer

## System Prompt Injection

```
You validate data integrity. After EVERY data transformation, verify the output.

THE GOLDEN RULE:
After every transform (filter, groupby, merge, pivot, apply), immediately check:
1. Shape: row count and column count (did we lose rows or columns?)
2. Sample: first 5 rows (does the data look right?)
3. Nulls: count of null values per column (did the transform introduce nulls?)
4. Types: dtypes of each column (did types change unexpectedly?)

VALIDATION CHECKPOINT PATTERN (Python/pandas):
```python
def validate_step(df, step_name, expected_cols=None, min_rows=1):
    """Run after every transformation step."""
    print(f"\n=== CHECKPOINT: {step_name} ===")
    print(f"Shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"Nulls:\n{df.isnull().sum()}")
    print(f"Dtypes:\n{df.dtypes}")
    print(f"Sample:\n{df.head()}")

    # Assertions
    assert len(df) >= min_rows, f"FAIL: Only {len(df)} rows (expected >= {min_rows})"
    if expected_cols:
        missing = set(expected_cols) - set(df.columns)
        assert not missing, f"FAIL: Missing columns: {missing}"

    return df
```

VALIDATION FOR TYPESCRIPT DATA:
```ts
function validateData<T extends Record<string, unknown>>(
  data: T[],
  stepName: string,
  checks: {
    minRows?: number;
    requiredFields?: string[];
    noNulls?: string[];
  }
): T[] {
  console.log(`\n=== CHECKPOINT: ${stepName} ===`);
  console.log(`Row count: ${data.length}`);
  console.log(`Fields: ${data.length > 0 ? Object.keys(data[0]) : 'N/A'}`);

  if (checks.minRows && data.length < checks.minRows) {
    throw new Error(`${stepName}: Expected >= ${checks.minRows} rows, got ${data.length}`);
  }

  if (checks.requiredFields && data.length > 0) {
    const missing = checks.requiredFields.filter(f => !(f in data[0]));
    if (missing.length > 0) {
      throw new Error(`${stepName}: Missing fields: ${missing.join(', ')}`);
    }
  }

  if (checks.noNulls && data.length > 0) {
    for (const field of checks.noNulls) {
      const nullCount = data.filter(row => row[field] == null).length;
      if (nullCount > 0) {
        throw new Error(`${stepName}: ${nullCount} null values in '${field}'`);
      }
    }
  }

  return data;
}
```

COMMON DATA BUGS TO CATCH:

1. SILENT ROW DROPS:
   - After merge/join: compare row counts before and after
   - After filter: verify filtered count + remaining = original count
   - After groupby: verify group count * avg group size ≈ original count

2. COLUMN LOSS:
   - After groupby: check that all expected columns survived
   - After pivot: verify both index and value columns are present
   - After merge: check for _x and _y suffix columns (indicates key mismatch)

3. TYPE CORRUPTION:
   - Numbers becoming strings after CSV read
   - Dates becoming strings after JSON parse
   - Integers becoming floats after merge (pandas int64 → float64 with NaN)

4. DUPLICATE RECORDS:
   ```python
   dupes = df[df.duplicated(subset=['id'], keep=False)]
   assert len(dupes) == 0, f"FAIL: {len(dupes)} duplicate records found"
   ```

5. PERCENTAGE/SHARE VIOLATIONS:
   ```python
   # Market share should sum to <= 100%
   share_sum = df.groupby('market')['share'].sum()
   violations = share_sum[share_sum > 1.0]
   assert len(violations) == 0, f"FAIL: Market shares > 100%: {violations}"
   ```

6. BOUNDS VIOLATIONS:
   ```python
   assert (df['budget'] >= 0).all(), "FAIL: Negative budgets found"
   assert (df['employee_count'] > 0).all(), "FAIL: Zero-employee companies"
   ```

VALIDATION IN TESTS:
Every data transformation function should have a test that:
1. Provides known input data
2. Runs the transformation
3. Asserts the output shape, types, and values
4. Tests edge cases: empty input, single row, duplicate keys
```

## Anti-patterns

- **No validation after groupby:** groupby is the #1 source of silent data loss. ALWAYS check shape after groupby.
- **Trusting merge output:** Merge can duplicate rows (many-to-many), drop rows (inner join), or add nulls (left/right join). Always check.
- **Print debugging only:** Printing data without assertions means bugs pass silently. Use assertions that FAIL loudly.
- **Validating only at the end:** If step 3 corrupts data and you only check at step 10, you waste time debugging. Validate every step.
- **Ignoring >100% shares:** Market share summing to 110% means the calculation is wrong. Never ignore mathematical impossibilities.
- **No duplicate check:** Duplicates cause double-counting in aggregations. Check for dupes after every join/merge.
- **String-typed numbers:** "100" + "200" = "100200" in JavaScript. Validate types after data loading.

## Verification Steps

1. Every data transformation step has a validation checkpoint (shape, sample, nulls, types)
2. Merge/join operations compare row counts before and after
3. Groupby results are checked for column loss and row count
4. Duplicate detection runs after every merge/join
5. Percentage/share values are bounds-checked (0-100% or 0-1.0)
6. Numeric fields are verified to be actual numbers (not strings)
7. Tests exist for data transformation functions with known input/output pairs
8. Edge cases tested: empty data, single row, duplicate keys, null values

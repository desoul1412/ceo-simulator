---
tags: [skill, library, data, statistics]
id: statistical-analysis
role: Data Scientist
status: active
date: 2026-04-10
---

# Statistical Analysis

**Description:** Apply statistical methods to business data. Cohort analysis, trend detection, distribution analysis, correlation studies. Always hypothesis-driven, always reproducible.

**Tools:** Read, Edit, Write, Bash, Grep, Supabase MCP (execute_sql)

**System Prompt Injection:**
```
When performing statistical analysis:
1. HYPOTHESIS FIRST: Write the question you are answering BEFORE exploring data. "Is churn rate improving across monthly cohorts?" not "Let me look at the data and see what's interesting."
2. DESCRIPTIVE STATISTICS: Start with: count, mean, median, std, min, max, percentiles (25th, 75th, 95th). Check for: nulls, outliers (IQR method), distribution shape (skewness, kurtosis).
3. COHORT ANALYSIS: Use triangular retention matrices. Rows = acquisition cohort (by month). Columns = lifecycle period (month 0, 1, 2...). Values = metric (retention %, revenue, activity). Compare cohorts at the SAME lifecycle stage. Never compare month-3 retention of an old cohort with month-1 of a new one.
4. TREND DETECTION: Use rolling averages (7-day, 30-day) to smooth noise. Decompose time series into trend, seasonality, and residual. Report confidence intervals on trend direction.
5. CORRELATION: Use Pearson for linear relationships, Spearman for monotonic. Always report: coefficient, p-value, sample size. Correlation is not causation -- state this explicitly and suggest experiment design if causal inference is needed.
6. VISUALIZATION: Every statistical finding needs a chart. Use: line charts for trends, heatmaps for cohort matrices, box plots for distributions, scatter plots for correlations. Label axes, include units, add context annotations.
7. DOCUMENTATION: Follow the 7-section notebook structure: Title/Date, Hypothesis, Data Source, Methodology, Results, Conclusion, Next Steps.
```

**Anti-Patterns:**
- Exploring data without a hypothesis (fishing for significance)
- Reporting averages without distribution context (median, percentiles)
- Comparing cohorts at different lifecycle stages
- Correlation claims without p-values and sample sizes
- Analyses without visualizations
- Notebooks without the 7-section structure

**Verification Steps:**
- [ ] Hypothesis written before data exploration
- [ ] Descriptive statistics reported (count, mean, median, std, percentiles)
- [ ] Cohort comparisons made at the same lifecycle stage
- [ ] All correlations include coefficient, p-value, and sample size
- [ ] Every finding has a supporting visualization
- [ ] Notebook follows 7-section structure
- [ ] Conclusion explicitly states whether data supports hypothesis

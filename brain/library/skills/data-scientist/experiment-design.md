---
tags: [skill, library, data, experiment, ab-test]
id: experiment-design
role: Data Scientist
status: active
date: 2026-04-10
---

# Experiment Design

**Description:** Design statistically rigorous A/B tests and experiments. Define hypotheses, calculate sample sizes, select metrics, and analyze results with proper statistical methods.

**Tools:** Read, Edit, Write, Bash, Grep, Supabase MCP (execute_sql)

**System Prompt Injection:**
```
When designing experiments:
1. HYPOTHESIS: Write a clear, falsifiable hypothesis BEFORE looking at data. Format: "We expect [metric] to [increase/decrease] by [X%] for [treatment group] compared to [control group] because [rationale]."
2. SAMPLE SIZE: Calculate required sample size BEFORE running the experiment. Use power analysis: 80% power, 5% significance level (alpha), minimum detectable effect (MDE) defined by business impact. If MDE requires more traffic than available, reconsider the experiment.
3. METRICS:
   - Primary metric: ONE metric that directly answers the hypothesis.
   - Guardrail metrics: 2-3 metrics that must NOT degrade (e.g., error rate, latency, revenue).
   - Do NOT add metrics after the experiment starts (p-hacking).
4. RANDOMIZATION: Random assignment at the user level (not session). Use consistent hashing for stable assignment. Verify balance: treatment and control should match on key covariates.
5. DURATION: Run for at least 1 full business cycle (typically 1-2 weeks). Do NOT peek at results before the planned end date unless using sequential testing with alpha-spending.
6. ANALYSIS: Use appropriate statistical test (t-test for means, chi-squared for proportions, Mann-Whitney for non-normal). Report: effect size, confidence interval, p-value, practical significance. Statistical significance without practical significance is not actionable.
7. COHORT LENS: Decompose results by cohort (new vs. returning, mobile vs. desktop). Averages hide segment-level effects.
```

**Anti-Patterns:**
- p-hacking: running multiple tests until one is significant
- Peeking: checking results before planned end date
- Adding metrics after experiment starts
- Underpowered experiments (sample too small to detect meaningful effects)
- Reporting statistical significance without practical significance
- Session-level randomization (leads to inconsistent user experience)

**Verification Steps:**
- [ ] Hypothesis written before any data analysis
- [ ] Sample size calculated with power analysis (80% power, 5% alpha)
- [ ] Primary metric and guardrail metrics defined upfront
- [ ] Randomization verified: balance check on key covariates
- [ ] Experiment ran for at least 1 full business cycle
- [ ] Results decomposed by cohort (not just overall average)
- [ ] Both statistical and practical significance reported

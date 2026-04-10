---
tags: [skill, library, ai, prompt, llm]
id: prompt-engineering
role: AI Engineer
status: active
date: 2026-04-10
---

# Prompt Engineering

**Description:** Design, version, test, and optimize prompts for LLM-powered features. Prompts are code -- they get version control, evaluation, and review.

**Tools:** Read, Edit, Write, Bash, Grep, WebFetch

**System Prompt Injection:**
```
When engineering prompts:
1. PROMPT FILES: Store prompts in dedicated files (e.g., prompts/classify-ticket.md). Never inline prompts as string literals in code. Import prompt content at runtime.
2. STRUCTURE: Use XML tags for clear sections:
   <role>Who the model is</role>
   <context>Background information</context>
   <instructions>What to do, step by step</instructions>
   <constraints>What NOT to do</constraints>
   <output_format>Expected response structure</output_format>
   <examples>Few-shot examples with input/output pairs</examples>
3. FEW-SHOT EXAMPLES: Include 2-3 examples showing input -> expected output. Cover: typical case, edge case, rejection case. Examples are the most powerful tuning lever.
4. EVALUATION: Create an eval set of 20+ input/expected-output pairs BEFORE optimizing. Run every prompt version against the eval set. Track: accuracy, consistency, cost (tokens), latency. A prompt is better only if eval metrics improve.
5. VERSION CONTROL: Filename includes version: classify-ticket-v2.1.md. Changelog at top of file. Never modify a prompt in production without running evals.
6. OPTIMIZATION:
   - Reduce token count: remove redundant instructions, compress examples.
   - Improve accuracy: add constraints, refine examples, add chain-of-thought.
   - Trade-off: shorter prompts cost less but may lose accuracy. Eval decides.
7. SYSTEM vs USER: Put stable instructions in system prompt (cacheable). Put variable content in user prompt. Maximize cache hit rate.
```

**Anti-Patterns:**
- Inline prompt strings in application code
- Modifying prompts without running evaluations
- No version history on prompt files
- Optimizing prompts without an eval set (vibes-based tuning)
- Ignoring token cost when adding instructions
- Using free-form text when structured XML would be clearer

**Verification Steps:**
- [ ] Prompt stored in dedicated file with version number
- [ ] XML structure used for clear sections
- [ ] 2-3 few-shot examples included (typical, edge, rejection)
- [ ] Eval set of 20+ pairs created before optimization
- [ ] Every prompt version tested against eval set with metrics
- [ ] Token count measured and cost estimated
- [ ] System vs user prompt split optimizes cacheability

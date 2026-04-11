import { query } from '@anthropic-ai/claude-agent-sdk';
import { supabase } from '../supabaseAdmin';
import { buildRelevantMemoryContext } from './worker';

/**
 * CEO Planner V2: multi-phase planning with incremental tab generation.
 * Each phase produces output for specific planning tabs.
 */

// ── Tab Definitions ────────────────────────────────────────────────────────

export const TAB_DEFINITIONS = [
  { key: 'overview', title: 'Overview', sortOrder: 0 },
  { key: 'findings', title: 'Findings', sortOrder: 1 },
  { key: 'research', title: 'Research', sortOrder: 2 },
  { key: 'tech_stack', title: 'Tech Stack', sortOrder: 3 },
  { key: 'architecture', title: 'Architecture', sortOrder: 4 },
  { key: 'hiring_plan', title: 'Hiring Plan', sortOrder: 5 },
  { key: 'implementation_plan', title: 'Implementation Plan', sortOrder: 6 },
] as const;

type TabKey = typeof TAB_DEFINITIONS[number]['key'];

// Which tabs to skip based on project size
const SKIP_TABS: Record<string, TabKey[]> = {
  small: ['research', 'tech_stack'],
  medium: ['research'],
  large: [],
};

// ── Phase Definitions ──────────────────────────────────────────────────────

interface PhaseConfig {
  phase: number;
  name: string;
  targetTab: TabKey;
  prompt: (directive: string, previousOutputs: Record<string, string>) => string;
  tools: string[];
  maxTurns: number;
  maxBudget: number;
}

// Scale turns/budget by project size — larger projects need more exploration
const SIZE_MULTIPLIERS: Record<string, { turns: number; budget: number }> = {
  small:  { turns: 0.6, budget: 0.5 },
  medium: { turns: 1.0, budget: 1.0 },
  large:  { turns: 1.5, budget: 1.5 },
};

function buildPhases(projectSize: string): PhaseConfig[] {
  const skipped = SKIP_TABS[projectSize] ?? [];
  const mult = SIZE_MULTIPLIERS[projectSize] ?? SIZE_MULTIPLIERS.medium;

  const allPhases: (PhaseConfig | null)[] = [
    // Phase 0+1: Overview (Intake + Requirements)
    {
      phase: 0,
      name: 'Intake & Requirements',
      targetTab: 'overview',
      prompt: (directive, _prev) => `You are the CEO planning a new project.

## Directive
"${directive}"

## Your Task
Scan the codebase (read README, package.json, src/ structure) and produce a comprehensive PROJECT OVERVIEW.

Include:
- **Project Name & Description**
- **Current State** (what exists, what's working)
- **Scope Classification** (Small/Medium/Large)
- **Stakeholders & Users**
- **Business Objectives** (what success looks like)
- **Non-Functional Requirements** (performance, security, scalability)
- **System Context** (external integrations, APIs)

Write in markdown. Be specific — reference actual files and code you find.`,
      tools: ['Read', 'Glob', 'Grep'],
      maxTurns: 15,
      maxBudget: 1.5,
    },

    // Phase 1: Findings (Discovery + ADRs)
    {
      phase: 1,
      name: 'Discovery & Findings',
      targetTab: 'findings',
      prompt: (directive, prev) => `You are the CEO conducting deep discovery for this project.

## Directive
"${directive}"

## Previous Phase Output (Overview)
${prev.overview ?? 'Not available'}

## Your Task
Investigate the codebase thoroughly and document ALL findings.

Include:
- **Architecture Decision Records (ADRs)** — key decisions made, alternatives considered, consequences
- **Technical Constraints** — framework limitations, API limits, browser support
- **Business Constraints** — budget, timeline, compliance
- **Risks** — technical debt, dependencies, missing tests
- **Existing Patterns** — code conventions, file structure, naming
- **Dependencies Audit** — outdated packages, security concerns
- **Open Questions** — things needing clarification

Format as structured markdown with clear sections.`,
      tools: ['Read', 'Glob', 'Grep'],
      maxTurns: 15,
      maxBudget: 1.5,
    },

    // Phase 2: Research (Large projects only)
    skipped.includes('research') ? null : {
      phase: 2,
      name: 'Feasibility Research',
      targetTab: 'research',
      prompt: (directive, prev) => `You are the CEO conducting feasibility research.

## Directive
"${directive}"

## Previous Findings
${prev.findings ?? 'Not available'}

## Your Task
Research the technical landscape for this project:
- **API Feasibility** — can the required integrations be built?
- **Infrastructure Options** — hosting, scaling, cost projections
- **Compliance Requirements** — data privacy, security standards
- **Competitor Analysis** — what similar projects exist?
- **PoC Recommendations** — what should be prototyped first?
- **Build vs. Buy Analysis** — for key components

Document findings with sources and confidence levels.`,
      tools: ['Read', 'Glob', 'Grep'],
      maxTurns: 12,
      maxBudget: 1.2,
    },

    // Phase 3: Tech Stack (Medium+ projects)
    skipped.includes('tech_stack') ? null : {
      phase: 3,
      name: 'Technology Evaluation',
      targetTab: 'tech_stack',
      prompt: (directive, prev) => `You are the CEO evaluating the technology stack.

## Directive
"${directive}"

## Overview
${prev.overview ?? ''}

## Findings
${prev.findings ?? ''}

## Your Task
Evaluate and document the technology stack:
- **Current Stack** — what's already in use (from package.json, code analysis)
- **Proposed Additions** — new libraries, frameworks, services needed
- **Comparison Matrix** — for each decision, compare 2-3 options on: maturity, performance, team fit, cost
- **ADRs** — record each technology decision with rationale
- **Migration Path** — if replacing existing tech, how to migrate
- **Dev Environment** — tools, linting, testing framework recommendations

Use tables for comparisons. Be specific about versions.`,
      tools: ['Read', 'Glob', 'Grep'],
      maxTurns: 12,
      maxBudget: 1.2,
    },

    // Phase 4: Architecture
    {
      phase: 4,
      name: 'Solution Architecture',
      targetTab: 'architecture',
      prompt: (directive, prev) => `You are the CEO designing the solution architecture.

## Directive
"${directive}"

## Context
${prev.overview ?? ''}
${prev.tech_stack ?? prev.findings ?? ''}

## Your Task
Design the complete solution architecture:
- **System Design** — high-level component diagram (describe in text/mermaid)
- **Data Model** — entity relationships, schemas, key tables
- **API Design** — endpoints, request/response shapes
- **Security Architecture** — auth, RLS, encryption, access control
- **Deployment Topology** — environments, CI/CD, infrastructure
- **Observability** — logging, monitoring, alerting strategy
- **Scalability Plan** — caching, queuing, database scaling

Reference actual code patterns found in the codebase. Include mermaid diagrams where helpful.`,
      tools: ['Read', 'Glob', 'Grep'],
      maxTurns: 15,
      maxBudget: 1.5,
    },

    // Phase 5: Hiring Plan
    {
      phase: 5,
      name: 'Hiring Plan',
      targetTab: 'hiring_plan',
      prompt: (directive, prev) => `You are the CEO determining the team composition.

## Directive
"${directive}"

## Architecture
${prev.architecture ?? ''}

## Your Task
Define the hiring plan as a structured table. For each role:

| Role | Model | Monthly Budget | Skills | Justification |
|------|-------|---------------|--------|---------------|
| PM | sonnet | $15 | requirements, specs, user stories | ... |
| Frontend | sonnet | $15 | React, TypeScript, Tailwind | ... |

Available roles: PM, Frontend, Backend, DevOps, QA, Designer, Full-Stack, Marketer, Content Writer, Sales, Operations, Data Architect, Data Scientist, AI Engineer, Automation

Available models: opus (strategic, expensive), sonnet (balanced), haiku (fast, cheap)

Budget guide: opus=$25, sonnet=$15, haiku=$5

Also specify:
- **Team Structure** — who reports to whom
- **Communication Protocol** — how agents coordinate
- **Priority Hiring** — which roles to hire first

IMPORTANT: Output the hiring plan as a markdown table. Each row = one agent to hire.`,
      tools: ['Read', 'Glob', 'Grep'],
      maxTurns: 10,
      maxBudget: 1.5,
    },

    // Phase 6: Implementation Plan
    {
      phase: 6,
      name: 'Implementation Planning',
      targetTab: 'implementation_plan',
      prompt: (directive, prev) => `You are the CEO creating the implementation plan.

## Directive
"${directive}"

## Architecture
${prev.architecture ?? ''}

## Hiring Plan
${prev.hiring_plan ?? ''}

## Your Task
Create a detailed, phased implementation plan:

### Phase 1: [Name]
**Goal**: ...
**Duration**: ...
**Assigned Roles**: PM, Backend
- [ ] Task 1 (Role: PM) — description
- [ ] Task 2 (Role: Backend) — description

### Phase 2: [Name]
**Dependencies**: Phase 1 must complete
**Assigned Roles**: Frontend, Backend
- [ ] Task 1 (Role: Frontend) — description

### Phase N: ...

RULES:
- Every task MUST have a "(Role: X)" tag
- Use "- [ ]" checkbox format for each task
- Specify dependencies between phases explicitly
- Include testing tasks assigned to QA
- Include deployment tasks assigned to DevOps
- Order by priority and dependency chain
- Be specific: "Build user auth API with JWT" not "Build backend"

Also include:
- **Testing Strategy** — unit, integration, e2e approach
- **CI/CD Pipeline** — build, test, deploy steps
- **Risk Mitigation** — fallback plans for risky tasks
- **Definition of Done** — acceptance criteria per phase`,
      tools: ['Read', 'Glob', 'Grep'],
      maxTurns: 15,
      maxBudget: 1.5,
    },
  ];

  return allPhases
    .filter((p): p is PhaseConfig => p !== null)
    .map(p => ({
      ...p,
      maxTurns: Math.round(p.maxTurns * mult.turns),
      maxBudget: +(p.maxBudget * mult.budget).toFixed(2),
    }));
}

// ── Phase Summarization ────────────────────────────────────────────────────

/**
 * Extract a compact summary of phase output to pass to subsequent phases.
 * Keeps headings + first bullet under each heading, caps at ~2000 chars.
 * This avoids cascading full content through all phases (saves 3-5k tokens).
 */
function summarizePhaseOutput(content: string, maxChars = 2000): string {
  if (content.length <= maxChars) return content;

  const lines = content.split('\n');
  const summary: string[] = [];
  let charCount = 0;
  let bulletCount = 0;
  let lastWasHeading = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { lastWasHeading = false; continue; }

    const isHeading = trimmed.startsWith('#');
    const isBullet = trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('|');

    if (isHeading) {
      summary.push(line);
      charCount += line.length;
      bulletCount = 0;
      lastWasHeading = true;
    } else if (lastWasHeading && isBullet && bulletCount < 3) {
      summary.push(line);
      charCount += line.length;
      bulletCount++;
    } else if (isHeading) {
      lastWasHeading = true;
    }

    if (charCount >= maxChars) break;
  }

  const result = summary.join('\n');
  return result.length > 0
    ? result + '\n\n*(full content available in planning tab)*'
    : content.slice(0, maxChars) + '...';
}

// ── Session Orchestrator ───────────────────────────────────────────────────

/**
 * Create a new planning session and all its tabs.
 */
export async function createPlanningSession(
  companyId: string,
  directive: string,
  projectSize: 'small' | 'medium' | 'large' = 'medium',
): Promise<string> {
  const phases = buildPhases(projectSize);
  const skipped = SKIP_TABS[projectSize] ?? [];

  const { data: session, error } = await supabase
    .from('planning_sessions')
    .insert({
      company_id: companyId,
      directive,
      project_size: projectSize,
      status: 'generating',
      current_phase: 0,
      total_phases: phases.length,
    })
    .select()
    .single();

  if (error || !session) {
    throw new Error(`Failed to create planning session: ${error?.message}`);
  }

  const sessionId = (session as any).id;

  // Create all tab rows
  for (const tab of TAB_DEFINITIONS) {
    await supabase.from('planning_tabs').insert({
      session_id: sessionId,
      tab_key: tab.key,
      title: tab.title,
      content: '',
      status: skipped.includes(tab.key) ? 'skipped' : 'pending',
      sort_order: tab.sortOrder,
    });
  }

  return sessionId;
}

/**
 * Run the full planning session asynchronously (fire-and-forget from HTTP handler).
 * Each phase writes its output to the DB as it completes.
 */
export async function runPlanningSession(
  sessionId: string,
  companyId: string,
  directive: string,
  cwd: string,
): Promise<void> {
  // Get project size from session
  const { data: session, error: sessionError } = await supabase
    .from('planning_sessions')
    .select('project_size')
    .eq('id', sessionId)
    .single();

  if (!session || sessionError) {
    console.error(`[ceo-planner] Session ${sessionId} not found:`, sessionError?.message);
    await supabase.from('planning_sessions').update({
      status: 'failed',
      error: `Session not found: ${sessionError?.message ?? 'null result'}`,
    }).eq('id', sessionId);
    return;
  }

  const projectSize = (session as any)?.project_size ?? 'medium';
  const phases = buildPhases(projectSize);

  // Set CEO to working
  const { data: ceoAgents } = await supabase
    .from('agents')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', 'CEO');

  let ceoMemoryContext = '';
  if (ceoAgents?.length) {
    const ceoId = (ceoAgents[0] as any).id;
    await supabase.from('agents').update({
      status: 'working',
      assigned_task: `Planning: "${directive.slice(0, 80)}"`,
    }).eq('id', ceoId);

    // Inject CEO's accumulated memory into planning context
    const { data: ceoAgent } = await supabase.from('agents').select('memory').eq('id', ceoId).single();
    if (ceoAgent) {
      ceoMemoryContext = buildRelevantMemoryContext((ceoAgent as any).memory ?? {}, directive);
    }
  }

  // Full outputs stored in DB; summaries passed between phases to save tokens
  const previousOutputs: Record<string, string> = {};
  const previousSummaries: Record<string, string> = {};
  let totalCost = 0;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];

    // Update session progress
    await supabase.from('planning_sessions').update({
      current_phase: i,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId);

    // Mark tab as generating
    await supabase.from('planning_tabs').update({
      status: 'generating',
    }).eq('session_id', sessionId).eq('tab_key', phase.targetTab);

    console.log(`[planner] Phase ${i}/${phases.length - 1}: ${phase.name} → ${phase.targetTab}`);

    try {
      // Pass summaries (not full outputs) to limit prompt size in later phases
      const { content, costUsd } = await executePlanningPhase(
        phase,
        directive,
        previousSummaries,
        cwd,
        ceoMemoryContext,
      );

      totalCost += costUsd;
      previousOutputs[phase.targetTab] = content;
      previousSummaries[phase.targetTab] = summarizePhaseOutput(content);

      // Write content to tab
      await supabase.from('planning_tabs').update({
        content,
        status: 'draft',
        phase_source: phase.phase,
        updated_at: new Date().toISOString(),
      }).eq('session_id', sessionId).eq('tab_key', phase.targetTab);

      // Update session cost
      await supabase.from('planning_sessions').update({
        cost_usd: totalCost,
      }).eq('id', sessionId);

    } catch (err: any) {
      console.error(`[planner] Phase ${phase.name} failed:`, err.message);

      // Mark tab as failed but continue with other phases
      await supabase.from('planning_tabs').update({
        content: `> **Generation failed**: ${err.message}\n\nPlease edit this tab manually or try re-planning.`,
        status: 'draft',
        updated_at: new Date().toISOString(),
      }).eq('session_id', sessionId).eq('tab_key', phase.targetTab);
    }
  }

  // All phases done — set session to review
  await supabase.from('planning_sessions').update({
    status: 'review',
    current_phase: phases.length,
    cost_usd: totalCost,
    updated_at: new Date().toISOString(),
  }).eq('id', sessionId);

  // Reset CEO status
  if (ceoAgents?.length) {
    await supabase.from('agents').update({
      status: 'idle',
      assigned_task: null,
    }).eq('id', (ceoAgents[0] as any).id);
  }

  // Log activity
  await supabase.from('activity_log').insert({
    company_id: companyId,
    type: 'ceo-reasoning',
    message: `CEO completed planning for: "${directive.slice(0, 100)}". Cost: $${totalCost.toFixed(4)}`,
  });

  console.log(`[planner] Session ${sessionId} complete. Total cost: $${totalCost.toFixed(4)}`);
}

/**
 * Execute a single planning phase via Claude Agent SDK.
 */
async function executePlanningPhase(
  phase: PhaseConfig,
  directive: string,
  previousOutputs: Record<string, string>,
  cwd: string,
  memoryContext: string = '',
): Promise<{ content: string; costUsd: number }> {
  const basePrompt = phase.prompt(directive, previousOutputs);
  const prompt = memoryContext ? `${memoryContext}\n\n${basePrompt}` : basePrompt;

  let result = '';
  let costUsd = 0;

  const q = query({
    prompt,
    options: {
      cwd,
      systemPrompt: `You are a senior technical CEO conducting project planning. Phase: ${phase.name}. Be thorough, specific, and reference actual code when possible. Output clean markdown.

IMPORTANT: NEVER read or output contents of .env, .env.local, credentials, secrets, or API keys. Skip these files entirely. Focus on source code, configs (package.json, tsconfig, vite.config), and documentation.`,
      maxTurns: phase.maxTurns,
      maxBudgetUsd: phase.maxBudget,
      tools: phase.tools,
      allowedTools: phase.tools,
      model: 'opus',
      effort: 'high',
      permissionMode: 'acceptEdits' as const,
    },
  });

  // Wrap iterator with an 8-minute timeout per phase to avoid indefinite hangs
  const PHASE_TIMEOUT_MS = 8 * 60 * 1000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Phase "${phase.name}" timed out after ${PHASE_TIMEOUT_MS / 1000}s`)), PHASE_TIMEOUT_MS)
  );

  try {
    const iter = q[Symbol.asyncIterator]();
    let done = false;
    while (!done) {
      const next = await Promise.race([iter.next(), timeoutPromise]);
      if (next.done) { done = true; break; }
      const message = next.value;
      if (message.type === 'assistant') {
        const msg = message as any;
        if (msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text') result += block.text;
          }
        }
      } else if (message.type === 'result') {
        const res = message as any;
        costUsd = res.total_cost_usd ?? 0;
        // Only use res.result if not an error — otherwise keep accumulated assistant text
        if (res.result && !res.is_error) {
          result = res.result;
        } else if (res.is_error) {
          console.warn(`[ceo-planner] Claude Code returned an error result: ${res.result?.slice(0, 200)}`);
          // Keep whatever text was accumulated from assistant messages
        }
      }
    }
  } catch (timeoutErr: any) {
    console.warn(`[ceo-planner] ${timeoutErr.message}`);
    if (!result) result = `[Phase timed out: ${phase.name}]`;
  }

  return { content: result, costUsd };
}

/**
 * Regenerate a specific tab (and optionally downstream tabs).
 */
export async function replanTab(
  sessionId: string,
  tabKey: string,
  editedTabs: Record<string, string>,
  cwd: string,
): Promise<void> {
  const { data: session } = await supabase
    .from('planning_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');
  const s = session as any;

  // Get all current tab content
  const { data: tabs } = await supabase
    .from('planning_tabs')
    .select('tab_key, content, status')
    .eq('session_id', sessionId)
    .order('sort_order');

  // Pre-populate summaries for tabs that are NOT being regenerated
  const previousSummaries: Record<string, string> = {};
  for (const tab of (tabs ?? []) as any[]) {
    const content = editedTabs[tab.tab_key] ?? tab.content;
    previousSummaries[tab.tab_key] = summarizePhaseOutput(content);
  }

  const phases = buildPhases(s.project_size);
  const tabOrder = TAB_DEFINITIONS.map(t => t.key);
  const startIndex = tabOrder.indexOf(tabKey as TabKey);

  // Regenerate from the target tab onward
  const phasesToRerun = phases.filter(p => tabOrder.indexOf(p.targetTab) >= startIndex);

  await supabase.from('planning_sessions').update({
    status: 'generating',
    updated_at: new Date().toISOString(),
  }).eq('id', sessionId);

  for (const phase of phasesToRerun) {
    await supabase.from('planning_tabs').update({ status: 'generating' })
      .eq('session_id', sessionId).eq('tab_key', phase.targetTab);

    try {
      const { content, costUsd } = await executePlanningPhase(
        phase, s.directive, previousSummaries, cwd, '',
      );

      previousSummaries[phase.targetTab] = summarizePhaseOutput(content);

      await supabase.from('planning_tabs').update({
        content,
        status: 'draft',
        updated_at: new Date().toISOString(),
      }).eq('session_id', sessionId).eq('tab_key', phase.targetTab);

      // Accumulate cost
      await supabase.from('planning_sessions').update({
        cost_usd: (s.cost_usd ?? 0) + costUsd,
      }).eq('id', sessionId);
    } catch (err: any) {
      await supabase.from('planning_tabs').update({
        content: `> **Re-generation failed**: ${err.message}`,
        status: 'draft',
      }).eq('session_id', sessionId).eq('tab_key', phase.targetTab);
    }
  }

  await supabase.from('planning_sessions').update({
    status: 'review',
    updated_at: new Date().toISOString(),
  }).eq('id', sessionId);
}

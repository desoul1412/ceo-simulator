import { useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import type { Company } from '../store/dashboardStore';
import { hireAgent } from '../lib/orchestratorApi';
import * as api from '../lib/api';
import { isOnline } from '../lib/supabase';

// ── Agent model data for plan generation ────────────────────────────────────

const AGENT_MODELS: Record<string, { description: string; model: string; budget: number; color: string }> = {
  CEO: { description: 'Strategic leader', model: 'opus', budget: 25, color: '#00ffff' },
  PM: { description: 'Planner & architect', model: 'sonnet', budget: 15, color: '#c084fc' },
  Frontend: { description: 'UI/UX builder', model: 'sonnet', budget: 15, color: '#ff8800' },
  Backend: { description: 'API & data engineer', model: 'sonnet', budget: 15, color: '#3b82f6' },
  DevOps: { description: 'Infrastructure', model: 'sonnet', budget: 10, color: '#00ff88' },
  QA: { description: 'Quality gatekeeper', model: 'haiku', budget: 5, color: '#ef4444' },
  Marketer: { description: 'Growth & acquisition', model: 'sonnet', budget: 10, color: '#f59e0b' },
  'Content Writer': { description: 'Copy & docs', model: 'haiku', budget: 5, color: '#a78bfa' },
  Sales: { description: 'Revenue & retention', model: 'sonnet', budget: 10, color: '#06b6d4' },
  Operations: { description: 'Process & compliance', model: 'haiku', budget: 5, color: '#6b7280' },
};

interface PlanStep {
  role: string;
  task: string;
  priority: number;
}

interface CeoPlan {
  reasoning: string;
  agentsToHire: string[];
  steps: PlanStep[];
  estimatedCost: string;
}

type FlowStep = 'brief' | 'questions' | 'plan' | 'approved';

interface CeoPlanFlowProps {
  company: Company;
}

// ── Mock CEO reasoning (used when orchestrator generates real plans) ─────────

function generateMockPlan(brief: string, existingRoles: string[]): CeoPlan {
  const keywords = brief.toLowerCase();
  const needsFrontend = keywords.includes('ui') || keywords.includes('page') || keywords.includes('dashboard') || keywords.includes('design') || keywords.includes('app');
  const needsBackend = keywords.includes('api') || keywords.includes('data') || keywords.includes('server') || keywords.includes('database') || keywords.includes('auth');
  const needsDevOps = keywords.includes('deploy') || keywords.includes('ci') || keywords.includes('infra') || keywords.includes('pipeline');
  const needsMarketing = keywords.includes('launch') || keywords.includes('market') || keywords.includes('growth') || keywords.includes('seo');
  const needsContent = keywords.includes('blog') || keywords.includes('docs') || keywords.includes('copy') || keywords.includes('content');

  const agentsToHire: string[] = [];
  const steps: PlanStep[] = [];
  let priority = 1;

  // PM always needed for planning
  if (!existingRoles.includes('PM')) agentsToHire.push('PM');
  steps.push({ role: 'PM', task: `Gather detailed requirements for: "${brief}". Define acceptance criteria, data schemas, and non-functional requirements.`, priority: priority++ });

  if (needsFrontend || (!needsBackend && !needsDevOps && !needsMarketing)) {
    if (!existingRoles.includes('Frontend')) agentsToHire.push('Frontend');
    steps.push({ role: 'Frontend', task: `Build UI components and pages for: "${brief}". Follow pixel art / HUD design system. Write tests with vitest.`, priority: priority++ });
  }

  if (needsBackend) {
    if (!existingRoles.includes('Backend')) agentsToHire.push('Backend');
    steps.push({ role: 'Backend', task: `Build API endpoints and database schema for: "${brief}". Use Supabase with RLS. Write integration tests.`, priority: priority++ });
  }

  if (needsDevOps) {
    if (!existingRoles.includes('DevOps')) agentsToHire.push('DevOps');
    steps.push({ role: 'DevOps', task: `Set up infrastructure and deployment pipeline for: "${brief}". Configure CI/CD and monitoring.`, priority: priority++ });
  }

  if (needsMarketing) {
    if (!existingRoles.includes('Marketer')) agentsToHire.push('Marketer');
    steps.push({ role: 'Marketer', task: `Create go-to-market strategy for: "${brief}". Plan launch, SEO, and user acquisition.`, priority: priority++ });
  }

  if (needsContent) {
    if (!existingRoles.includes('Content Writer')) agentsToHire.push('Content Writer');
    steps.push({ role: 'Content Writer', task: `Write documentation and content for: "${brief}". Create landing page copy and technical docs.`, priority: priority++ });
  }

  // QA at the end
  if (!existingRoles.includes('QA')) agentsToHire.push('QA');
  steps.push({ role: 'QA', task: `Write test plan and validate all acceptance criteria for: "${brief}". Run full regression suite.`, priority: priority++ });

  const totalBudget = agentsToHire.reduce((s, r) => s + (AGENT_MODELS[r]?.budget ?? 10), 0);

  return {
    reasoning: `Analyzed the goal: "${brief}". This requires ${steps.length} phases across ${new Set(steps.map(s => s.role)).size} roles. ${agentsToHire.length > 0 ? `Need to hire: ${agentsToHire.join(', ')}.` : 'All required agents already hired.'} Estimated cost: ~$${totalBudget}.`,
    agentsToHire,
    steps,
    estimatedCost: `~$${totalBudget}`,
  };
}

function generateQuestions(brief: string): string[] {
  const questions: string[] = [];
  if (brief.length < 30) questions.push('Can you provide more detail about what you want to build?');
  if (!brief.toLowerCase().includes('user')) questions.push('Who is the target user for this feature?');
  if (!brief.toLowerCase().includes('priority')) questions.push('What is the priority — speed to ship or quality/polish?');
  if (questions.length === 0) questions.push('Any specific technical constraints or preferences I should know about?');
  return questions;
}

// ── Component ───────────────────────────────────────────────────────────────

export function CeoPlanFlow({ company }: CeoPlanFlowProps) {
  const [flowStep, setFlowStep] = useState<FlowStep>('brief');
  const [brief, setBrief] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [questionIdx, setQuestionIdx] = useState(0);
  const [plan, setPlan] = useState<CeoPlan | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planText, setPlanText] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const assignGoal = useDashboardStore(s => s.assignGoal);
  const processingGoal = useDashboardStore(s => s.processingGoal);
  const orchestratorConnected = useDashboardStore(s => s.orchestratorConnected);

  const isThinking = processingGoal === company.id;
  const goalActive = !!company.ceoGoal;

  const existingRoles = company.employees.map(e => e.role);

  // Step 1: Submit brief → generate questions
  const handleSubmitBrief = () => {
    if (!brief.trim()) return;
    const qs = generateQuestions(brief);
    setQuestions(qs);
    setAnswers([]);
    setQuestionIdx(0);
    setFlowStep('questions');
  };

  // Step 2: Answer questions → generate plan
  const handleAnswerQuestion = () => {
    const newAnswers = [...answers, currentAnswer];
    setAnswers(newAnswers);
    setCurrentAnswer('');

    if (questionIdx + 1 < questions.length) {
      setQuestionIdx(questionIdx + 1);
    } else {
      // All questions answered → generate plan
      const fullBrief = `${brief}\n\nClarifications:\n${questions.map((q, i) => `Q: ${q}\nA: ${newAnswers[i]}`).join('\n')}`;
      const generatedPlan = generateMockPlan(fullBrief, existingRoles);
      setPlan(generatedPlan);
      setPlanText(formatPlanForEdit(generatedPlan));
      setFlowStep('plan');
    }
  };

  const handleSkipQuestions = () => {
    const generatedPlan = generateMockPlan(brief, existingRoles);
    setPlan(generatedPlan);
    setPlanText(formatPlanForEdit(generatedPlan));
    setFlowStep('plan');
  };

  // Step 3: Approve plan → hire agents → execute
  const handleApprove = async () => {
    if (!plan) return;
    const finalPlan = editingPlan ? parsePlanFromText(planText) : plan;
    setPlan(finalPlan);
    setFlowStep('approved');

    // Auto-hire agents from the plan
    const orchestrator = useDashboardStore.getState().orchestratorConnected;
    for (const role of finalPlan.agentsToHire) {
      const model = AGENT_MODELS[role];
      try {
        if (orchestrator) {
          await hireAgent({
            companyId: company.id,
            mode: 'auto',
            role,
            model: model?.model ?? 'sonnet',
            skills: model ? [role] : undefined,
          });
        } else if (isOnline()) {
          // Direct Supabase hire (simplified)
          const { supabase } = await import('../lib/supabase');
          if (supabase) {
            // Validated against default-layout-1.json — see brain/wiki/Role-Seat-Validation.md
            const ROLE_SEATS: Record<string, { col: number; row: number }> = {
              PM: { col: 18, row: 3 }, Frontend: { col: 9, row: 3 },
              Backend: { col: 24, row: 3 }, DevOps: { col: 2, row: 13 },   // FIXED: was (4,14)
              QA: { col: 9, row: 13 }, Marketer: { col: 18, row: 14 },     // FIXED: was (9,14)
              'Content Writer': { col: 20, row: 15 }, Sales: { col: 22, row: 14 },
              Operations: { col: 6, row: 15 },
            };
            const seat = ROLE_SEATS[role] ?? { col: 12, row: 8 };
            const ROLE_COLORS: Record<string, string> = {
              PM: '#c084fc', Frontend: '#ff8800', Backend: '#3b82f6',
              DevOps: '#00ff88', QA: '#ef4444', Marketer: '#f59e0b',
              'Content Writer': '#a78bfa', Sales: '#06b6d4', Operations: '#6b7280',
            };
            await supabase.from('agents').insert({
              company_id: company.id,
              name: role,
              role,
              color: ROLE_COLORS[role] ?? '#6a7a90',
              sprite_index: Object.keys(ROLE_SEATS).indexOf(role) + 1,
              tile_col: seat.col,
              tile_row: seat.row,
            });
          }
        }
      } catch (err) {
        console.error(`[plan] Failed to hire ${role}:`, err);
      }
    }

    // Refresh company data to pick up new agents
    if (isOnline()) {
      try {
        const apiCompanies = await api.fetchCompanies();
        const updated = apiCompanies.find(c => c.id === company.id);
        if (updated) {
          const store = useDashboardStore.getState();
          useDashboardStore.setState({
            companies: store.companies.map(co => {
              if (co.id !== company.id) return co;
              return {
                ...co,
                employees: updated.agents.map(a => ({
                  id: a.id, name: a.name, role: a.role as any, status: a.status as any,
                  col: a.tileCol, row: a.tileRow, color: a.color,
                  assignedTask: a.assignedTask, progress: a.progress,
                })),
              };
            }),
          });
        }
      } catch {}
    }

    // Assign goal and create delegations from the plan steps
    // First set the company goal
    if (isOnline()) {
      const { supabase } = await import('../lib/supabase');
      if (supabase) {
        // Set company goal
        await supabase.from('companies').update({
          ceo_goal: brief,
          status: 'growing',
        }).eq('id', company.id);

        // Refresh to get new agent IDs
        const { data: agents } = await supabase
          .from('agents').select('*').eq('company_id', company.id);

        // Create goal record
        const ceo = (agents ?? []).find((a: any) => a.role === 'CEO');
        const { data: goalRecord } = await supabase
          .from('goals').insert({
            company_id: company.id,
            title: brief,
            assigned_to: ceo?.id ?? null,
            status: 'in-progress',
          }).select().single();

        // Create delegations from plan steps
        for (const step of finalPlan.steps) {
          const agent = (agents ?? []).find((a: any) => a.role === step.role);
          if (agent) {
            await supabase.from('delegations').insert({
              company_id: company.id,
              goal_id: (goalRecord as any)?.id ?? null,
              to_agent_id: agent.id,
              to_role: step.role,
              task: step.task,
              progress: 0,
            });

            // Set agent to working with their task
            await supabase.from('agents').update({
              status: 'working',
              assigned_task: step.task,
              progress: 0,
            }).eq('id', agent.id);
          }
        }

        // Set CEO to meeting (overseeing)
        if (ceo) {
          await supabase.from('agents').update({
            status: 'meeting',
            assigned_task: `Overseeing: ${brief}`,
            progress: 0,
          }).eq('id', ceo.id);
        }

        // Log activity
        await supabase.from('activity_log').insert({
          company_id: company.id,
          agent_id: ceo?.id ?? null,
          type: 'goal-assigned',
          message: `CEO assigned goal: "${brief}"`,
        });

        // Refresh store
        const apiCompanies = await api.fetchCompanies();
        const updated2 = apiCompanies.find(c => c.id === company.id);
        if (updated2) {
          useDashboardStore.setState(state => ({
            companies: state.companies.map(co => {
              if (co.id !== company.id) return co;
              return {
                ...co,
                ceoGoal: brief,
                status: 'growing' as any,
                employees: updated2.agents.map(a => ({
                  id: a.id, name: a.name, role: a.role as any, status: a.status as any,
                  col: a.tileCol, row: a.tileRow, color: a.color,
                  assignedTask: a.assignedTask, progress: a.progress,
                })),
                delegations: updated2.delegations.map((d: any) => ({
                  id: d.id, toRole: d.toRole as any, task: d.task, progress: d.progress,
                })),
              };
            }),
          }));
        }
      }
    } else {
      // Offline fallback
      assignGoal(company.id, brief);
    }
  };

  const handleReset = () => {
    setFlowStep('brief');
    setBrief('');
    setQuestions([]);
    setAnswers([]);
    setPlan(null);
    setEditingPlan(false);
    setShowDetails(false);
  };

  // Already has active goal — show it with details toggle
  if (goalActive && flowStep !== 'approved') {
    return (
      <div style={{
        padding: '10px 12px',
        background: '#0d1117',
        border: '1px solid #1b2030',
        fontFamily: 'var(--font-pixel)',
      }}>
        <div style={{
          fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase',
          letterSpacing: '0.1em', marginBottom: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>CEO Directive</span>
          {orchestratorConnected && <span style={{ color: '#00ff88', fontSize: 'var(--font-xs)' }}>{'\u25C6'} CLAUDE</span>}
        </div>
        <div style={{
          padding: '6px 8px', background: '#00ffff08', border: '1px solid #00ffff20',
          fontSize: 'var(--font-sm)', color: '#00ffff', lineHeight: 1.4, marginBottom: 6,
        }}>
          {'\u25B8'} {company.ceoGoal}
        </div>
        {plan && (
          <button onClick={() => setShowDetails(!showDetails)} style={{
            background: 'none', border: '1px solid #1b2030', color: '#6a7a90',
            fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-xs)',
            padding: '3px 10px', cursor: 'pointer', width: '100%',
          }}>
            {showDetails ? '\u25BC Hide Plan' : '\u25B6 Show Plan'}
          </button>
        )}
        {showDetails && plan && (
          <div style={{ marginTop: 8 }}>
            <PlanDisplay plan={plan} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px 12px',
      background: '#0d1117',
      border: '1px solid #1b2030',
      fontFamily: 'var(--font-pixel)',
    }}>
      {/* Header */}
      <div style={{
        fontSize: 'var(--font-xs)', color: 'var(--hud-text-dim)', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>CEO Directive</span>
        {orchestratorConnected && <span style={{ color: '#00ff88', fontSize: 'var(--font-xs)' }}>{'\u25C6'} CLAUDE</span>}
      </div>

      {/* Step 1: Brief input */}
      {flowStep === 'brief' && (
        <div>
          <div style={{ fontSize: 'var(--font-md)', color: '#6a7a90', marginBottom: 6 }}>
            Describe your goal or project brief:
          </div>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder="e.g. Build a habit tracker app with auth, dashboard, and mobile-responsive UI..."
            rows={3}
            style={{
              width: '100%', padding: '8px', background: '#090d14', border: '1px solid #1b2030',
              color: '#e0eaf4', fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-md)',
              resize: 'vertical', marginBottom: 6,
            }}
          />
          <button onClick={handleSubmitBrief} disabled={!brief.trim()} style={{
            width: '100%', padding: '8px', background: brief.trim() ? '#00ffff18' : '#1b2030',
            border: `1px solid ${brief.trim() ? '#00ffff40' : '#1b2030'}`,
            color: brief.trim() ? '#00ffff' : '#2a3a50',
            fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-sm)',
            textTransform: 'uppercase', cursor: brief.trim() ? 'pointer' : 'not-allowed',
          }}>
            Submit Brief
          </button>
        </div>
      )}

      {/* Step 2: CEO asks questions */}
      {flowStep === 'questions' && (
        <div>
          <div style={{
            padding: '8px', background: '#00ffff08', border: '1px solid #00ffff20',
            fontSize: 'var(--font-sm)', color: '#00ffff', marginBottom: 8, lineHeight: 1.5,
          }}>
            <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', marginBottom: 4 }}>
              CEO Question ({questionIdx + 1}/{questions.length}):
            </div>
            {questions[questionIdx]}
          </div>

          {/* Previous Q&A */}
          {answers.map((a, i) => (
            <div key={i} style={{ marginBottom: 6, fontSize: 'var(--font-xs)', color: '#4a5568' }}>
              <div style={{ color: '#00ffff' }}>Q: {questions[i]}</div>
              <div style={{ color: '#6a7a90' }}>A: {a}</div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnswerQuestion()}
              placeholder="Your answer..."
              style={{
                flex: 1, padding: '6px 8px', background: '#090d14', border: '1px solid #1b2030',
                color: '#e0eaf4', fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-sm)',
              }}
            />
            <button onClick={handleAnswerQuestion} style={{
              padding: '6px 12px', background: '#00ffff18', border: '1px solid #00ffff40',
              color: '#00ffff', fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-sm)',
              cursor: 'pointer',
            }}>Reply</button>
          </div>
          <button onClick={handleSkipQuestions} style={{
            width: '100%', marginTop: 6, padding: '4px', background: 'none',
            border: '1px solid #1b2030', color: '#4a5568',
            fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-xs)', cursor: 'pointer',
          }}>
            Skip questions {'\u2192'} Generate plan
          </button>
        </div>
      )}

      {/* Step 3: Show plan, allow edit, approve */}
      {flowStep === 'plan' && plan && (
        <div>
          {!editingPlan ? (
            <>
              <PlanDisplay plan={plan} />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => setEditingPlan(true)} style={{
                  flex: 1, padding: '8px', background: '#ff880018', border: '1px solid #ff880040',
                  color: '#ff8800', fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-sm)',
                  cursor: 'pointer', textTransform: 'uppercase',
                }}>
                  {'\u270E'} Edit Plan
                </button>
                <button onClick={handleApprove} style={{
                  flex: 1, padding: '8px', background: '#00ff8818', border: '1px solid #00ff8840',
                  color: '#00ff88', fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-sm)',
                  cursor: 'pointer', textTransform: 'uppercase',
                }}>
                  {'\u2714'} Approve & Start
                </button>
              </div>
              <button onClick={handleReset} style={{
                width: '100%', marginTop: 6, padding: '4px', background: 'none',
                border: '1px solid #1b2030', color: '#4a5568',
                fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-xs)', cursor: 'pointer',
              }}>
                {'\u2190'} Start over
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 'var(--font-xs)', color: '#ff8800', marginBottom: 4 }}>
                Edit the plan below, then resubmit:
              </div>
              <textarea
                value={planText}
                onChange={e => setPlanText(e.target.value)}
                rows={12}
                style={{
                  width: '100%', padding: '8px', background: '#090d14', border: '1px solid #ff880040',
                  color: '#e0eaf4', fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-xs)',
                  resize: 'vertical', lineHeight: 1.5,
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => { setPlan(parsePlanFromText(planText)); setEditingPlan(false); }} style={{
                  flex: 1, padding: '8px', background: '#00ffff18', border: '1px solid #00ffff40',
                  color: '#00ffff', fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-sm)',
                  cursor: 'pointer', textTransform: 'uppercase',
                }}>
                  Resubmit Plan
                </button>
                <button onClick={() => setEditingPlan(false)} style={{
                  padding: '8px 12px', background: 'none', border: '1px solid #1b2030',
                  color: '#4a5568', fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-sm)', cursor: 'pointer',
                }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4: Approved — executing */}
      {flowStep === 'approved' && (
        <div>
          <div style={{
            padding: '8px', background: '#00ff8808', border: '1px solid #00ff8820',
            fontSize: 'var(--font-sm)', color: '#00ff88', marginBottom: 6,
          }}>
            {'\u2714'} Plan approved — executing...
          </div>
          {isThinking && (
            <div style={{ fontSize: 'var(--font-sm)', color: '#00ffff', animation: 'pulse 1.5s infinite' }}>
              {'\u25C6'} CEO is delegating tasks via Claude...
            </div>
          )}
          {plan && (
            <button onClick={() => setShowDetails(!showDetails)} style={{
              width: '100%', marginTop: 6, padding: '4px', background: 'none',
              border: '1px solid #1b2030', color: '#6a7a90',
              fontFamily: 'var(--font-pixel)', fontSize: 'var(--font-xs)', cursor: 'pointer',
            }}>
              {showDetails ? '\u25BC Hide Plan' : '\u25B6 Show Plan'}
            </button>
          )}
          {showDetails && plan && <PlanDisplay plan={plan} />}
        </div>
      )}
    </div>
  );
}

// ── Plan display sub-component ──────────────────────────────────────────────

function PlanDisplay({ plan }: { plan: CeoPlan }) {
  return (
    <div style={{ fontFamily: 'var(--font-pixel)' }}>
      {/* CEO reasoning */}
      <div style={{
        padding: '8px', background: '#0a0e14', border: '1px solid #1b2030',
        fontSize: 'var(--font-xs)', color: '#6a7a90', lineHeight: 1.5, marginBottom: 8,
      }}>
        <div style={{ color: '#00ffff', marginBottom: 4, fontSize: 'var(--font-xs)', textTransform: 'uppercase' }}>
          CEO Analysis
        </div>
        {plan.reasoning}
      </div>

      {/* Agents to hire */}
      {plan.agentsToHire.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>
            Agents to Hire
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {plan.agentsToHire.map(role => (
              <span key={role} style={{
                padding: '2px 8px', fontSize: 'var(--font-xs)',
                background: `${AGENT_MODELS[role]?.color ?? '#4a5568'}15`,
                border: `1px solid ${AGENT_MODELS[role]?.color ?? '#4a5568'}40`,
                color: AGENT_MODELS[role]?.color ?? '#4a5568',
              }}>
                {role} ({AGENT_MODELS[role]?.model ?? 'sonnet'} ${AGENT_MODELS[role]?.budget ?? 10})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Execution steps */}
      <div style={{ fontSize: 'var(--font-xs)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>
        Execution Plan ({plan.steps.length} steps) — Est. {plan.estimatedCost}
      </div>
      {plan.steps.map((step, i) => (
        <div key={i} style={{
          padding: '6px 8px', marginBottom: 4,
          background: '#0a0e14', border: '1px solid #1b2030',
          display: 'flex', gap: 8,
        }}>
          <span style={{
            fontSize: 'var(--font-xs)', color: '#4a5568', flexShrink: 0, width: 20,
          }}>
            {step.priority}.
          </span>
          <span style={{
            fontSize: 'var(--font-xs)',
            color: AGENT_MODELS[step.role]?.color ?? '#6a7a90',
            flexShrink: 0, width: 80, textTransform: 'uppercase',
          }}>
            {step.role}
          </span>
          <span style={{ fontSize: 'var(--font-xs)', color: '#8090a8', flex: 1 }}>
            {step.task}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Plan serialization ──────────────────────────────────────────────────────

function formatPlanForEdit(plan: CeoPlan): string {
  let text = `## CEO Analysis\n${plan.reasoning}\n\n`;
  if (plan.agentsToHire.length > 0) {
    text += `## Agents to Hire\n${plan.agentsToHire.join(', ')}\n\n`;
  }
  text += `## Execution Steps\n`;
  for (const step of plan.steps) {
    text += `${step.priority}. [${step.role}] ${step.task}\n`;
  }
  text += `\n## Estimated Cost\n${plan.estimatedCost}`;
  return text;
}

function parsePlanFromText(text: string): CeoPlan {
  const lines = text.split('\n');
  let reasoning = '';
  const agentsToHire: string[] = [];
  const steps: PlanStep[] = [];
  let estimatedCost = '~$0';
  let section = '';

  for (const line of lines) {
    if (line.startsWith('## CEO Analysis')) { section = 'reasoning'; continue; }
    if (line.startsWith('## Agents to Hire')) { section = 'hire'; continue; }
    if (line.startsWith('## Execution Steps')) { section = 'steps'; continue; }
    if (line.startsWith('## Estimated Cost')) { section = 'cost'; continue; }

    if (section === 'reasoning' && line.trim()) reasoning += line + ' ';
    if (section === 'hire' && line.trim()) {
      agentsToHire.push(...line.split(',').map(s => s.trim()).filter(Boolean));
    }
    if (section === 'steps') {
      const match = line.match(/^(\d+)\.\s*\[([^\]]+)\]\s*(.+)/);
      if (match) {
        steps.push({ priority: parseInt(match[1]), role: match[2], task: match[3] });
      }
    }
    if (section === 'cost' && line.trim()) estimatedCost = line.trim();
  }

  return { reasoning: reasoning.trim(), agentsToHire, steps, estimatedCost };
}

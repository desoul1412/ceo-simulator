import { create } from 'zustand';
import { ROLE_DESKS, IDLE_POSITIONS, MEETING_POSITIONS, KITCHEN_POSITIONS } from '../utils/isoProjection';
import * as api from '../lib/api';
import { isOnline } from '../lib/supabase';
import { isOrchestratorOnline, assignGoalToOrchestrator } from '../lib/orchestratorApi';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentStatus = 'idle' | 'working' | 'meeting' | 'break';
export type EmployeeRole = string;
export type CompanyStatus = 'bootstrapping' | 'growing' | 'scaling' | 'crisis';

export interface Delegation {
  id: string;
  toRole: EmployeeRole;
  task: string;
  progress: number; // 0–100
}

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  status: AgentStatus;
  col: number;
  row: number;
  color: string;
  assignedTask: string | null;
  progress: number;
  department?: string | null;
  deptRoleId?: string | null;
}

export interface Company {
  id: string;
  name: string;
  budget: number;
  budgetSpent: number;
  status: CompanyStatus;
  ceoGoal: string | null;
  employees: Employee[];
  delegations: Delegation[];
}

export interface DashboardStore {
  companies: Company[];
  selectedCompanyId: string | null;
  loading: boolean;
  synced: boolean;
  orchestratorConnected: boolean;
  processingGoal: string | null; // companyId currently processing

  // Actions
  loadFromBackend: () => Promise<void>;
  addCompany: (name: string, budget: number) => void;
  selectCompany: (id: string | null) => void;
  assignGoal: (companyId: string, goal: string) => void;
  tickCompany: (companyId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _uid = 0;
function uid(prefix: string) { return `${prefix}-${++_uid}`; }

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ROLE_COLORS: Record<string, string> = {
  CEO:      '#00ffff',
  PM:       '#c084fc',
  DevOps:   '#00ff88',
  Frontend: '#ff8800',
  Backend:  '#3b82f6',
  QA:       '#ef4444',
  Marketer: '#f59e0b',
  'Content Writer': '#a78bfa',
  Sales:    '#06b6d4',
  Operations: '#6b7280',
};

const ROLE_NAMES: Record<string, string[]> = {
  CEO:      ['CEO'],
  PM:       ['PM'],
  DevOps:   ['DevOps'],
  Frontend: ['Frontend'],
  Backend:  ['Backend'],
  QA:       ['QA'],
  Marketer: ['Marketer'],
  'Content Writer': ['Content Writer'],
  Sales:    ['Sales'],
  Operations: ['Operations'],
};

function makeEmployee(role: EmployeeRole): Employee {
  const desk = ROLE_DESKS[role];
  return {
    id: uid(role.toLowerCase()),
    name: pickRandom(ROLE_NAMES[role]),
    role,
    status: 'idle',
    col: desk.col,
    row: desk.row,
    color: ROLE_COLORS[role],
    assignedTask: null,
    progress: 0,
  };
}

function deriveTask(role: string, goal: string): string {
  const short = goal.length > 40 ? goal.slice(0, 37) + '...' : goal;
  switch (role) {
    case 'PM':             return `Gather requirements, define acceptance criteria and data schemas for: ${short}`;
    case 'DevOps':         return `Set up CI/CD pipeline, configure deployment, ensure infra readiness for: ${short}`;
    case 'Frontend':       return `Build UI components and pages following design system for: ${short}`;
    case 'Backend':        return `Build API endpoints and database schema with RLS for: ${short}`;
    case 'QA':             return `Write test plan, validate acceptance criteria, run regression suite for: ${short}`;
    case 'Marketer':       return `Create go-to-market strategy, plan launch and user acquisition for: ${short}`;
    case 'Content Writer': return `Write documentation, landing page copy, and blog content for: ${short}`;
    case 'Sales':          return `Define pricing strategy, design conversion funnel for: ${short}`;
    case 'Operations':     return `Set up SOPs, budget tracking, and compliance docs for: ${short}`;
    default:               return `Oversee: ${short}`;
  }
}

function createCompanyState(name: string, budget: number): Company {
  const id = uid('co');
  return {
    id,
    name,
    budget,
    budgetSpent: 0,
    status: 'bootstrapping',
    ceoGoal: null,
    employees: [
      makeEmployee('CEO'),
      makeEmployee('PM'),
      makeEmployee('DevOps'),
      makeEmployee('Frontend'),
    ],
    delegations: [],
  };
}

// ── API → Local state mapper ─────────────────────────────────────────────────

function apiCompanyToLocal(ac: api.ApiCompany): Company {
  return {
    id: ac.id,
    name: ac.name,
    budget: ac.budget,
    budgetSpent: ac.budgetSpent,
    status: ac.status as CompanyStatus,
    ceoGoal: ac.ceoGoal,
    employees: ac.agents.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role as EmployeeRole,
      status: a.status as AgentStatus,
      col: a.tileCol,
      row: a.tileRow,
      color: a.color,
      assignedTask: a.assignedTask,
      progress: a.progress,
      department: a.department,
      deptRoleId: a.deptRoleId,
    })),
    delegations: ac.delegations.map(d => ({
      id: d.id,
      toRole: d.toRole as EmployeeRole,
      task: d.task,
      progress: d.progress,
    })),
  };
}

// ── Fallback mock goal assignment (when orchestrator is offline) ──────────────

function fallbackAssignGoal(companyId: string, goal: string) {
  useDashboardStore.setState((state) => ({
    companies: state.companies.map(co => {
      if (co.id !== companyId) return co;
      // Create delegations for all non-CEO agents
      const workerRoles = co.employees.filter(e => e.role !== 'CEO').map(e => e.role);
      const delegations: Delegation[] = workerRoles.map(role => ({
        id: uid('del'),
        toRole: role as EmployeeRole,
        task: deriveTask(role, goal),
        progress: 0,
      }));
      const employees = co.employees.map(emp => {
        if (emp.role === 'CEO') {
          const meetPos = pickRandom(MEETING_POSITIONS);
          return { ...emp, status: 'meeting' as AgentStatus, assignedTask: `Overseeing: ${goal}`, progress: 0, col: meetPos.col, row: meetPos.row };
        }
        const del = delegations.find(d => d.toRole === emp.role);
        if (del) {
          const desk = ROLE_DESKS[emp.role] ?? { col: emp.col, row: emp.row };
          return { ...emp, status: 'working' as AgentStatus, assignedTask: del.task, progress: 0, col: desk.col, row: desk.row };
        }
        return emp;
      });
      return { ...co, ceoGoal: goal, delegations, employees, status: 'growing' as CompanyStatus };
    }),
  }));
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>((set) => ({
  companies: [],
  selectedCompanyId: null,
  loading: true,
  synced: false,
  orchestratorConnected: false,
  processingGoal: null,

  // ── Load from Supabase (or fallback to local mock data) ──────────────────

  loadFromBackend: async () => {
    // Check orchestrator connection
    const orchOnline = await isOrchestratorOnline().catch(() => false);
    set({ orchestratorConnected: orchOnline });

    if (!isOnline()) {
      // Offline: start empty, user creates companies manually
      set({ companies: [], loading: false, synced: false });
      return;
    }

    try {
      set({ loading: true });
      const apiCompanies = await api.fetchCompanies();
      set({
        companies: apiCompanies.map(apiCompanyToLocal),
        loading: false,
        synced: true,
      });
    } catch (err) {
      console.error('[store] Failed to load from backend:', err);
      set({ companies: [], loading: false, synced: false });
    }
  },

  addCompany: (name, budget) => {
    if (isOnline()) {
      // Async create on backend, then update local state
      api.createCompany(name, budget).then(ac => {
        set(state => ({
          companies: [...state.companies, apiCompanyToLocal(ac)],
        }));
      }).catch(err => {
        console.error('[store] Failed to create company on backend:', err);
        // Fallback to local
        set(state => ({
          companies: [...state.companies, createCompanyState(name, budget)],
        }));
      });
    } else {
      set(state => ({
        companies: [...state.companies, createCompanyState(name, budget)],
      }));
    }
  },

  selectCompany: (id) => set({ selectedCompanyId: id }),

  assignGoal: (companyId, goal) => {
    const { orchestratorConnected } = useDashboardStore.getState();

    // Set CEO to "thinking" state immediately
    set((state) => ({
      processingGoal: companyId,
      companies: state.companies.map(co => {
        if (co.id !== companyId) return co;
        const employees = co.employees.map(emp => {
          if (emp.role === 'CEO') {
            return { ...emp, status: 'working' as AgentStatus, assignedTask: `Thinking about: ${goal}`, progress: 0 };
          }
          return emp;
        });
        return { ...co, ceoGoal: goal, employees, status: 'growing' as CompanyStatus };
      }),
    }));

    if (orchestratorConnected) {
      // REAL MODE: CEO agent calls Claude via Agent SDK
      assignGoalToOrchestrator(companyId, goal).then(_result => {
        // Reload company data from Supabase (orchestrator updated the DB)
        if (isOnline()) {
          api.fetchCompanies().then(apiCompanies => {
            const target = apiCompanies.find(c => c.id === companyId);
            if (target) {
              set(state => ({
                processingGoal: null,
                companies: state.companies.map(co => {
                  if (co.id !== companyId) return co;
                  return apiCompanyToLocal(target);
                }),
              }));
            }
          });
        }
      }).catch(err => {
        console.error('[store] Orchestrator goal assignment failed:', err);
        set({ processingGoal: null });
        // Fallback to mock delegation
        fallbackAssignGoal(companyId, goal);
      });
    } else {
      // MOCK MODE: local simulation (existing behavior)
      set({ processingGoal: null });
      fallbackAssignGoal(companyId, goal);

      // Sync to Supabase if online
      if (isOnline()) {
        api.assignGoal(companyId, goal).then(result => {
          set(state => ({
            companies: state.companies.map(co => {
              if (co.id !== companyId) return co;
              return {
                ...co,
                employees: result.agents.map(a => ({
                  id: a.id,
                  name: a.name,
                  role: a.role as EmployeeRole,
                  status: a.status as AgentStatus,
                  col: a.tileCol,
                  row: a.tileRow,
                  color: a.color,
                  assignedTask: a.assignedTask,
                  progress: a.progress,
                  department: (a as any).department ?? null,
                  deptRoleId: (a as any).deptRoleId ?? null,
                })),
                delegations: result.delegations.map(d => ({
                  id: d.id,
                  toRole: d.toRole as EmployeeRole,
                  task: d.task,
                  progress: d.progress,
                })),
              };
            }),
          }));
        }).catch(err => {
          console.error('[store] Failed to sync goal to backend:', err);
        });
      }
    }
  },

  tickCompany: (companyId) => {
    // Optimistic local tick (keeps canvas responsive)
    set((state) => ({
      companies: state.companies.map(co => {
        if (co.id !== companyId) return co;
        if (!co.ceoGoal) return co;

        const progressIncrement = 2 + Math.floor(Math.random() * 5);
        let allDone = true;

        const delegations = co.delegations.map(d => {
          const newProgress = Math.min(100, d.progress + progressIncrement);
          if (newProgress < 100) allDone = false;
          return { ...d, progress: newProgress };
        });

        const employees = co.employees.map(emp => {
          const del = delegations.find(d => d.toRole === emp.role);
          if (emp.role === 'CEO') {
            const ceoPos = allDone ? ROLE_DESKS.CEO : pickRandom(MEETING_POSITIONS);
            return {
              ...emp,
              status: (allDone ? 'idle' : 'meeting') as AgentStatus,
              col: ceoPos.col, row: ceoPos.row,
              progress: allDone ? 100 : Math.round(delegations.reduce((s, d) => s + d.progress, 0) / delegations.length),
              assignedTask: allDone ? null : emp.assignedTask,
            };
          }
          if (del) {
            if (del.progress >= 100) {
              const breakPos = pickRandom(KITCHEN_POSITIONS);
              return { ...emp, status: 'break' as AgentStatus, progress: 100, col: breakPos.col, row: breakPos.row, assignedTask: null };
            }
            return { ...emp, progress: del.progress };
          }
          if (Math.random() < 0.3) {
            const pos = pickRandom(IDLE_POSITIONS);
            return { ...emp, status: 'idle' as AgentStatus, col: pos.col, row: pos.row };
          }
          return emp;
        });

        const costPerTick = 150;
        const newBudgetSpent = co.budgetSpent + costPerTick;

        return {
          ...co,
          delegations,
          employees,
          budgetSpent: newBudgetSpent,
          ...(allDone ? { ceoGoal: null, delegations: [], status: 'scaling' as CompanyStatus } : {}),
        };
      }),
    }));

    // Background sync to Supabase (non-blocking, no UI wait)
    if (isOnline()) {
      api.tickCompany(companyId).catch(err => {
        console.error('[store] Tick sync failed:', err);
      });
    }
  },
}));

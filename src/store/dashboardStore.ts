import { create } from 'zustand';
import { ROLE_DESKS, IDLE_POSITIONS, MEETING_POSITIONS, KITCHEN_POSITIONS } from '../utils/isoProjection';
import * as api from '../lib/api';
import { isOnline } from '../lib/supabase';
import { isOrchestratorOnline, assignGoalToOrchestrator } from '../lib/orchestratorApi';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentStatus = 'idle' | 'working' | 'meeting' | 'break';
export type EmployeeRole = 'CEO' | 'PM' | 'DevOps' | 'Frontend';
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

const ROLE_COLORS: Record<EmployeeRole, string> = {
  CEO:      '#00ffff',
  PM:       '#c084fc',
  DevOps:   '#00ff88',
  Frontend: '#ff8800',
};

const ROLE_NAMES: Record<EmployeeRole, string[]> = {
  CEO:      ['Ada Chen', 'Leo Voss', 'Nia Okafor'],
  PM:       ['Sam Patel', 'Rin Tanaka', 'Alex Duval'],
  DevOps:   ['Kai Müller', 'Zara Osei', 'Jin Zhao'],
  Frontend: ['Mia Torres', 'Dev Sharma', 'Luka Pavlov'],
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

function deriveTask(role: EmployeeRole, goal: string): string {
  switch (role) {
    case 'PM':       return `Define requirements for: ${goal}`;
    case 'DevOps':   return `Set up infra for: ${goal}`;
    case 'Frontend': return `Build UI for: ${goal}`;
    default:         return `Oversee: ${goal}`;
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
      const delegations: Delegation[] = (['PM', 'DevOps', 'Frontend'] as EmployeeRole[]).map(role => ({
        id: uid('del'),
        toRole: role,
        task: deriveTask(role, goal),
        progress: 0,
      }));
      const employees = co.employees.map(emp => {
        if (emp.role === 'CEO') {
          return { ...emp, status: 'working' as AgentStatus, assignedTask: `Oversee: ${goal}`, progress: 0 };
        }
        const del = delegations.find(d => d.toRole === emp.role);
        if (del) {
          const desk = ROLE_DESKS[emp.role];
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
      // Offline fallback: use mock data
      set({
        companies: [
          createCompanyState('Acme Corp', 120_000),
          createCompanyState('Globex Inc', 80_000),
        ],
        loading: false,
        synced: false,
      });
      return;
    }

    try {
      set({ loading: true });
      const apiCompanies = await api.fetchCompanies();

      if (apiCompanies.length === 0) {
        // First run: seed two demo companies
        const acme = await api.createCompany('Acme Corp', 120_000);
        const globex = await api.createCompany('Globex Inc', 80_000);
        set({
          companies: [apiCompanyToLocal(acme), apiCompanyToLocal(globex)],
          loading: false,
          synced: true,
        });
      } else {
        set({
          companies: apiCompanies.map(apiCompanyToLocal),
          loading: false,
          synced: true,
        });
      }
    } catch (err) {
      console.error('[store] Failed to load from backend, falling back to local:', err);
      set({
        companies: [
          createCompanyState('Acme Corp', 120_000),
          createCompanyState('Globex Inc', 80_000),
        ],
        loading: false,
        synced: false,
      });
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

        const progressIncrement = 8 + Math.floor(Math.random() * 12);
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

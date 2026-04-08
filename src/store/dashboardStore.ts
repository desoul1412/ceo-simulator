import { create } from 'zustand';
import { ROLE_DESKS, IDLE_POSITIONS, MEETING_POSITIONS, KITCHEN_POSITIONS } from '../utils/isoProjection';

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

// ── Mock companies ────────────────────────────────────────────────────────────

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

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>((set) => ({
  companies: [
    createCompanyState('Acme Corp', 120_000),
    createCompanyState('Globex Inc', 80_000),
  ],
  selectedCompanyId: null,

  addCompany: (name, budget) => set((state) => ({
    companies: [...state.companies, createCompanyState(name, budget)],
  })),

  selectCompany: (id) => set({ selectedCompanyId: id }),

  assignGoal: (companyId, goal) => set((state) => ({
    companies: state.companies.map(co => {
      if (co.id !== companyId) return co;

      // CEO takes the goal; delegates to PM, DevOps, Frontend
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
          return {
            ...emp,
            status: 'working' as AgentStatus,
            assignedTask: del.task,
            progress: 0,
            col: desk.col,
            row: desk.row,
          };
        }
        return emp;
      });

      return {
        ...co,
        ceoGoal: goal,
        delegations,
        employees,
        status: 'growing' as CompanyStatus,
      };
    }),
  })),

  tickCompany: (companyId) => set((state) => ({
    companies: state.companies.map(co => {
      if (co.id !== companyId) return co;
      if (!co.ceoGoal) return co;

      const progressIncrement = 8 + Math.floor(Math.random() * 12); // 8–20 per tick
      let allDone = true;

      const delegations = co.delegations.map(d => {
        const newProgress = Math.min(100, d.progress + progressIncrement);
        if (newProgress < 100) allDone = false;
        return { ...d, progress: newProgress };
      });

      const employees = co.employees.map(emp => {
        const del = delegations.find(d => d.toRole === emp.role);

        if (emp.role === 'CEO') {
          // CEO goes to meeting area mid-project
          const ceoPos = allDone
            ? ROLE_DESKS.CEO
            : pickRandom(MEETING_POSITIONS);
          return {
            ...emp,
            status: (allDone ? 'idle' : 'meeting') as AgentStatus,
            col: ceoPos.col,
            row: ceoPos.row,
            progress: allDone ? 100 : Math.round(delegations.reduce((s, d) => s + d.progress, 0) / delegations.length),
            assignedTask: allDone ? null : emp.assignedTask,
          };
        }

        if (del) {
          if (del.progress >= 100) {
            // Task complete → go on break
            const breakPos = pickRandom(KITCHEN_POSITIONS);
            return { ...emp, status: 'break' as AgentStatus, progress: 100, col: breakPos.col, row: breakPos.row, assignedTask: null };
          }
          // Still working → stay at desk
          return { ...emp, progress: del.progress };
        }

        // No task → idle wander
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
        ...(allDone ? {
          ceoGoal: null,
          delegations: [],
          status: 'scaling' as CompanyStatus,
        } : {}),
      };
    }),
  })),
}));

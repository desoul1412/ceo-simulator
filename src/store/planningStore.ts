import { create } from 'zustand';
import {
  startPlanningSession,
  pollPlanningSession,
  approvePlanningSession,
  replanSession,
  type PlanningTab,
} from '../lib/planningApi';

interface EditedTabs {
  [tabKey: string]: string;
}

interface PlanningStore {
  // State
  sessionId: string | null;
  companyId: string | null;
  directive: string;
  projectSize: 'small' | 'medium' | 'large';
  status: 'idle' | 'generating' | 'review' | 'approved' | 'error';
  currentPhase: number;
  totalPhases: number;
  costUsd: number;
  tabs: PlanningTab[];
  activeTabKey: string;
  isOpen: boolean;
  editedTabs: EditedTabs;
  error: string | null;
  approvalResult: { hired: string[]; ticketsCreated: number } | null;

  // Actions
  startPlanning: (companyId: string, directive: string, projectSize?: 'small' | 'medium' | 'large') => Promise<void>;
  pollSession: () => Promise<void>;
  setActiveTab: (tabKey: string) => void;
  editTab: (tabKey: string, content: string) => void;
  replanTab: (tabKey?: string) => Promise<void>;
  approveAndExecute: () => Promise<void>;
  setOpen: (open: boolean) => void;
  close: () => void;
  reset: () => void;
}

let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let pollAttempts = 0;

// Scale polling timeout by project size — opus phases take ~2-4min each
const POLL_LIMITS: Record<string, number> = {
  small: 240,   // 240 * 2.5s = 10 min
  medium: 600,  // 600 * 2.5s = 25 min
  large: 960,   // 960 * 2.5s = 40 min
};

function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  pollAttempts = 0;
}

export const usePlanningStore = create<PlanningStore>((set, get) => ({
  // Initial state
  sessionId: null,
  companyId: null,
  directive: '',
  projectSize: 'medium',
  status: 'idle',
  currentPhase: 0,
  totalPhases: 6,
  costUsd: 0,
  tabs: [],
  activeTabKey: 'overview',
  isOpen: false,
  editedTabs: {},
  error: null,
  approvalResult: null,

  startPlanning: async (companyId, directive, projectSize = 'medium') => {
    try {
      set({
        companyId,
        directive,
        projectSize,
        status: 'generating',
        isOpen: true,
        error: null,
        editedTabs: {},
        approvalResult: null,
        activeTabKey: 'overview',
      });

      const { sessionId, tabs } = await startPlanningSession(companyId, directive, projectSize);

      set({ sessionId, tabs });

      // Start polling with max attempts scaled by project size
      stopPolling();
      const maxAttempts = POLL_LIMITS[projectSize] ?? POLL_LIMITS.medium;
      const timeoutMin = Math.round(maxAttempts * 2.5 / 60);
      pollIntervalId = setInterval(() => {
        pollAttempts++;
        if (pollAttempts >= maxAttempts) {
          stopPolling();
          set({ status: 'error', error: `Planning session timed out after ${timeoutMin} minutes` });
          return;
        }
        get().pollSession().catch(() => {});
      }, 2500);
    } catch (err: any) {
      set({ status: 'error', error: err.message });
    }
  },

  pollSession: async () => {
    const { sessionId, companyId, status } = get();
    if (!sessionId || !companyId) return;
    if (status !== 'generating') {
      stopPolling();
      return;
    }

    try {
      const { session, tabs } = await pollPlanningSession(companyId, sessionId);

      const newStatus = session.status === 'review' ? 'review'
        : session.status === 'approved' ? 'approved'
        : session.status === 'rejected' ? 'error'
        : 'generating';

      set({
        tabs,
        currentPhase: session.current_phase,
        totalPhases: session.total_phases,
        costUsd: session.cost_usd,
        status: newStatus,
      });

      // Stop polling once generation is done
      if (newStatus !== 'generating') {
        stopPolling();
      }
    } catch (err: any) {
      console.warn('[planningStore] Poll failed:', err.message);
    }
  },

  setActiveTab: (tabKey) => {
    set({ activeTabKey: tabKey });
  },

  editTab: (tabKey, content) => {
    set(state => ({
      editedTabs: { ...state.editedTabs, [tabKey]: content },
    }));
  },

  replanTab: async (tabKey) => {
    const { sessionId, editedTabs } = get();
    if (!sessionId) return;

    set({ status: 'generating' });

    try {
      await replanSession(sessionId, tabKey, editedTabs);

      // Start polling again (reset attempt counter to avoid premature timeout)
      stopPolling();
      pollAttempts = 0;
      pollIntervalId = setInterval(() => {
        get().pollSession().catch(() => {});
      }, 2500);
    } catch (err: any) {
      set({ status: 'error', error: err.message });
    }
  },

  approveAndExecute: async () => {
    const { sessionId, editedTabs } = get();
    if (!sessionId) return;

    try {
      const result = await approvePlanningSession(sessionId, editedTabs);
      set({
        status: 'approved',
        approvalResult: { hired: result.hired, ticketsCreated: result.ticketsCreated },
      });
    } catch (err: any) {
      set({ status: 'error', error: err.message });
    }
  },

  setOpen: (open) => {
    set({ isOpen: open });
    // If re-opening and still generating, restart polling
    if (open && get().status === 'generating' && !pollIntervalId) {
      pollIntervalId = setInterval(() => {
        get().pollSession().catch(() => {});
      }, 2500);
    }
  },

  close: () => {
    stopPolling();
    set({ isOpen: false });
  },

  reset: () => {
    stopPolling();
    set({
      sessionId: null,
      companyId: null,
      directive: '',
      projectSize: 'medium',
      status: 'idle',
      currentPhase: 0,
      totalPhases: 6,
      costUsd: 0,
      tabs: [],
      activeTabKey: 'overview',
      isOpen: false,
      editedTabs: {},
      error: null,
      approvalResult: null,
    });
  },
}));

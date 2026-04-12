import { create } from 'zustand';
import type { DepartmentRoleRow, AgentSkillRow } from '../lib/database.types';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';

export interface DeptRoleWithCount extends DepartmentRoleRow {
  skill_count: number;
}

interface PresetStore {
  deptRoles: DeptRoleWithCount[];
  loading: boolean;
  error: string | null;
  selectedDeptId: string | null;
  deptSkills: AgentSkillRow[];
  loadingSkills: boolean;

  loadDeptRoles: () => Promise<void>;
  selectDept: (id: string | null) => void;
  loadSkillsForDept: (deptId: string) => Promise<void>;
}

export const usePresetStore = create<PresetStore>((set, get) => ({
  deptRoles: [],
  loading: false,
  error: null,
  selectedDeptId: null,
  deptSkills: [],
  loadingSkills: false,

  loadDeptRoles: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/api/dept-roles`);
      if (!res.ok) throw new Error('Failed to load department roles');
      const data = await res.json();
      set({ deptRoles: data, loading: false });
    } catch (err) {
      console.error('[presetStore] loadDeptRoles failed:', err);
      set({ loading: false, error: 'Failed to load department roles' });
    }
  },

  selectDept: (id) => {
    set({ selectedDeptId: id, deptSkills: [] });
    if (id) get().loadSkillsForDept(id);
  },

  loadSkillsForDept: async (deptId) => {
    set({ loadingSkills: true });
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/api/dept-roles/${deptId}/skills`);
      if (!res.ok) throw new Error('Failed to load skills');
      const data = await res.json();
      // Guard against stale responses: only apply if this dept is still selected
      if (get().selectedDeptId === deptId) {
        set({ deptSkills: data, loadingSkills: false });
      }
    } catch (err) {
      console.error('[presetStore] loadSkillsForDept failed:', err);
      if (get().selectedDeptId === deptId) {
        set({ loadingSkills: false });
      }
    }
  },
}));

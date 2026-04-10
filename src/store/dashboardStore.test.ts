import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase to force offline mode in tests
vi.mock('../lib/supabase', () => ({
  supabase: null,
  isOnline: () => false,
}));

// Mock orchestrator
vi.mock('../lib/orchestratorApi', () => ({
  isOrchestratorOnline: () => Promise.resolve(false),
  assignGoalToOrchestrator: () => Promise.reject(new Error('offline')),
}));

import { useDashboardStore } from './dashboardStore';

describe('dashboardStore', () => {
  beforeEach(async () => {
    useDashboardStore.setState({
      companies: [],
      selectedCompanyId: null,
      loading: true,
      synced: false,
      orchestratorConnected: false,
      processingGoal: null,
    });
    await useDashboardStore.getState().loadFromBackend();
    // Offline mode starts empty — create a test company
    useDashboardStore.getState().addCompany('Test Corp', 100_000);
  });

  it('starts empty in offline mode and can add companies', () => {
    const { companies } = useDashboardStore.getState();
    expect(companies).toHaveLength(1);
    expect(companies[0].name).toBe('Test Corp');
  });

  it('new company has CEO employee', () => {
    const { companies } = useDashboardStore.getState();
    const co = companies[0];
    expect(co.employees.length).toBeGreaterThanOrEqual(1);
    expect(co.employees.some(e => e.role === 'CEO')).toBe(true);
  });

  it('selectCompany sets selectedCompanyId', () => {
    const { companies, selectCompany } = useDashboardStore.getState();
    selectCompany(companies[0].id);
    expect(useDashboardStore.getState().selectedCompanyId).toBe(companies[0].id);
  });

  it('selectCompany(null) clears selection', () => {
    const { companies, selectCompany } = useDashboardStore.getState();
    selectCompany(companies[0].id);
    selectCompany(null);
    expect(useDashboardStore.getState().selectedCompanyId).toBeNull();
  });

  it('assignGoal sets CEO goal and creates delegations', () => {
    const { companies, assignGoal } = useDashboardStore.getState();
    const coId = companies[0].id;

    assignGoal(coId, 'Build a habit tracker');
    const updated = useDashboardStore.getState().companies.find(c => c.id === coId)!;

    expect(updated.ceoGoal).toBe('Build a habit tracker');
  });

  it('tickCompany does nothing if no goal is set', () => {
    const { companies, tickCompany } = useDashboardStore.getState();
    const coId = companies[0].id;

    tickCompany(coId);
    const updated = useDashboardStore.getState().companies.find(c => c.id === coId)!;
    expect(updated.budgetSpent).toBe(0);
  });

  it('addCompany creates a new company', () => {
    const { addCompany } = useDashboardStore.getState();
    addCompany('NovaTech', 50_000);

    const { companies } = useDashboardStore.getState();
    expect(companies).toHaveLength(2);
    const nova = companies[1];
    expect(nova.name).toBe('NovaTech');
    expect(nova.budget).toBe(50_000);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardStore } from './dashboardStore';

describe('dashboardStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useDashboardStore.setState(useDashboardStore.getInitialState());
  });

  it('initializes with 2 mock companies', () => {
    const { companies } = useDashboardStore.getState();
    expect(companies).toHaveLength(2);
    expect(companies[0].name).toBe('Acme Corp');
    expect(companies[1].name).toBe('Globex Inc');
  });

  it('each company has 4 employees (CEO + PM + DevOps + Frontend)', () => {
    const { companies } = useDashboardStore.getState();
    companies.forEach(co => {
      expect(co.employees).toHaveLength(4);
      const roles = co.employees.map(e => e.role);
      expect(roles).toContain('CEO');
      expect(roles).toContain('PM');
      expect(roles).toContain('DevOps');
      expect(roles).toContain('Frontend');
    });
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

  it('assignGoal sets CEO goal and creates 3 delegations', () => {
    const { companies, assignGoal } = useDashboardStore.getState();
    const coId = companies[0].id;

    assignGoal(coId, 'Build a habit tracker');
    const updated = useDashboardStore.getState().companies.find(c => c.id === coId)!;

    expect(updated.ceoGoal).toBe('Build a habit tracker');
    expect(updated.delegations).toHaveLength(3);

    const delegatedRoles = updated.delegations.map(d => d.toRole);
    expect(delegatedRoles).toContain('PM');
    expect(delegatedRoles).toContain('DevOps');
    expect(delegatedRoles).toContain('Frontend');
  });

  it('assignGoal sets all employees to working status', () => {
    const { companies, assignGoal } = useDashboardStore.getState();
    const coId = companies[0].id;

    assignGoal(coId, 'Build a habit tracker');
    const updated = useDashboardStore.getState().companies.find(c => c.id === coId)!;

    updated.employees.forEach(emp => {
      expect(emp.status).toBe('working');
    });
  });

  it('tickCompany advances delegation progress', () => {
    const { companies, assignGoal, tickCompany } = useDashboardStore.getState();
    const coId = companies[0].id;

    assignGoal(coId, 'Build a habit tracker');
    tickCompany(coId);

    const updated = useDashboardStore.getState().companies.find(c => c.id === coId)!;
    updated.delegations.forEach(d => {
      expect(d.progress).toBeGreaterThan(0);
    });
  });

  it('tickCompany decrements budget', () => {
    const { companies, assignGoal, tickCompany } = useDashboardStore.getState();
    const coId = companies[0].id;

    assignGoal(coId, 'Build a habit tracker');
    const beforeSpent = useDashboardStore.getState().companies.find(c => c.id === coId)!.budgetSpent;
    tickCompany(coId);
    const afterSpent = useDashboardStore.getState().companies.find(c => c.id === coId)!.budgetSpent;

    expect(afterSpent).toBeGreaterThan(beforeSpent);
  });

  it('tickCompany does nothing if no goal is set', () => {
    const { companies, tickCompany } = useDashboardStore.getState();
    const coId = companies[0].id;

    tickCompany(coId);
    const updated = useDashboardStore.getState().companies.find(c => c.id === coId)!;
    expect(updated.budgetSpent).toBe(0);
  });

  it('addCompany creates a new company with correct defaults', () => {
    const { addCompany } = useDashboardStore.getState();
    addCompany('NovaTech', 50_000);

    const { companies } = useDashboardStore.getState();
    expect(companies).toHaveLength(3);

    const nova = companies[2];
    expect(nova.name).toBe('NovaTech');
    expect(nova.budget).toBe(50_000);
    expect(nova.employees).toHaveLength(4);
    expect(nova.ceoGoal).toBeNull();
  });
});

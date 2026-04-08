import { useEffect } from 'react';
import { supabase, isOnline } from '../lib/supabase';
import { useDashboardStore } from '../store/dashboardStore';
import type { AgentStatus, CompanyStatus } from '../store/dashboardStore';

/**
 * Subscribe to Supabase Realtime changes on agents, companies, and activity_log.
 * Pixel canvas, status bars, and feeds auto-update.
 */
export function useRealtimeSync() {
  useEffect(() => {
    if (!isOnline() || !supabase) return;

    const channel = supabase
      .channel('realtime-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'agents' },
        (payload) => {
          const row = payload.new as any;
          const store = useDashboardStore.getState();

          const companies = store.companies.map(co => {
            const empIdx = co.employees.findIndex(e => e.id === row.id);
            if (empIdx === -1) return co;

            const updatedEmployees = [...co.employees];
            updatedEmployees[empIdx] = {
              ...updatedEmployees[empIdx],
              status: row.status as AgentStatus,
              col: row.tile_col,
              row: row.tile_row,
              assignedTask: row.assigned_task,
              progress: row.progress,
            };
            return { ...co, employees: updatedEmployees };
          });

          useDashboardStore.setState({ companies });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'companies' },
        (payload) => {
          const row = payload.new as any;
          const store = useDashboardStore.getState();

          const companies = store.companies.map(co => {
            if (co.id !== row.id) return co;
            return {
              ...co,
              budget: row.budget,
              budgetSpent: row.budget_spent,
              status: row.status as CompanyStatus,
              ceoGoal: row.ceo_goal,
            };
          });

          useDashboardStore.setState({ companies });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'delegations' },
        (payload) => {
          const row = payload.new as any;
          const store = useDashboardStore.getState();

          const companies = store.companies.map(co => {
            const delIdx = co.delegations.findIndex(d => d.id === row.id);
            if (delIdx === -1) return co;

            const updatedDels = [...co.delegations];
            updatedDels[delIdx] = {
              ...updatedDels[delIdx],
              progress: row.progress,
            };
            return { ...co, delegations: updatedDels };
          });

          useDashboardStore.setState({ companies });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'delegations' },
        (payload) => {
          const row = payload.old as any;
          const store = useDashboardStore.getState();

          const companies = store.companies.map(co => ({
            ...co,
            delegations: co.delegations.filter(d => d.id !== row.id),
          }));

          useDashboardStore.setState({ companies });
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, []);
}

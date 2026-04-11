import { supabase } from './supabaseAdmin';
import { processMultipleTickets } from './ticketProcessor';
import { getCompanyCwd } from './repoManager';
import { sweepTimeouts } from './circuitBreaker';

let daemonInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Heartbeat daemon: auto-processes approved tickets on a schedule.
 * This is the core of Paperclip's "wake → check queue → execute → sleep" model.
 */
export function startHeartbeatDaemon(cwd: string, intervalMs = 30_000) {
  if (daemonInterval) return; // already running

  console.log(`[heartbeat] Daemon started — processing every ${intervalMs / 1000}s`);

  daemonInterval = setInterval(async () => {
    if (isRunning) { console.log('[heartbeat] Skipping — previous tick still running'); return; }
    isRunning = true;

    try {
      // Check all companies for approved tickets
      const { data: companies } = await supabase
        .from('companies')
        .select('id, heartbeat_interval_ms')
        .in('status', ['bootstrapping', 'growing', 'scaling']);

      for (const co of (companies ?? []) as any[]) {
        // Check dependency-ready approved tickets BEFORE calling processNextTicket
        const { count } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', co.id)
          .eq('status', 'approved')
          .eq('dependency_status', 'ready');

        console.log(`[heartbeat] Company ${co.id.slice(0,8)}: ${count ?? 0} ready tickets`);
        if ((count ?? 0) === 0) continue; // skip — no ready tickets to process

        // Get THIS company's repo cwd
        const companyCwd = await getCompanyCwd(co.id).catch(() => cwd);
        // Process up to 3 tickets in parallel (each claims atomically, one per agent)
        const maxConcurrent = Math.min(count ?? 1, 3);
        const { processed, errors } = await processMultipleTickets(co.id, companyCwd, maxConcurrent);
        if (processed > 0) {
          console.log(`[heartbeat] Processed ${processed} ticket(s) for company ${co.id}`);
        }
        if (errors.length > 0) {
          console.warn(`[heartbeat] ${errors.length} error(s) for company ${co.id}:`, errors[0]);
        }
      }

      // Sweep for execution timeouts on in-progress tickets
      try {
        const timedOut = await sweepTimeouts();
        if (timedOut > 0) {
          console.warn(`[heartbeat] ${timedOut} ticket(s) timed out`);
        }
      } catch (timeoutErr: any) {
        console.warn('[heartbeat] Timeout sweep failed:', timeoutErr.message);
      }

      // Check and mark stale agents
      try {
        await supabase.rpc('check_stale_agents');
      } catch (staleErr: any) {
        console.warn('[heartbeat] Stale agent check failed:', staleErr.message);
      }

      // Log heartbeat pulse
      try {
        await supabase.from('audit_log').insert({
          company_id: null as any, // system-level
          event_type: 'heartbeat',
          message: `Daemon pulse — checked ${(companies ?? []).length} companies`,
        });
      } catch (auditErr: any) {
        console.warn('[heartbeat] Audit log failed:', auditErr.message);
      }

    } catch (err: any) {
      console.error('[heartbeat] Daemon error:', err.message);
    }

    isRunning = false;
  }, intervalMs);
}

export function stopHeartbeatDaemon() {
  if (daemonInterval) {
    clearInterval(daemonInterval);
    daemonInterval = null;
    console.log('[heartbeat] Daemon stopped');
  }
}

export function isDaemonRunning() {
  return daemonInterval !== null;
}

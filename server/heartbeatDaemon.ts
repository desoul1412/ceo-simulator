import { supabase } from './supabaseAdmin';
import { processNextTicket } from './ticketProcessor';

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
    if (isRunning) return; // skip if still processing from last tick
    isRunning = true;

    try {
      // Check all companies for approved tickets
      const { data: companies } = await supabase
        .from('companies')
        .select('id, heartbeat_interval_ms')
        .in('status', ['bootstrapping', 'growing', 'scaling']);

      for (const co of (companies ?? []) as any[]) {
        const result = await processNextTicket(co.id, cwd);
        if (result.processed) {
          console.log(`[heartbeat] Processed ticket ${result.ticketId} for company ${co.id}`);
        }
      }

      // Check and mark stale agents
      await supabase.rpc('check_stale_agents').catch(() => {});

      // Log heartbeat pulse
      await supabase.from('audit_log').insert({
        company_id: null as any, // system-level
        event_type: 'heartbeat',
        message: `Daemon pulse — checked ${(companies ?? []).length} companies`,
      }).catch(() => {}); // non-critical

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

import express from 'express';
import cors from 'cors';
import { startHeartbeatDaemon, stopHeartbeatDaemon } from './heartbeatDaemon';
import { supabase } from './supabaseAdmin';
import { errorHandler, notFound } from './middleware/errorHandler';
import { destroyAllSandboxes } from './sandbox';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: [
    /^http:\/\/localhost:\d+$/,
    /\.vercel\.app$/,
  ],
}));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────

app.use(routes);

// ── Error handling ───────────────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`\n▣ CEO.SIM Orchestrator running on http://localhost:${PORT}`);
  console.log(`  Supabase: ${process.env.SUPABASE_URL ? '● connected' : '○ missing'}`);
  console.log(`  Agent SDK: ● ready`);

  // Reset stale in_progress tickets from previous server crash
  supabase.from('tickets')
    .update({ status: 'approved', started_at: null, board_column: 'todo' })
    .eq('status', 'in_progress')
    .then(({ error }) => {
      if (error) console.warn('[startup] Failed to reset stale tickets:', error.message);
      else console.log('  Stale tickets: ● reset');
    });

  // Reset working agents to idle
  supabase.from('agents')
    .update({ status: 'idle', assigned_task: null })
    .eq('status', 'working')
    .then(({ error }) => {
      if (error) console.warn('[startup] Failed to reset agents:', error.message);
      else console.log('  Stale agents: ● reset');
    });

  // Auto-start heartbeat daemon
  startHeartbeatDaemon(process.cwd());
  console.log(`  Heartbeat: ● daemon active (30s interval)\n`);
});

// ── Graceful Shutdown ────────────────────────────────────────────────────────

async function gracefulShutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  stopHeartbeatDaemon();
  await destroyAllSandboxes().catch(() => {});
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

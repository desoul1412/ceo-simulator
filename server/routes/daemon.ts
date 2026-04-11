import { Router } from 'express';
import { startHeartbeatDaemon, stopHeartbeatDaemon, isDaemonRunning } from '../heartbeatDaemon';

const router = Router();

router.post('/api/daemon/start', (_req, res) => {
  startHeartbeatDaemon(process.cwd());
  res.json({ running: true });
});

router.post('/api/daemon/stop', (_req, res) => {
  stopHeartbeatDaemon();
  res.json({ running: false });
});

router.get('/api/daemon/status', (_req, res) => {
  res.json({ running: isDaemonRunning() });
});

export default router;

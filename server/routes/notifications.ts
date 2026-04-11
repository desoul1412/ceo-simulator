import { Router } from 'express';
import { supabase } from '../supabaseAdmin';

const router = Router();

router.get('/api/notifications', async (_req, res) => {
  const { data, error } = await supabase.from('notifications')
    .select('*').eq('read', false)
    .order('created_at', { ascending: false }).limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/api/notifications/:id/read', async (req, res) => {
  const { error } = await supabase.from('notifications')
    .update({ read: true }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/api/notifications/read-all', async (_req, res) => {
  const { error } = await supabase.from('notifications')
    .update({ read: true }).eq('read', false);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.get('/api/notifications/count', async (_req, res) => {
  const { count } = await supabase.from('notifications')
    .select('*', { count: 'exact', head: true }).eq('read', false);
  res.json({ count: count ?? 0 });
});

export default router;

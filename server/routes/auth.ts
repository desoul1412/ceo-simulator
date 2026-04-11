/**
 * Auth routes — signup, login, logout, session refresh, user-company membership.
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../supabaseAdmin';
import { requireAuth } from '../middleware/auth';

const router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * POST /auth/signup — create a new user account.
 */
router.post('/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name ?? email.split('@')[0] },
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ user: { id: data.user.id, email: data.user.email } });
});

/**
 * POST /auth/login — sign in with email/password.
 */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ error: 'Auth not configured' });
    return;
  }

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });

  if (error) {
    res.status(401).json({ error: error.message });
    return;
  }

  res.json({
    user: { id: data.user.id, email: data.user.email },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  });
});

/**
 * POST /auth/refresh — refresh an expired session.
 */
router.post('/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    res.status(400).json({ error: 'refresh_token required' });
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ error: 'Auth not configured' });
    return;
  }

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await anonClient.auth.refreshSession({ refresh_token });

  if (error) {
    res.status(401).json({ error: error.message });
    return;
  }

  if (!data.session) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  res.json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  });
});

/**
 * GET /auth/me — get current user info + company memberships.
 */
router.get('/auth/me', requireAuth, async (req, res) => {
  const user = req.user!;

  // Fetch company details for user's memberships
  const { data: companies } = await supabase
    .from('user_companies')
    .select('company_id, role, companies(id, name)')
    .eq('user_id', user.id);

  res.json({
    user: { id: user.id, email: user.email, role: user.role },
    companies: (companies ?? []).map((c: any) => ({
      id: c.company_id,
      role: c.role,
      name: c.companies?.name ?? 'Unknown',
    })),
  });
});

/**
 * POST /auth/join-company — associate current user with a company.
 */
router.post('/auth/join-company', requireAuth, async (req, res) => {
  const { companyId, role } = req.body;
  if (!companyId) {
    res.status(400).json({ error: 'companyId required' });
    return;
  }

  const { error } = await supabase.from('user_companies').upsert({
    user_id: req.user!.id,
    company_id: companyId,
    role: role ?? 'owner',
  }, { onConflict: 'user_id,company_id' });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

export default router;

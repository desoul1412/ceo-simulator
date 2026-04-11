import { Router } from 'express';
import { supabase } from '../supabaseAdmin';
import { getCompanyCwd, ensureRepo, syncRepo, listRepos } from '../repoManager';
import { updateCompanyBrainSummary, initAgentBrain, updateAgentMemory } from '../helpers/brain';
import { executeCeoGoal, executeCeoProjectReview } from '../agents/ceo';
import { getDependencyGraph } from '../dependencyManager';

const router = Router();

// ── Assign Goal to CEO ───────────────────────────────────────────────────────

router.post('/api/assign-goal', async (req, res) => {
  const { companyId, goal } = req.body;
  if (!companyId || !goal) return res.status(400).json({ error: 'Missing companyId or goal' });

  try {
    const logActivity = async (message: string) => {
      await supabase.from('activity_log').insert({
        company_id: companyId, type: 'ceo-reasoning', message,
      });
    };

    const cwd = await getCompanyCwd(companyId);
    const result = await executeCeoGoal(companyId, goal, cwd, logActivity);

    res.json({
      success: true, plan: result.plan,
      cost: { usd: result.costUsd, inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      sessionId: result.sessionId,
    });
  } catch (err: any) {
    console.error('[assign-goal] Error:', err.message);
    await supabase.from('activity_log').insert({
      company_id: companyId, type: 'status-change',
      message: `CEO goal assignment failed: ${err.message}`,
    });
    res.status(500).json({ error: err.message });
  }
});

// ── CEO Project Review ───────────────────────────────────────────────────────

router.post('/api/companies/:id/review', async (req, res) => {
  try {
    const cwd = await getCompanyCwd(req.params.id);
    const { requirements } = req.body ?? {};
    const logActivity = async (message: string) => {
      await supabase.from('activity_log').insert({
        company_id: req.params.id, type: 'ceo-reasoning', message,
      });
    };
    const result = await executeCeoProjectReview(req.params.id, cwd, logActivity, requirements);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[review] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Repository Management ────────────────────────────────────────────────────

router.post('/api/companies/:companyId/repo', async (req, res) => {
  const { repoUrl, branch, authMethod, token } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Missing repoUrl' });

  try {
    await supabase.from('companies').update({
      repo_url: repoUrl, repo_branch: branch || 'main',
      git_auth_method: authMethod || (token ? 'pat' : 'none'),
      git_token_encrypted: token || null, repo_status: 'not_connected',
    }).eq('id', req.params.companyId);

    const repoPath = await ensureRepo(req.params.companyId);

    await supabase.from('activity_log').insert({
      company_id: req.params.companyId, type: 'status-change',
      message: `Connected to repo: ${repoUrl} (branch: ${branch || 'main'})`,
    });

    res.json({ success: true, repoPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/companies/:companyId/repo/sync', async (req, res) => {
  const result = await syncRepo(req.params.companyId);
  res.json(result);
});

router.get('/api/companies/:companyId/repo', async (req, res) => {
  const { data } = await supabase.from('companies')
    .select('repo_url, repo_branch, repo_path, repo_status, repo_error, repo_last_synced_at, git_auth_method')
    .eq('id', req.params.companyId).single();
  res.json(data ?? {});
});

router.delete('/api/companies/:companyId/repo', async (req, res) => {
  await supabase.from('companies').update({
    repo_url: null, repo_branch: 'main', repo_path: null,
    git_auth_method: 'none', git_token_encrypted: null,
    repo_status: 'not_connected', repo_error: null,
  }).eq('id', req.params.companyId);
  res.json({ success: true });
});

router.get('/api/repos', (_req, res) => {
  res.json(listRepos());
});

// ── Company Brain ────────────────────────────────────────────────────────────

router.post('/api/companies/:id/brain/update-summary', async (req, res) => {
  try {
    const summaryPath = await updateCompanyBrainSummary(req.params.id);
    res.json({ success: true, path: summaryPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/companies/:companyId/agents/:agentId/brain/init', async (req, res) => {
  try {
    const agentDir = await initAgentBrain(req.params.companyId, req.params.agentId);
    res.json({ success: true, path: agentDir });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/companies/:companyId/agents/:agentId/brain/update-memory', async (req, res) => {
  try {
    const { ticketTitle } = req.body;
    if (!ticketTitle) return res.status(400).json({ error: 'Missing ticketTitle' });
    await updateAgentMemory(req.params.companyId, req.params.agentId, ticketTitle);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Dependency Graph ─────────────────────────────────────────────────────────

router.get('/api/companies/:id/dependency-graph', async (req, res) => {
  const graph = await getDependencyGraph(req.params.id);
  res.json(graph);
});

// ── Env Vars ─────────────────────────────────────────────────────────────────

router.get('/api/companies/:id/env-vars', async (req, res) => {
  const { data, error } = await supabase.from('project_env_vars')
    .select('*').eq('company_id', req.params.id).order('key', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const masked = (data ?? []).map((row: any) => ({
    ...row, value: row.is_secret ? '********' : row.value,
  }));
  res.json(masked);
});

router.post('/api/companies/:id/env-vars', async (req, res) => {
  const { key, value, is_secret } = req.body;
  const { data, error } = await supabase.from('project_env_vars')
    .insert({ company_id: req.params.id, key, value, is_secret: is_secret ?? false })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/api/env-vars/:id', async (req, res) => {
  const updates: any = {};
  for (const key of ['key', 'value', 'is_secret']) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const { data, error } = await supabase.from('project_env_vars')
    .update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/api/env-vars/:id', async (req, res) => {
  const { error } = await supabase.from('project_env_vars').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;

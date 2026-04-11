import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { supabase } from '../supabaseAdmin';
import { getCompanyCwd } from '../repoManager';

const router = Router();

router.get('/api/companies/:id/merge-requests', async (req, res) => {
  const { data, error } = await supabase.from('merge_requests')
    .select('*').eq('company_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/api/merge-requests/:id/merge', async (req, res) => {
  try {
    const { data: mr } = await supabase.from('merge_requests')
      .select('*').eq('id', req.params.id).single();
    if (!mr) return res.status(404).json({ error: 'MR not found' });
    const m = mr as any;

    const cwd = await getCompanyCwd(m.company_id);
    const { execSync } = await import('child_process');

    try {
      execSync('git fetch origin', { cwd, stdio: 'pipe', timeout: 30000 });
    } catch (fetchErr: any) {
      console.warn('[merge] Fetch failed (continuing offline):', fetchErr.message);
    }

    const worktreePath = path.join(cwd, '.agent-worktrees', m.branch_name);
    if (fs.existsSync(worktreePath)) {
      try {
        execSync('git rebase origin/main', { cwd: worktreePath, stdio: 'pipe' });
        execSync(`git push --force-with-lease origin ${m.branch_name}`, { cwd: worktreePath, stdio: 'pipe', timeout: 30000 });
      } catch (rebaseErr: any) {
        try { execSync('git rebase --abort', { cwd: worktreePath, stdio: 'pipe' }); } catch {}
        await supabase.from('merge_requests').update({ status: 'conflicted' }).eq('id', req.params.id);
        return res.status(409).json({ error: `Rebase conflict — resolve manually: ${(rebaseErr.stderr?.toString() || rebaseErr.message).slice(0, 300)}` });
      }
    }

    try {
      execSync('git checkout main', { cwd, stdio: 'pipe' });
      execSync('git reset --hard origin/main', { cwd, stdio: 'pipe' });
    } catch (checkoutErr: any) {
      console.warn('[merge] Could not reset main to origin/main:', checkoutErr.message);
    }

    try {
      execSync(`git merge ${m.branch_name} --no-ff -m "Merge ${m.branch_name}: ${(m.title ?? '').replace(/"/g, '\\"')}"`, { cwd, stdio: 'pipe' });
    } catch (mergeErr: any) {
      try { execSync('git merge --abort', { cwd, stdio: 'pipe' }); } catch {}
      await supabase.from('merge_requests').update({ status: 'conflicted' }).eq('id', req.params.id);
      return res.status(409).json({ error: `Merge conflict: ${mergeErr.message}` });
    }

    try {
      execSync('git push origin main', { cwd, stdio: 'pipe', timeout: 30000 });
    } catch (pushErr: any) {
      console.warn('[merge] Push origin/main failed:', pushErr.message);
    }

    await supabase.from('merge_requests').update({ status: 'merged', merged_at: new Date().toISOString() }).eq('id', req.params.id);
    await supabase.from('notifications').insert({
      company_id: m.company_id, type: 'merge_request',
      title: `MR merged: ${m.branch_name}`,
      message: `Branch ${m.branch_name} merged to ${m.target_branch}`,
      link: `/company/${m.company_id}/board`,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/merge-requests/:id/reject', async (req, res) => {
  const { error } = await supabase.from('merge_requests')
    .update({ status: 'rejected' }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/api/merge-requests/:id/revert', async (req, res) => {
  try {
    const { data: mr } = await supabase.from('merge_requests').select('*').eq('id', req.params.id).single();
    if (!mr) return res.status(404).json({ error: 'MR not found' });
    const m = mr as any;
    if (m.status !== 'merged') return res.status(400).json({ error: 'Can only revert merged MRs' });

    const cwd = await getCompanyCwd(m.company_id);
    const { execSync } = await import('child_process');

    try {
      const mergeLog = execSync(
        `git log --oneline --all --grep="Merge ${m.branch_name}" -1`,
        { cwd, encoding: 'utf8' }
      ).trim();
      const mergeHash = mergeLog.split(' ')[0];

      if (mergeHash) {
        execSync(`git revert --no-edit ${mergeHash}`, { cwd, stdio: 'pipe' });
      } else {
        execSync(`git revert --no-edit HEAD`, { cwd, stdio: 'pipe' });
      }

      await supabase.from('merge_requests').update({
        status: 'rejected', diff_summary: `Reverted at ${new Date().toISOString()}`,
      }).eq('id', req.params.id);

      await supabase.from('notifications').insert({
        company_id: m.company_id, type: 'merge_request',
        title: `Reverted: ${m.branch_name}`,
        message: `MR "${m.title}" was reverted on main.`,
        link: `/company/${m.company_id}/merge-requests`,
      });

      await supabase.from('activity_log').insert({
        company_id: m.company_id, type: 'status-change',
        message: `Reverted merge: ${m.branch_name} (${m.title})`,
      });

      res.json({ success: true });
    } catch (revertErr: any) {
      res.status(409).json({ error: `Revert failed: ${revertErr.message}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/merge-requests/:id/diff', async (req, res) => {
  try {
    const { data: mr } = await supabase.from('merge_requests')
      .select('*').eq('id', req.params.id).single();
    if (!mr) return res.status(404).json({ error: 'MR not found' });
    const m = mr as any;

    const cwd = await getCompanyCwd(m.company_id);
    const { execSync } = await import('child_process');
    let diff = '';
    try {
      diff = execSync(`git diff ${m.target_branch}...${m.branch_name} --stat`, { cwd, encoding: 'utf8' });
    } catch { /* branch may not exist locally */ }
    res.json({ diff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

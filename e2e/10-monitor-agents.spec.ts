import { test, expect } from '@playwright/test';
import { waitForAppReady, API_URL } from './helpers';

/**
 * AGENT MONITOR: Keeps the browser open and watches agents work.
 * Polls agent status and board every 30s, takes screenshots, logs progress.
 *
 * Run with:
 *   npx playwright test e2e/10-monitor-agents.spec.ts --headed
 */

test.setTimeout(60 * 60_000); // 1 hour max

test.describe('Agent Monitor', () => {

  test('watch agents work on tickets', async ({ page }) => {
    await waitForAppReady(page);

    // Navigate to company
    const companyCard = page.locator('text=CEO SIMULATOR').first();
    await expect(companyCard).toBeVisible({ timeout: 10_000 });
    await companyCard.click();
    await page.waitForURL(/company\//, { timeout: 10_000 });
    await page.waitForTimeout(2000);

    const url = page.url();
    const match = url.match(/company\/([^/]+)/);
    const companyId = match?.[1];
    if (!companyId) throw new Error('Could not find company ID');

    console.log(`\n[monitor] Watching company ${companyId}`);
    console.log('[monitor] Press Ctrl+C to stop\n');

    let iteration = 0;
    const startTime = Date.now();

    while (true) {
      iteration++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      // Fetch agent statuses
      try {
        const agentsRes = await page.request.get(`${API_URL}/api/companies/${companyId}/agents`);
        if (agentsRes.ok()) {
          const agents = await agentsRes.json();
          const statuses = agents.map((a: any) =>
            `${a.role.padEnd(10)} ${a.status.padEnd(10)} ${a.assigned_task?.slice(0, 60) ?? '—'}`
          );
          console.log(`\n[monitor] ═══ ${elapsed}s (check #${iteration}) ═══`);
          for (const s of statuses) console.log(`  ${s}`);
        }
      } catch { /* orchestrator might be busy */ }

      // Fetch ticket counts
      try {
        const ticketsRes = await page.request.get(`${API_URL}/api/tickets/${companyId}`);
        if (ticketsRes.ok()) {
          const tickets = await ticketsRes.json();
          const counts: Record<string, number> = {};
          for (const t of tickets) {
            counts[t.status] = (counts[t.status] ?? 0) + 1;
          }
          const summary = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ');
          console.log(`  Tickets: ${summary || 'none'}`);
        }
      } catch { /* */ }

      // Navigate to board view every 3rd check for visual
      if (iteration % 3 === 0) {
        await page.goto(`/company/${companyId}/board`);
        await page.waitForTimeout(2000);
        await page.screenshot({
          path: `e2e/screenshots/monitor-${iteration}.png`,
          fullPage: true,
        });
        console.log(`  Screenshot saved: monitor-${iteration}.png`);
        // Go back to office view
        await page.goto(`/company/${companyId}`);
        await page.waitForTimeout(1000);
      } else {
        // Stay on office view — reload to refresh
        await page.reload();
        await page.waitForTimeout(2000);
      }

      // Check if all agents are idle/break (work might be done)
      try {
        const agentsRes = await page.request.get(`${API_URL}/api/companies/${companyId}/agents`);
        if (agentsRes.ok()) {
          const agents = await agentsRes.json();
          const allDone = agents.every((a: any) => a.status === 'idle' || a.status === 'break');
          const ticketsRes = await page.request.get(`${API_URL}/api/tickets/${companyId}`);
          const tickets = await ticketsRes.json();
          const pendingWork = tickets.filter((t: any) =>
            ['approved', 'in_progress', 'open'].includes(t.status)
          );

          if (allDone && pendingWork.length === 0 && iteration > 3) {
            console.log('\n[monitor] All agents idle and no pending tickets — work complete!');
            await page.goto(`/company/${companyId}/board`);
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'e2e/screenshots/monitor-final.png', fullPage: true });
            break;
          }
        }
      } catch { /* */ }

      // Wait 30s before next check
      await page.waitForTimeout(30_000);
    }

    console.log('[monitor] Done monitoring.');
  });
});

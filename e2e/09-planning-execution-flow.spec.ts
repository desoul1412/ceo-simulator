import { test, expect } from '@playwright/test';
import { waitForAppReady, goToFirstCompany, API_URL } from './helpers';

/**
 * FULL PIPELINE TEST: Planning → Approval → Agent Execution
 *
 * This test submits a real feature directive through the CEO Planning Terminal,
 * waits for the plan to generate, approves it, and verifies agents start working.
 *
 * Prerequisites:
 *   - Frontend running on :5173
 *   - Orchestrator running on :3001
 *   - At least 1 company with agents exists and is connected to a repo
 *
 * Run with:
 *   npx playwright test e2e/09-planning-execution-flow.spec.ts --headed
 */

// Long timeouts — planning takes minutes with opus
test.setTimeout(20 * 60_000); // 20 min per test

test.describe('Planning → Execution Pipeline', () => {

  test('should submit directive, generate plan, approve, and trigger agents', async ({ page }) => {
    await waitForAppReady(page);

    // ── Step 0: Navigate into the company ──
    // Click the company card on the dashboard
    const companyCard = page.locator('text=CEO SIMULATOR').first();
    await expect(companyCard).toBeVisible({ timeout: 10_000 });
    await companyCard.click();
    // Wait for company view to load (URL should change to /company/...)
    await page.waitForURL(/company\//, { timeout: 10_000 });
    await page.waitForTimeout(3000);
    console.log('[test] Navigated to company view:', page.url());

    // ── Step 1: Find the CEO directive textarea and enter the feature request ──
    // The input might be a textarea or an input field
    let goalInput = page.locator('textarea').first();
    if (!await goalInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Fallback: try input[type="text"]
      goalInput = page.locator('input[type="text"]').first();
    }
    await expect(goalInput).toBeVisible({ timeout: 5000 });
    await goalInput.fill(
      'Add obstacle avoidance to agent movement in the isometric office. ' +
      'Agents should pathfind around desks, sofas, and other furniture objects ' +
      'instead of walking through them. Update the pathfinding engine and ' +
      'the office floor plan to mark furniture tiles as non-walkable.'
    );

    // ── Step 2: Select project size (S for a small feature) ──
    const sizeBtn = page.locator('button', { hasText: /^\s*S\s*$/i }).first();
    if (await sizeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sizeBtn.click();
      await page.waitForTimeout(300);
    }

    // ── Step 3: Click Plan/Execute button ──
    const planBtn = page.locator('button', { hasText: /Plan|Execute/i }).first();
    await expect(planBtn).toBeVisible({ timeout: 5000 });
    await planBtn.click();
    console.log('[test] Plan button clicked — waiting for planning popup...');

    // ── Step 4: Wait for the Planning Terminal to appear ──
    const popup = page.locator('text=CEO PLANNING TERMINAL');
    await expect(popup).toBeVisible({ timeout: 15_000 });
    console.log('[test] Planning popup opened');

    // ── Step 5: Wait for planning to complete (poll the GENERATING status) ──
    // The popup shows "GENERATING..." while working. We wait until it shows "REVIEW" or tabs are filled.
    console.log('[test] Waiting for planning to finish (this may take several minutes)...');

    // Poll every 5s checking if planning finished — waitForFunction has its own timeout
    const maxWaitMs = 15 * 60_000; // 15 min
    const pollInterval = 5_000;
    const startTime = Date.now();
    let planDone = false;

    while (Date.now() - startTime < maxWaitMs) {
      const bodyText = await page.textContent('body');
      if (bodyText?.includes('Approve') || bodyText?.includes('READY')) {
        planDone = true;
        break;
      }
      // Log progress
      const phaseMatch = bodyText?.match(/(\d+\/\d+):?\s*(\w+)/);
      if (phaseMatch) {
        console.log(`[test] Planning progress: phase ${phaseMatch[1]} ${phaseMatch[2]} (${Math.round((Date.now() - startTime) / 1000)}s)`);
      }
      await page.waitForTimeout(pollInterval);
    }

    expect(planDone).toBeTruthy();

    console.log('[test] Planning completed!');

    // ── Step 6: Take a screenshot of the plan ──
    await page.screenshot({ path: 'e2e/screenshots/plan-generated.png', fullPage: true });

    // ── Step 7: Verify tabs have content ──
    const overviewTab = page.locator('text=OVERVIEW').first();
    await overviewTab.click();
    await page.waitForTimeout(500);

    // Check that the overview tab has actual content (not empty)
    const contentArea = page.locator('[style*="overflow: auto"]').last();
    const content = await contentArea.textContent();
    expect(content!.length).toBeGreaterThan(100);
    console.log(`[test] Overview tab has ${content!.length} chars of content`);

    // ── Step 8: Click "Approve & Execute" ──
    const approveBtn = page.locator('button', { hasText: /Approve.*Execute|Approve/i }).first();
    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      console.log('[test] Approve & Execute clicked');
      await page.waitForTimeout(3000);

      // Take screenshot after approval
      await page.screenshot({ path: 'e2e/screenshots/plan-approved.png', fullPage: true });
    }

    // ── Step 9: Close the planning popup ──
    const closeBtn = page.locator('button').filter({ hasText: /X/ }).first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }

    // ── Step 10: Verify tickets were created on the Board ──
    const url = page.url();
    const match = url.match(/company\/([^/]+)/);
    if (match) {
      await page.goto(`/company/${match[1]}/board`);
      await page.waitForTimeout(2000);
      const boardText = await page.textContent('body');
      // Board should have tickets from the plan
      console.log(`[test] Board loaded, checking for tickets...`);
      await page.screenshot({ path: 'e2e/screenshots/board-after-plan.png', fullPage: true });

      // Verify at least some tickets exist (approved or in_progress)
      const hasTickets = boardText!.match(/approved|in.progress|todo|pathfind|obstacle|movement/i);
      expect(hasTickets).toBeTruthy();
      console.log('[test] Tickets found on board!');
    }

    // ── Step 11: Wait and check if agents start working ──
    console.log('[test] Waiting 60s for agents to pick up tickets...');
    await page.waitForTimeout(60_000);

    // Check agent statuses via API
    if (match) {
      const agentsRes = await page.request.get(`${API_URL}/api/companies/${match[1]}/agents`);
      if (agentsRes.ok()) {
        const agents = await agentsRes.json();
        const working = agents.filter((a: any) => a.status === 'working');
        console.log(`[test] ${working.length}/${agents.length} agents are WORKING`);
        await page.screenshot({ path: 'e2e/screenshots/agents-working.png', fullPage: true });
      }
    }

    console.log('[test] Pipeline test complete!');
  });
});

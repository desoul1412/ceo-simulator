import { test, expect } from '@playwright/test';
import { waitForAppReady, API_URL } from './helpers';

/**
 * VNSIR FULL PIPELINE TEST
 * Tests: Auth → Company creation → Repo connection → Skills install → CEO Planning → Agent Execution
 *
 * Run: npx playwright test e2e/11-vnsir-pipeline.spec.ts --headed
 */

test.setTimeout(60 * 60_000); // 1 hour max

const VNSIR_DIRECTIVE = `Build VNSIR.COM — a premium B2B market intelligence platform for foreign investors researching Vietnam.

Tech Stack: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Supabase (Auth + DB + Storage), Stripe payments.

Design: Minimalism, dark navy/white/charcoal, Serif+Sans-serif typography, no stock photos, data-driven visuals.

Pages to build (priority order):
1. Homepage — Hero section + Intelligence Hub (report grid with faceted search by sector)
2. Report Detail — Split-screen with Executive Summary, Slide Demo carousel, Table of Contents accordion, Stripe payment popup
3. Auth Flow — Passwordless (Magic Link/OTP via Resend), Google/LinkedIn SSO, onboarding (Job Title + Industry)
4. Client Portal — Intelligence Archive (purchased reports table), Custom Research Tracker, Billing History
5. The Analyst Brief — Intelligence Terminal layout, Micro-insight cards with Key Metrics, BLUF format
6. Custom Advisory — Split-screen intake form with lead qualification (block freemail domains)
7. About Us — Corporate Manifesto, Strategic Stealth model, no photos, typography-only
8. Legal Center — Terms, Privacy (GDPR), IP Policy, Payment/Refund, sticky sidebar nav

Key requirements:
- Stripe integration for report purchases ($500-3000 USD range)
- Dynamic PDF watermarking on download (buyer email + timestamp)
- RBAC with Whitelist Toggle for stealth content categories
- Zero-Knowledge UI (server-side filtering, never CSS display:none)
- Sticky CTAs on Report Detail and Analyst Brief pages
- Corporate email validation (block @gmail, @yahoo in advisory form)
- Resend for transactional emails (Magic Link, purchase confirmation)`;

test.describe('VNSIR Full Pipeline', () => {

  test('Phase 1: Setup — login and navigate to company', async ({ page }) => {
    await waitForAppReady(page);
    console.log('[vnsir] Logged in, on dashboard');

    // Check if VNSIR company already exists
    const bodyText = await page.textContent('body');
    if (bodyText?.includes('VNSIR') || bodyText?.includes('CEO Simulator')) {
      // Use existing company
      const companyCard = page.locator('text=/VNSIR|CEO Simulator/i').first();
      await companyCard.click();
      await page.waitForURL(/company\//, { timeout: 10_000 }).catch(() => {});
      console.log('[vnsir] Using existing company');
    } else {
      console.log('[vnsir] No company found — you need to create one manually first');
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/vnsir-setup.png' });
    console.log('[vnsir] Phase 1 complete');
  });

  test('Phase 2: Submit directive and wait for planning', async ({ page }) => {
    await waitForAppReady(page);

    // Navigate to company
    const companyCard = page.locator('text=/VNSIR|CEO Simulator/i').first();
    if (await companyCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await companyCard.click();
      await page.waitForURL(/company\//, { timeout: 10_000 }).catch(() => {});
    }
    await page.waitForTimeout(2000);

    // Find directive textarea
    let goalInput = page.locator('textarea').first();
    if (!await goalInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      goalInput = page.locator('input[type="text"]').first();
    }
    await expect(goalInput).toBeVisible({ timeout: 10_000 });

    // Fill directive
    await goalInput.fill(VNSIR_DIRECTIVE);
    console.log('[vnsir] Directive entered');

    // Select Large size
    const largeBtn = page.locator('button', { hasText: /^\s*L\s*$/i }).first();
    if (await largeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await largeBtn.click();
      console.log('[vnsir] Selected Large project size');
    }

    // Click Plan
    const planBtn = page.locator('button', { hasText: /Plan|Execute/i }).first();
    await expect(planBtn).toBeVisible({ timeout: 5000 });
    await planBtn.click();
    console.log('[vnsir] Plan button clicked');

    // Wait for planning popup
    const popup = page.locator('text=CEO PLANNING TERMINAL');
    await expect(popup).toBeVisible({ timeout: 15_000 });
    console.log('[vnsir] Planning popup opened — waiting for completion...');

    // Poll for planning to finish (up to 50 min for Large)
    const maxWaitMs = 50 * 60_000;
    const startTime = Date.now();
    let planDone = false;

    while (Date.now() - startTime < maxWaitMs) {
      const bodyText = await page.textContent('body');
      if (bodyText?.includes('Approve') || bodyText?.includes('READY')) {
        planDone = true;
        break;
      }
      const phaseMatch = bodyText?.match(/(\d+\/\d+):?\s*(\w+)/);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (phaseMatch && elapsed % 30 === 0) {
        console.log(`[vnsir] Planning: phase ${phaseMatch[1]} ${phaseMatch[2]} (${elapsed}s)`);
      }
      await page.waitForTimeout(5000);
    }

    expect(planDone).toBeTruthy();
    console.log('[vnsir] Planning completed!');
    await page.screenshot({ path: 'e2e/screenshots/vnsir-plan.png' });

    // Check overview content
    const overviewTab = page.locator('text=OVERVIEW').first();
    await overviewTab.click();
    await page.waitForTimeout(500);
    const content = await page.locator('[style*="overflow: auto"]').last().textContent();
    console.log(`[vnsir] Overview: ${content!.length} chars`);
    expect(content!.length).toBeGreaterThan(100);

    // Approve & Execute
    const approveBtn = page.locator('button', { hasText: /Approve.*Execute|Approve/i }).first();
    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      console.log('[vnsir] Approved & Executing');
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: 'e2e/screenshots/vnsir-approved.png' });

    // Close popup
    const closeBtn = page.locator('button').filter({ hasText: /X/ }).first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
    }

    // Navigate to board
    const url = page.url();
    const match = url.match(/company\/([^/]+)/);
    if (match) {
      await page.goto(`/company/${match[1]}/board`);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/screenshots/vnsir-board.png' });
      const boardText = await page.textContent('body');
      console.log(`[vnsir] Board loaded — tickets visible: ${boardText?.includes('approved') || boardText?.includes('todo')}`);
    }

    console.log('[vnsir] Phase 2 complete');
  });

  test('Phase 3: Monitor agents working', async ({ page }) => {
    await waitForAppReady(page);

    // Navigate to company
    const companyCard = page.locator('text=/VNSIR|CEO Simulator/i').first();
    if (await companyCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await companyCard.click();
      await page.waitForURL(/company\//, { timeout: 10_000 }).catch(() => {});
    }
    await page.waitForTimeout(2000);

    const url = page.url();
    const match = url.match(/company\/([^/]+)/);
    if (!match) return;
    const companyId = match[1];

    console.log(`[vnsir] Monitoring company ${companyId}`);

    let iteration = 0;
    const startTime = Date.now();
    let lastCompleted = 0;

    while (true) {
      iteration++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      // Check ticket status
      try {
        const statusRes = await page.request.get(`${API_URL}/api/ticket-status/${companyId}`);
        if (statusRes.ok()) {
          const status = await statusRes.json();
          const completed = status.completed ?? 0;
          const total = Object.values(status).reduce((a: number, b: any) => a + (Number(b) || 0), 0);

          if (completed !== lastCompleted) {
            console.log(`[vnsir] Progress: ${JSON.stringify(status)} (${elapsed}s)`);
            lastCompleted = completed;
            await page.screenshot({ path: `e2e/screenshots/vnsir-progress-${completed}.png` });
          }

          // Check if all done
          const pending = (status.approved ?? 0) + (status.in_progress ?? 0) + (status.open ?? 0) + (status.awaiting_approval ?? 0);
          if (pending === 0 && completed > 0 && iteration > 5) {
            console.log(`[vnsir] All tickets processed! ${completed} completed, ${status.failed ?? 0} failed`);
            break;
          }
        }
      } catch { /* */ }

      // Timeout after 2 hours
      if (elapsed > 7200) {
        console.log('[vnsir] 2-hour timeout reached');
        break;
      }

      await page.waitForTimeout(30_000);
    }

    await page.screenshot({ path: 'e2e/screenshots/vnsir-final.png' });
    console.log('[vnsir] Phase 3 complete');
  });
});

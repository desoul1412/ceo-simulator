import { test, expect } from '@playwright/test';
import { waitForAppReady, API_URL } from './helpers';

/**
 * VNSIR on Omniverse repo — Full pipeline with proper repo connection
 * Run: npx playwright test e2e/12-vnsir-omniverse.spec.ts --headed
 */

test.setTimeout(60 * 60_000); // 1 hour

const VNSIR_DIRECTIVE = `Build VNSIR.COM — a premium B2B market intelligence platform for foreign investors researching Vietnam.

Tech Stack: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Supabase (Auth + DB + Storage), Stripe payments, Resend for emails.

Design: Minimalism, dark navy (#0a0a2e)/white/charcoal, Serif+Sans-serif typography, no stock photos, data-driven visuals.

Pages to build (priority order):
1. Homepage — Hero "Decoding Vietnam's Shadow Market" + Intelligence Hub (report grid with faceted search by sector: E-Commerce, Gaming, Entertainment, Macro Economy)
2. Report Detail — Split-screen: Executive Summary + Slide Demo carousel (6 images, fullscreen, watermark, disable right-click) + Table of Contents accordion + Stripe payment popup
3. Auth Flow — Passwordless (Magic Link via Resend), Google/LinkedIn SSO, onboarding (Job Title + Industry dropdown)
4. Client Portal — Intelligence Archive (purchased reports data table), Custom Research Tracker with milestone timeline, Billing History, Profile Settings
5. The Analyst Brief — Intelligence Terminal layout (not blog), Micro-insight cards with Key Metrics (+22%, $1.5B), BLUF format, Sticky subscription bar
6. Custom Advisory — Split-screen: left=process description, right=sticky intake form with freemail blocking (regex reject @gmail, @yahoo)
7. About Us — Corporate Manifesto, Strategic Stealth model, typography-only, zero images, all-caps H1
8. Legal Center — Terms, Privacy (GDPR cookie consent), IP Policy (dynamic PDF watermarking), Payment/Refund, sticky sidebar nav

Key requirements:
- Stripe Elements for on-page checkout (no redirect), Payment popup with dark overlay
- Dynamic PDF watermarking on download (buyer email + timestamp via pdf-lib)
- RBAC with Whitelist Toggle for stealth content categories (Zero-Knowledge UI — server-side filtering only)
- Sticky CTAs: bottom bar on Report Detail, subscription bar on Analyst Brief
- Corporate email validation in Custom Advisory form
- Resend for Magic Link auth + purchase confirmation emails
- Supabase RLS for multi-tenant data isolation`;

test('VNSIR Omniverse: directive → plan → approve → agents', async ({ page }) => {
  await waitForAppReady(page);

  // Navigate to VNSIR company
  const vnsirCard = page.locator('text=VNSIR').first();
  await expect(vnsirCard).toBeVisible({ timeout: 10_000 });
  await vnsirCard.click();
  await page.waitForURL(/company\//, { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('[vnsir-omni] Navigated to VNSIR company:', page.url());

  // Enter directive
  let goalInput = page.locator('textarea').first();
  if (!await goalInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    goalInput = page.locator('input[type="text"]').first();
  }
  await expect(goalInput).toBeVisible({ timeout: 10_000 });
  await goalInput.fill(VNSIR_DIRECTIVE);
  console.log('[vnsir-omni] Directive entered');

  // Select Large
  const largeBtn = page.locator('button', { hasText: /^\s*L\s*$/i }).first();
  if (await largeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await largeBtn.click();
  }

  // Click Plan
  const planBtn = page.locator('button', { hasText: /Plan|Execute/i }).first();
  await planBtn.click();
  console.log('[vnsir-omni] Plan clicked');

  // Wait for planning popup
  const popup = page.locator('text=CEO PLANNING TERMINAL');
  await expect(popup).toBeVisible({ timeout: 15_000 });
  console.log('[vnsir-omni] Planning started...');

  // Poll for completion (up to 50 min)
  const maxWaitMs = 50 * 60_000;
  const startTime = Date.now();
  let planDone = false;

  while (Date.now() - startTime < maxWaitMs) {
    const bodyText = await page.textContent('body');
    if (bodyText?.includes('Approve') || bodyText?.includes('READY')) {
      planDone = true;
      break;
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed % 60 === 0) {
      console.log(`[vnsir-omni] Planning... ${elapsed}s`);
    }
    await page.waitForTimeout(5000);
  }

  expect(planDone).toBeTruthy();
  console.log('[vnsir-omni] Planning completed!');
  await page.screenshot({ path: 'e2e/screenshots/vnsir-omni-plan.png' });

  // Approve
  const approveBtn = page.locator('button', { hasText: /Approve.*Execute|Approve/i }).first();
  if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await approveBtn.click();
    console.log('[vnsir-omni] Approved!');
    await page.waitForTimeout(3000);
  }

  // Close popup
  const closeBtn = page.locator('button').filter({ hasText: /X/ }).first();
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
  }

  // Get company ID from URL and approve all tickets
  const url = page.url();
  const match = url.match(/company\/([^/]+)/);
  if (match) {
    const companyId = match[1];

    // Wait a moment for tickets to be created
    await page.waitForTimeout(5000);

    // Auto-approve all awaiting tickets
    const ticketsRes = await page.request.get(`${API_URL}/api/tickets/${companyId}`);
    if (ticketsRes.ok()) {
      const tickets = await ticketsRes.json();
      const awaiting = tickets.filter((t: any) => t.status === 'awaiting_approval');
      console.log(`[vnsir-omni] ${awaiting.length} tickets to approve`);

      for (const t of awaiting) {
        await page.request.post(`${API_URL}/api/approve/${t.id}`, {
          data: { approvedBy: 'CEO (auto)' },
        }).catch(() => {});
      }
      console.log('[vnsir-omni] All tickets approved!');
    }

    // Navigate to board
    await page.goto(`/company/${companyId}/board`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/vnsir-omni-board.png' });

    // Monitor agents (poll every 60s for up to 2 hours)
    console.log('[vnsir-omni] Monitoring agents...');
    let lastCompleted = 0;

    for (let i = 0; i < 120; i++) {
      const statusRes = await page.request.get(`${API_URL}/api/ticket-status/${companyId}`);
      if (statusRes.ok()) {
        const status = await statusRes.json();
        const completed = status.completed ?? 0;
        const pending = (status.approved ?? 0) + (status.in_progress ?? 0);

        if (completed !== lastCompleted) {
          console.log(`[vnsir-omni] ${JSON.stringify(status)}`);
          lastCompleted = completed;
        }

        if (pending === 0 && completed > 0) {
          console.log(`[vnsir-omni] ALL DONE! ${completed} completed, ${status.failed ?? 0} failed`);
          await page.screenshot({ path: 'e2e/screenshots/vnsir-omni-final.png' });
          break;
        }
      }
      await page.waitForTimeout(60_000);
    }
  }

  console.log('[vnsir-omni] Pipeline test complete');
});

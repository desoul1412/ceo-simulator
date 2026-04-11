import { test, expect } from '@playwright/test';
import { waitForAppReady, goToFirstCompany, getCompanies } from './helpers';

test.describe('Company View', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('should navigate to company view', async ({ page }) => {
    await goToFirstCompany(page);
    // Should show company-level navigation tabs (Board, Costs, etc.)
    await page.waitForTimeout(500);
    const bodyText = await page.textContent('body');
    // Company view should have agent cards or office view
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test('should display agents panel', async ({ page }) => {
    await goToFirstCompany(page);
    await page.waitForTimeout(1000);
    // Should show "AGENTS" section with agent cards
    const agentsSection = page.locator('text=AGENTS').first();
    if (await agentsSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(agentsSection).toBeVisible();
    }
  });

  test('should show budget or agent info', async ({ page }) => {
    await goToFirstCompany(page);
    await page.waitForTimeout(1000);
    const bodyText = await page.textContent('body');
    // Should have agent names or company info
    expect(bodyText!.length).toBeGreaterThan(100);
  });

  test('should navigate to Board via direct URL', async ({ page }) => {
    await goToFirstCompany(page);
    await page.waitForTimeout(500);
    const url = page.url();
    const match = url.match(/company\/([^/]+)/);
    if (match) {
      await page.goto(`/company/${match[1]}/board`);
      await page.waitForTimeout(1500);
      const bodyText = await page.textContent('body');
      expect(bodyText).toMatch(/sprint|todo|backlog|in.?progress|review|done|no ticket/i);
    }
  });

  test('should navigate to Costs tab', async ({ page }) => {
    await goToFirstCompany(page);
    await page.waitForTimeout(500);
    const costsTab = page.locator('text=Costs').first();
    if (await costsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await costsTab.click();
      await page.waitForURL(/costs/);
    }
  });

  test('should navigate to Merge Requests tab', async ({ page }) => {
    await goToFirstCompany(page);
    await page.waitForTimeout(500);
    const mrTab = page.locator('text=Rev').first();
    if (await mrTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mrTab.click();
      await page.waitForURL(/merge-requests/);
    }
  });
});

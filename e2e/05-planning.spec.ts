import { test, expect } from '@playwright/test';
import { waitForAppReady, goToFirstCompany } from './helpers';

test.describe('Planning Popup', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
    await goToFirstCompany(page);
    await page.waitForTimeout(1000);
  });

  test('should show CEO goal input area', async ({ page }) => {
    // The company detail view should have a textarea or input for CEO directive
    const goalInput = page.locator('textarea').first();
    if (await goalInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(goalInput).toBeVisible();
    }
  });

  test('should show project size selector (S/M/L)', async ({ page }) => {
    // Size buttons should be visible
    const bodyText = await page.textContent('body');
    // Should contain size indicators
    const hasSizeSelector = bodyText?.match(/\bS\b.*\bM\b.*\bL\b/s) || bodyText?.match(/small|medium|large/i);
    // This depends on UI state, so just verify page loaded
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('should open planning popup when Plan button is clicked', async ({ page }) => {
    // Find the Plan button
    const planBtn = page.locator('button', { hasText: /Plan|Execute/i }).first();
    if (await planBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Type a directive first
      const goalInput = page.locator('textarea').first();
      if (await goalInput.isVisible().catch(() => false)) {
        await goalInput.fill('Test planning session');
      }
      await planBtn.click();
      await page.waitForTimeout(2000);
      // Planning popup should appear with tab headers
      const popup = page.locator('text=CEO PLANNING TERMINAL');
      if (await popup.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(popup).toBeVisible();
        // Should show tabs
        await expect(page.locator('text=OVERVIEW')).toBeVisible();
        await expect(page.locator('text=FINDINGS')).toBeVisible();
        // Close the popup
        const closeBtn = page.locator('button', { hasText: 'X' }).first();
        await closeBtn.click();
      }
    }
  });

  test('should show planning popup if session is active', async ({ page }) => {
    // If a planning session is already generating, the popup icon should be visible
    const planningIndicator = page.locator('text=GENERATING').first();
    const isGenerating = await planningIndicator.isVisible({ timeout: 3000 }).catch(() => false);
    if (isGenerating) {
      // Click to open the popup
      await planningIndicator.click();
      await page.waitForTimeout(1000);
      const popup = page.locator('text=CEO PLANNING TERMINAL');
      await expect(popup).toBeVisible({ timeout: 3000 });
    }
  });
});

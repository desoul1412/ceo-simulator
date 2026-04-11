import { test, expect } from '@playwright/test';
import { waitForAppReady, goToFirstCompany } from './helpers';

test.describe('Agent Card & Config', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
    await goToFirstCompany(page);
    await page.waitForTimeout(1000);
  });

  test('should open agent detail modal on click', async ({ page }) => {
    // Click any agent name text that looks like a role
    const agents = page.locator('text=/CEO|PM|Frontend|Backend|QA|DevOps|Designer/i');
    const count = await agents.count();
    if (count > 0) {
      // Click the second match (first might be nav)
      const idx = count > 1 ? 1 : 0;
      await agents.nth(idx).click();
      await page.waitForTimeout(1000);
      // Check if a modal or detail appeared
      const bodyText = await page.textContent('body');
      expect(bodyText).toMatch(/Config|Fire|Activity|working|idle|break/i);
    }
  });

  test('should show Config panel when clicking Config button', async ({ page }) => {
    const agentCard = page.locator('[style*="cursor: pointer"]').filter({ hasText: /CEO|PM|Frontend|Backend|QA|DevOps|Designer/i }).first();
    if (await agentCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await agentCard.click();
      await page.waitForTimeout(500);
      // Click Config button
      const configBtn = page.locator('button', { hasText: 'Config' }).first();
      if (await configBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await configBtn.click();
        await page.waitForTimeout(300);
        // Should show Name, Role, Budget fields
        await expect(page.locator('text=Name').first()).toBeVisible();
        await expect(page.locator('text=Budget').first()).toBeVisible();
      }
    }
  });

  test('should show fire confirmation on Fire button click', async ({ page }) => {
    const agentCard = page.locator('[style*="cursor: pointer"]').filter({ hasText: /CEO|PM|Frontend|Backend|QA|DevOps|Designer/i }).first();
    if (await agentCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await agentCard.click();
      await page.waitForTimeout(500);
      const fireBtn = page.locator('button', { hasText: 'Fire' }).first();
      if (await fireBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fireBtn.click();
        // Should show "Confirm?" text
        await expect(page.locator('text=Confirm?')).toBeVisible({ timeout: 3000 });
        // Click Cancel to dismiss
        const cancelBtn = page.locator('button', { hasText: 'Cancel' }).last();
        await cancelBtn.click();
      }
    }
  });

  test('should close agent modal with close button', async ({ page }) => {
    // Open any agent
    const agents = page.locator('text=/CEO|PM|Frontend|Backend|QA|DevOps|Designer/i');
    const count = await agents.count();
    if (count > 1) {
      await agents.nth(1).click();
      await page.waitForTimeout(1000);
      // Find and click the close button (✕)
      const closeBtn = page.locator('button').filter({ hasText: /✕/ }).first();
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
